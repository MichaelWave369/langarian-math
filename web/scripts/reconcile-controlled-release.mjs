#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const OBSERVATION_SCHEMA = 'repository-merge-observation:v0.1'
const ROLLBACK_ANCHOR_SCHEMA = 'repository-rollback-anchor:v0.1'
const MERGE_LEDGER_SCHEMA = 'repository-merge-ledger:v0.1'
const APPLICATION_SCHEMA = 'repository-application-receipt:v0.1'
const APPLICATION_BUNDLE_SCHEMA = 'repository-application-bundle:v0.1'
const REPLAY_LEDGER_SCHEMA = 'repository-replay-ledger:v0.1'
const POLICY_SCHEMA = 'repository-reconciliation-policy:v0.1'

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument ${token}.`)
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) args[key] = true
    else {
      args[key] = value
      index += 1
    }
  }
  return args
}

function required(args, key) {
  const value = args[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing --${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}.`)
  return value
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'))
}

function writeJson(path, value) {
  const target = resolve(path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalize(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON rejects NaN and infinity.')
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen))
  if (isRecord(value)) {
    if (seen.has(value)) throw new Error('Canonical JSON rejects cyclic objects.')
    seen.add(value)
    const output = {}
    for (const key of Object.keys(value).sort()) {
      const item = value[key]
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') throw new Error(`Canonical JSON rejects unsupported value at ${key}.`)
      output[key] = canonicalize(item, seen)
    }
    seen.delete(value)
    return output
  }
  throw new Error(`Canonical JSON rejects ${typeof value}.`)
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`
}

function validateCommit(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(value)) throw new Error(`${label} must be a 40- or 64-character lowercase hexadecimal commit id.`)
}

function validatePolicy(policy) {
  if (policy.schema_version !== POLICY_SCHEMA) throw new Error(`Reconciliation policy must use ${POLICY_SCHEMA}.`)
  if (policy.base_ref !== 'main') throw new Error('Default reconciliation policy must target main.')
  if (policy.application_branch_prefix !== 'controlled-release/') throw new Error('Application branch prefix is not recognized.')
  if (policy.reconciliation_branch_prefix !== 'release-reconciliation/') throw new Error('Reconciliation branch prefix is not recognized.')
  if (policy.replay_ledger_path !== '.parallax/release-replay-ledger.json') throw new Error('Replay ledger path is not recognized.')
  if (!Array.isArray(policy.allowed_receipt_path_prefixes) || policy.allowed_receipt_path_prefixes.length === 0) throw new Error('At least one application receipt path prefix is required.')
}

function applicationReceiptBody(receipt) {
  const body = { ...receipt }
  delete body.application_receipt_id
  return body
}

function validateReceipt(receipt) {
  if (receipt.schema_version !== APPLICATION_SCHEMA) throw new Error(`Application receipt must use ${APPLICATION_SCHEMA}.`)
  if (receipt.status !== 'APPLIED_ON_REVIEW_BRANCH' || receipt.merge_status !== 'NOT_MERGED') throw new Error('Application receipt must describe an unmerged controlled review branch.')
  const expectedId = `repository-application:${digest(applicationReceiptBody(receipt)).slice('sha256:'.length)}`
  if (receipt.application_receipt_id !== expectedId) throw new Error('Application receipt id does not match its canonical body.')
  validateCommit(receipt.base_commit, 'Application base commit')
  validateCommit(receipt.mutation_commit, 'Mutation commit')
}

function findReplayEntry(ledger, receipt) {
  if (ledger.schema_version !== REPLAY_LEDGER_SCHEMA || !Array.isArray(ledger.entries)) throw new Error(`Replay ledger must use ${REPLAY_LEDGER_SCHEMA}.`)
  const matches = ledger.entries.filter((entry) => entry.replay_key === receipt.replay_key)
  if (matches.length !== 1) throw new Error('Merged replay ledger must contain exactly one matching replay entry.')
  const entry = matches[0]
  const valid = entry.application_receipt_id === receipt.application_receipt_id &&
    entry.release_receipt_id === receipt.release_receipt_id &&
    entry.package_id === receipt.package.id &&
    entry.action === receipt.action &&
    entry.target_path === receipt.target_path &&
    entry.base_commit === receipt.base_commit &&
    entry.mutation_commit === receipt.mutation_commit &&
    entry.application_branch === receipt.application_branch &&
    entry.merge_status === 'NOT_MERGED'
  if (!valid) throw new Error('Replay ledger entry is detached from the exact application receipt.')
  return entry
}

function validateApplicationBundle(bundle, receipt) {
  if (bundle.bundle_schema_version !== APPLICATION_BUNDLE_SCHEMA) throw new Error(`Application bundle must use ${APPLICATION_BUNDLE_SCHEMA}.`)
  if (canonicalJson(bundle.application_receipt) !== canonicalJson(receipt)) throw new Error('Attested application bundle receipt differs from the repository receipt.')
  const plan = bundle.writer_plan
  if (!isRecord(plan) || plan.release_receipt_id !== receipt.release_receipt_id || plan.replay_key !== receipt.replay_key || plan.target_path !== receipt.target_path || plan.before_manifest_hash !== receipt.before_manifest_hash || plan.after_manifest_hash !== receipt.after_manifest_hash || plan.patch_digest !== receipt.patch_digest) throw new Error('Writer plan is detached from the application receipt.')
  if (!isRecord(bundle.replay_ledger_entry)) throw new Error('Attested application bundle lacks a replay entry.')
  findReplayEntry({ schema_version: REPLAY_LEDGER_SCHEMA, entries: [bundle.replay_ledger_entry] }, receipt)
}

function validatePrMetadata(metadata, receipt, policy) {
  if (metadata.merged !== true) throw new Error('Pull request was not merged.')
  if (metadata.base_ref !== policy.base_ref) throw new Error(`Application pull request must merge into ${policy.base_ref}.`)
  if (typeof metadata.head_ref !== 'string' || !metadata.head_ref.startsWith(policy.application_branch_prefix)) throw new Error('Pull request head is not a controlled application branch.')
  validateCommit(metadata.head_commit, 'Application head commit')
  validateCommit(metadata.merge_commit, 'Merge commit')
  if (metadata.mutation_commit_reachable !== true) throw new Error('Recorded mutation commit is not reachable from the application PR head.')
  if (metadata.base_commit_reachable !== true) throw new Error('Recorded application base commit is not an ancestor of the application PR head.')
  if (metadata.merge_tree_matches_head !== true) throw new Error('Merged tree differs from the reviewed application branch for governed paths.')
  if (metadata.release_chain_reverified !== true) throw new Error('Original signed release chain was not successfully re-verified.')
  if (metadata.application_attestation_verified !== true) throw new Error('Application bundle provenance attestation was not verified.')
  if (metadata.repository !== receipt.repository) throw new Error('Pull request repository differs from the application receipt.')
  if (metadata.head_ref !== receipt.application_branch) throw new Error('Pull request head branch differs from the application receipt.')
}

function validateChangedPaths(paths, receipt, receiptPath, policy) {
  if (!Array.isArray(paths) || paths.some((item) => typeof item !== 'string')) throw new Error('Changed paths must be a string array.')
  const expected = [receipt.target_path, receiptPath, policy.replay_ledger_path].sort()
  const actual = [...new Set(paths)].sort()
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(`Controlled application PR must change exactly: ${expected.join(', ')}.`)
  if (!policy.allowed_receipt_path_prefixes.some((prefix) => receiptPath.startsWith(prefix)) || !receiptPath.endsWith('.json')) throw new Error('Application receipt path is outside the registered artifact namespace.')
}

function validateMergeLedger(ledger, receipt, mergeCommit) {
  if (ledger.schema_version !== MERGE_LEDGER_SCHEMA || !Array.isArray(ledger.entries)) throw new Error(`Merge ledger must use ${MERGE_LEDGER_SCHEMA}.`)
  if (ledger.entries.some((entry) => entry.application_receipt_id === receipt.application_receipt_id || entry.replay_key === receipt.replay_key || entry.merge_commit === mergeCommit)) throw new Error('This application, replay key, or merge commit has already been reconciled.')
}

function main(args) {
  const policy = readJson(required(args, 'policy'))
  const metadata = readJson(required(args, 'prMetadata'))
  const receipt = readJson(required(args, 'applicationReceipt'))
  const applicationBundle = readJson(required(args, 'applicationBundle'))
  const baseManifest = readJson(required(args, 'baseManifest'))
  const headManifest = readJson(required(args, 'headManifest'))
  const mergedManifest = readJson(required(args, 'mergedManifest'))
  const headReplayLedger = readJson(required(args, 'headReplayLedger'))
  const mergedReplayLedger = readJson(required(args, 'mergedReplayLedger'))
  const mergeLedger = readJson(required(args, 'mergeLedger'))
  const changedPaths = readJson(required(args, 'changedPaths'))
  const receiptPath = required(args, 'applicationReceiptPath')
  const outputDirectory = required(args, 'outDir')
  const observedAt = typeof args.observedAt === 'string' ? args.observedAt : new Date().toISOString()

  validatePolicy(policy)
  validateReceipt(receipt)
  validatePrMetadata(metadata, receipt, policy)
  validateChangedPaths(changedPaths, receipt, receiptPath, policy)
  validateApplicationBundle(applicationBundle, receipt)
  validateMergeLedger(mergeLedger, receipt, metadata.merge_commit)

  if (digest(baseManifest) !== receipt.before_manifest_hash) throw new Error('Application base manifest does not match the signed before-manifest hash.')
  if (digest(headManifest) !== receipt.after_manifest_hash || digest(mergedManifest) !== receipt.after_manifest_hash) throw new Error('Application head or merged manifest does not match the authorized after-manifest hash.')
  if (canonicalJson(headManifest) !== canonicalJson(mergedManifest)) throw new Error('Merged target manifest differs from the reviewed application branch.')
  const headEntry = findReplayEntry(headReplayLedger, receipt)
  const mergedEntry = findReplayEntry(mergedReplayLedger, receipt)
  if (canonicalJson(headEntry) !== canonicalJson(mergedEntry)) throw new Error('Merged replay entry differs from the reviewed application branch.')

  const rollbackUnsigned = {
    schema_version: ROLLBACK_ANCHOR_SCHEMA,
    anchor_type: 'exact-rollback-reference-not-rollback-authorization',
    status: 'AVAILABLE_FOR_GOVERNED_ROLLBACK',
    repository: receipt.repository,
    package: receipt.package,
    target_path: receipt.target_path,
    application_receipt_id: receipt.application_receipt_id,
    release_receipt_id: receipt.release_receipt_id,
    authority_decision_id: receipt.authority_decision_id,
    action_applied: receipt.action,
    application_base_commit: receipt.base_commit,
    mutation_commit: receipt.mutation_commit,
    application_head_commit: metadata.head_commit,
    merge_commit: metadata.merge_commit,
    merged_manifest_hash: receipt.after_manifest_hash,
    restore_manifest_hash: receipt.before_manifest_hash,
    patch_digest: receipt.patch_digest,
    replay_key: receipt.replay_key,
    established_at_utc: observedAt,
    claims_supported: ['This record identifies the exact merged package state and exact prior manifest hash that a separately governed rollback may reference.'],
    prohibited_inferences: ['Rollback is automatically authorized.', 'The prior manifest may be restored without rollback quorum.', 'The merge proves package claims or Reality Gate passage.'],
  }
  const rollbackAnchor = { ...rollbackUnsigned, rollback_anchor_id: `rollback-anchor:${digest(rollbackUnsigned).slice('sha256:'.length)}` }

  const observationUnsigned = {
    schema_version: OBSERVATION_SCHEMA,
    observation_type: 'append-only-merged-application-observation',
    status: 'MERGED',
    repository: receipt.repository,
    pull_request: {
      number: metadata.pr_number,
      url: metadata.pr_url,
      base_ref: metadata.base_ref,
      head_ref: metadata.head_ref,
      base_commit_at_application: receipt.base_commit,
      head_commit: metadata.head_commit,
      mutation_commit: receipt.mutation_commit,
      merge_commit: metadata.merge_commit,
      merged_at_utc: metadata.merged_at_utc,
      merged_by: metadata.merged_by,
      merge_topology: metadata.merge_topology,
    },
    application: {
      application_receipt_id: receipt.application_receipt_id,
      application_receipt_path: receiptPath,
      release_receipt_id: receipt.release_receipt_id,
      authority_decision_id: receipt.authority_decision_id,
      package: receipt.package,
      action: receipt.action,
      target_path: receipt.target_path,
      replay_key: receipt.replay_key,
    },
    integrity: {
      application_receipt_digest: digest(receipt),
      changed_paths_digest: digest([...new Set(changedPaths)].sort()),
      base_manifest_hash: digest(baseManifest),
      reviewed_manifest_hash: digest(headManifest),
      merged_manifest_hash: digest(mergedManifest),
      replay_entry_digest: digest(mergedEntry),
      application_bundle_digest: digest(applicationBundle),
      application_attestation_verified: true,
      release_chain_reverified: true,
      reviewed_tree_matches_merge: true,
    },
    rollback_anchor_id: rollbackAnchor.rollback_anchor_id,
    reconciliation_record_status: 'PENDING_RECONCILIATION_PR',
    observed_at_utc: observedAt,
    claims_supported: ['The exact controlled application pull request was merged and the governed target manifest and replay entry in the merge tree match the reviewed application branch.'],
    prohibited_inferences: ['The original application receipt was rewritten.', 'Merge proves mathematical or empirical truth.', 'Rollback is automatically authorized.', 'Historical manifests or governance records may be deleted.'],
  }
  const observation = { ...observationUnsigned, observation_id: `merge-observation:${digest(observationUnsigned).slice('sha256:'.length)}` }
  const mergeEntry = {
    observation_id: observation.observation_id,
    application_receipt_id: receipt.application_receipt_id,
    release_receipt_id: receipt.release_receipt_id,
    replay_key: receipt.replay_key,
    package_id: receipt.package.id,
    action: receipt.action,
    target_path: receipt.target_path,
    application_pr_number: metadata.pr_number,
    application_head_commit: metadata.head_commit,
    mutation_commit: receipt.mutation_commit,
    merge_commit: metadata.merge_commit,
    merged_at_utc: metadata.merged_at_utc,
    rollback_anchor_id: rollbackAnchor.rollback_anchor_id,
    reconciliation_record_status: 'PENDING_RECONCILIATION_PR',
  }
  const updatedMergeLedger = { ...mergeLedger, entries: [...mergeLedger.entries, mergeEntry], metadata: { ...(mergeLedger.metadata ?? {}), last_updated_at_utc: observedAt } }
  const bundle = {
    bundle_schema_version: 'repository-merge-reconciliation-bundle:v0.1',
    merge_observation: observation,
    rollback_anchor: rollbackAnchor,
    application_receipt: receipt,
    writer_plan: applicationBundle.writer_plan,
    replay_ledger_entry: mergedEntry,
    pr_metadata: metadata,
    metadata: { provenance_attestation_status: 'PENDING_WORKFLOW_ATTESTATION', reconciliation_record_status: 'PENDING_RECONCILIATION_PR' },
  }

  writeJson(`${outputDirectory}/merge-observation.json`, observation)
  writeJson(`${outputDirectory}/rollback-anchor.json`, rollbackAnchor)
  writeJson(`${outputDirectory}/merge-ledger.json`, updatedMergeLedger)
  writeJson(`${outputDirectory}/reconciliation-bundle.json`, bundle)
  process.stdout.write(`${JSON.stringify(observation)}\n`)
}

try {
  main(parseArgs(process.argv.slice(2)))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
