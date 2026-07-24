import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  emptyAuthorityBundle,
  generateLocalAuthority,
  issuePromotionMandate,
  signRollbackBallot,
  type PromotionAuthorityProfile,
} from '../../src/theory/authority.js'
import { sha256EvidenceDigest } from '../../src/theory/custody.js'
import {
  buildGovernedRollbackProfile,
  createGovernedRollbackRequest,
  createIncidentRecord,
} from '../../src/theory/incidentRollback.js'
import { BUNDLED_THEORY_PACKAGES, type TheoryPackage } from '../../src/theory/packages.js'
import type { PromotionAssessmentReceipt } from '../../src/theory/promotion.js'
import { createSignedPromotionDecision } from '../../src/theory/signedDecision.js'

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
    accepted('ballot:math', 'authority:math', 'mandate:math', 'mathematical-review', 'mathematical-analysis'),
    accepted('ballot:implementation', 'authority:implementation', 'mandate:implementation', 'implementation-audit', 'runtime-conformance'),
  ]
  return {
    policy: {
      schema_version: 'promotion-authority-policy:v0.1',
      id: 'level4-independent-authority-quorum',
      version: '0.1.0',
      target_level: 4,
      minimum_approvals: 2,
      minimum_distinct_independence_domains: 2,
      required_roles: ['mathematical-review', 'implementation-audit'],
      require_no_reject_ballots: true,
      mandate_issuer_scope: 'issue:promotion-mandate',
      ballot_scope: 'vote:promotion-level4',
      appeal_scope: 'appeal:promotion-decision',
      rollback_scope: 'rollback:promotion-decision',
      minimum_rollback_approvals: 2,
      decision_validity_days: 180,
      metadata: {},
    },
    assessment_id: 'assessment:rollback-fixture',
    package_id: theoryPackage.theory.id,
    package_version: theoryPackage.theory.version,
    assessment_eligible: true,
    mandates: [],
    ballots: approvals,
    accepted_approvals: approvals,
    accepted_rejections: [],
    distinct_approval_authorities: approvals.map((item) => item.authority_id),
    distinct_independence_domains: approvals.flatMap((item) => item.independence_domains),
    covered_roles: approvals.map((item) => item.role!),
    quorum_satisfied: true,
    blockers: [],
    warnings: [],
    status: 'APPROVED_PENDING_PACKAGE_UPDATE',
  }
}

function assessment(theoryPackage: TheoryPackage): PromotionAssessmentReceipt {
  return {
    schema_version: 'promotion-assessment:v0.1',
    assessment_id: 'assessment:rollback-fixture',
    assessment_type: 'eligibility-review-not-package-mutation',
    package: { id: theoryPackage.theory.id, version: theoryPackage.theory.version, current_maturity_level: theoryPackage.maturity_level, target_level: 4 },
    policy: { id: 'synthetic', version: '0.1.0', schema_version: 'promotion-policy:v0.1' },
    evidence: { suite_locator: 'synthetic', suite_digest: `sha256:${'1'.repeat(64)}`, admissible_evidence_ids: [], distinct_signer_ids: [] },
    conformance: { suite_schema_version: 'contract-conformance-suite:v0.1', promotion_eligible: true, operator_count: 1, blockers: [] },
    custody: { bundle_valid: true, custody_ready: true, admissible_evidence_count: 1, lifecycle_issue_count: 0 },
    status: 'ELIGIBLE_FOR_REVIEW',
    blockers: [],
    warnings: [],
    issued_at_utc: '2026-07-24T00:00:00.000Z',
    claims_supported: [],
    prohibited_inferences: [],
  }
}

