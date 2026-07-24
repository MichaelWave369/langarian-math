export const MERGE_OBSERVATION_SCHEMA_VERSION = 'repository-merge-observation:v0.1' as const
export const ROLLBACK_ANCHOR_SCHEMA_VERSION = 'repository-rollback-anchor:v0.1' as const

export interface ReconciliationIssue {
  path: string
  code: string
  message: string
}

export interface RepositoryMergeObservation {
  schema_version: typeof MERGE_OBSERVATION_SCHEMA_VERSION
  observation_type: 'append-only-merged-application-observation'
  status: 'MERGED'
  repository: string
  pull_request: {
    number: number
    url: string
    base_ref: string
    head_ref: string
    base_commit_at_application: string
    head_commit: string
    mutation_commit: string
    merge_commit: string
    merged_at_utc: string
    merged_by: string
    merge_topology: 'HEAD_ANCESTOR_OF_MERGE' | 'TREE_EQUIVALENT_SQUASH_OR_REBASE'
  }
  application: {
    application_receipt_id: string
    application_receipt_path: string
    release_receipt_id: string
    authority_decision_id: string
    package: Record<string, unknown>
    action: 'PROMOTION' | 'ROLLBACK'
    target_path: string
    replay_key: string
  }
  integrity: {
    application_receipt_digest: string
    changed_paths_digest: string
    base_manifest_hash: string
    reviewed_manifest_hash: string
    merged_manifest_hash: string
    replay_entry_digest: string
    application_bundle_digest: string
    application_attestation_verified: true
    release_chain_reverified: true
    reviewed_tree_matches_merge: true
  }
  rollback_anchor_id: string
  reconciliation_record_status: 'PENDING_RECONCILIATION_PR'
  observed_at_utc: string
  claims_supported: string[]
  prohibited_inferences: string[]
  observation_id: string
}

export interface RepositoryRollbackAnchor {
  schema_version: typeof ROLLBACK_ANCHOR_SCHEMA_VERSION
  anchor_type: 'exact-rollback-reference-not-rollback-authorization'
  status: 'AVAILABLE_FOR_GOVERNED_ROLLBACK'
  repository: string
  package: Record<string, unknown>
  target_path: string
  application_receipt_id: string
  release_receipt_id: string
  authority_decision_id: string
  action_applied: 'PROMOTION' | 'ROLLBACK'
  application_base_commit: string
  mutation_commit: string
  application_head_commit: string
  merge_commit: string
  merged_manifest_hash: string
  restore_manifest_hash: string
  patch_digest: string
  replay_key: string
  established_at_utc: string
  claims_supported: string[]
  prohibited_inferences: string[]
  rollback_anchor_id: string
}

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/
const ID_PATTERN = /^[a-z][a-z0-9-]*:[0-9a-f]{64}$/
const COMMIT_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(path: string, code: string, message: string): ReconciliationIssue {
  return { path, code, message }
}

function requireString(value: Record<string, unknown>, key: string, path: string, issues: ReconciliationIssue[]): string | null {
  const item = value[key]
  if (typeof item !== 'string' || item.length === 0) {
    issues.push(issue(`${path}.${key}`, 'EXPECTED_STRING', `${key} must be a non-empty string.`))
    return null
  }
  return item
}

