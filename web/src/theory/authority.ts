import { canonicalEvidenceJson, sha256EvidenceDigest } from './custody.js'
import type { PromotionAssessmentReceipt } from './promotion.js'

export const AUTHORITY_IDENTITY_SCHEMA_VERSION = 'promotion-authority:v0.1' as const
export const AUTHORITY_BUNDLE_SCHEMA_VERSION = 'promotion-authority-bundle:v0.1' as const
export const MANDATE_SCHEMA_VERSION = 'promotion-mandate:v0.1' as const
export const BALLOT_SCHEMA_VERSION = 'promotion-ballot:v0.1' as const
export const APPEAL_SCHEMA_VERSION = 'promotion-appeal:v0.1' as const
export const ROLLBACK_BALLOT_SCHEMA_VERSION = 'promotion-rollback-ballot:v0.1' as const
export const AUTHORITY_POLICY_SCHEMA_VERSION = 'promotion-authority-policy:v0.1' as const
export const AUTHORITY_DECISION_SCHEMA_VERSION = 'promotion-authority-decision:v0.1' as const

export type AuthorityStatus = 'active' | 'revoked'
export type BallotDisposition = 'APPROVE' | 'REJECT' | 'ABSTAIN'
export type AuthorityDecisionStatus = 'APPROVED_PENDING_PACKAGE_UPDATE' | 'REJECTED' | 'BLOCKED'
export type RollbackStatus = 'ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE' | 'ROLLBACK_BLOCKED'

export interface PromotionAuthorityIdentity {
  schema_version: typeof AUTHORITY_IDENTITY_SCHEMA_VERSION
  id: string
  display_name: string
  algorithm: 'Ed25519'
  public_key_jwk: JsonWebKey
  roles: string[]
  independence_domains: string[]
  authority_scope: string[]
  status: AuthorityStatus
  created_at_utc: string
  metadata: Record<string, unknown>
}

export interface LocalAuthoritySession {
  identity: PromotionAuthorityIdentity
  private_key: CryptoKey
}

export interface PromotionMandate {
  schema_version: typeof MANDATE_SCHEMA_VERSION
  mandate_id: string
  issuer_id: string
  subject_authority_id: string
  role: string
  package_id: string
  package_version: string
  target_level: 4
  scopes: string[]
  valid_from_utc: string
  expires_at_utc: string
  max_decisions: number
  supersedes: string[]
  issued_at_utc: string
  signature: string
  metadata: Record<string, unknown>
}

export interface PromotionBallot {
  schema_version: typeof BALLOT_SCHEMA_VERSION
  ballot_id: string
  assessment_id: string
  package_id: string
  package_version: string
  target_level: 4
  authority_id: string
  mandate_id: string
  disposition: BallotDisposition
  reason: string
  issued_at_utc: string
  signature: string
  metadata: Record<string, unknown>
}

export interface PromotionAppeal {
  schema_version: typeof APPEAL_SCHEMA_VERSION
  appeal_id: string
  decision_id: string
  authority_id: string
  grounds: string
  issued_at_utc: string
  signature: string
  metadata: Record<string, unknown>
}

export interface RollbackBallot {
  schema_version: typeof ROLLBACK_BALLOT_SCHEMA_VERSION
  rollback_ballot_id: string
  decision_id: string
  package_id: string
  package_version: string
  target_level: 4
  authority_id: string
  mandate_id: string
  reason: string
  issued_at_utc: string
  signature: string
  metadata: Record<string, unknown>
}

export interface PromotionAuthorityBundle {
  bundle_schema_version: typeof AUTHORITY_BUNDLE_SCHEMA_VERSION
  authorities: PromotionAuthorityIdentity[]
  mandates: PromotionMandate[]
  ballots: PromotionBallot[]
  appeals: PromotionAppeal[]
  rollback_ballots: RollbackBallot[]
  metadata: Record<string, unknown>
}

export interface PromotionAuthorityPolicy {
  schema_version: typeof AUTHORITY_POLICY_SCHEMA_VERSION
  id: string
  version: string
  target_level: 4
  minimum_approvals: number
  minimum_distinct_independence_domains: number
  required_roles: string[]
  require_no_reject_ballots: boolean
  mandate_issuer_scope: string
  ballot_scope: string
  appeal_scope: string
  rollback_scope: string
  minimum_rollback_approvals: number
  decision_validity_days: number
  metadata: Record<string, unknown>
}

export interface AuthorityIssue {
  path: string
  code: string
  message: string
}

export interface MandateVerification {
  mandate_id: string
  subject_authority_id: string
  role: string
  signature_valid: boolean
  issuer_authorized: boolean
  identity_valid: boolean
  package_binding_valid: boolean
  time_valid: boolean
  superseded: boolean
  scope_valid: boolean
  accepted: boolean
  issues: AuthorityIssue[]
}

export interface BallotVerification {
  ballot_id: string
  authority_id: string
  mandate_id: string
  disposition: BallotDisposition
  signature_valid: boolean
  assessment_binding_valid: boolean
  mandate_valid: boolean
  authority_active: boolean
  accepted: boolean
  independence_domains: string[]
  role: string | null
  issues: AuthorityIssue[]
}

