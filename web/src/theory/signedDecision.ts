import { canonicalEvidenceJson, sha256EvidenceDigest } from './custody.js'
import {
  AUTHORITY_DECISION_SCHEMA_VERSION,
  DEFAULT_PROMOTION_AUTHORITY_POLICY,
  ROLLBACK_BALLOT_SCHEMA_VERSION,
  evaluateAppeals,
  type AppealProfile,
  type LocalAuthoritySession,
  type PromotionAuthorityBundle,
  type PromotionAuthorityDecisionReceipt,
  type PromotionAuthorityIdentity,
  type PromotionAuthorityPolicy,
  type PromotionAuthorityProfile,
  type PromotionMandate,
  type RollbackBallot,
  type RollbackProfile,
} from './authority.js'

export const SIGNED_AUTHORITY_DECISION_SCHEMA_VERSION = 'signed-promotion-decision:v0.1' as const

export interface SignedPromotionAuthorityDecisionReceipt extends PromotionAuthorityDecisionReceipt {
  signed_schema_version: typeof SIGNED_AUTHORITY_DECISION_SCHEMA_VERSION
  recorded_by: string
  signature: string
}

export interface SignedDecisionVerification {
  decision_id: string
  recorder_id: string
  signature_valid: boolean
  decision_id_valid: boolean
  recorder_known: boolean
  recorder_active: boolean
  recorder_scope_valid: boolean
  recorder_fingerprint_valid: boolean
  time_valid: boolean
  accepted: boolean
  issues: string[]
}

