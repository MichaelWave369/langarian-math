import type { ContractConformanceSuite } from './conformance.js'

export const CUSTODY_BUNDLE_SCHEMA_VERSION = 'evidence-custody-bundle:v0.1' as const
export const CUSTODY_ENVELOPE_SCHEMA_VERSION = 'evidence-custody-envelope:v0.1' as const
export const SIGNER_IDENTITY_SCHEMA_VERSION = 'evidence-signer:v0.1' as const
export const REVOCATION_SCHEMA_VERSION = 'evidence-revocation:v0.1' as const

export type CustodySubjectKind = 'contract-conformance-suite' | 'contract-conformance-observation' | 'ci-evidence-bundle'
export type SignerStatus = 'active' | 'revoked'

export interface EvidenceSignerIdentity {
  schema_version: typeof SIGNER_IDENTITY_SCHEMA_VERSION
  id: string
  display_name: string
  algorithm: 'Ed25519'
  public_key_jwk: JsonWebKey
  authority_scope: string[]
  status: SignerStatus
  created_at_utc: string
  metadata: Record<string, unknown>
}

export interface EvidenceCustodyEnvelope {
  schema_version: typeof CUSTODY_ENVELOPE_SCHEMA_VERSION
  evidence_id: string
  subject_kind: CustodySubjectKind
  subject_digest: string
  subject_locator: string
  signer_id: string
  signature: string
  signed_at_utc: string
  supersedes: string[]
  metadata: Record<string, unknown>
}

export interface EvidenceRevocationRecord {
  schema_version: typeof REVOCATION_SCHEMA_VERSION
  revocation_id: string
  target_evidence_id: string
  authority_id: string
  reason: string
  issued_at_utc: string
  signature: string
  metadata: Record<string, unknown>
}

export interface EvidenceCustodyBundle {
  bundle_schema_version: typeof CUSTODY_BUNDLE_SCHEMA_VERSION
  signers: EvidenceSignerIdentity[]
  envelopes: EvidenceCustodyEnvelope[]
  revocations: EvidenceRevocationRecord[]
  metadata: Record<string, unknown>
}

export interface LocalSignerSession {
  identity: EvidenceSignerIdentity
  private_key: CryptoKey
}

export interface CustodyValidationIssue {
  path: string
  code: string
  message: string
}

export interface EnvelopeVerification {
  evidence_id: string
  subject_locator: string
  signer_id: string
  digest_valid: boolean
  evidence_id_valid: boolean
  signature_valid: boolean
  signer_known: boolean
  signer_active: boolean
  revoked: boolean
  superseded: boolean
  accepted: boolean
  issues: CustodyValidationIssue[]
}

export interface RevocationVerification {
  revocation_id: string
  target_evidence_id: string
  authority_id: string
  signature_valid: boolean
  authority_known: boolean
  authority_active: boolean
  accepted: boolean
  issues: CustodyValidationIssue[]
}

export interface CustodyProfile {
  bundle_valid: boolean
  subject_digest: string
  accepted_evidence_ids: string[]
  active_envelopes: EnvelopeVerification[]
  envelope_results: EnvelopeVerification[]
  revocation_results: RevocationVerification[]
  issues: CustodyValidationIssue[]
  custody_ready: boolean
}

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)*$/
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(path: string, code: string, message: string): CustodyValidationIssue {
  return { path, code, message }
}

function canonicalize(value: unknown, seen = new Set<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical evidence JSON rejects NaN and infinity.')
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen))
  if (isRecord(value)) {
    if (seen.has(value)) throw new Error('Canonical evidence JSON rejects cyclic objects.')
    seen.add(value)
    const output: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const item = value[key]
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') {
        throw new Error(`Canonical evidence JSON rejects unsupported value at ${key}.`)
      }
      output[key] = canonicalize(item, seen)
    }
    seen.delete(value)
    return output
  }
  throw new Error(`Canonical evidence JSON rejects ${typeof value}.`)
}

export function canonicalEvidenceJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
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