export interface PromotionAuthorityProfile {
  policy: PromotionAuthorityPolicy
  assessment_id: string
  package_id: string
  package_version: string
  assessment_eligible: boolean
  mandates: MandateVerification[]
  ballots: BallotVerification[]
  accepted_approvals: BallotVerification[]
  accepted_rejections: BallotVerification[]
  distinct_approval_authorities: string[]
  distinct_independence_domains: string[]
  covered_roles: string[]
  quorum_satisfied: boolean
  blockers: string[]
  warnings: string[]
  status: AuthorityDecisionStatus
}

export interface PromotionAuthorityDecisionReceipt {
  schema_version: typeof AUTHORITY_DECISION_SCHEMA_VERSION
  decision_id: string
  decision_type: 'authority-authorization-not-package-mutation'
  assessment_id: string
  package: {
    id: string
    version: string
    current_maturity_level: number
    target_level: 4
  }
  policy: {
    id: string
    version: string
    schema_version: string
  }
  quorum: {
    minimum_approvals: number
    accepted_approval_ballot_ids: string[]
    accepted_rejection_ballot_ids: string[]
    distinct_authority_ids: string[]
    independence_domains: string[]
    covered_roles: string[]
  }
  mandate_ids: string[]
  status: AuthorityDecisionStatus
  blockers: string[]
  warnings: string[]
  issued_at_utc: string
  expires_at_utc: string
  claims_supported: string[]
  prohibited_inferences: string[]
}

export interface AppealProfile {
  decision_id: string
  valid_appeal_ids: string[]
  appeal_open: boolean
  issues: AuthorityIssue[]
}

export interface RollbackProfile {
  decision_id: string
  valid_ballot_ids: string[]
  distinct_authority_ids: string[]
  distinct_independence_domains: string[]
  covered_roles: string[]
  blockers: string[]
  status: RollbackStatus
}

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)*$/

function issue(path: string, code: string, message: string): AuthorityIssue {
  return { path, code, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(bytes.length, index + chunk)))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function signPayload(privateKey: CryptoKey, payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalEvidenceJson(payload))
  const signature = await crypto.subtle.sign('Ed25519', privateKey, bytes)
  return bytesToBase64Url(new Uint8Array(signature))
}

async function verifyPayload(identity: PromotionAuthorityIdentity, signature: string, payload: unknown): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey('jwk', identity.public_key_jwk, { name: 'Ed25519' }, true, ['verify'])
    const bytes = new TextEncoder().encode(canonicalEvidenceJson(payload))
    return crypto.subtle.verify('Ed25519', publicKey, base64UrlToBytes(signature), bytes)
  } catch {
    return false
  }
}

function mandatePayload(record: Omit<PromotionMandate, 'mandate_id' | 'signature'>): Record<string, unknown> {
  return { ...record }
}

function ballotPayload(record: Omit<PromotionBallot, 'ballot_id' | 'signature'>): Record<string, unknown> {
  return { ...record }
}

function appealPayload(record: Omit<PromotionAppeal, 'appeal_id' | 'signature'>): Record<string, unknown> {
  return { ...record }
}

function rollbackPayload(record: Omit<RollbackBallot, 'rollback_ballot_id' | 'signature'>): Record<string, unknown> {
  return { ...record }
}

async function identityFingerprint(identity: PromotionAuthorityIdentity): Promise<string> {
  const digest = await sha256EvidenceDigest(identity.public_key_jwk)
  return `authority:${digest.slice('sha256:'.length)}`
}

function dateMs(value: string): number {
  return Date.parse(value)
}

