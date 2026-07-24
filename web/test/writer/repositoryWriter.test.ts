import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
import { createPackageReleaseArchive } from '../../src/theory/releaseArchive.js'

const writerScript = fileURLToPath(new URL('../../scripts/controlled-repository-writer.mjs', import.meta.url))

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
    accepted('ballot:math', 'authority:math-reviewer', 'mandate:math', 'mathematical-review', 'mathematical-analysis'),
    accepted('ballot:implementation', 'authority:implementation-auditor', 'mandate:implementation', 'implementation-audit', 'runtime-conformance'),
  ]
  return {
    policy: DEFAULT_PROMOTION_AUTHORITY_POLICY,
    assessment_id: 'assessment:repository-writer-eligible',
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
  return { before, after, archive: createPackageReleaseArchive(before, after, proposal, receipt, decision, authorityBundle), receipt }
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function runWriter(args: string[]) {
  return spawnSync(process.execPath, [writerScript, ...args], { encoding: 'utf8' })
}

function baseFiles(directory: string, before: TheoryPackage, archive: unknown) {
  const archivePath = join(directory, 'archive.json')
  const livePath = join(directory, 'live.json')
  const policyPath = join(directory, 'policy.json')
  const ledgerPath = join(directory, 'ledger.json')
  writeJson(archivePath, archive)
  writeJson(livePath, before)
  writeJson(policyPath, {
    schema_version: 'repository-writer-policy:v0.1',
    allowed_targets: [{ package_id: before.theory.id, path: 'examples/theory-packages/langarian-finite-complex.json', allowed_actions: ['PROMOTION', 'ROLLBACK'] }],
  })
  writeJson(ledgerPath, { schema_version: 'repository-replay-ledger:v0.1', entries: [], metadata: { append_only: true } })
  return { archivePath, livePath, policyPath, ledgerPath }
}

describe('controlled repository writer', () => {
  it('plans an exact review-branch mutation and emits a commit-bound receipt', async () => {
    const fixture = await authorizedArchive()
    const directory = mkdtempSync(join(tmpdir(), 'repository-writer-'))
    const files = baseFiles(directory, fixture.before, fixture.archive)
    const output = join(directory, 'plan-output')
    const planRun = runWriter([
      'plan', '--archive', files.archivePath, '--live-manifest', files.livePath, '--policy', files.policyPath,
      '--ledger', files.ledgerPath, '--target-path', 'examples/theory-packages/langarian-finite-complex.json',
      '--expected-receipt-id', fixture.receipt.receipt_id, '--now', '2026-07-24T00:20:00.000Z', '--out-dir', output,
    ])
    expect(planRun.status, planRun.stderr).toBe(0)
    const plan = JSON.parse(readFileSync(join(output, 'writer-plan.json'), 'utf8'))
    const after = JSON.parse(readFileSync(join(output, 'after-manifest.json'), 'utf8'))
    expect(plan.status).toBe('READY_FOR_REVIEW_BRANCH')
    expect(after.theory.version).toBe('1.1.0')
    expect(after.maturity_level).toBe(4)

    const application = join(directory, 'application-output')
    const finalizeRun = runWriter([
      'finalize', '--plan', join(output, 'writer-plan.json'), '--ledger', files.ledgerPath,
      '--mutation-commit', 'a'.repeat(40), '--application-branch', 'controlled-release/test', '--base-ref', 'main',
      '--base-commit', 'b'.repeat(40), '--repository', 'MichaelWave369/langarian-math', '--workflow-run-id', '1234',
      '--workflow-run-attempt', '1', '--now', '2026-07-24T00:22:00.000Z', '--out-dir', application,
    ])
    expect(finalizeRun.status, finalizeRun.stderr).toBe(0)
    const receipt = JSON.parse(readFileSync(join(application, 'application-receipt.json'), 'utf8'))
    const ledger = JSON.parse(readFileSync(join(application, 'replay-ledger.json'), 'utf8'))
    expect(receipt.status).toBe('APPLIED_ON_REVIEW_BRANCH')
    expect(receipt.merge_status).toBe('NOT_MERGED')
    expect(receipt.mutation_commit).toBe('a'.repeat(40))
    expect(ledger.entries).toHaveLength(1)
    expect(ledger.entries[0].replay_key).toBe(plan.replay_key)
  })

  it('rejects stale live manifests, unregistered targets, and replayed transitions', async () => {
    const fixture = await authorizedArchive()
    const directory = mkdtempSync(join(tmpdir(), 'repository-writer-redteam-'))
    const files = baseFiles(directory, fixture.before, fixture.archive)
    const stale = clone(fixture.before)
    stale.theory.summary = `${stale.theory.summary} drifted`
    writeJson(files.livePath, stale)
    const staleRun = runWriter([
      'plan', '--archive', files.archivePath, '--live-manifest', files.livePath, '--policy', files.policyPath,
      '--ledger', files.ledgerPath, '--target-path', 'examples/theory-packages/langarian-finite-complex.json',
      '--now', '2026-07-24T00:20:00.000Z', '--out-dir', join(directory, 'stale'),
    ])
    expect(staleRun.status).not.toBe(0)
    expect(staleRun.stderr).toContain('Live source manifest')

    writeJson(files.livePath, fixture.before)
    const targetRun = runWriter([
      'plan', '--archive', files.archivePath, '--live-manifest', files.livePath, '--policy', files.policyPath,
      '--ledger', files.ledgerPath, '--target-path', 'README.md', '--now', '2026-07-24T00:20:00.000Z',
      '--out-dir', join(directory, 'target'),
    ])
    expect(targetRun.status).not.toBe(0)
    expect(targetRun.stderr).toContain('Target path must be')

    const firstOutput = join(directory, 'first')
    const firstRun = runWriter([
      'plan', '--archive', files.archivePath, '--live-manifest', files.livePath, '--policy', files.policyPath,
      '--ledger', files.ledgerPath, '--target-path', 'examples/theory-packages/langarian-finite-complex.json',
      '--now', '2026-07-24T00:20:00.000Z', '--out-dir', firstOutput,
    ])
    expect(firstRun.status, firstRun.stderr).toBe(0)
    const plan = JSON.parse(readFileSync(join(firstOutput, 'writer-plan.json'), 'utf8'))
    writeJson(files.ledgerPath, { schema_version: 'repository-replay-ledger:v0.1', entries: [{ replay_key: plan.replay_key }], metadata: {} })
    const replayRun = runWriter([
      'plan', '--archive', files.archivePath, '--live-manifest', files.livePath, '--policy', files.policyPath,
      '--ledger', files.ledgerPath, '--target-path', 'examples/theory-packages/langarian-finite-complex.json',
      '--now', '2026-07-24T00:20:00.000Z', '--out-dir', join(directory, 'replay'),
    ])
    expect(replayRun.status).not.toBe(0)
    expect(replayRun.stderr).toContain('Replay key has already been consumed')
  })

  it('rejects blocked or tampered release archives before any repository plan exists', async () => {
    const fixture = await authorizedArchive()
    const directory = mkdtempSync(join(tmpdir(), 'repository-writer-blocked-'))
    const tampered = clone(fixture.archive)
    tampered.release_bundle.after_manifest.theory.summary = 'tampered after signing'
    const files = baseFiles(directory, fixture.before, tampered)
    const run = runWriter([
      'plan', '--archive', files.archivePath, '--live-manifest', files.livePath, '--policy', files.policyPath,
      '--ledger', files.ledgerPath, '--target-path', 'examples/theory-packages/langarian-finite-complex.json',
      '--now', '2026-07-24T00:20:00.000Z', '--out-dir', join(directory, 'blocked'),
    ])
    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('Archived target manifest')
  })
})
