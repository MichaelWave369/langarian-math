import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROMOTION_AUTHORITY_POLICY,
  emptyAuthorityBundle,
  generateLocalAuthority,
  issuePromotionMandate,
  signRollbackBallot,
  type PromotionAssessmentReceipt,
  type PromotionAuthorityProfile,
} from '../../src/theory/authority.js'
import { BUNDLED_THEORY_PACKAGES, type TheoryPackage } from '../../src/theory/packages.js'
import { createSignedPromotionDecision } from '../../src/theory/signedDecision.js'
import {
  DEFAULT_PACKAGE_RELEASE_POLICY,
  applyPackagePatch,
  buildControlledPackageReleaseProfile,
  createPackageReleaseBundle,
  createPackageReleaseProposal,
  createSignedPackageReleaseReceipt,
  verifySignedPackageReleaseReceipt,
  type PackagePatchOperation,
} from '../../src/theory/release.js'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function sourcePackage(): TheoryPackage {
  const value = clone(BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex')!)
  value.theory.version = '1.0.0'
  value.maturity_level = 3
  delete value.metadata.release_governance
  return value
}

function assessmentFor(theoryPackage: TheoryPackage): PromotionAssessmentReceipt {
  return {
    schema_version: 'promotion-assessment:v0.1',
    assessment_id: 'assessment:synthetic-release-eligible',
    assessment_type: 'eligibility-review-not-package-mutation',
    package: { id: theoryPackage.theory.id, version: theoryPackage.theory.version, current_maturity_level: theoryPackage.maturity_level, target_level: 4 },
    policy: { id: 'synthetic', version: '1.0.0', schema_version: 'promotion-policy:v0.1' },
    evidence: { suite_locator: 'synthetic', suite_digest: `sha256:${'1'.repeat(64)}`, admissible_evidence_ids: ['evidence:synthetic'], distinct_signer_ids: ['signer:synthetic'] },
    conformance: { suite_schema_version: 'contract-conformance-suite:v0.1', promotion_eligible: true, operator_count: theoryPackage.operators.length, blockers: [] },
    custody: { bundle_valid: true, custody_ready: true, admissible_evidence_count: 1, lifecycle_issue_count: 0 },
    status: 'ELIGIBLE_FOR_REVIEW',
    blockers: [],
    warnings: [],
    issued_at_utc: '2026-07-24T00:00:00.000Z',
    claims_supported: ['Synthetic eligible assessment for release-governance tests.'],
    prohibited_inferences: ['No automatic package mutation.'],
  }
}

function authorityProfile(theoryPackage: TheoryPackage, status: PromotionAuthorityProfile['status'] = 'APPROVED_PENDING_PACKAGE_UPDATE'): PromotionAuthorityProfile {
  const accepted = (ballotId: string, authorityId: string, mandateId: string, role: string, domain: string) => ({
    ballot_id: ballotId,
    authority_id: authorityId,
    mandate_id: mandateId,
    disposition: 'APPROVE' as const,
    signature_valid: true,
    assessment_binding_valid: true,
    mandate_valid: true,
    authority_active: true,
    accepted: true,
    independence_domains: [domain],
    role,
    issues: [],
  })
  const approvals = [
    accepted('ballot:math', 'authority:math-reviewer', 'mandate:math', 'mathematical-review', 'mathematical-analysis'),
    accepted('ballot:implementation', 'authority:implementation-auditor', 'mandate:implementation', 'implementation-audit', 'runtime-conformance'),
  ]
  return {
    policy: DEFAULT_PROMOTION_AUTHORITY_POLICY,
    assessment_id: assessmentFor(theoryPackage).assessment_id,
    package_id: theoryPackage.theory.id,
    package_version: theoryPackage.theory.version,
    assessment_eligible: status === 'APPROVED_PENDING_PACKAGE_UPDATE',
    mandates: [],
    ballots: approvals,
    accepted_approvals: approvals,
    accepted_rejections: [],
    distinct_approval_authorities: approvals.map((item) => item.authority_id),
    distinct_independence_domains: approvals.flatMap((item) => item.independence_domains),
    covered_roles: approvals.map((item) => item.role!),
    quorum_satisfied: status === 'APPROVED_PENDING_PACKAGE_UPDATE',
    blockers: status === 'APPROVED_PENDING_PACKAGE_UPDATE' ? [] : ['Prerequisite assessment is blocked.'],
    warnings: [],
    status,
  }
}

async function approvedDecision(theoryPackage: TheoryPackage) {
  const recorder = await generateLocalAuthority(
    'Decision recorder',
    ['decision-recorder'],
    ['governance-records'],
    ['record:promotion-decision'],
    '2026-07-24T00:00:00.000Z',
  )
  const decision = await createSignedPromotionDecision(authorityProfile(theoryPackage), theoryPackage.maturity_level, recorder, '2026-07-24T00:00:00.000Z')
  return { recorder, decision }
}

async function releaseAuthority(scope = 'release:package-mutation') {
  return generateLocalAuthority(
    'Independent release custodian',
    ['release-custodian'],
    ['release-operations'],
    [scope],
    '2026-07-24T00:00:00.000Z',
  )
}

describe('controlled package mutation and release governance', () => {
  it('authorizes an exact promotion artifact without committing the repository', async () => {
    const before = sourcePackage()
    const { recorder, decision } = await approvedDecision(before)
    const releaser = await releaseAuthority()
    const authorityBundle = { ...emptyAuthorityBundle(), authorities: [recorder.identity, releaser.identity], metadata: { planning_artifact: false } }
    const { proposal, after } = await createPackageReleaseProposal(before, decision, 'PROMOTION', '1.1.0', releaser, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:10:00.000Z')
    const profile = await buildControlledPackageReleaseProfile(before, decision, authorityBundle, proposal, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:20:00.000Z')

    expect(profile.status).toBe('AUTHORIZED_NOT_COMMITTED')
    expect(profile.decision_gate_open).toBe(true)
    expect(profile.proposal_verification.accepted).toBe(true)
    expect(after.theory.version).toBe('1.1.0')
    expect(after.maturity_level).toBe(4)
    expect(before.theory.version).toBe('1.0.0')
    expect(before.maturity_level).toBe(3)

    const receipt = await createSignedPackageReleaseReceipt(before, profile, proposal, releaser, '2026-07-24T00:21:00.000Z')
    expect(receipt.status).toBe('AUTHORIZED_NOT_COMMITTED')
    expect(receipt.repository_commit_status).toBe('NOT_COMMITTED')
    const bundle = createPackageReleaseBundle(before, after, proposal, receipt)
    const verification = await verifySignedPackageReleaseReceipt(bundle, authorityBundle.authorities)
    expect(verification.accepted).toBe(true)
  })

  it('cannot release a blocked authority decision even with valid release custody', async () => {
    const before = sourcePackage()
    const recorder = await generateLocalAuthority('Recorder', ['decision-recorder'], ['governance-records'], ['record:promotion-decision'], '2026-07-24T00:00:00.000Z')
    const decision = await createSignedPromotionDecision(authorityProfile(before, 'BLOCKED'), before.maturity_level, recorder, '2026-07-24T00:00:00.000Z')
    const releaser = await releaseAuthority()
    const authorityBundle = { ...emptyAuthorityBundle(), authorities: [recorder.identity, releaser.identity], metadata: { planning_artifact: false } }
    const { proposal } = await createPackageReleaseProposal(before, decision, 'PROMOTION', '1.1.0', releaser, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:10:00.000Z')
    const profile = await buildControlledPackageReleaseProfile(before, decision, authorityBundle, proposal, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:20:00.000Z')

    expect(profile.status).toBe('BLOCKED')
    expect(profile.decision_gate_open).toBe(false)
    expect(profile.proposal_verification.accepted).toBe(true)
  })

  it('rejects a release authority that also recorded the governance decision', async () => {
    const before = sourcePackage()
    const combined = await generateLocalAuthority(
      'Combined authority',
      ['decision-recorder', 'release-custodian'],
      ['governance-records', 'release-operations'],
      ['record:promotion-decision', 'release:package-mutation'],
      '2026-07-24T00:00:00.000Z',
    )
    const decision = await createSignedPromotionDecision(authorityProfile(before), before.maturity_level, combined, '2026-07-24T00:00:00.000Z')
    const authorityBundle = { ...emptyAuthorityBundle(), authorities: [combined.identity], metadata: { planning_artifact: false } }
    const { proposal } = await createPackageReleaseProposal(before, decision, 'PROMOTION', '1.1.0', combined, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:10:00.000Z')
    const profile = await buildControlledPackageReleaseProfile(before, decision, authorityBundle, proposal, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:20:00.000Z')

    expect(profile.status).toBe('BLOCKED')
    expect(profile.proposal_verification.authority_separation_valid).toBe(false)
  })

  it('rejects stale before manifests and unauthorized patch paths', async () => {
    const before = sourcePackage()
    const { recorder, decision } = await approvedDecision(before)
    const releaser = await releaseAuthority()
    const authorityBundle = { ...emptyAuthorityBundle(), authorities: [recorder.identity, releaser.identity], metadata: { planning_artifact: false } }
    const created = await createPackageReleaseProposal(before, decision, 'PROMOTION', '1.1.0', releaser, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:10:00.000Z')

    const stale = clone(before)
    stale.theory.summary = `${stale.theory.summary} changed after signing`
    const staleProfile = await buildControlledPackageReleaseProfile(stale, decision, authorityBundle, created.proposal, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:20:00.000Z')
    expect(staleProfile.status).toBe('BLOCKED')
    expect(staleProfile.proposal_verification.before_hash_valid).toBe(false)

    const unsafePatch = clone(created.proposal)
    unsafePatch.patch = [{ op: 'replace', path: '/theory/name', value: 'Tampered' } as unknown as PackagePatchOperation]
    const unsafeProfile = await buildControlledPackageReleaseProfile(before, decision, authorityBundle, unsafePatch, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:20:00.000Z')
    expect(unsafeProfile.status).toBe('BLOCKED')
    expect(unsafeProfile.proposal_verification.patch_valid).toBe(false)
  })

  it('authorizes rollback only after independent signed rollback quorum', async () => {
    const source = sourcePackage()
    const assessment = assessmentFor(source)
    const { recorder, decision } = await approvedDecision(source)
    const promotionReleaser = await releaseAuthority()
    const promotionCreated = await createPackageReleaseProposal(source, decision, 'PROMOTION', '1.1.0', promotionReleaser, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:10:00.000Z')
    const promoted = promotionCreated.after

    const issuer = await generateLocalAuthority('Rollback mandate issuer', ['mandate-issuer'], ['governance-office'], ['issue:promotion-mandate'], '2026-07-24T00:00:00.000Z')
    const math = await generateLocalAuthority('Rollback math reviewer', ['mathematical-review'], ['mathematical-analysis'], ['rollback:promotion-decision'], '2026-07-24T00:00:00.000Z')
    const implementation = await generateLocalAuthority('Rollback implementation auditor', ['implementation-audit'], ['runtime-conformance'], ['rollback:promotion-decision'], '2026-07-24T00:00:00.000Z')
    const common = { valid_from_utc: '2026-07-24T00:00:00.000Z', expires_at_utc: '2026-08-24T00:00:00.000Z', issued_at_utc: '2026-07-24T00:00:00.000Z' }
    const mathMandate = await issuePromotionMandate(issuer, math.identity.id, 'mathematical-review', assessment, ['rollback:promotion-decision'], common)
    const implementationMandate = await issuePromotionMandate(issuer, implementation.identity.id, 'implementation-audit', assessment, ['rollback:promotion-decision'], common)
    const mathBallot = await signRollbackBallot(math, decision, mathMandate, 'Rollback exact authorized release.', { issued_at_utc: '2026-07-24T00:30:00.000Z' })
    const implementationBallot = await signRollbackBallot(implementation, decision, implementationMandate, 'Rollback exact authorized release.', { issued_at_utc: '2026-07-24T00:30:00.000Z' })
    const rollbackReleaser = await releaseAuthority('release:package-rollback')
    const authorityBundle = {
      ...emptyAuthorityBundle(),
      authorities: [recorder.identity, issuer.identity, math.identity, implementation.identity, rollbackReleaser.identity],
      mandates: [mathMandate, implementationMandate],
      rollback_ballots: [mathBallot, implementationBallot],
      metadata: { planning_artifact: false },
    }
    const { proposal, after } = await createPackageReleaseProposal(promoted, decision, 'ROLLBACK', '1.2.0', rollbackReleaser, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:40:00.000Z')
    const profile = await buildControlledPackageReleaseProfile(promoted, decision, authorityBundle, proposal, DEFAULT_PACKAGE_RELEASE_POLICY, '2026-07-24T00:50:00.000Z')

    expect(profile.status).toBe('AUTHORIZED_NOT_COMMITTED')
    expect(after.maturity_level).toBe(3)
    expect(after.theory.version).toBe('1.2.0')
  })

  it('does not mutate the source object while materializing a patch', () => {
    const before = sourcePackage()
    const patch: PackagePatchOperation[] = [
      { op: 'replace', path: '/theory/version', value: '1.1.0' },
      { op: 'replace', path: '/maturity_level', value: 4 },
      { op: 'add', path: '/metadata/release_governance', value: { authority_decision_id: 'authority-decision:test' } },
    ]
    const after = applyPackagePatch(before, patch)
    expect(after).not.toBe(before)
    expect(before.theory.version).toBe('1.0.0')
    expect(after.theory.version).toBe('1.1.0')
  })
})
