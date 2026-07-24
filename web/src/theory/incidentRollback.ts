import { canonicalEvidenceJson, sha256EvidenceDigest } from './custody.js'
import type { LocalAuthoritySession, PromotionAuthorityBundle, PromotionAuthorityIdentity } from './authority.js'
import type { SignedPromotionAuthorityDecisionReceipt } from './signedDecision.js'
import { evaluateSignedRollback } from './signedDecision.js'
import type { TheoryPackage } from './packages.js'
import {
  buildControlledPackageReleaseProfile,
  createPackageReleaseProposal,
  createSignedPackageReleaseReceipt,
  type SignedPackageReleaseReceipt,
} from './release.js'
import {
  createPackageReleaseArchive,
  verifyPackageReleaseArchive,
  type PackageReleaseArchive,
} from './releaseArchive.js'
import {
  validateMergeObservation,
  validateRollbackAnchor,
  type RepositoryMergeObservation,
  type RepositoryRollbackAnchor,
} from './reconciliation.js'

export const INCIDENT_RECORD_SCHEMA_VERSION = 'incident-response-record:v0.1' as const
export const CONTAINMENT_PLAN_SCHEMA_VERSION = 'rollback-containment-plan:v0.1' as const
export const GOVERNED_ROLLBACK_REQUEST_SCHEMA_VERSION = 'governed-rollback-request:v0.1' as const
export const INCIDENT_POLICY_SCHEMA_VERSION = 'rollback-incident-policy:v0.1' as const

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'

export interface RollbackIncidentPolicy {
  schema_version: typeof INCIDENT_POLICY_SCHEMA_VERSION
  id: string
  version: string
  incident_role: string
  incident_scope: string
  containment_role: string
  containment_scope: string
  require_incident_and_containment_separation: boolean
  require_containment_separate_from_release_authority: boolean
  require_evidence_references: boolean
  allowed_severities: IncidentSeverity[]
  metadata: Record<string, unknown>
}

export interface SignedIncidentRecord {
  schema_version: typeof INCIDENT_RECORD_SCHEMA_VERSION
  incident_id: string
  incident_type: 'governed-release-incident'
  status: 'OPEN_CONTAINMENT'
  repository: string
  package_id: string
  target_path: string
  merge_observation_id: string
  rollback_anchor_id: string
  current_manifest_hash: string
  restore_manifest_hash: string
  severity: IncidentSeverity
  summary: string
  observed_effects: string[]
  evidence_references: string[]
  containment_rationale: string
  rollback_objective: string
  declared_by: string
  declared_at_utc: string
  metadata: Record<string, unknown>
  signature: string
}

export interface SignedContainmentPlan {
  schema_version: typeof CONTAINMENT_PLAN_SCHEMA_VERSION
  containment_plan_id: string
  incident_id: string
  rollback_anchor_id: string
  release_archive_digest: string
  release_receipt_id: string
  expected_current_manifest_hash: string
  expected_restore_manifest_hash: string
  action: 'MATERIALIZE_GOVERNED_ROLLBACK'
  steps: string[]
  success_conditions: string[]
  stop_conditions: string[]
  monitoring_window_minutes: number
  approved_by: string
  approved_at_utc: string
  metadata: Record<string, unknown>
  signature: string
}

export interface GovernedRollbackRequest {
  request_schema_version: typeof GOVERNED_ROLLBACK_REQUEST_SCHEMA_VERSION
  incident: SignedIncidentRecord
  containment_plan: SignedContainmentPlan
  merge_observation: RepositoryMergeObservation
  rollback_anchor: RepositoryRollbackAnchor
  current_manifest: TheoryPackage
  restore_manifest: TheoryPackage
  release_archive: PackageReleaseArchive
  metadata: Record<string, unknown>
}

export interface RollbackIssue {
  path: string
  code: string
  message: string
}

export interface GovernedRollbackProfile {
  incident_valid: boolean
  containment_valid: boolean
  anchor_valid: boolean
  rollback_quorum_valid: boolean
  release_archive_valid: boolean
  current_hash_valid: boolean
  restore_hash_valid: boolean
  restore_content_valid: boolean
  separation_valid: boolean
  blockers: string[]
  warnings: string[]
  status: 'READY_FOR_CONTROLLED_WRITER' | 'BLOCKED'
}