export async function sha256EvidenceDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalEvidenceJson(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function envelopePayload(envelope: Omit<EvidenceCustodyEnvelope, 'evidence_id' | 'signature'>): Record<string, unknown> {
  return {
    schema_version: envelope.schema_version,
    subject_kind: envelope.subject_kind,
    subject_digest: envelope.subject_digest,
    subject_locator: envelope.subject_locator,
    signer_id: envelope.signer_id,
    signed_at_utc: envelope.signed_at_utc,
    supersedes: envelope.supersedes,
    metadata: envelope.metadata,
  }
}

function revocationPayload(record: Omit<EvidenceRevocationRecord, 'revocation_id' | 'signature'>): Record<string, unknown> {
  return {
    schema_version: record.schema_version,
    target_evidence_id: record.target_evidence_id,
    authority_id: record.authority_id,
    reason: record.reason,
    issued_at_utc: record.issued_at_utc,
    metadata: record.metadata,
  }
}

async function importVerificationKey(identity: EvidenceSignerIdentity): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', identity.public_key_jwk, { name: 'Ed25519' }, true, ['verify'])
}

async function signPayload(privateKey: CryptoKey, payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalEvidenceJson(payload))
  const signature = await crypto.subtle.sign('Ed25519', privateKey, bytes)
  return bytesToBase64Url(new Uint8Array(signature))
}

async function verifyPayload(identity: EvidenceSignerIdentity, signature: string, payload: unknown): Promise<boolean> {
  try {
    const publicKey = await importVerificationKey(identity)
    const bytes = new TextEncoder().encode(canonicalEvidenceJson(payload))
    return crypto.subtle.verify('Ed25519', publicKey, base64UrlToBytes(signature), bytes)
  } catch {
    return false
  }
}

export async function generateLocalSigner(
  displayName: string,
  authorityScope: string[] = ['sign:contract-conformance-suite', 'revoke:self-issued-evidence'],
  now = new Date().toISOString(),
): Promise<LocalSignerSession> {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const fingerprint = await sha256EvidenceDigest(publicKeyJwk)
  return {
    identity: {
      schema_version: SIGNER_IDENTITY_SCHEMA_VERSION,
      id: `signer:${fingerprint.slice('sha256:'.length)}`,
      display_name: displayName.trim() || 'Local ephemeral signer',
      algorithm: 'Ed25519',
      public_key_jwk: publicKeyJwk,
      authority_scope: [...authorityScope],
      status: 'active',
      created_at_utc: now,
      metadata: {
        custody_class: 'browser-ephemeral',
        warning: 'Private key remains in memory only and is not exported by the workbench.',
      },
    },
    private_key: keyPair.privateKey,
  }
}

export async function signEvidenceSubject(
  subject: unknown,
  subjectKind: CustodySubjectKind,
  subjectLocator: string,
  signer: LocalSignerSession,
  options: { signed_at_utc?: string; supersedes?: string[]; metadata?: Record<string, unknown> } = {},
): Promise<EvidenceCustodyEnvelope> {
  const unsigned = {
    schema_version: CUSTODY_ENVELOPE_SCHEMA_VERSION,
    subject_kind: subjectKind,
    subject_digest: await sha256EvidenceDigest(subject),
    subject_locator: subjectLocator,
    signer_id: signer.identity.id,
    signed_at_utc: options.signed_at_utc ?? new Date().toISOString(),
    supersedes: [...(options.supersedes ?? [])],
    metadata: { ...(options.metadata ?? {}) },
  }
  const signature = await signPayload(signer.private_key, envelopePayload(unsigned))
  const evidenceId = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, evidence_id: `evidence:${evidenceId.slice('sha256:'.length)}`, signature }
}

export async function revokeEvidence(
  targetEvidenceId: string,
  signer: LocalSignerSession,
  reason: string,
  options: { issued_at_utc?: string; metadata?: Record<string, unknown> } = {},
): Promise<EvidenceRevocationRecord> {
  const unsigned = {
    schema_version: REVOCATION_SCHEMA_VERSION,
    target_evidence_id: targetEvidenceId,
    authority_id: signer.identity.id,
    reason: reason.trim() || 'No reason supplied.',
    issued_at_utc: options.issued_at_utc ?? new Date().toISOString(),
    metadata: { ...(options.metadata ?? {}) },
  }
  const signature = await signPayload(signer.private_key, revocationPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, revocation_id: `revocation:${digest.slice('sha256:'.length)}`, signature }
}

export function emptyCustodyBundle(): EvidenceCustodyBundle {
  return {
    bundle_schema_version: CUSTODY_BUNDLE_SCHEMA_VERSION,
    signers: [],
    envelopes: [],
    revocations: [],
    metadata: { planning_artifact: true },
  }
}