export function validateMergeObservation(value: unknown): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = []
  if (!record(value)) return [issue('$', 'EXPECTED_OBJECT', 'Merge observation must be an object.')]
  if (value.schema_version !== MERGE_OBSERVATION_SCHEMA_VERSION) issues.push(issue('schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${MERGE_OBSERVATION_SCHEMA_VERSION}.`))
  if (value.observation_type !== 'append-only-merged-application-observation') issues.push(issue('observation_type', 'INVALID_TYPE', 'Observation type is not recognized.'))
  if (value.status !== 'MERGED') issues.push(issue('status', 'INVALID_STATUS', 'A reconciliation observation must record MERGED.'))
  const observationId = requireString(value, 'observation_id', '$', issues)
  const rollbackAnchorId = requireString(value, 'rollback_anchor_id', '$', issues)
  if (observationId && !ID_PATTERN.test(observationId)) issues.push(issue('observation_id', 'INVALID_ID', 'Observation id must be content-addressed.'))
  if (rollbackAnchorId && !ID_PATTERN.test(rollbackAnchorId)) issues.push(issue('rollback_anchor_id', 'INVALID_ID', 'Rollback anchor id must be content-addressed.'))
  if (!record(value.pull_request)) issues.push(issue('pull_request', 'EXPECTED_OBJECT', 'Pull request metadata is required.'))
  else {
    for (const key of ['base_commit_at_application', 'head_commit', 'mutation_commit', 'merge_commit'] as const) {
      const commit = requireString(value.pull_request, key, 'pull_request', issues)
      if (commit && !COMMIT_PATTERN.test(commit)) issues.push(issue(`pull_request.${key}`, 'INVALID_COMMIT', `${key} is not a valid commit id.`))
    }
    if (!Number.isInteger(value.pull_request.number) || Number(value.pull_request.number) < 1) issues.push(issue('pull_request.number', 'INVALID_PR_NUMBER', 'Pull request number must be a positive integer.'))
  }
  if (!record(value.application)) issues.push(issue('application', 'EXPECTED_OBJECT', 'Application binding is required.'))
  else {
    for (const key of ['application_receipt_id', 'release_receipt_id', 'authority_decision_id'] as const) {
      const id = requireString(value.application, key, 'application', issues)
      if (id && !ID_PATTERN.test(id)) issues.push(issue(`application.${key}`, 'INVALID_ID', `${key} must be content-addressed.`))
    }
    const replay = requireString(value.application, 'replay_key', 'application', issues)
    if (replay && !HASH_PATTERN.test(replay)) issues.push(issue('application.replay_key', 'INVALID_HASH', 'Replay key must be SHA-256.'))
  }
  if (!record(value.integrity)) issues.push(issue('integrity', 'EXPECTED_OBJECT', 'Integrity record is required.'))
  else {
    for (const key of ['application_receipt_digest', 'changed_paths_digest', 'base_manifest_hash', 'reviewed_manifest_hash', 'merged_manifest_hash', 'replay_entry_digest', 'application_bundle_digest'] as const) {
      const hash = requireString(value.integrity, key, 'integrity', issues)
      if (hash && !HASH_PATTERN.test(hash)) issues.push(issue(`integrity.${key}`, 'INVALID_HASH', `${key} must be SHA-256.`))
    }
    for (const key of ['application_attestation_verified', 'release_chain_reverified', 'reviewed_tree_matches_merge'] as const) {
      if (value.integrity[key] !== true) issues.push(issue(`integrity.${key}`, 'VERIFICATION_REQUIRED', `${key} must be true.`))
    }
    if (value.integrity.reviewed_manifest_hash !== value.integrity.merged_manifest_hash) issues.push(issue('integrity.merged_manifest_hash', 'MERGED_TREE_MISMATCH', 'Reviewed and merged manifest hashes differ.'))
  }
  if (value.reconciliation_record_status !== 'PENDING_RECONCILIATION_PR') issues.push(issue('reconciliation_record_status', 'INVALID_RECORD_STATUS', 'Observation must remain pending until its separate reconciliation PR is merged.'))
  return issues
}

export function validateRollbackAnchor(value: unknown): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = []
  if (!record(value)) return [issue('$', 'EXPECTED_OBJECT', 'Rollback anchor must be an object.')]
  if (value.schema_version !== ROLLBACK_ANCHOR_SCHEMA_VERSION) issues.push(issue('schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${ROLLBACK_ANCHOR_SCHEMA_VERSION}.`))
  if (value.anchor_type !== 'exact-rollback-reference-not-rollback-authorization') issues.push(issue('anchor_type', 'INVALID_TYPE', 'Rollback anchor type is not recognized.'))
  if (value.status !== 'AVAILABLE_FOR_GOVERNED_ROLLBACK') issues.push(issue('status', 'INVALID_STATUS', 'Rollback anchor status is invalid.'))
  const id = requireString(value, 'rollback_anchor_id', '$', issues)
  if (id && !ID_PATTERN.test(id)) issues.push(issue('rollback_anchor_id', 'INVALID_ID', 'Rollback anchor id must be content-addressed.'))
  for (const key of ['application_base_commit', 'mutation_commit', 'application_head_commit', 'merge_commit'] as const) {
    const commit = requireString(value, key, '$', issues)
    if (commit && !COMMIT_PATTERN.test(commit)) issues.push(issue(key, 'INVALID_COMMIT', `${key} is not a valid commit id.`))
  }
  for (const key of ['merged_manifest_hash', 'restore_manifest_hash', 'patch_digest', 'replay_key'] as const) {
    const hash = requireString(value, key, '$', issues)
    if (hash && !HASH_PATTERN.test(hash)) issues.push(issue(key, 'INVALID_HASH', `${key} must be SHA-256.`))
  }
  return issues
}

export function parseMergeObservationJson(text: string): { observation: RepositoryMergeObservation | null; issues: ReconciliationIssue[] } {
  try {
    const value: unknown = JSON.parse(text)
    const issues = validateMergeObservation(value)
    return { observation: issues.length === 0 ? value as RepositoryMergeObservation : null, issues }
  } catch (error) {
    return { observation: null, issues: [issue('$', 'INVALID_JSON', error instanceof Error ? error.message : String(error))] }
  }
}

export function parseRollbackAnchorJson(text: string): { anchor: RepositoryRollbackAnchor | null; issues: ReconciliationIssue[] } {
  try {
    const value: unknown = JSON.parse(text)
    const issues = validateRollbackAnchor(value)
    return { anchor: issues.length === 0 ? value as RepositoryRollbackAnchor : null, issues }
  } catch (error) {
    return { anchor: null, issues: [issue('$', 'INVALID_JSON', error instanceof Error ? error.message : String(error))] }
  }
}
