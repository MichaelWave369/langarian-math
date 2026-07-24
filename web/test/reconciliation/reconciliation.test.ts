import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sha256EvidenceDigest } from '../../src/theory/custody.js'
import {
  validateMergeObservation,
  validateRollbackAnchor,
} from '../../src/theory/reconciliation.js'

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'langarian-reconcile-'))
  const input = join(root, 'input')
  const output = join(root, 'output')
  mkdirSync(input, { recursive: true })
  mkdirSync(output, { recursive: true })

  const baseManifest = { schema_version: 'theory-package:v0.2', theory: { id: 'synthetic', version: '1.0.0' }, maturity_level: 3, objects: [], operators: [], metadata: {} }
  const mergedManifest = { ...baseManifest, theory: { ...baseManifest.theory, version: '1.1.0' }, maturity_level: 4, metadata: { release_governance: { authority_decision_id: `authority-decision:${'1'.repeat(64)}` } } }
  const beforeHash = await sha256EvidenceDigest(baseManifest)
  const afterHash = await sha256EvidenceDigest(mergedManifest)
  const replayKey = await sha256EvidenceDigest({ decision_id: `authority-decision:${'1'.repeat(64)}`, before_hash: beforeHash, after_hash: afterHash, action: 'PROMOTION' })
  const receiptUnsigned = {
    schema_version: 'repository-application-receipt:v0.1',
    application_type: 'commit-bound-controlled-package-release',
    status: 'APPLIED_ON_REVIEW_BRANCH',
    merge_status: 'NOT_MERGED',
    repository: 'MichaelWave369/langarian-math',
    base_ref: 'main',
    base_commit: 'a'.repeat(40),
    application_branch: 'controlled-release/123-test',
    mutation_commit: 'b'.repeat(40),
    target_path: 'examples/theory-packages/synthetic.json',
    package: { id: 'synthetic', before_version: '1.0.0', target_version: '1.1.0' },
    action: 'PROMOTION',
    archive_digest: `sha256:${'2'.repeat(64)}`,
    authority_decision_id: `authority-decision:${'1'.repeat(64)}`,
    release_proposal_id: `release-proposal:${'3'.repeat(64)}`,
    release_receipt_id: `release-receipt:${'4'.repeat(64)}`,
    before_manifest_hash: beforeHash,
    after_manifest_hash: afterHash,
    patch_digest: `sha256:${'5'.repeat(64)}`,
    replay_key: replayKey,
    workflow_identity: {
      provider: 'github-actions-oidc',
      workflow_run_id: '123',
      workflow_run_attempt: '1',
      attestation_status: 'PENDING_WORKFLOW_ATTESTATION',
    },
    issued_at_utc: '2026-07-24T02:00:00.000Z',
    claims_supported: ['Synthetic test application.'],
    prohibited_inferences: ['Not merged yet.'],
  }
  const receiptDigest = await sha256EvidenceDigest(receiptUnsigned)
  const receipt = { ...receiptUnsigned, application_receipt_id: `repository-application:${receiptDigest.slice('sha256:'.length)}` }
  const replayEntry = {
    replay_key: replayKey,
    application_receipt_id: receipt.application_receipt_id,
    release_receipt_id: receipt.release_receipt_id,
    package_id: receipt.package.id,
    action: receipt.action,
    target_path: receipt.target_path,
    base_commit: receipt.base_commit,
    mutation_commit: receipt.mutation_commit,
    application_branch: receipt.application_branch,
    consumed_at_utc: receipt.issued_at_utc,
    merge_status: 'NOT_MERGED',
  }
  const replayLedger = { schema_version: 'repository-replay-ledger:v0.1', entries: [replayEntry], metadata: {} }
  const writerPlan = {
    schema_version: 'repository-writer-plan:v0.1',
    status: 'READY_FOR_REVIEW_BRANCH',
    release_receipt_id: receipt.release_receipt_id,
    target_path: receipt.target_path,
    before_manifest_hash: beforeHash,
    after_manifest_hash: afterHash,
    patch_digest: receipt.patch_digest,
    replay_key: replayKey,
  }
  const applicationBundle = {
    bundle_schema_version: 'repository-application-bundle:v0.1',
    writer_plan: writerPlan,
    application_receipt: receipt,
    replay_ledger_entry: replayEntry,
    metadata: {},
  }
  const prMetadata = {
    repository: receipt.repository,
    pr_number: 88,
    pr_url: 'https://github.com/MichaelWave369/langarian-math/pull/88',
    merged: true,
    base_ref: 'main',
    head_ref: receipt.application_branch,
    head_commit: 'c'.repeat(40),
    merge_commit: 'd'.repeat(40),
    merged_at_utc: '2026-07-24T03:00:00.000Z',
    merged_by: 'MichaelWave369',
    mutation_commit_reachable: true,
    base_commit_reachable: true,
    merge_tree_matches_head: true,
    release_chain_reverified: true,
    application_attestation_verified: true,
    merge_topology: 'TREE_EQUIVALENT_SQUASH_OR_REBASE',
  }
  const receiptPath = 'artifacts/repository-applications/receipt.json'
  const changedPaths = [receipt.target_path, receiptPath, '.parallax/release-replay-ledger.json']
  const policy = {
    schema_version: 'repository-reconciliation-policy:v0.1',
    base_ref: 'main',
    application_branch_prefix: 'controlled-release/',
    reconciliation_branch_prefix: 'release-reconciliation/',
    allowed_receipt_path_prefixes: ['artifacts/repository-applications/'],
    replay_ledger_path: '.parallax/release-replay-ledger.json',
  }
  const mergeLedger = { schema_version: 'repository-merge-ledger:v0.1', entries: [], metadata: {} }
  const paths = {
    policy: join(input, 'policy.json'),
    prMetadata: join(input, 'pr-metadata.json'),
    receipt: join(input, 'receipt.json'),
    applicationBundle: join(input, 'application-bundle.json'),
    baseManifest: join(input, 'base.json'),
    headManifest: join(input, 'head.json'),
    mergedManifest: join(input, 'merged.json'),
    headReplayLedger: join(input, 'head-replay.json'),
    mergedReplayLedger: join(input, 'merged-replay.json'),
    mergeLedger: join(input, 'merge-ledger.json'),
    changedPaths: join(input, 'changed-paths.json'),
  }
  writeJson(paths.policy, policy)
  writeJson(paths.prMetadata, prMetadata)
  writeJson(paths.receipt, receipt)
  writeJson(paths.applicationBundle, applicationBundle)
  writeJson(paths.baseManifest, baseManifest)
  writeJson(paths.headManifest, mergedManifest)
  writeJson(paths.mergedManifest, mergedManifest)
  writeJson(paths.headReplayLedger, replayLedger)
  writeJson(paths.mergedReplayLedger, replayLedger)
  writeJson(paths.mergeLedger, mergeLedger)
  writeJson(paths.changedPaths, changedPaths)
  return { root, output, paths, receiptPath, receipt, replayKey, prMetadata, mergedManifest, applicationBundle }
}