function addDays(value: string, days: number): string {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export const DEFAULT_PROMOTION_AUTHORITY_POLICY: PromotionAuthorityPolicy = {
  schema_version: AUTHORITY_POLICY_SCHEMA_VERSION,
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
  metadata: {
    decision_boundary: 'Quorum authorizes a later package update. It does not edit the package, prove the mathematics, or pass the Reality Gate.',
  },
}

export function emptyAuthorityBundle(): PromotionAuthorityBundle {
  return {
    bundle_schema_version: AUTHORITY_BUNDLE_SCHEMA_VERSION,
    authorities: [],
    mandates: [],
    ballots: [],
    appeals: [],
    rollback_ballots: [],
    metadata: { planning_artifact: true },
  }
}

export async function generateLocalAuthority(
  displayName: string,
  roles: string[],
  independenceDomains: string[],
  authorityScope: string[],
  now = new Date().toISOString(),
): Promise<LocalAuthoritySession> {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const digest = await sha256EvidenceDigest(publicKeyJwk)
  return {
    identity: {
      schema_version: AUTHORITY_IDENTITY_SCHEMA_VERSION,
      id: `authority:${digest.slice('sha256:'.length)}`,
      display_name: displayName.trim() || 'Unnamed promotion authority',
      algorithm: 'Ed25519',
      public_key_jwk: publicKeyJwk,
      roles: [...new Set(roles)],
      independence_domains: [...new Set(independenceDomains)],
      authority_scope: [...new Set(authorityScope)],
      status: 'active',
      created_at_utc: now,
      metadata: { custody_class: 'browser-ephemeral', private_key_exported: false },
    },
    private_key: keyPair.privateKey,
  }
}

export async function issuePromotionMandate(
  issuer: LocalAuthoritySession,
  subjectAuthorityId: string,
  role: string,
  assessment: PromotionAssessmentReceipt,
  scopes: string[],
  options: {
    valid_from_utc?: string
    expires_at_utc?: string
    max_decisions?: number
    supersedes?: string[]
    issued_at_utc?: string
    metadata?: Record<string, unknown>
  } = {},
): Promise<PromotionMandate> {
  if (!issuer.identity.authority_scope.includes(DEFAULT_PROMOTION_AUTHORITY_POLICY.mandate_issuer_scope)) {
    throw new Error(`Issuer lacks ${DEFAULT_PROMOTION_AUTHORITY_POLICY.mandate_issuer_scope}.`)
  }
  const issuedAt = options.issued_at_utc ?? new Date().toISOString()
  const validFrom = options.valid_from_utc ?? issuedAt
  const expiresAt = options.expires_at_utc ?? addDays(validFrom, 30)
  const unsigned = {
    schema_version: MANDATE_SCHEMA_VERSION,
    issuer_id: issuer.identity.id,
    subject_authority_id: subjectAuthorityId,
    role,
    package_id: assessment.package.id,
    package_version: assessment.package.version,
    target_level: 4 as const,
    scopes: [...new Set(scopes)],
    valid_from_utc: validFrom,
    expires_at_utc: expiresAt,
    max_decisions: options.max_decisions ?? 1,
    supersedes: [...(options.supersedes ?? [])],
    issued_at_utc: issuedAt,
    metadata: { ...(options.metadata ?? {}) },
  }
  const signature = await signPayload(issuer.private_key, mandatePayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, mandate_id: `mandate:${digest.slice('sha256:'.length)}`, signature }
}

export async function signPromotionBallot(
  authority: LocalAuthoritySession,
  assessment: PromotionAssessmentReceipt,
  mandate: PromotionMandate,
  disposition: BallotDisposition,
  reason: string,
  options: { issued_at_utc?: string; metadata?: Record<string, unknown> } = {},
): Promise<PromotionBallot> {
  const unsigned = {
    schema_version: BALLOT_SCHEMA_VERSION,
    assessment_id: assessment.assessment_id,
    package_id: assessment.package.id,
    package_version: assessment.package.version,
    target_level: 4 as const,
    authority_id: authority.identity.id,
    mandate_id: mandate.mandate_id,
    disposition,
    reason: reason.trim() || 'No reason supplied.',
    issued_at_utc: options.issued_at_utc ?? new Date().toISOString(),
    metadata: { ...(options.metadata ?? {}) },
  }
  const signature = await signPayload(authority.private_key, ballotPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, ballot_id: `ballot:${digest.slice('sha256:'.length)}`, signature }
}

export async function filePromotionAppeal(
  authority: LocalAuthoritySession,
  decision: PromotionAuthorityDecisionReceipt,
  grounds: string,
  options: { issued_at_utc?: string; metadata?: Record<string, unknown> } = {},
): Promise<PromotionAppeal> {
  const unsigned = {
    schema_version: APPEAL_SCHEMA_VERSION,
    decision_id: decision.decision_id,
    authority_id: authority.identity.id,
    grounds: grounds.trim() || 'No grounds supplied.',
    issued_at_utc: options.issued_at_utc ?? new Date().toISOString(),
    metadata: { ...(options.metadata ?? {}) },
  }
  const signature = await signPayload(authority.private_key, appealPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, appeal_id: `appeal:${digest.slice('sha256:'.length)}`, signature }
}

export async function signRollbackBallot(
  authority: LocalAuthoritySession,
  decision: PromotionAuthorityDecisionReceipt,
  mandate: PromotionMandate,
  reason: string,
  options: { issued_at_utc?: string; metadata?: Record<string, unknown> } = {},
): Promise<RollbackBallot> {
  const unsigned = {
    schema_version: ROLLBACK_BALLOT_SCHEMA_VERSION,
    decision_id: decision.decision_id,
    package_id: decision.package.id,
    package_version: decision.package.version,
    target_level: 4 as const,
    authority_id: authority.identity.id,
    mandate_id: mandate.mandate_id,
    reason: reason.trim() || 'No reason supplied.',
    issued_at_utc: options.issued_at_utc ?? new Date().toISOString(),
    metadata: { ...(options.metadata ?? {}) },
  }
  const signature = await signPayload(authority.private_key, rollbackPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, rollback_ballot_id: `rollback-ballot:${digest.slice('sha256:'.length)}`, signature }
}

export function validateAuthorityBundle(value: unknown): AuthorityIssue[] {
  const issues: AuthorityIssue[] = []
  if (!isRecord(value)) return [issue('$', 'EXPECTED_OBJECT', 'Authority bundle must be an object.')]
  if (value.bundle_schema_version !== AUTHORITY_BUNDLE_SCHEMA_VERSION) issues.push(issue('bundle_schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${AUTHORITY_BUNDLE_SCHEMA_VERSION}.`))
  for (const key of ['authorities', 'mandates', 'ballots', 'appeals', 'rollback_ballots'] as const) {
    if (!Array.isArray(value[key])) issues.push(issue(key, 'EXPECTED_ARRAY', `${key} must be an array.`))
  }
  if (Array.isArray(value.authorities)) {
    const ids = new Set<string>()
    value.authorities.forEach((raw, index) => {
      const path = `authorities[${index}]`
      if (!isRecord(raw)) return issues.push(issue(path, 'EXPECTED_OBJECT', 'Authority must be an object.'))
      if (raw.schema_version !== AUTHORITY_IDENTITY_SCHEMA_VERSION) issues.push(issue(`${path}.schema_version`, 'UNSUPPORTED_AUTHORITY_SCHEMA', `Expected ${AUTHORITY_IDENTITY_SCHEMA_VERSION}.`))
      if (typeof raw.id !== 'string' || !raw.id.startsWith('authority:')) issues.push(issue(`${path}.id`, 'INVALID_AUTHORITY_ID', 'Expected authority:<sha256 hex>.'))
      if (typeof raw.id === 'string') {
        if (ids.has(raw.id)) issues.push(issue(`${path}.id`, 'DUPLICATE_ID', `Duplicate authority ${raw.id}.`))
        ids.add(raw.id)
      }
      if (!Array.isArray(raw.roles) || !Array.isArray(raw.independence_domains) || !Array.isArray(raw.authority_scope)) issues.push(issue(path, 'AUTHORITY_LISTS_REQUIRED', 'roles, independence_domains, and authority_scope must be arrays.'))
      if (!['active', 'revoked'].includes(String(raw.status))) issues.push(issue(`${path}.status`, 'INVALID_STATUS', 'Authority status must be active or revoked.'))
    })
  }
  for (const [key, prefix] of [['mandates', 'mandate:'], ['ballots', 'ballot:'], ['appeals', 'appeal:'], ['rollback_ballots', 'rollback-ballot:']] as const) {
    if (!Array.isArray(value[key])) continue
    const ids = new Set<string>()
    value[key].forEach((raw, index) => {
      const path = `${key}[${index}]`
      if (!isRecord(raw)) return issues.push(issue(path, 'EXPECTED_OBJECT', `${key} entry must be an object.`))
      const idKey = key === 'mandates' ? 'mandate_id' : key === 'ballots' ? 'ballot_id' : key === 'appeals' ? 'appeal_id' : 'rollback_ballot_id'
      const id = raw[idKey]
      if (typeof id !== 'string' || !id.startsWith(prefix)) issues.push(issue(`${path}.${idKey}`, 'INVALID_RECORD_ID', `Expected ${prefix}<sha256 hex>.`))
      if (typeof id === 'string') {
        if (ids.has(id)) issues.push(issue(`${path}.${idKey}`, 'DUPLICATE_ID', `Duplicate record ${id}.`))
        ids.add(id)
      }
    })
  }
  return issues
}

function supersededMandateIds(bundle: PromotionAuthorityBundle): Set<string> {
  const ids = new Set<string>()
  for (const mandate of bundle.mandates) for (const prior of mandate.supersedes) ids.add(prior)
  return ids
}

function mandateCycleIds(bundle: PromotionAuthorityBundle): Set<string> {
  const graph = new Map(bundle.mandates.map((item) => [item.mandate_id, item.supersedes]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const cycles = new Set<string>()
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      cycles.add(id)
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const prior of graph.get(id) ?? []) visit(prior)
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of graph.keys()) visit(id)
  return cycles
}

async function verifyMandates(
  assessment: PromotionAssessmentReceipt,
  bundle: PromotionAuthorityBundle,
  policy: PromotionAuthorityPolicy,
  now: string,
): Promise<MandateVerification[]> {
  const authorities = new Map(bundle.authorities.map((item) => [item.id, item]))
  const superseded = supersededMandateIds(bundle)
  const cycles = mandateCycleIds(bundle)
  const results: MandateVerification[] = []
  for (const mandate of bundle.mandates) {
    const issuer = authorities.get(mandate.issuer_id)
    const subject = authorities.get(mandate.subject_authority_id)
    const payload = mandatePayload({
      schema_version: mandate.schema_version,
      issuer_id: mandate.issuer_id,
      subject_authority_id: mandate.subject_authority_id,
      role: mandate.role,
      package_id: mandate.package_id,
      package_version: mandate.package_version,
      target_level: mandate.target_level,
      scopes: mandate.scopes,
      valid_from_utc: mandate.valid_from_utc,
      expires_at_utc: mandate.expires_at_utc,
      max_decisions: mandate.max_decisions,
      supersedes: mandate.supersedes,
      issued_at_utc: mandate.issued_at_utc,
      metadata: mandate.metadata,
    })
    const signatureValid = issuer ? await verifyPayload(issuer, mandate.signature, payload) : false
    const expectedDigest = await sha256EvidenceDigest({ ...payload, signature: mandate.signature })
    const idValid = mandate.mandate_id === `mandate:${expectedDigest.slice('sha256:'.length)}`
    const issuerFingerprintValid = issuer ? await identityFingerprint(issuer) === issuer.id : false
    const subjectFingerprintValid = subject ? await identityFingerprint(subject) === subject.id : false
    const issuerAuthorized = Boolean(issuer && issuer.status === 'active' && issuer.authority_scope.includes(policy.mandate_issuer_scope))
    const identityValid = Boolean(subject && subject.status === 'active' && issuerFingerprintValid && subjectFingerprintValid)
    const packageBindingValid = mandate.package_id === assessment.package.id && mandate.package_version === assessment.package.version && mandate.target_level === 4
    const timeValid = Number.isFinite(dateMs(mandate.valid_from_utc)) && Number.isFinite(dateMs(mandate.expires_at_utc)) && dateMs(now) >= dateMs(mandate.valid_from_utc) && dateMs(now) <= dateMs(mandate.expires_at_utc) && dateMs(mandate.expires_at_utc) > dateMs(mandate.valid_from_utc)
    const isSuperseded = superseded.has(mandate.mandate_id) || cycles.has(mandate.mandate_id)
    const scopeValid = mandate.scopes.includes(policy.ballot_scope) && subject?.roles.includes(mandate.role) === true
    const mandateIssues: AuthorityIssue[] = []
    if (!signatureValid) mandateIssues.push(issue(mandate.mandate_id, 'INVALID_MANDATE_SIGNATURE', 'Mandate signature is invalid.'))
    if (!idValid) mandateIssues.push(issue(mandate.mandate_id, 'INVALID_MANDATE_ID', 'Mandate id does not match its signed body.'))
    if (!issuerAuthorized) mandateIssues.push(issue(mandate.mandate_id, 'ISSUER_NOT_AUTHORIZED', `Issuer lacks ${policy.mandate_issuer_scope} or is inactive.`))
    if (!identityValid) mandateIssues.push(issue(mandate.mandate_id, 'AUTHORITY_IDENTITY_INVALID', 'Issuer or subject identity is unknown, inactive, or detached from its public-key fingerprint.'))
    if (!packageBindingValid) mandateIssues.push(issue(mandate.mandate_id, 'MANDATE_PACKAGE_MISMATCH', 'Mandate is not bound to the exact package and target level.'))
    if (!timeValid) mandateIssues.push(issue(mandate.mandate_id, 'MANDATE_EXPIRED_OR_NOT_YET_VALID', 'Mandate is outside its declared validity window.'))
    if (isSuperseded) mandateIssues.push(issue(mandate.mandate_id, cycles.has(mandate.mandate_id) ? 'MANDATE_SUPERSESSION_CYCLE' : 'MANDATE_SUPERSEDED', 'Mandate is not the active lifecycle record.'))
    if (!scopeValid) mandateIssues.push(issue(mandate.mandate_id, 'MANDATE_SCOPE_OR_ROLE_MISMATCH', `Mandate must include ${policy.ballot_scope} and assign a role held by the authority.`))
    const accepted = signatureValid && idValid && issuerAuthorized && identityValid && packageBindingValid && timeValid && !isSuperseded && scopeValid && mandate.max_decisions >= 1
    results.push({
      mandate_id: mandate.mandate_id,
      subject_authority_id: mandate.subject_authority_id,
      role: mandate.role,
      signature_valid: signatureValid && idValid,
      issuer_authorized: issuerAuthorized,
      identity_valid: identityValid,
      package_binding_valid: packageBindingValid,
      time_valid: timeValid,
      superseded: isSuperseded,
      scope_valid: scopeValid,
      accepted,
      issues: mandateIssues,
    })
  }
  return results
}

export async function buildPromotionAuthorityProfile(
  assessment: PromotionAssessmentReceipt,
  bundle: PromotionAuthorityBundle,
  policy: PromotionAuthorityPolicy = DEFAULT_PROMOTION_AUTHORITY_POLICY,
  now = new Date().toISOString(),
): Promise<PromotionAuthorityProfile> {
  const structuralIssues = validateAuthorityBundle(bundle)
  const authorities = new Map(bundle.authorities.map((item) => [item.id, item]))
  const rawMandates = new Map(bundle.mandates.map((item) => [item.mandate_id, item]))
  const mandates = await verifyMandates(assessment, bundle, policy, now)
  const validMandates = new Map(mandates.filter((item) => item.accepted).map((item) => [item.mandate_id, item]))
  const ballotUseCounts = new Map<string, number>()
  for (const ballot of bundle.ballots) ballotUseCounts.set(ballot.mandate_id, (ballotUseCounts.get(ballot.mandate_id) ?? 0) + 1)
  const duplicateAuthorityIds = new Set<string>()
  const seenAuthorityIds = new Set<string>()
  for (const ballot of bundle.ballots) {
    if (seenAuthorityIds.has(ballot.authority_id)) duplicateAuthorityIds.add(ballot.authority_id)
    seenAuthorityIds.add(ballot.authority_id)
  }

  const ballots: BallotVerification[] = []
  for (const ballot of bundle.ballots) {
    const authority = authorities.get(ballot.authority_id)
    const mandate = rawMandates.get(ballot.mandate_id)
    const mandateResult = validMandates.get(ballot.mandate_id)
    const payload = ballotPayload({
      schema_version: ballot.schema_version,
      assessment_id: ballot.assessment_id,
      package_id: ballot.package_id,
      package_version: ballot.package_version,
      target_level: ballot.target_level,
      authority_id: ballot.authority_id,
      mandate_id: ballot.mandate_id,
      disposition: ballot.disposition,
      reason: ballot.reason,
      issued_at_utc: ballot.issued_at_utc,
      metadata: ballot.metadata,
    })
    const signatureValid = authority ? await verifyPayload(authority, ballot.signature, payload) : false
    const expectedDigest = await sha256EvidenceDigest({ ...payload, signature: ballot.signature })
    const idValid = ballot.ballot_id === `ballot:${expectedDigest.slice('sha256:'.length)}`
    const authorityFingerprintValid = authority ? await identityFingerprint(authority) === authority.id : false
    const authorityActive = Boolean(authority && authority.status === 'active' && authorityFingerprintValid)
    const assessmentBindingValid = ballot.assessment_id === assessment.assessment_id && ballot.package_id === assessment.package.id && ballot.package_version === assessment.package.version && ballot.target_level === 4
    const mandateValid = Boolean(mandate && mandateResult && mandateResult.accepted && mandate.subject_authority_id === ballot.authority_id && dateMs(ballot.issued_at_utc) >= dateMs(mandate.valid_from_utc) && dateMs(ballot.issued_at_utc) <= dateMs(mandate.expires_at_utc) && (ballotUseCounts.get(mandate.mandate_id) ?? 0) <= mandate.max_decisions)
    const ballotIssues: AuthorityIssue[] = []
    if (!signatureValid) ballotIssues.push(issue(ballot.ballot_id, 'INVALID_BALLOT_SIGNATURE', 'Ballot signature is invalid.'))
    if (!idValid) ballotIssues.push(issue(ballot.ballot_id, 'INVALID_BALLOT_ID', 'Ballot id does not match its signed body.'))
    if (!authorityActive) ballotIssues.push(issue(ballot.ballot_id, 'AUTHORITY_INACTIVE_OR_INVALID', 'Ballot authority is unknown, inactive, or detached from its public-key fingerprint.'))
    if (!assessmentBindingValid) ballotIssues.push(issue(ballot.ballot_id, 'ASSESSMENT_BINDING_MISMATCH', 'Ballot is not bound to the exact assessment and package.'))
    if (!mandateValid) ballotIssues.push(issue(ballot.ballot_id, 'MANDATE_INVALID_FOR_BALLOT', 'Ballot lacks an active matching mandate or exceeds its use limit.'))
    if (duplicateAuthorityIds.has(ballot.authority_id)) ballotIssues.push(issue(ballot.ballot_id, 'DUPLICATE_AUTHORITY_BALLOT', 'An authority may cast only one ballot for an assessment.'))
    const accepted = signatureValid && idValid && authorityActive && assessmentBindingValid && mandateValid && !duplicateAuthorityIds.has(ballot.authority_id)
    ballots.push({
      ballot_id: ballot.ballot_id,
      authority_id: ballot.authority_id,
      mandate_id: ballot.mandate_id,
      disposition: ballot.disposition,
      signature_valid: signatureValid && idValid,
      assessment_binding_valid: assessmentBindingValid,
      mandate_valid: mandateValid,
      authority_active: authorityActive,
      accepted,
      independence_domains: authority?.independence_domains ?? [],
      role: mandateResult?.role ?? null,
      issues: ballotIssues,
    })
  }

  const approvals = ballots.filter((item) => item.accepted && item.disposition === 'APPROVE')
  const rejections = ballots.filter((item) => item.accepted && item.disposition === 'REJECT')
  const distinctAuthorityIds = [...new Set(approvals.map((item) => item.authority_id))]
  const independenceDomains = [...new Set(approvals.flatMap((item) => item.independence_domains))]
  const roles = [...new Set(approvals.map((item) => item.role).filter((item): item is string => item !== null))]
  const blockers: string[] = []
  const assessmentEligible = assessment.status === 'ELIGIBLE_FOR_REVIEW'
  if (!assessmentEligible) blockers.push('The custody-aware promotion assessment is not ELIGIBLE_FOR_REVIEW.')
  if (structuralIssues.length > 0) blockers.push(`Authority bundle has ${structuralIssues.length} structural issue(s).`)
  if (approvals.length < policy.minimum_approvals) blockers.push(`Policy requires at least ${policy.minimum_approvals} accepted approval ballot(s).`)
  if (distinctAuthorityIds.length < policy.minimum_approvals) blockers.push('Approval quorum must come from distinct authorities.')
  if (independenceDomains.length < policy.minimum_distinct_independence_domains) blockers.push(`Policy requires at least ${policy.minimum_distinct_independence_domains} declared independence domain(s).`)
  for (const role of policy.required_roles) if (!roles.includes(role)) blockers.push(`Required review role ${role} is not represented by an accepted approval.`)
  if (policy.require_no_reject_ballots && rejections.length > 0) blockers.push('At least one valid rejection ballot blocks authorization under this policy.')
  for (const mandate of mandates.filter((item) => !item.accepted)) blockers.push(`${mandate.mandate_id}: mandate admission failed.`)
  for (const ballot of ballots.filter((item) => !item.accepted)) blockers.push(`${ballot.ballot_id}: ballot admission failed.`)
  const warnings = [
    'Authority quorum authorizes a later package update only. This engine never edits package maturity or Reality Gate status.',
    'Declared independence domains are governance metadata and are not proof of statistical or institutional independence.',
  ]
  const quorumSatisfied = blockers.length === 0
  const status: AuthorityDecisionStatus = !assessmentEligible || structuralIssues.length > 0 || approvals.length < policy.minimum_approvals
    ? 'BLOCKED'
    : rejections.length > 0 && policy.require_no_reject_ballots
      ? 'REJECTED'
      : quorumSatisfied
        ? 'APPROVED_PENDING_PACKAGE_UPDATE'
        : 'BLOCKED'
  return {
    policy,
    assessment_id: assessment.assessment_id,
    package_id: assessment.package.id,
    package_version: assessment.package.version,
    assessment_eligible: assessmentEligible,
    mandates,
    ballots,
    accepted_approvals: approvals,
    accepted_rejections: rejections,
    distinct_approval_authorities: distinctAuthorityIds,
    distinct_independence_domains: independenceDomains,
    covered_roles: roles,
    quorum_satisfied: quorumSatisfied,
    blockers,
    warnings,
    status,
  }
}

export async function createPromotionAuthorityDecisionReceipt(
  profile: PromotionAuthorityProfile,
  currentMaturityLevel: number,
  issuedAt = new Date().toISOString(),
): Promise<PromotionAuthorityDecisionReceipt> {
  const unsigned = {
    schema_version: AUTHORITY_DECISION_SCHEMA_VERSION,
    decision_type: 'authority-authorization-not-package-mutation' as const,
    assessment_id: profile.assessment_id,
    package: {
      id: profile.package_id,
      version: profile.package_version,
      current_maturity_level: currentMaturityLevel,
      target_level: 4 as const,
    },
    policy: {
      id: profile.policy.id,
      version: profile.policy.version,
      schema_version: profile.policy.schema_version,
    },
    quorum: {
      minimum_approvals: profile.policy.minimum_approvals,
      accepted_approval_ballot_ids: profile.accepted_approvals.map((item) => item.ballot_id),
      accepted_rejection_ballot_ids: profile.accepted_rejections.map((item) => item.ballot_id),
      distinct_authority_ids: [...profile.distinct_approval_authorities],
      independence_domains: [...profile.distinct_independence_domains],
      covered_roles: [...profile.covered_roles],
    },
    mandate_ids: [...new Set(profile.accepted_approvals.map((item) => item.mandate_id))],
    status: profile.status,
    blockers: [...profile.blockers],
    warnings: [...profile.warnings],
    issued_at_utc: issuedAt,
    expires_at_utc: addDays(issuedAt, profile.policy.decision_validity_days),
    claims_supported: profile.status === 'APPROVED_PENDING_PACKAGE_UPDATE'
      ? ['The exact eligible assessment has received sufficient signed authority approval to enter a separately controlled package-update step before this decision expires.']
      : ['The exact assessment is not authorized for a package-update step under the named authority policy.'],
    prohibited_inferences: [
      'The package manifest or maturity level was automatically changed.',
      'Authority approval proves the mathematical claims.',
      'Declared reviewer independence proves empirical independence.',
      'The package passed the Reality Gate.',
      'An expired, appealed, or rolled-back decision remains operative.',
    ],
  }
  const digest = await sha256EvidenceDigest(unsigned)
  return { ...unsigned, decision_id: `authority-decision:${digest.slice('sha256:'.length)}` }
}

export async function evaluateAppeals(
  decision: PromotionAuthorityDecisionReceipt,
  bundle: PromotionAuthorityBundle,
  policy: PromotionAuthorityPolicy = DEFAULT_PROMOTION_AUTHORITY_POLICY,
): Promise<AppealProfile> {
  const authorities = new Map(bundle.authorities.map((item) => [item.id, item]))
  const validAppeals: string[] = []
  const issues: AuthorityIssue[] = []
  for (const appeal of bundle.appeals.filter((item) => item.decision_id === decision.decision_id)) {
    const authority = authorities.get(appeal.authority_id)
    const payload = appealPayload({
      schema_version: appeal.schema_version,
      decision_id: appeal.decision_id,
      authority_id: appeal.authority_id,
      grounds: appeal.grounds,
      issued_at_utc: appeal.issued_at_utc,
      metadata: appeal.metadata,
    })
    const signatureValid = authority ? await verifyPayload(authority, appeal.signature, payload) : false
    const digest = await sha256EvidenceDigest({ ...payload, signature: appeal.signature })
    const idValid = appeal.appeal_id === `appeal:${digest.slice('sha256:'.length)}`
    const authorized = Boolean(authority && authority.status === 'active' && authority.authority_scope.includes(policy.appeal_scope) && await identityFingerprint(authority) === authority.id)
    if (signatureValid && idValid && authorized) validAppeals.push(appeal.appeal_id)
    else issues.push(issue(appeal.appeal_id, 'APPEAL_INVALID', 'Appeal signature, identity, or authority scope is invalid.'))
  }
  return { decision_id: decision.decision_id, valid_appeal_ids: validAppeals, appeal_open: validAppeals.length > 0, issues }
}

export async function evaluateRollback(
  decision: PromotionAuthorityDecisionReceipt,
  bundle: PromotionAuthorityBundle,
  policy: PromotionAuthorityPolicy = DEFAULT_PROMOTION_AUTHORITY_POLICY,
  now = new Date().toISOString(),
): Promise<RollbackProfile> {
  const authorities = new Map(bundle.authorities.map((item) => [item.id, item]))
  const mandates = new Map(bundle.mandates.map((item) => [item.mandate_id, item]))
  const validIds: string[] = []
  const authorityIds: string[] = []
  const domains: string[] = []
  const roles: string[] = []
  const blockers: string[] = []
  const seen = new Set<string>()
  for (const ballot of bundle.rollback_ballots.filter((item) => item.decision_id === decision.decision_id)) {
    const authority = authorities.get(ballot.authority_id)
    const mandate = mandates.get(ballot.mandate_id)
    const payload = rollbackPayload({
      schema_version: ballot.schema_version,
      decision_id: ballot.decision_id,
      package_id: ballot.package_id,
      package_version: ballot.package_version,
      target_level: ballot.target_level,
      authority_id: ballot.authority_id,
      mandate_id: ballot.mandate_id,
      reason: ballot.reason,
      issued_at_utc: ballot.issued_at_utc,
      metadata: ballot.metadata,
    })
    const signatureValid = authority ? await verifyPayload(authority, ballot.signature, payload) : false
    const digest = await sha256EvidenceDigest({ ...payload, signature: ballot.signature })
    const idValid = ballot.rollback_ballot_id === `rollback-ballot:${digest.slice('sha256:'.length)}`
    const authorityValid = Boolean(authority && authority.status === 'active' && authority.authority_scope.includes(policy.rollback_scope) && await identityFingerprint(authority) === authority.id)
    const mandateValid = Boolean(mandate && mandate.subject_authority_id === ballot.authority_id && mandate.package_id === decision.package.id && mandate.package_version === decision.package.version && mandate.scopes.includes(policy.rollback_scope) && dateMs(now) >= dateMs(mandate.valid_from_utc) && dateMs(now) <= dateMs(mandate.expires_at_utc))
    const unique = !seen.has(ballot.authority_id)
    seen.add(ballot.authority_id)
    const bindingValid = ballot.package_id === decision.package.id && ballot.package_version === decision.package.version && ballot.target_level === decision.package.target_level
    if (signatureValid && idValid && authorityValid && mandateValid && unique && bindingValid) {
      validIds.push(ballot.rollback_ballot_id)
      authorityIds.push(ballot.authority_id)
      domains.push(...(authority?.independence_domains ?? []))
      if (mandate?.role) roles.push(mandate.role)
    } else blockers.push(`${ballot.rollback_ballot_id}: rollback ballot is invalid or unauthorized.`)
  }
  const distinctAuthorities = [...new Set(authorityIds)]
  const distinctDomains = [...new Set(domains)]
  const coveredRoles = [...new Set(roles)]
  if (decision.status !== 'APPROVED_PENDING_PACKAGE_UPDATE') blockers.push('Only an approved authority decision may be rolled back through this lane.')
  if (validIds.length < policy.minimum_rollback_approvals) blockers.push(`Rollback requires at least ${policy.minimum_rollback_approvals} accepted ballot(s).`)
  if (distinctDomains.length < policy.minimum_distinct_independence_domains) blockers.push('Rollback quorum lacks required independence-domain diversity.')
  for (const role of policy.required_roles) if (!coveredRoles.includes(role)) blockers.push(`Rollback quorum lacks required role ${role}.`)
  return {
    decision_id: decision.decision_id,
    valid_ballot_ids: validIds,
    distinct_authority_ids: distinctAuthorities,
    distinct_independence_domains: distinctDomains,
    covered_roles: coveredRoles,
    blockers,
    status: blockers.length === 0 ? 'ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE' : 'ROLLBACK_BLOCKED',
  }
}

export function parseAuthorityBundleJson(text: string): { bundle: PromotionAuthorityBundle | null; issues: AuthorityIssue[] } {
  try {
    const value: unknown = JSON.parse(text)
    const issues = validateAuthorityBundle(value)
    return { bundle: issues.length === 0 ? value as PromotionAuthorityBundle : null, issues }
  } catch (error) {
    return { bundle: null, issues: [issue('$', 'INVALID_JSON', error instanceof Error ? error.message : String(error))] }
  }
}
