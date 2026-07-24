import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROMOTION_AUTHORITY_POLICY,
  emptyAuthorityBundle,
  generateLocalAuthority,
  type PromotionAuthorityProfile,
} from '../../src/theory/authority.js'
import { BUNDLED_THEORY_PACKAGES, type TheoryPackage } from '../../src/theory/packages.js'
import { createSignedPromotionDecision } from '../../src/theory/signedDecision.js'
import {
  DEFAULT_PACKAGE_RELEASE_POLICY,
  buildControlledPackageReleaseProfile,
  createPackageReleaseProposal,
  createSignedPackageReleaseReceipt,
} from '../../src/theory/release.js'
import {
  createPackageReleaseArchive,
  parsePackageReleaseArchiveJson,
  verifyPackageReleaseArchive,
} from '../../src/theory/releaseArchive.js'

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

function approvedProfile(theoryPackage: TheoryPackage): PromotionAuthorityProfile {
  const approvals = [
    {
      ballot_id: 'ballot:math', authority_id: 'authority:math', mandate_id: 'mandate:math', disposition: 'APPROVE' as const,
      signature_valid: true, assessment_binding_valid: true, mandate_valid: true, authority_active: true, accepted: true,
      independence_domains: ['mathematical-analysis'], role: 'mathematical-review', issues: [],
    },
    {
      ballot_id: 'ballot:implementation', authority_id: 'authority:implementation', mandate_id: 'mandate:implementation', disposition: 'APPROVE' as const,
      signature_valid: true, assessment_binding_valid: true, mandate_valid: true, authority_active: true, accepted: true,
      independence_domains: ['runtime-conformance'], role: 'implementation-audit', issues: [],
    },
  ]
  return {
    policy: DEFAULT_PROMOTION_AUTHORITY_POLICY,
    assessment_id: 'assessment:release-archive-proof',
    package_id: theoryPackage.theory.id,
    package_version: theoryPackage.theory.version,
    assessment_eligible: true,
    mandates: [],
    ballots: approvals,
    accepted_approvals: approvals,
    accepted_rejections: [],
    distinct_approval_authorities: approvals.map((item) => item.authority_id),
    distinct_independence_domains: approvals.flatMap((item) => item.independence_domains),
    covered_roles: approvals.map((item) => item.role),
    quorum_satisfied: true,
    blockers: [],
    warnings: [],
    status: 'APPROVED_PENDING_PACKAGE_UPDATE',
  }
}

async function authorizedArchive() {
  const before = sourcePackage()
  const recorder = await generateLocalAuthority(
    'Decision recorder',
    ['decision-recorder'],
    ['governance-records'],
    ['record:promotion-decision'],
    '2026-07-24T00:00:00.000Z',
  )
  const releaser = await generateLocalAuthority(
    'Independent release custodian',
    ['release-custodian'],
    ['release-operations'],
    ['release:package-mutation'],
    '2026-07-24T00:00:00.000Z',
  )
  const decision = await createSignedPromotionDecision(approvedProfile(before), before.maturity_level, recorder, '2026-07-24T00:00:00.000Z')
  const authorityBundle = {
    ...emptyAuthorityBundle(),
    authorities: [recorder.identity, releaser.identity],
    metadata: { planning_artifact: false },
  }
  const { proposal, after } = await createPackageReleaseProposal(
    before,
    decision,
    'PROMOTION',
    '1.1.0',
    releaser,
    DEFAULT_PACKAGE_RELEASE_POLICY,
    '2026-07-24T00:10:00.000Z',
  )
  const profile = await buildControlledPackageReleaseProfile(
    before,
    decision,
    authorityBundle,
    proposal,
    DEFAULT_PACKAGE_RELEASE_POLICY,
    '2026-07-24T00:20:00.000Z',
  )
  const receipt = await createSignedPackageReleaseReceipt(before, profile, proposal, releaser, '2026-07-24T00:21:00.000Z')
  return createPackageReleaseArchive(before, after, proposal, receipt, decision, authorityBundle)
}

describe('portable controlled-release archive', () => {
  it('re-evaluates a self-contained authorized archive from public records only', async () => {
    const archive = await authorizedArchive()
    const parsed = parsePackageReleaseArchiveJson(JSON.stringify(archive))
    expect(parsed.issues).toEqual([])
    expect(parsed.archive).not.toBeNull()

    const verification = await verifyPackageReleaseArchive(
      parsed.archive!,
      DEFAULT_PACKAGE_RELEASE_POLICY,
      '2026-07-24T00:20:00.000Z',
    )
    expect(verification.structurally_valid).toBe(true)
    expect(verification.decision_binding_valid).toBe(true)
    expect(verification.release_profile_status).toBe('AUTHORIZED_NOT_COMMITTED')
    expect(verification.receipt_verification.accepted).toBe(true)
    expect(verification.accepted).toBe(true)
  })

  it('rejects target-manifest tampering after proposal and receipt signing', async () => {
    const archive = await authorizedArchive()
    archive.release_bundle.after_manifest.theory.summary = `${archive.release_bundle.after_manifest.theory.summary} tampered`

    const verification = await verifyPackageReleaseArchive(
      archive,
      DEFAULT_PACKAGE_RELEASE_POLICY,
      '2026-07-24T00:20:00.000Z',
    )
    expect(verification.receipt_verification.manifest_binding_valid).toBe(false)
    expect(verification.receipt_verification.accepted).toBe(false)
    expect(verification.accepted).toBe(false)
  })

  it('rejects an archive whose release receipt is detached from its signed proposal', async () => {
    const archive = await authorizedArchive()
    archive.release_bundle.receipt.proposal_id = 'release-proposal:detached'

    const verification = await verifyPackageReleaseArchive(
      archive,
      DEFAULT_PACKAGE_RELEASE_POLICY,
      '2026-07-24T00:20:00.000Z',
    )
    expect(verification.receipt_verification.proposal_binding_valid).toBe(false)
    expect(verification.receipt_verification.accepted).toBe(false)
    expect(verification.accepted).toBe(false)
  })
})