async function fixture() {
  const restore = sourcePackage()
  const recorder = await generateLocalAuthority('Decision recorder', ['decision-recorder'], ['governance-records'], ['record:promotion-decision'], '2026-07-24T00:00:00.000Z')
  const issuer = await generateLocalAuthority('Mandate issuer', ['mandate-issuer'], ['mandate-office'], ['issue:promotion-mandate'], '2026-07-24T00:00:00.000Z')
  const math = await generateLocalAuthority('Math rollback reviewer', ['mathematical-review'], ['mathematical-analysis'], ['rollback:promotion-decision'], '2026-07-24T00:00:00.000Z')
  const implementation = await generateLocalAuthority('Implementation rollback reviewer', ['implementation-audit'], ['runtime-conformance'], ['rollback:promotion-decision'], '2026-07-24T00:00:00.000Z')
  const commander = await generateLocalAuthority('Incident commander', ['incident-commander'], ['incident-command'], ['declare:release-incident'], '2026-07-24T00:00:00.000Z')
  const containment = await generateLocalAuthority('Containment authority', ['containment-authority'], ['containment-operations'], ['approve:rollback-containment'], '2026-07-24T00:00:00.000Z')
  const releaser = await generateLocalAuthority('Rollback release custodian', ['release-custodian'], ['release-operations'], ['release:package-rollback'], '2026-07-24T00:00:00.000Z')
  const decision = await createSignedPromotionDecision(approvedProfile(restore), restore.maturity_level, recorder, '2026-07-24T00:00:00.000Z')
  const current = clone(restore)
  current.theory.version = '1.1.0'
  current.maturity_level = 4
  current.metadata.release_governance = { authority_decision_id: decision.decision_id, action: 'PROMOTION' }
  const eligible = assessment(restore)
  const mathMandate = await issuePromotionMandate(issuer, math.identity.id, 'mathematical-review', eligible, ['rollback:promotion-decision'], { valid_from_utc: '2026-07-24T00:00:00.000Z', expires_at_utc: '2026-08-24T00:00:00.000Z' })
  const implementationMandate = await issuePromotionMandate(issuer, implementation.identity.id, 'implementation-audit', eligible, ['rollback:promotion-decision'], { valid_from_utc: '2026-07-24T00:00:00.000Z', expires_at_utc: '2026-08-24T00:00:00.000Z' })
  const mathRollback = await signRollbackBallot(math, decision, mathMandate, 'Observed release regression requires governed reversal.', { issued_at_utc: '2026-07-24T01:00:00.000Z' })
  const implementationRollback = await signRollbackBallot(implementation, decision, implementationMandate, 'Runtime evidence supports restoring the prior package state.', { issued_at_utc: '2026-07-24T01:00:00.000Z' })
  const authorityBundle = {
    ...emptyAuthorityBundle(),
    authorities: [recorder.identity, issuer.identity, math.identity, implementation.identity, commander.identity, containment.identity, releaser.identity],
    mandates: [mathMandate, implementationMandate],
    rollback_ballots: [mathRollback, implementationRollback],
    metadata: { planning_artifact: false },
  }
  const currentHash = await sha256EvidenceDigest(current)
  const restoreHash = await sha256EvidenceDigest(restore)
  const anchorUnsigned = {
    schema_version: 'repository-rollback-anchor:v0.1' as const,
    anchor_type: 'exact-rollback-reference-not-rollback-authorization' as const,
    status: 'AVAILABLE_FOR_GOVERNED_ROLLBACK' as const,
    repository: 'MichaelWave369/langarian-math',
    package: { id: current.theory.id, before_version: restore.theory.version, target_version: current.theory.version },
    target_path: 'examples/theory-packages/langarian-finite-complex.json',
    application_receipt_id: `repository-application:${'2'.repeat(64)}`,
    release_receipt_id: `release-receipt:${'3'.repeat(64)}`,
    authority_decision_id: decision.decision_id,
    action_applied: 'PROMOTION' as const,
    application_base_commit: 'a'.repeat(40),
    mutation_commit: 'b'.repeat(40),
    application_head_commit: 'c'.repeat(40),
    merge_commit: 'd'.repeat(40),
    merged_manifest_hash: currentHash,
    restore_manifest_hash: restoreHash,
    patch_digest: `sha256:${'4'.repeat(64)}`,
    replay_key: `sha256:${'5'.repeat(64)}`,
    established_at_utc: '2026-07-24T01:10:00.000Z',
    claims_supported: [],
    prohibited_inferences: [],
  }
  const anchorDigest = await sha256EvidenceDigest(anchorUnsigned)
  const anchor = { ...anchorUnsigned, rollback_anchor_id: `rollback-anchor:${anchorDigest.slice('sha256:'.length)}` }
  const observationUnsigned = {
    schema_version: 'repository-merge-observation:v0.1' as const,
    observation_type: 'append-only-merged-application-observation' as const,
    status: 'MERGED' as const,
    repository: anchor.repository,
    pull_request: { number: 88, url: 'https://github.com/MichaelWave369/langarian-math/pull/88', base_ref: 'main', head_ref: 'controlled-release/fixture', base_commit_at_application: anchor.application_base_commit, head_commit: anchor.application_head_commit, mutation_commit: anchor.mutation_commit, merge_commit: anchor.merge_commit, merged_at_utc: '2026-07-24T01:05:00.000Z', merged_by: 'MichaelWave369', merge_topology: 'HEAD_ANCESTOR_OF_MERGE' as const },
    application: { application_receipt_id: anchor.application_receipt_id, application_receipt_path: 'artifacts/repository-applications/fixture.json', release_receipt_id: anchor.release_receipt_id, authority_decision_id: anchor.authority_decision_id, package: anchor.package, action: 'PROMOTION' as const, target_path: anchor.target_path, replay_key: anchor.replay_key },
    integrity: { application_receipt_digest: `sha256:${'6'.repeat(64)}`, changed_paths_digest: `sha256:${'7'.repeat(64)}`, base_manifest_hash: restoreHash, reviewed_manifest_hash: currentHash, merged_manifest_hash: currentHash, replay_entry_digest: `sha256:${'8'.repeat(64)}`, application_bundle_digest: `sha256:${'9'.repeat(64)}`, application_attestation_verified: true as const, release_chain_reverified: true as const, reviewed_tree_matches_merge: true as const },
    rollback_anchor_id: anchor.rollback_anchor_id,
    reconciliation_record_status: 'PENDING_RECONCILIATION_PR' as const,
    observed_at_utc: '2026-07-24T01:10:00.000Z',
    claims_supported: [],
    prohibited_inferences: [],
  }
  const observationDigest = await sha256EvidenceDigest(observationUnsigned)
  const observation = { ...observationUnsigned, observation_id: `merge-observation:${observationDigest.slice('sha256:'.length)}` }
  const incident = await createIncidentRecord(commander, {
    repository: anchor.repository,
    package_id: current.theory.id,
    target_path: anchor.target_path,
    merge_observation_id: observation.observation_id,
    rollback_anchor_id: anchor.rollback_anchor_id,
    current_manifest_hash: currentHash,
    restore_manifest_hash: restoreHash,
    severity: 'SEV2',
    summary: 'Synthetic post-release regression detected.',
    observed_effects: ['Contract-conformance behavior differs from the approved release expectation.'],
    evidence_references: ['artifact://synthetic-regression-evidence'],
    containment_rationale: 'Freeze promotion and restore the exact prior governed state while preserving all receipts.',
    rollback_objective: 'Return maturity and governed package state to the anchor-bound prior manifest content.',
    metadata: { synthetic_fixture: true },
  }, '2026-07-24T01:15:00.000Z')
  const request = await createGovernedRollbackRequest(current, restore, observation, anchor, decision, authorityBundle, incident, '1.1.1', releaser, containment, '2026-07-24T01:20:00.000Z')
  return { request, current, restore }
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function runMaterializer(args: string[]): Promise<void> {
  const originalArgv = process.argv
  const originalExitCode = process.exitCode
  const script = resolve('web/scripts/materialize-governed-rollback.mjs')
  process.argv = [originalArgv[0] ?? 'node', script, ...args]
  process.exitCode = undefined
  try {
    const moduleUrl = `${pathToFileURL(script).href}?test=${Date.now()}-${Math.random()}`
    await import(/* @vite-ignore */ moduleUrl)
    if (process.exitCode !== undefined && process.exitCode !== 0) throw new Error(`Materializer set exit code ${process.exitCode}.`)
  } finally {
    process.argv = originalArgv
    process.exitCode = originalExitCode
  }
}

describe('governed rollback incident response', () => {
  it('earns a controlled-writer handoff with independent incident, containment, quorum, and release custody', async () => {
    const value = await fixture()
    const profile = await buildGovernedRollbackProfile(value.request, undefined, '2026-07-24T01:20:00.000Z')
    expect(profile.status, profile.blockers.join('\n')).toBe('READY_FOR_CONTROLLED_WRITER')
    expect(profile.rollback_quorum_valid).toBe(true)
    expect(profile.release_archive_valid).toBe(true)
    expect(profile.separation_valid).toBe(true)

    const directory = mkdtempSync(join(tmpdir(), 'governed-rollback-'))
    mkdirSync(join(directory, 'out'))
    writeJson(join(directory, 'request.json'), value.request)
    writeJson(join(directory, 'live.json'), value.current)
    writeJson(join(directory, 'restore.json'), value.restore)
    await runMaterializer([
      '--request', join(directory, 'request.json'),
      '--live-manifest', join(directory, 'live.json'),
      '--restore-manifest', join(directory, 'restore.json'),
      '--out-dir', join(directory, 'out'),
    ])
    const handoff = JSON.parse(readFileSync(join(directory, 'out', 'rollback-handoff.json'), 'utf8'))
    expect(handoff.status).toBe('READY_FOR_CONTROLLED_WRITER_VALIDATION')
    expect(handoff.release_receipt_id).toBe(value.request.release_archive.release_bundle.receipt.receipt_id)
  })

  it('blocks detached containment and restore-manifest tampering', async () => {
    const value = await fixture()
    const detached = clone(value.request)
    detached.containment_plan.release_archive_digest = `sha256:${'f'.repeat(64)}`
    const detachedProfile = await buildGovernedRollbackProfile(detached, undefined, '2026-07-24T01:20:00.000Z')
    expect(detachedProfile.status).toBe('BLOCKED')
    expect(detachedProfile.blockers.join(' ')).toContain('ARCHIVE_BINDING_MISMATCH')

    const tampered = clone(value.request)
    tampered.restore_manifest.theory.summary = `${tampered.restore_manifest.theory.summary} tampered`
    const tamperedProfile = await buildGovernedRollbackProfile(tampered, undefined, '2026-07-24T01:20:00.000Z')
    expect(tamperedProfile.status).toBe('BLOCKED')
    expect(tamperedProfile.restore_hash_valid).toBe(false)
  })
})