export interface DecisionLifecycleProfile {
  decision_id: string
  verification: SignedDecisionVerification
  appeal: AppealProfile
  rollback: RollbackProfile
  expired: boolean
  operative: boolean
  blockers: string[]
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

async function fingerprintValid(identity: PromotionAuthorityIdentity): Promise<boolean> {
  const digest = await sha256EvidenceDigest(identity.public_key_jwk)
  return identity.id === `authority:${digest.slice('sha256:'.length)}`
}

function addDays(value: string, days: number): string {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function dateMs(value: string): number {
  return Date.parse(value)
}

function signedDecisionPayload(
  decision: Omit<SignedPromotionAuthorityDecisionReceipt, 'decision_id' | 'signature'>,
): Record<string, unknown> {
  return { ...decision }
}

function mandatePayload(record: PromotionMandate): Record<string, unknown> {
  return {
    schema_version: record.schema_version,
    issuer_id: record.issuer_id,
    subject_authority_id: record.subject_authority_id,
    role: record.role,
    package_id: record.package_id,
    package_version: record.package_version,
    target_level: record.target_level,
    scopes: record.scopes,
    valid_from_utc: record.valid_from_utc,
    expires_at_utc: record.expires_at_utc,
    max_decisions: record.max_decisions,
    supersedes: record.supersedes,
    issued_at_utc: record.issued_at_utc,
    metadata: record.metadata,
  }
}

function rollbackPayload(record: RollbackBallot): Record<string, unknown> {
  return {
    schema_version: record.schema_version,
    decision_id: record.decision_id,
    package_id: record.package_id,
    package_version: record.package_version,
    target_level: record.target_level,
    authority_id: record.authority_id,
    mandate_id: record.mandate_id,
    reason: record.reason,
    issued_at_utc: record.issued_at_utc,
    metadata: record.metadata,
  }
}

export async function createSignedPromotionDecision(
  profile: PromotionAuthorityProfile,
  currentMaturityLevel: number,
  recorder: LocalAuthoritySession,
  issuedAt = new Date().toISOString(),
): Promise<SignedPromotionAuthorityDecisionReceipt> {
  if (recorder.identity.status !== 'active') throw new Error('Decision recorder is not active.')
  if (!recorder.identity.authority_scope.includes('record:promotion-decision')) throw new Error('Decision recorder lacks record:promotion-decision.')
  if (!await fingerprintValid(recorder.identity)) throw new Error('Decision recorder id does not match its public-key fingerprint.')
  const unsigned = {
    schema_version: AUTHORITY_DECISION_SCHEMA_VERSION,
    signed_schema_version: SIGNED_AUTHORITY_DECISION_SCHEMA_VERSION,
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
    recorded_by: recorder.identity.id,
    claims_supported: profile.status === 'APPROVED_PENDING_PACKAGE_UPDATE'
      ? ['The exact eligible assessment has received sufficient signed authority approval to enter a separately controlled package-update step before this signed decision expires.']
      : ['The exact assessment is not authorized for a package-update step under the named authority policy.'],
    prohibited_inferences: [
      'The package manifest or maturity level was automatically changed.',
      'Authority approval proves the mathematical claims.',
      'Declared reviewer independence proves empirical independence.',
      'The package passed the Reality Gate.',
      'An expired, appealed, or rollback-authorized decision remains operative.',
    ],
  }
  const signature = await signPayload(recorder.private_key, signedDecisionPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, signature, decision_id: `authority-decision:${digest.slice('sha256:'.length)}` }
}

export async function verifySignedPromotionDecision(
  decision: SignedPromotionAuthorityDecisionReceipt,
  authorities: PromotionAuthorityIdentity[],
  now = new Date().toISOString(),
): Promise<SignedDecisionVerification> {
  const recorder = authorities.find((item) => item.id === decision.recorded_by)
  const payload = signedDecisionPayload({
    schema_version: decision.schema_version,
    signed_schema_version: decision.signed_schema_version,
    decision_type: decision.decision_type,
    assessment_id: decision.assessment_id,
    package: decision.package,
    policy: decision.policy,
    quorum: decision.quorum,
    mandate_ids: decision.mandate_ids,
    status: decision.status,
    blockers: decision.blockers,
    warnings: decision.warnings,
    issued_at_utc: decision.issued_at_utc,
    expires_at_utc: decision.expires_at_utc,
    recorded_by: decision.recorded_by,
    claims_supported: decision.claims_supported,
    prohibited_inferences: decision.prohibited_inferences,
  })
  const signatureValid = recorder ? await verifyPayload(recorder, decision.signature, payload) : false
  const digest = await sha256EvidenceDigest({ ...payload, signature: decision.signature })
  const decisionIdValid = decision.decision_id === `authority-decision:${digest.slice('sha256:'.length)}`
  const recorderKnown = Boolean(recorder)
  const recorderActive = recorder?.status === 'active'
  const recorderScopeValid = recorder?.authority_scope.includes('record:promotion-decision') === true
  const recorderFingerprintValid = recorder ? await fingerprintValid(recorder) : false
  const timeValid = Number.isFinite(dateMs(decision.issued_at_utc)) && Number.isFinite(dateMs(decision.expires_at_utc)) && dateMs(now) >= dateMs(decision.issued_at_utc) && dateMs(now) <= dateMs(decision.expires_at_utc)
  const issues: string[] = []
  if (!signatureValid) issues.push('Decision recorder signature is invalid.')
  if (!decisionIdValid) issues.push('Decision id does not match its canonical signed body.')
  if (!recorderKnown) issues.push('Decision recorder is unknown.')
  if (!recorderActive) issues.push('Decision recorder is not active.')
  if (!recorderScopeValid) issues.push('Decision recorder lacks record:promotion-decision.')
  if (!recorderFingerprintValid) issues.push('Decision recorder id does not match its public key fingerprint.')
  if (!timeValid) issues.push('Decision is not yet valid or has expired.')
  return {
    decision_id: decision.decision_id,
    recorder_id: decision.recorded_by,
    signature_valid: signatureValid,
    decision_id_valid: decisionIdValid,
    recorder_known: recorderKnown,
    recorder_active: Boolean(recorderActive),
    recorder_scope_valid: recorderScopeValid,
    recorder_fingerprint_valid: recorderFingerprintValid,
    time_valid: timeValid,
    accepted: signatureValid && decisionIdValid && recorderKnown && Boolean(recorderActive) && recorderScopeValid && recorderFingerprintValid && timeValid,
    issues,
  }
}

function supersededMandates(bundle: PromotionAuthorityBundle): Set<string> {
  return new Set(bundle.mandates.flatMap((item) => item.supersedes))
}

async function rollbackMandateValid(
  mandate: PromotionMandate,
  bundle: PromotionAuthorityBundle,
  decision: SignedPromotionAuthorityDecisionReceipt,
  authority: PromotionAuthorityIdentity,
  policy: PromotionAuthorityPolicy,
  now: string,
): Promise<boolean> {
  const issuer = bundle.authorities.find((item) => item.id === mandate.issuer_id)
  if (!issuer || issuer.status !== 'active' || !issuer.authority_scope.includes(policy.mandate_issuer_scope)) return false
  if (!await fingerprintValid(issuer) || !await fingerprintValid(authority)) return false
  const signatureValid = await verifyPayload(issuer, mandate.signature, mandatePayload(mandate))
  const digest = await sha256EvidenceDigest({ ...mandatePayload(mandate), signature: mandate.signature })
  const idValid = mandate.mandate_id === `mandate:${digest.slice('sha256:'.length)}`
  return signatureValid && idValid &&
    mandate.subject_authority_id === authority.id &&
    mandate.package_id === decision.package.id &&
    mandate.package_version === decision.package.version &&
    mandate.target_level === decision.package.target_level &&
    mandate.scopes.includes(policy.rollback_scope) &&
    authority.roles.includes(mandate.role) &&
    !supersededMandates(bundle).has(mandate.mandate_id) &&
    dateMs(now) >= dateMs(mandate.valid_from_utc) && dateMs(now) <= dateMs(mandate.expires_at_utc)
}

export async function evaluateSignedRollback(
  decision: SignedPromotionAuthorityDecisionReceipt,
  bundle: PromotionAuthorityBundle,
  policy: PromotionAuthorityPolicy = DEFAULT_PROMOTION_AUTHORITY_POLICY,
  now = new Date().toISOString(),
): Promise<RollbackProfile> {
  const validIds: string[] = []
  const authorityIds: string[] = []
  const domains: string[] = []
  const roles: string[] = []
  const blockers: string[] = []
  const seen = new Set<string>()
  for (const ballot of bundle.rollback_ballots.filter((item) => item.decision_id === decision.decision_id)) {
    const authority = bundle.authorities.find((item) => item.id === ballot.authority_id)
    const mandate = bundle.mandates.find((item) => item.mandate_id === ballot.mandate_id)
    const signatureValid = authority ? await verifyPayload(authority, ballot.signature, rollbackPayload(ballot)) : false
    const digest = await sha256EvidenceDigest({ ...rollbackPayload(ballot), signature: ballot.signature })
    const idValid = ballot.schema_version === ROLLBACK_BALLOT_SCHEMA_VERSION && ballot.rollback_ballot_id === `rollback-ballot:${digest.slice('sha256:'.length)}`
    const authorityValid = Boolean(authority && authority.status === 'active' && authority.authority_scope.includes(policy.rollback_scope) && await fingerprintValid(authority))
    const mandateValid = Boolean(authority && mandate && await rollbackMandateValid(mandate, bundle, decision, authority, policy, now))
    const bindingValid = ballot.package_id === decision.package.id && ballot.package_version === decision.package.version && ballot.target_level === decision.package.target_level
    const unique = !seen.has(ballot.authority_id)
    seen.add(ballot.authority_id)
    if (signatureValid && idValid && authorityValid && mandateValid && bindingValid && unique) {
      validIds.push(ballot.rollback_ballot_id)
      authorityIds.push(ballot.authority_id)
      domains.push(...(authority?.independence_domains ?? []))
      if (mandate?.role) roles.push(mandate.role)
    } else blockers.push(`${ballot.rollback_ballot_id}: rollback ballot is invalid, duplicated, or lacks a verified active mandate.`)
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

export async function evaluateSignedDecisionLifecycle(
  decision: SignedPromotionAuthorityDecisionReceipt,
  bundle: PromotionAuthorityBundle,
  policy: PromotionAuthorityPolicy = DEFAULT_PROMOTION_AUTHORITY_POLICY,
  now = new Date().toISOString(),
): Promise<DecisionLifecycleProfile> {
  const verification = await verifySignedPromotionDecision(decision, bundle.authorities, now)
  const appeal = await evaluateAppeals(decision, bundle, policy)
  const rollback = await evaluateSignedRollback(decision, bundle, policy, now)
  const expired = Number.isFinite(dateMs(decision.expires_at_utc)) && dateMs(now) > dateMs(decision.expires_at_utc)
  const blockers: string[] = []
  if (!verification.accepted) blockers.push(...verification.issues)
  if (decision.status !== 'APPROVED_PENDING_PACKAGE_UPDATE') blockers.push('Decision does not authorize a package-update step.')
  if (appeal.appeal_open) blockers.push('A valid appeal is open and requires independent re-review.')
  if (rollback.status === 'ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE') blockers.push('A valid rollback quorum has authorized reversal of this decision.')
  if (expired) blockers.push('Decision has expired.')
  return {
    decision_id: decision.decision_id,
    verification,
    appeal,
    rollback,
    expired,
    operative: blockers.length === 0,
    blockers,
  }
}