export const DEFAULT_ROLLBACK_INCIDENT_POLICY: RollbackIncidentPolicy = {
  schema_version: INCIDENT_POLICY_SCHEMA_VERSION,
  id: 'governed-rollback-incident-response',
  version: '1.0.0',
  incident_role: 'incident-commander',
  incident_scope: 'declare:release-incident',
  containment_role: 'containment-authority',
  containment_scope: 'approve:rollback-containment',
  require_incident_and_containment_separation: true,
  require_containment_separate_from_release_authority: true,
  require_evidence_references: true,
  allowed_severities: ['SEV1', 'SEV2', 'SEV3', 'SEV4'],
  metadata: {
    boundary: 'Incident and containment signatures document accountable response. They do not replace rollback quorum or repository release custody.',
  },
}

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/

function issue(path: string, code: string, message: string): RollbackIssue {
  return { path, code, message }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(bytes.length, index + 0x8000)))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - value.length % 4) % 4)}`
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function signPayload(privateKey: CryptoKey, payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalEvidenceJson(payload))
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, bytes)))
}

async function verifyPayload(identity: PromotionAuthorityIdentity, signature: string, payload: unknown): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('jwk', identity.public_key_jwk, { name: 'Ed25519' }, true, ['verify'])
    return crypto.subtle.verify('Ed25519', key, base64UrlToBytes(signature), new TextEncoder().encode(canonicalEvidenceJson(payload)))
  } catch {
    return false
  }
}

async function fingerprintValid(identity: PromotionAuthorityIdentity): Promise<boolean> {
  const digest = await sha256EvidenceDigest(identity.public_key_jwk)
  return identity.id === `authority:${digest.slice('sha256:'.length)}`
}

function without<T extends Record<string, unknown>>(value: T, keys: string[]): Record<string, unknown> {
  const output = { ...value }
  for (const key of keys) delete output[key]
  return output
}

function incidentPayload(record: Omit<SignedIncidentRecord, 'incident_id' | 'signature'>): Record<string, unknown> {
  return { ...record }
}

function containmentPayload(record: Omit<SignedContainmentPlan, 'containment_plan_id' | 'signature'>): Record<string, unknown> {
  return { ...record }
}

function immutableView(value: TheoryPackage): unknown {
  const clone = deepClone(value)
  clone.theory.version = '__VERSION__'
  clone.maturity_level = 1
  const metadata = { ...(clone.metadata ?? {}) }
  delete metadata.release_governance
  clone.metadata = metadata
  return clone
}

async function contentIdValid(prefix: string, value: Record<string, unknown>, idKey: string): Promise<boolean> {
  const unsigned = without(value, [idKey])
  const digest = await sha256EvidenceDigest(unsigned)
  return value[idKey] === `${prefix}:${digest.slice('sha256:'.length)}`
}

export async function createIncidentRecord(
  commander: LocalAuthoritySession,
  input: Omit<SignedIncidentRecord, 'schema_version' | 'incident_id' | 'incident_type' | 'status' | 'declared_by' | 'declared_at_utc' | 'signature'>,
  declaredAt = new Date().toISOString(),
): Promise<SignedIncidentRecord> {
  const unsigned = {
    schema_version: INCIDENT_RECORD_SCHEMA_VERSION,
    incident_type: 'governed-release-incident' as const,
    status: 'OPEN_CONTAINMENT' as const,
    ...deepClone(input),
    declared_by: commander.identity.id,
    declared_at_utc: declaredAt,
  }
  const signature = await signPayload(commander.private_key, incidentPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, signature, incident_id: `incident:${digest.slice('sha256:'.length)}` }
}

export async function createContainmentPlan(
  authority: LocalAuthoritySession,
  input: Omit<SignedContainmentPlan, 'schema_version' | 'containment_plan_id' | 'action' | 'approved_by' | 'approved_at_utc' | 'signature'>,
  approvedAt = new Date().toISOString(),
): Promise<SignedContainmentPlan> {
  const unsigned = {
    schema_version: CONTAINMENT_PLAN_SCHEMA_VERSION,
    action: 'MATERIALIZE_GOVERNED_ROLLBACK' as const,
    ...deepClone(input),
    approved_by: authority.identity.id,
    approved_at_utc: approvedAt,
  }
  const signature = await signPayload(authority.private_key, containmentPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, signature, containment_plan_id: `containment-plan:${digest.slice('sha256:'.length)}` }
}

async function verifyIncident(
  incident: SignedIncidentRecord,
  bundle: PromotionAuthorityBundle,
  policy: RollbackIncidentPolicy,
): Promise<RollbackIssue[]> {
  const issues: RollbackIssue[] = []
  const authority = bundle.authorities.find((item) => item.id === incident.declared_by)
  const payload = incidentPayload(without(incident as unknown as Record<string, unknown>, ['incident_id', 'signature']) as Omit<SignedIncidentRecord, 'incident_id' | 'signature'>)
  const idDigest = await sha256EvidenceDigest({ ...payload, signature: incident.signature })
  if (incident.schema_version !== INCIDENT_RECORD_SCHEMA_VERSION) issues.push(issue('incident.schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${INCIDENT_RECORD_SCHEMA_VERSION}.`))
  if (incident.incident_id !== `incident:${idDigest.slice('sha256:'.length)}`) issues.push(issue('incident.incident_id', 'INVALID_ID', 'Incident id does not match its signed body.'))
  if (!authority || authority.status !== 'active' || !await fingerprintValid(authority)) issues.push(issue('incident.declared_by', 'INVALID_AUTHORITY', 'Incident commander is unknown, inactive, or fingerprint-invalid.'))
  if (authority && !authority.roles.includes(policy.incident_role)) issues.push(issue('incident.declared_by', 'ROLE_MISSING', `Incident commander lacks role ${policy.incident_role}.`))
  if (authority && !authority.authority_scope.includes(policy.incident_scope)) issues.push(issue('incident.declared_by', 'SCOPE_MISSING', `Incident commander lacks ${policy.incident_scope}.`))
  if (!authority || !await verifyPayload(authority, incident.signature, payload)) issues.push(issue('incident.signature', 'INVALID_SIGNATURE', 'Incident signature is invalid.'))
  if (!policy.allowed_severities.includes(incident.severity)) issues.push(issue('incident.severity', 'INVALID_SEVERITY', 'Incident severity is not allowed by policy.'))
  if (!incident.summary.trim() || !incident.containment_rationale.trim() || !incident.rollback_objective.trim()) issues.push(issue('incident', 'REQUIRED_NARRATIVE_MISSING', 'Summary, containment rationale, and rollback objective are required.'))
  if (policy.require_evidence_references && incident.evidence_references.length === 0) issues.push(issue('incident.evidence_references', 'EVIDENCE_REQUIRED', 'At least one inspectable evidence reference is required.'))
  return issues
}