function run(value: Awaited<ReturnType<typeof fixture>>): void {
  execFileSync(process.execPath, [
    resolve('scripts/reconcile-controlled-release.mjs'),
    '--policy', value.paths.policy,
    '--pr-metadata', value.paths.prMetadata,
    '--application-receipt', value.paths.receipt,
    '--application-receipt-path', value.receiptPath,
    '--application-bundle', value.paths.applicationBundle,
    '--base-manifest', value.paths.baseManifest,
    '--head-manifest', value.paths.headManifest,
    '--merged-manifest', value.paths.mergedManifest,
    '--head-replay-ledger', value.paths.headReplayLedger,
    '--merged-replay-ledger', value.paths.mergedReplayLedger,
    '--merge-ledger', value.paths.mergeLedger,
    '--changed-paths', value.paths.changedPaths,
    '--out-dir', value.output,
    '--observed-at', '2026-07-24T03:05:00.000Z',
  ], { cwd: resolve('web'), stdio: 'pipe' })
}

describe('merge observation and release reconciliation', () => {
  it('emits a MERGED observation and exact rollback anchor without rewriting the application receipt', async () => {
    const value = await fixture()
    run(value)
    const observation = readJson<Record<string, any>>(join(value.output, 'merge-observation.json'))
    const anchor = readJson<Record<string, any>>(join(value.output, 'rollback-anchor.json'))
    const ledger = readJson<Record<string, any>>(join(value.output, 'merge-ledger.json'))

    expect(observation.status).toBe('MERGED')
    expect(observation.application.application_receipt_id).toBe(value.receipt.application_receipt_id)
    expect(observation.integrity.reviewed_manifest_hash).toBe(observation.integrity.merged_manifest_hash)
    expect(anchor.merged_manifest_hash).toBe(value.receipt.after_manifest_hash)
    expect(anchor.restore_manifest_hash).toBe(value.receipt.before_manifest_hash)
    expect(anchor.rollback_anchor_id).toBe(observation.rollback_anchor_id)
    expect(ledger.entries).toHaveLength(1)
    expect(validateMergeObservation(observation)).toEqual([])
    expect(validateRollbackAnchor(anchor)).toEqual([])
    expect(readJson(value.paths.receipt)).toEqual(value.receipt)
  })

  it('rejects a pull request that was not actually merged', async () => {
    const value = await fixture()
    writeJson(value.paths.prMetadata, { ...value.prMetadata, merged: false })
    expect(() => run(value)).toThrow()
  })

  it('rejects an extra changed path outside the controlled application file set', async () => {
    const value = await fixture()
    const paths = readJson<string[]>(value.paths.changedPaths)
    writeJson(value.paths.changedPaths, [...paths, 'README.md'])
    expect(() => run(value)).toThrow()
  })

  it('rejects merged target-manifest tampering', async () => {
    const value = await fixture()
    writeJson(value.paths.mergedManifest, { ...value.mergedManifest, maturity_level: 5 })
    expect(() => run(value)).toThrow()
  })

  it('rejects a detached application bundle receipt', async () => {
    const value = await fixture()
    writeJson(value.paths.applicationBundle, {
      ...value.applicationBundle,
      application_receipt: { ...value.receipt, release_receipt_id: `release-receipt:${'9'.repeat(64)}` },
    })
    expect(() => run(value)).toThrow()
  })

  it('rejects duplicate application or replay reconciliation', async () => {
    const value = await fixture()
    run(value)
    const ledger = readJson<Record<string, any>>(join(value.output, 'merge-ledger.json'))
    writeJson(value.paths.mergeLedger, ledger)
    expect(() => run(value)).toThrow()
  })
})