export function validateCustodyBundle(value: unknown): CustodyValidationIssue[] {
  const issues: CustodyValidationIssue[] = []
  if (!isRecord(value)) return [issue('$', 'EXPECTED_OBJECT', 'Custody bundle must be an object.')]
  if (value.bundle_schema_version !== CUSTODY_BUNDLE_SCHEMA_VERSION) issues.push(issue('bundle_schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${CUSTODY_BUNDLE_SCHEMA_VERSION}.`))
  for (const key of ['signers', 'envelopes', 'revocations'] as const) {
    if (!Array.isArray(value[key])) issues.push(issue(key, 'EXPECTED_ARRAY', `${key} must be an array.`))
  }
  if (Array.isArray(value.signers)) {
    const ids = new Set<string>()
    value.signers.forEach((raw, index) => {
      const path = `signers[${index}]`
      if (!isRecord(raw)) {
        issues.push(issue(path, 'EXPECTED_OBJECT', 'Signer must be an object.'))
        return
      }
      if (raw.schema_version !== SIGNER_IDENTITY_SCHEMA_VERSION) issues.push(issue(`${path}.schema_version`, 'UNSUPPORTED_SIGNER_SCHEMA', `Expected ${SIGNER_IDENTITY_SCHEMA_VERSION}.`))
      if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) issues.push(issue(`${path}.id`, 'INVALID_ID', 'Signer id must be stable and lowercase.'))
      if (typeof raw.id === 'string') {
        if (ids.has(raw.id)) issues.push(issue(`${path}.id`, 'DUPLICATE_ID', `Duplicate signer ${raw.id}.`))
        ids.add(raw.id)
      }
      if (raw.algorithm !== 'Ed25519') issues.push(issue(`${path}.algorithm`, 'UNSUPPORTED_ALGORITHM', 'Only Ed25519 is supported in v0.1.'))
      if (!isRecord(raw.public_key_jwk)) issues.push(issue(`${path}.public_key_jwk`, 'MISSING_PUBLIC_KEY', 'A public JWK is required.'))
      if (!Array.isArray(raw.authority_scope)) issues.push(issue(`${path}.authority_scope`, 'EXPECTED_ARRAY', 'authority_scope must be an array.'))
      if (!['active', 'revoked'].includes(String(raw.status))) issues.push(issue(`${path}.status`, 'INVALID_STATUS', 'Signer status must be active or revoked.'))
    })
  }
  if (Array.isArray(value.envelopes)) {
    const ids = new Set<string>()
    value.envelopes.forEach((raw, index) => {
      const path = `envelopes[${index}]`
      if (!isRecord(raw)) {
        issues.push(issue(path, 'EXPECTED_OBJECT', 'Envelope must be an object.'))
        return
      }
      if (raw.schema_version !== CUSTODY_ENVELOPE_SCHEMA_VERSION) issues.push(issue(`${path}.schema_version`, 'UNSUPPORTED_ENVELOPE_SCHEMA', `Expected ${CUSTODY_ENVELOPE_SCHEMA_VERSION}.`))
      if (typeof raw.evidence_id !== 'string' || !raw.evidence_id.startsWith('evidence:')) issues.push(issue(`${path}.evidence_id`, 'INVALID_EVIDENCE_ID', 'Expected evidence:<sha256 hex>.'))
      if (typeof raw.evidence_id === 'string') {
        if (ids.has(raw.evidence_id)) issues.push(issue(`${path}.evidence_id`, 'DUPLICATE_ID', `Duplicate evidence id ${raw.evidence_id}.`))
        ids.add(raw.evidence_id)
      }
      if (typeof raw.subject_digest !== 'string' || !DIGEST_PATTERN.test(raw.subject_digest)) issues.push(issue(`${path}.subject_digest`, 'INVALID_DIGEST', 'Expected sha256:<64 lowercase hex>.'))
      if (typeof raw.subject_locator !== 'string' || raw.subject_locator.trim() === '') issues.push(issue(`${path}.subject_locator`, 'REQUIRED_TEXT', 'subject_locator is required.'))
      if (typeof raw.signer_id !== 'string' || raw.signer_id.trim() === '') issues.push(issue(`${path}.signer_id`, 'REQUIRED_TEXT', 'signer_id is required.'))
      if (typeof raw.signature !== 'string' || raw.signature.trim() === '') issues.push(issue(`${path}.signature`, 'REQUIRED_TEXT', 'signature is required.'))
      if (!Array.isArray(raw.supersedes)) issues.push(issue(`${path}.supersedes`, 'EXPECTED_ARRAY', 'supersedes must be an array.'))
    })
  }
  if (Array.isArray(value.revocations)) {
    value.revocations.forEach((raw, index) => {
      const path = `revocations[${index}]`
      if (!isRecord(raw)) {
        issues.push(issue(path, 'EXPECTED_OBJECT', 'Revocation must be an object.'))
        return
      }
      if (raw.schema_version !== REVOCATION_SCHEMA_VERSION) issues.push(issue(`${path}.schema_version`, 'UNSUPPORTED_REVOCATION_SCHEMA', `Expected ${REVOCATION_SCHEMA_VERSION}.`))
      for (const key of ['revocation_id', 'target_evidence_id', 'authority_id', 'reason', 'signature'] as const) {
        if (typeof raw[key] !== 'string' || raw[key].trim() === '') issues.push(issue(`${path}.${key}`, 'REQUIRED_TEXT', `${key} is required.`))
      }
    })
  }
  return issues
}

export async function verifyCustodyBundle(
  bundle: EvidenceCustodyBundle,
  subjects: Record<string, unknown>,
): Promise<CustodyProfile> {
  const structuralIssues = validateCustodyBundle(bundle)
  const signers = new Map(bundle.signers.map((identity) => [identity.id, identity]))
  const subjectDigests = new Map<string, string>()
  for (const [locator, subject] of Object.entries(subjects)) subjectDigests.set(locator, await sha256EvidenceDigest(subject))

  const revocationResults: RevocationVerification[] = []
  const acceptedRevocations = new Set<string>()
  for (const record of bundle.revocations) {
    const authority = signers.get(record.authority_id)
    const payload = revocationPayload({
      schema_version: record.schema_version,
      target_evidence_id: record.target_evidence_id,
      authority_id: record.authority_id,
      reason: record.reason,
      issued_at_utc: record.issued_at_utc,
      metadata: record.metadata,
    })
    const signatureValid = authority ? await verifyPayload(authority, record.signature, payload) : false
    const expectedDigest = await sha256EvidenceDigest({ ...payload, signature: record.signature })
    const idValid = record.revocation_id === `revocation:${expectedDigest.slice('sha256:'.length)}`
    const authorityActive = authority?.status === 'active'
    const recordIssues: CustodyValidationIssue[] = []
    if (!authority) recordIssues.push(issue(record.revocation_id, 'UNKNOWN_AUTHORITY', `Unknown authority ${record.authority_id}.`))
    if (!signatureValid) recordIssues.push(issue(record.revocation_id, 'INVALID_SIGNATURE', 'Revocation signature is invalid.'))
    if (!idValid) recordIssues.push(issue(record.revocation_id, 'INVALID_REVOCATION_ID', 'Revocation id does not match its canonical signed body.'))
    if (!authorityActive) recordIssues.push(issue(record.revocation_id, 'INACTIVE_AUTHORITY', 'Revocation authority is not active.'))
    const accepted = Boolean(authority && signatureValid && idValid && authorityActive)
    if (accepted) acceptedRevocations.add(record.target_evidence_id)
    revocationResults.push({
      revocation_id: record.revocation_id,
      target_evidence_id: record.target_evidence_id,
      authority_id: record.authority_id,
      signature_valid: signatureValid && idValid,
      authority_known: Boolean(authority),
      authority_active: Boolean(authorityActive),
      accepted,
      issues: recordIssues,
    })
  }

  const preliminary: EnvelopeVerification[] = []
  const validEnvelopeIds = new Set<string>()
  for (const envelope of bundle.envelopes) {
    const signer = signers.get(envelope.signer_id)
    const expectedSubjectDigest = subjectDigests.get(envelope.subject_locator)
    const payload = envelopePayload({
      schema_version: envelope.schema_version,
      subject_kind: envelope.subject_kind,
      subject_digest: envelope.subject_digest,
      subject_locator: envelope.subject_locator,
      signer_id: envelope.signer_id,
      signed_at_utc: envelope.signed_at_utc,
      supersedes: envelope.supersedes,
      metadata: envelope.metadata,
    })
    const signatureValid = signer ? await verifyPayload(signer, envelope.signature, payload) : false
    const expectedEvidenceDigest = await sha256EvidenceDigest({ ...payload, signature: envelope.signature })
    const evidenceIdValid = envelope.evidence_id === `evidence:${expectedEvidenceDigest.slice('sha256:'.length)}`
    const digestValid = expectedSubjectDigest !== undefined && expectedSubjectDigest === envelope.subject_digest
    const signerActive = signer?.status === 'active'
    const envelopeIssues: CustodyValidationIssue[] = []
    if (!signer) envelopeIssues.push(issue(envelope.evidence_id, 'UNKNOWN_SIGNER', `Unknown signer ${envelope.signer_id}.`))
    if (!digestValid) envelopeIssues.push(issue(envelope.evidence_id, 'SUBJECT_DIGEST_MISMATCH', 'Subject digest does not match the currently supplied subject.'))
    if (!signatureValid) envelopeIssues.push(issue(envelope.evidence_id, 'INVALID_SIGNATURE', 'Envelope signature is invalid.'))
    if (!evidenceIdValid) envelopeIssues.push(issue(envelope.evidence_id, 'INVALID_EVIDENCE_ID', 'Evidence id does not match its canonical signed body.'))
    if (!signerActive) envelopeIssues.push(issue(envelope.evidence_id, 'INACTIVE_SIGNER', 'Signer is not active.'))
    const cryptographicallyValid = Boolean(signer && digestValid && signatureValid && evidenceIdValid && signerActive)
    if (cryptographicallyValid) validEnvelopeIds.add(envelope.evidence_id)
    preliminary.push({
      evidence_id: envelope.evidence_id,
      subject_locator: envelope.subject_locator,
      signer_id: envelope.signer_id,
      digest_valid: digestValid,
      evidence_id_valid: evidenceIdValid,
      signature_valid: signatureValid,
      signer_known: Boolean(signer),
      signer_active: Boolean(signerActive),
      revoked: acceptedRevocations.has(envelope.evidence_id),
      superseded: false,
      accepted: false,
      issues: envelopeIssues,
    })
  }

  const supersededIds = new Set<string>()
  for (const envelope of bundle.envelopes) {
    if (!validEnvelopeIds.has(envelope.evidence_id) || acceptedRevocations.has(envelope.evidence_id)) continue
    for (const priorId of envelope.supersedes) {
      if (validEnvelopeIds.has(priorId)) supersededIds.add(priorId)
    }
  }

  const envelopeResults = preliminary.map((result) => {
    const revoked = acceptedRevocations.has(result.evidence_id)
    const superseded = supersededIds.has(result.evidence_id)
    const accepted = result.digest_valid && result.evidence_id_valid && result.signature_valid && result.signer_known && result.signer_active && !revoked && !superseded
    const extraIssues = [...result.issues]
    if (revoked) extraIssues.push(issue(result.evidence_id, 'REVOKED', 'A valid revocation record targets this evidence.'))
    if (superseded) extraIssues.push(issue(result.evidence_id, 'SUPERSEDED', 'A newer valid envelope supersedes this evidence.'))
    return { ...result, revoked, superseded, accepted, issues: extraIssues }
  })

  const activeEnvelopes = envelopeResults.filter((result) => result.accepted)
  const allIssues = [
    ...structuralIssues,
    ...envelopeResults.flatMap((result) => result.issues),
    ...revocationResults.flatMap((result) => result.issues),
  ]
  const distinctSubjectDigests = [...new Set(subjectDigests.values())]
  return {
    bundle_valid: structuralIssues.length === 0,
    subject_digest: distinctSubjectDigests.length === 1 ? distinctSubjectDigests[0]! : 'multiple-subjects',
    accepted_evidence_ids: activeEnvelopes.map((result) => result.evidence_id),
    active_envelopes: activeEnvelopes,
    envelope_results: envelopeResults,
    revocation_results: revocationResults,
    issues: allIssues,
    custody_ready: structuralIssues.length === 0 && activeEnvelopes.length > 0,
  }
}

export function custodyLocatorForSuite(suite: ContractConformanceSuite): string {
  return `conformance-suite:${suite.package.id}@${suite.package.version}`
}

export function parseCustodyBundleJson(text: string): { bundle: EvidenceCustodyBundle | null; issues: CustodyValidationIssue[] } {
  try {
    const value: unknown = JSON.parse(text)
    const issues = validateCustodyBundle(value)
    return { bundle: issues.length === 0 ? value as EvidenceCustodyBundle : null, issues }
  } catch (error) {
    return { bundle: null, issues: [issue('$', 'INVALID_JSON', error instanceof Error ? error.message : String(error))] }
  }
}