async function verifyContainment(
  plan: SignedContainmentPlan,
  incident: SignedIncidentRecord,
  archive: PackageReleaseArchive,
  bundle: PromotionAuthorityBundle,
  policy: RollbackIncidentPolicy,
): Promise<RollbackIssue[]> {
  const issues: RollbackIssue[] = []
  const authority = bundle.authorities.find((item) => item.id === plan.approved_by)
  const payload = containmentPayload(without(plan as unknown as Record<string, unknown>, ['containment_plan_id', 'signature']) as Omit<SignedContainmentPlan, 'containment_plan_id' | 'signature'>)
  const idDigest = await sha256EvidenceDigest({ ...payload, signature: plan.signature })
  if (plan.schema_version !== CONTAINMENT_PLAN_SCHEMA_VERSION) issues.push(issue('containment_plan.schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${CONTAINMENT_PLAN_SCHEMA_VERSION}.`))
  if (plan.containment_plan_id !== `containment-plan:${idDigest.slice('sha256:'.length)}`) issues.push(issue('containment_plan.containment_plan_id', 'INVALID_ID', 'Containment plan id does not match its signed body.'))
  if (!authority || authority.status !== 'active' || !await fingerprintValid(authority)) issues.push(issue('containment_plan.approved_by', 'INVALID_AUTHORITY', 'Containment authority is unknown, inactive, or fingerprint-invalid.'))
  if (authority && !authority.roles.includes(policy.containment_role)) issues.push(issue('containment_plan.approved_by', 'ROLE_MISSING', `Containment authority lacks role ${policy.containment_role}.`))
  if (authority && !authority.authority_scope.includes(policy.containment_scope)) issues.push(issue('containment_plan.approved_by', 'SCOPE_MISSING', `Containment authority lacks ${policy.containment_scope}.`))
  if (!authority || !await verifyPayload(authority, plan.signature, payload)) issues.push(issue('containment_plan.signature', 'INVALID_SIGNATURE', 'Containment plan signature is invalid.'))
  if (plan.incident_id !== incident.incident_id) issues.push(issue('containment_plan.incident_id', 'INCIDENT_BINDING_MISMATCH', 'Containment plan does not bind the signed incident.'))
  if (plan.release_archive_digest !== await sha256EvidenceDigest(archive)) issues.push(issue('containment_plan.release_archive_digest', 'ARCHIVE_BINDING_MISMATCH', 'Containment plan does not bind the exact release archive.'))
  if (plan.release_receipt_id !== archive.release_bundle.receipt.receipt_id) issues.push(issue('containment_plan.release_receipt_id', 'RECEIPT_BINDING_MISMATCH', 'Containment plan does not bind the archived release receipt.'))
  if (plan.steps.length === 0 || plan.success_conditions.length === 0 || plan.stop_conditions.length === 0) issues.push(issue('containment_plan', 'CONTROL_SET_INCOMPLETE', 'Steps, success conditions, and stop conditions are required.'))
  if (!Number.isInteger(plan.monitoring_window_minutes) || plan.monitoring_window_minutes < 1) issues.push(issue('containment_plan.monitoring_window_minutes', 'INVALID_MONITORING_WINDOW', 'Monitoring window must be a positive integer.'))
  return issues
}

export async function buildGovernedRollbackProfile(
  request: GovernedRollbackRequest,
  policy: RollbackIncidentPolicy = DEFAULT_ROLLBACK_INCIDENT_POLICY,
  now = new Date().toISOString(),
): Promise<GovernedRollbackProfile> {
  const blockers: string[] = []
  const { incident, containment_plan: plan, merge_observation: observation, rollback_anchor: anchor, current_manifest: current, restore_manifest: restore, release_archive: archive } = request
  const authorityBundle = archive.authority_bundle
  const anchorIssues = [...validateMergeObservation(observation), ...validateRollbackAnchor(anchor)]
  const observationIdValid = await contentIdValid('merge-observation', observation as unknown as Record<string, unknown>, 'observation_id')
  const anchorIdValid = await contentIdValid('rollback-anchor', anchor as unknown as Record<string, unknown>, 'rollback_anchor_id')
  if (!observationIdValid) anchorIssues.push(issue('merge_observation.observation_id', 'INVALID_CONTENT_ID', 'Merge observation id is not content-addressed to its body.'))
  if (!anchorIdValid) anchorIssues.push(issue('rollback_anchor.rollback_anchor_id', 'INVALID_CONTENT_ID', 'Rollback anchor id is not content-addressed to its body.'))
  if (observation.rollback_anchor_id !== anchor.rollback_anchor_id || observation.pull_request.merge_commit !== anchor.merge_commit) anchorIssues.push(issue('rollback_anchor', 'OBSERVATION_ANCHOR_MISMATCH', 'Merge observation and rollback anchor are detached.'))
  if (anchor.action_applied !== 'PROMOTION') anchorIssues.push(issue('rollback_anchor.action_applied', 'ROLLBACK_SOURCE_NOT_PROMOTION', 'Default v1.0 policy accepts rollback anchors established by a promotion.'))

  const currentHash = await sha256EvidenceDigest(current)
  const restoreHash = await sha256EvidenceDigest(restore)
  const currentHashValid = currentHash === anchor.merged_manifest_hash && currentHash === incident.current_manifest_hash
  const restoreHashValid = restoreHash === anchor.restore_manifest_hash && restoreHash === incident.restore_manifest_hash
  const restoreContentValid = canonicalEvidenceJson(immutableView(current)) === canonicalEvidenceJson(immutableView(restore)) && canonicalEvidenceJson(immutableView(archive.release_bundle.after_manifest)) === canonicalEvidenceJson(immutableView(restore))
  if (!currentHashValid) blockers.push('Current manifest does not match the merged rollback anchor and incident declaration.')
  if (!restoreHashValid) blockers.push('Restore manifest does not match the rollback anchor and incident declaration.')
  if (!restoreContentValid) blockers.push('Rollback target changes immutable theory content instead of restoring only governed release state.')
  if (incident.repository !== anchor.repository || incident.package_id !== current.theory.id || incident.target_path !== anchor.target_path || incident.merge_observation_id !== observation.observation_id || incident.rollback_anchor_id !== anchor.rollback_anchor_id) blockers.push('Incident declaration is detached from the exact repository, package, merge observation, or rollback anchor.')

  const incidentIssues = await verifyIncident(incident, authorityBundle, policy)
  const containmentIssues = await verifyContainment(plan, incident, archive, authorityBundle, policy)
  const releaseAuthorityId = archive.release_bundle.proposal.release_authority_id
  const separationValid = (!policy.require_incident_and_containment_separation || incident.declared_by !== plan.approved_by) && (!policy.require_containment_separate_from_release_authority || plan.approved_by !== releaseAuthorityId)
  if (!separationValid) blockers.push('Incident, containment, and release custody separation requirements are not satisfied.')

  const decision: SignedPromotionAuthorityDecisionReceipt = archive.signed_authority_decision
  const rollback = await evaluateSignedRollback(decision, authorityBundle, undefined, now)
  const rollbackQuorumValid = rollback.status === 'ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE'
  if (!rollbackQuorumValid) blockers.push(...rollback.blockers)
  if (anchor.authority_decision_id !== decision.decision_id || archive.release_bundle.proposal.action !== 'ROLLBACK' || archive.release_bundle.receipt.action !== 'ROLLBACK') blockers.push('Release archive is not a rollback of the anchor-bound authority decision.')
  if (plan.rollback_anchor_id !== anchor.rollback_anchor_id || plan.expected_current_manifest_hash !== currentHash || plan.expected_restore_manifest_hash !== restoreHash) blockers.push('Containment plan is detached from the exact anchor or manifests.')

  const archiveVerification = await verifyPackageReleaseArchive(archive, undefined, now)
  const releaseArchiveValid = archiveVerification.accepted && archiveVerification.release_profile_status === 'AUTHORIZED_NOT_COMMITTED'
  if (!releaseArchiveValid) blockers.push(...archiveVerification.issues.map((item) => `${item.code}: ${item.message}`))
  blockers.push(...anchorIssues.map((item) => `${item.code}: ${item.message}`))
  blockers.push(...incidentIssues.map((item) => `${item.code}: ${item.message}`))
  blockers.push(...containmentIssues.map((item) => `${item.code}: ${item.message}`))

  const warnings = [
    'READY_FOR_CONTROLLED_WRITER does not modify the repository.',
    'The rollback release must pass the existing controlled writer, application PR, merge, and reconciliation chain.',
    'Incident signatures and rollback quorum do not prove package claims or erase the original release history.',
  ]
  return {
    incident_valid: incidentIssues.length === 0,
    containment_valid: containmentIssues.length === 0,
    anchor_valid: anchorIssues.length === 0,
    rollback_quorum_valid: rollbackQuorumValid,
    release_archive_valid: releaseArchiveValid,
    current_hash_valid: currentHashValid,
    restore_hash_valid: restoreHashValid,
    restore_content_valid: restoreContentValid,
    separation_valid: separationValid,
    blockers,
    warnings,
    status: blockers.length === 0 ? 'READY_FOR_CONTROLLED_WRITER' : 'BLOCKED',
  }
}

export async function createGovernedRollbackRequest(
  current: TheoryPackage,
  restore: TheoryPackage,
  observation: RepositoryMergeObservation,
  anchor: RepositoryRollbackAnchor,
  decision: SignedPromotionAuthorityDecisionReceipt,
  authorityBundle: PromotionAuthorityBundle,
  incident: SignedIncidentRecord,
  targetVersion: string,
  releaseAuthority: LocalAuthoritySession,
  containmentAuthority: LocalAuthoritySession,
  now = new Date().toISOString(),
): Promise<GovernedRollbackRequest> {
  const { proposal, after } = await createPackageReleaseProposal(current, decision, 'ROLLBACK', targetVersion, releaseAuthority, undefined, now)
  const profile = await buildControlledPackageReleaseProfile(current, decision, authorityBundle, proposal, undefined, now)
  const receipt: SignedPackageReleaseReceipt = await createSignedPackageReleaseReceipt(current, profile, proposal, releaseAuthority, now)
  const archive = createPackageReleaseArchive(current, after, proposal, receipt, decision, authorityBundle)
  const archiveDigest = await sha256EvidenceDigest(archive)
  const plan = await createContainmentPlan(containmentAuthority, {
    incident_id: incident.incident_id,
    rollback_anchor_id: anchor.rollback_anchor_id,
    release_archive_digest: archiveDigest,
    release_receipt_id: receipt.receipt_id,
    expected_current_manifest_hash: await sha256EvidenceDigest(current),
    expected_restore_manifest_hash: await sha256EvidenceDigest(restore),
    steps: ['Freeze further package promotions.', 'Materialize the signed rollback archive.', 'Submit the archive to the controlled repository writer.', 'Observe the application merge and reconcile the rollback.'],
    success_conditions: ['The governed target manifest matches the signed rollback after-hash.', 'A new merge observation records action ROLLBACK.', 'The original promotion and incident records remain append-only.'],
    stop_conditions: ['Live manifest hash drifts from the incident-bound current hash.', 'Rollback quorum, release custody, or repository attestation becomes invalid.', 'The restore target changes immutable theory content.'],
    monitoring_window_minutes: 1440,
    metadata: { policy_id: DEFAULT_ROLLBACK_INCIDENT_POLICY.id },
  }, now)
  return {
    request_schema_version: GOVERNED_ROLLBACK_REQUEST_SCHEMA_VERSION,
    incident: deepClone(incident),
    containment_plan: plan,
    merge_observation: deepClone(observation),
    rollback_anchor: deepClone(anchor),
    current_manifest: deepClone(current),
    restore_manifest: deepClone(restore),
    release_archive: archive,
    metadata: {
      portable_public_artifact: true,
      repository_commit_status: 'NOT_COMMITTED',
      next_gate: 'controlled-release-writer',
    },
  }
}

export function validateGovernedRollbackRequest(value: unknown): RollbackIssue[] {
  const issues: RollbackIssue[] = []
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [issue('$', 'EXPECTED_OBJECT', 'Governed rollback request must be an object.')]
  const record = value as Record<string, unknown>
  if (record.request_schema_version !== GOVERNED_ROLLBACK_REQUEST_SCHEMA_VERSION) issues.push(issue('request_schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${GOVERNED_ROLLBACK_REQUEST_SCHEMA_VERSION}.`))
  for (const key of ['incident', 'containment_plan', 'merge_observation', 'rollback_anchor', 'current_manifest', 'restore_manifest', 'release_archive'] as const) {
    if (typeof record[key] !== 'object' || record[key] === null || Array.isArray(record[key])) issues.push(issue(key, 'EXPECTED_OBJECT', `${key} is required.`))
  }
  const incident = record.incident as Record<string, unknown> | undefined
  const plan = record.containment_plan as Record<string, unknown> | undefined
  if (incident && incident.schema_version !== INCIDENT_RECORD_SCHEMA_VERSION) issues.push(issue('incident.schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${INCIDENT_RECORD_SCHEMA_VERSION}.`))
  if (plan && plan.schema_version !== CONTAINMENT_PLAN_SCHEMA_VERSION) issues.push(issue('containment_plan.schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${CONTAINMENT_PLAN_SCHEMA_VERSION}.`))
  for (const hash of [incident?.current_manifest_hash, incident?.restore_manifest_hash, plan?.release_archive_digest, plan?.expected_current_manifest_hash, plan?.expected_restore_manifest_hash]) {
    if (typeof hash !== 'string' || !HASH_PATTERN.test(hash)) issues.push(issue('$', 'INVALID_HASH', 'Governed rollback hashes must be canonical SHA-256 values.'))
  }
  return issues
}

export function parseGovernedRollbackRequestJson(text: string): { request: GovernedRollbackRequest | null; issues: RollbackIssue[] } {
  try {
    const value: unknown = JSON.parse(text)
    const issues = validateGovernedRollbackRequest(value)
    return { request: issues.length === 0 ? value as GovernedRollbackRequest : null, issues }
  } catch (error) {
    return { request: null, issues: [issue('$', 'INVALID_JSON', error instanceof Error ? error.message : String(error))] }
  }
}
