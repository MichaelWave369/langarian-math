import { canonicalEvidenceJson, sha256EvidenceDigest } from './custody.js'
import { validateTheoryPackage, type TheoryPackage } from './packages.js'
import type { LocalAuthoritySession, PromotionAuthorityBundle, PromotionAuthorityIdentity } from './authority.js'
import {
  evaluateSignedDecisionLifecycle,
  evaluateSignedRollback,
  verifySignedPromotionDecision,
  type SignedPromotionAuthorityDecisionReceipt,
} from './signedDecision.js'

export const PACKAGE_PATCH_SCHEMA_VERSION = 'package-manifest-patch:v0.1' as const
export const RELEASE_PROPOSAL_SCHEMA_VERSION = 'package-release-proposal:v0.1' as const
export const RELEASE_POLICY_SCHEMA_VERSION = 'package-release-policy:v0.1' as const
export const RELEASE_RECEIPT_SCHEMA_VERSION = 'package-release-receipt:v0.1' as const
export const RELEASE_BUNDLE_SCHEMA_VERSION = 'package-release-bundle:v0.1' as const

export type ReleaseAction = 'PROMOTION' | 'ROLLBACK'
export type ReleaseStatus = 'AUTHORIZED_NOT_COMMITTED' | 'BLOCKED'
export type AllowedPatchPath = '/theory/version' | '/maturity_level' | '/metadata/release_governance'

export interface PackagePatchOperation {
  op: 'add' | 'replace'
  path: AllowedPatchPath
  value: unknown
}

export interface PackageReleasePolicy {
  schema_version: typeof RELEASE_POLICY_SCHEMA_VERSION
  id: string
  version: string
  release_role: string
  promotion_scope: string
  rollback_scope: string
  require_release_authority_separate_from_governance: boolean
  require_release_independence_domain_outside_governance: boolean
  proposal_validity_minutes: number
  allowed_patch_paths: AllowedPatchPath[]
  require_semver_change: boolean
  require_exact_before_hash: boolean
  require_exact_after_hash: boolean
  metadata: Record<string, unknown>
}

export interface SignedPackageReleaseProposal {
  schema_version: typeof RELEASE_PROPOSAL_SCHEMA_VERSION
  patch_schema_version: typeof PACKAGE_PATCH_SCHEMA_VERSION
  proposal_id: string
  action: ReleaseAction
  authority_decision_id: string
  package_id: string
  before_version: string
  target_version: string
  before_manifest_hash: string
  after_manifest_hash: string
  patch_digest: string
  patch: PackagePatchOperation[]
  release_authority_id: string
  issued_at_utc: string
  expires_at_utc: string
  metadata: Record<string, unknown>
  signature: string
}

export interface ReleaseIssue {
  path: string
  code: string
  message: string
}

export interface ReleaseProposalVerification {
  proposal_id: string
  signature_valid: boolean
  proposal_id_valid: boolean
  authority_known: boolean
  authority_active: boolean
  authority_fingerprint_valid: boolean
  authority_scope_valid: boolean
  authority_role_valid: boolean
  authority_separation_valid: boolean
  independence_valid: boolean
  time_valid: boolean
  decision_binding_valid: boolean
  package_binding_valid: boolean
  before_hash_valid: boolean
  patch_digest_valid: boolean
  after_hash_valid: boolean
  patch_valid: boolean
  after_package_valid: boolean
  accepted: boolean
  issues: ReleaseIssue[]
}

export interface ControlledPackageReleaseProfile {
  policy: PackageReleasePolicy
  action: ReleaseAction
  package_id: string
  before_version: string
  target_version: string
  decision_id: string
  decision_gate_open: boolean
  decision_gate_blockers: string[]
  proposal_verification: ReleaseProposalVerification
  before_manifest_hash: string
  after_manifest_hash: string
  patch_digest: string
  materialized_after_manifest: TheoryPackage | null
  blockers: string[]
  warnings: string[]
  status: ReleaseStatus
}

export interface SignedPackageReleaseReceipt {
  schema_version: typeof RELEASE_RECEIPT_SCHEMA_VERSION
  receipt_id: string
  receipt_type: 'controlled-release-authorization-not-repository-commit'
  action: ReleaseAction
  proposal_id: string
  authority_decision_id: string
  package: {
    id: string
    before_version: string
    target_version: string
    before_maturity_level: number
    target_maturity_level: number
  }
  integrity: {
    before_manifest_hash: string
    after_manifest_hash: string
    patch_digest: string
    replay_key: string
  }
  release_authority_id: string
  status: ReleaseStatus
  blockers: string[]
  warnings: string[]
  repository_commit_status: 'NOT_COMMITTED'
  issued_at_utc: string
  claims_supported: string[]
  prohibited_inferences: string[]
  signature: string
}

export interface PackageReleaseBundle {
  bundle_schema_version: typeof RELEASE_BUNDLE_SCHEMA_VERSION
  before_manifest: TheoryPackage
  after_manifest: TheoryPackage
  proposal: SignedPackageReleaseProposal
  receipt: SignedPackageReleaseReceipt
  metadata: Record<string, unknown>
}

export interface ReleaseReceiptVerification {
  receipt_id: string
  signature_valid: boolean
  receipt_id_valid: boolean
  authority_known: boolean
  authority_active: boolean
  authority_fingerprint_valid: boolean
  proposal_binding_valid: boolean
  manifest_binding_valid: boolean
  accepted: boolean
  issues: ReleaseIssue[]
}

const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/

export const DEFAULT_PACKAGE_RELEASE_POLICY: PackageReleasePolicy = {
  schema_version: RELEASE_POLICY_SCHEMA_VERSION,
  id: 'controlled-package-release',
  version: '0.1.0',
  release_role: 'release-custodian',
  promotion_scope: 'release:package-mutation',
  rollback_scope: 'release:package-rollback',
  require_release_authority_separate_from_governance: true,
  require_release_independence_domain_outside_governance: true,
  proposal_validity_minutes: 60,
  allowed_patch_paths: ['/theory/version', '/maturity_level', '/metadata/release_governance'],
  require_semver_change: true,
  require_exact_before_hash: true,
  require_exact_after_hash: true,
  metadata: {
    boundary: 'An authorized release receipt materializes an exact package artifact but does not commit it to a repository.',
  },
}

function issue(path: string, code: string, message: string): ReleaseIssue {
  return { path, code, message }
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

function dateMs(value: string): number {
  return Date.parse(value)
}

function addMinutes(value: string, minutes: number): string {
  return new Date(dateMs(value) + minutes * 60_000).toISOString()
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function releaseMetadata(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function setPatchValue(target: TheoryPackage, operation: PackagePatchOperation): void {
  if (operation.path === '/theory/version') target.theory.version = String(operation.value)
  else if (operation.path === '/maturity_level') target.maturity_level = Number(operation.value) as TheoryPackage['maturity_level']
  else if (operation.path === '/metadata/release_governance') target.metadata = { ...target.metadata, release_governance: deepClone(operation.value) }
}

export function applyPackagePatch(before: TheoryPackage, patch: PackagePatchOperation[]): TheoryPackage {
  const after = deepClone(before)
  for (const operation of patch) setPatchValue(after, operation)
  return after
}

function normalizedImmutableView(value: TheoryPackage): unknown {
  const clone = deepClone(value) as TheoryPackage
  clone.theory.version = '__MUTABLE_VERSION__'
  clone.maturity_level = 1
  const metadata = { ...clone.metadata }
  delete metadata.release_governance
  clone.metadata = metadata
  return clone
}

function proposalPayload(proposal: Omit<SignedPackageReleaseProposal, 'proposal_id' | 'signature'>): Record<string, unknown> {
  return { ...proposal }
}

function receiptPayload(receipt: Omit<SignedPackageReleaseReceipt, 'receipt_id' | 'signature'>): Record<string, unknown> {
  return { ...receipt }
}

function requiredScope(action: ReleaseAction, policy: PackageReleasePolicy): string {
  return action === 'PROMOTION' ? policy.promotion_scope : policy.rollback_scope
}

function targetMaturity(action: ReleaseAction, decision: SignedPromotionAuthorityDecisionReceipt): number {
  return action === 'PROMOTION' ? decision.package.target_level : decision.package.current_maturity_level
}

export async function createPackageReleaseProposal(
  before: TheoryPackage,
  decision: SignedPromotionAuthorityDecisionReceipt,
  action: ReleaseAction,
  targetVersion: string,
  releaseAuthority: LocalAuthoritySession,
  policy: PackageReleasePolicy = DEFAULT_PACKAGE_RELEASE_POLICY,
  issuedAt = new Date().toISOString(),
): Promise<{ proposal: SignedPackageReleaseProposal; after: TheoryPackage }> {
  const beforeHash = await sha256EvidenceDigest(before)
  const maturity = targetMaturity(action, decision)
  const governanceMetadata = {
    schema_version: 'release-governance-metadata:v0.1',
    action,
    authority_decision_id: decision.decision_id,
    prior_manifest_hash: beforeHash,
    prior_version: before.theory.version,
    released_at_utc: issuedAt,
    release_authority_id: releaseAuthority.identity.id,
  }
  const patch: PackagePatchOperation[] = [
    { op: 'replace', path: '/theory/version', value: targetVersion },
    { op: 'replace', path: '/maturity_level', value: maturity },
    { op: 'add', path: '/metadata/release_governance', value: governanceMetadata },
  ]
  const after = applyPackagePatch(before, patch)
  const afterHash = await sha256EvidenceDigest(after)
  const patchDigest = await sha256EvidenceDigest({ schema_version: PACKAGE_PATCH_SCHEMA_VERSION, patch })
  const unsigned = {
    schema_version: RELEASE_PROPOSAL_SCHEMA_VERSION,
    patch_schema_version: PACKAGE_PATCH_SCHEMA_VERSION,
    action,
    authority_decision_id: decision.decision_id,
    package_id: before.theory.id,
    before_version: before.theory.version,
    target_version: targetVersion,
    before_manifest_hash: beforeHash,
    after_manifest_hash: afterHash,
    patch_digest: patchDigest,
    patch,
    release_authority_id: releaseAuthority.identity.id,
    issued_at_utc: issuedAt,
    expires_at_utc: addMinutes(issuedAt, policy.proposal_validity_minutes),
    metadata: {
      release_policy_id: policy.id,
      release_policy_version: policy.version,
      repository_commit_status: 'NOT_COMMITTED',
    },
  }
  const signature = await signPayload(releaseAuthority.private_key, proposalPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return {
    after,
    proposal: { ...unsigned, signature, proposal_id: `release-proposal:${digest.slice('sha256:'.length)}` },
  }
}

export async function verifyPackageReleaseProposal(
  before: TheoryPackage,
  decision: SignedPromotionAuthorityDecisionReceipt,
  authorityBundle: PromotionAuthorityBundle,
  proposal: SignedPackageReleaseProposal,
  policy: PackageReleasePolicy = DEFAULT_PACKAGE_RELEASE_POLICY,
  now = new Date().toISOString(),
): Promise<{ verification: ReleaseProposalVerification; after: TheoryPackage | null }> {
  const issues: ReleaseIssue[] = []
  const authority = authorityBundle.authorities.find((item) => item.id === proposal.release_authority_id)
  const payload = proposalPayload({
    schema_version: proposal.schema_version,
    patch_schema_version: proposal.patch_schema_version,
    action: proposal.action,
    authority_decision_id: proposal.authority_decision_id,
    package_id: proposal.package_id,
    before_version: proposal.before_version,
    target_version: proposal.target_version,
    before_manifest_hash: proposal.before_manifest_hash,
    after_manifest_hash: proposal.after_manifest_hash,
    patch_digest: proposal.patch_digest,
    patch: proposal.patch,
    release_authority_id: proposal.release_authority_id,
    issued_at_utc: proposal.issued_at_utc,
    expires_at_utc: proposal.expires_at_utc,
    metadata: proposal.metadata,
  })
  const signatureValid = authority ? await verifyPayload(authority, proposal.signature, payload) : false
  const proposalDigest = await sha256EvidenceDigest({ ...payload, signature: proposal.signature })
  const proposalIdValid = proposal.proposal_id === `release-proposal:${proposalDigest.slice('sha256:'.length)}`
  const authorityKnown = Boolean(authority)
  const authorityActive = authority?.status === 'active'
  const authorityFingerprintValid = authority ? await fingerprintValid(authority) : false
  const authorityScopeValid = authority?.authority_scope.includes(requiredScope(proposal.action, policy)) === true
  const authorityRoleValid = authority?.roles.includes(policy.release_role) === true
  const governanceAuthorityIds = new Set([decision.recorded_by, ...decision.quorum.distinct_authority_ids])
  const authoritySeparationValid = !policy.require_release_authority_separate_from_governance || !governanceAuthorityIds.has(proposal.release_authority_id)
  const governanceDomains = new Set(decision.quorum.independence_domains)
  const independenceValid = !policy.require_release_independence_domain_outside_governance || Boolean(authority?.independence_domains.some((domain) => !governanceDomains.has(domain)))
  const timeValid = Number.isFinite(dateMs(proposal.issued_at_utc)) && Number.isFinite(dateMs(proposal.expires_at_utc)) && dateMs(now) >= dateMs(proposal.issued_at_utc) && dateMs(now) <= dateMs(proposal.expires_at_utc)
  const decisionBindingValid = proposal.authority_decision_id === decision.decision_id
  const packageBindingValid = proposal.package_id === before.theory.id && proposal.before_version === before.theory.version && proposal.package_id === decision.package.id
  const actualBeforeHash = await sha256EvidenceDigest(before)
  const beforeHashValid = HASH_PATTERN.test(proposal.before_manifest_hash) && (!policy.require_exact_before_hash || proposal.before_manifest_hash === actualBeforeHash)
  const actualPatchDigest = await sha256EvidenceDigest({ schema_version: PACKAGE_PATCH_SCHEMA_VERSION, patch: proposal.patch })
  const patchDigestValid = HASH_PATTERN.test(proposal.patch_digest) && proposal.patch_digest === actualPatchDigest

  const paths = proposal.patch.map((item) => item.path)
  const uniquePaths = new Set(paths)
  const allowedPaths = new Set(policy.allowed_patch_paths)
  const patchValid = proposal.schema_version === RELEASE_PROPOSAL_SCHEMA_VERSION &&
    proposal.patch_schema_version === PACKAGE_PATCH_SCHEMA_VERSION &&
    proposal.patch.length === policy.allowed_patch_paths.length &&
    uniquePaths.size === proposal.patch.length &&
    paths.every((path) => allowedPaths.has(path)) &&
    policy.allowed_patch_paths.every((path) => uniquePaths.has(path)) &&
    proposal.patch.every((item) => item.op === 'add' || item.op === 'replace')

  let after: TheoryPackage | null = null
  let afterHashValid = false
  let afterPackageValid = false
  if (patchValid) {
    after = applyPackagePatch(before, proposal.patch)
    const actualAfterHash = await sha256EvidenceDigest(after)
    afterHashValid = HASH_PATTERN.test(proposal.after_manifest_hash) && (!policy.require_exact_after_hash || proposal.after_manifest_hash === actualAfterHash)
    const packageValidation = validateTheoryPackage(after)
    const immutableValid = canonicalEvidenceJson(normalizedImmutableView(before)) === canonicalEvidenceJson(normalizedImmutableView(after))
    const versionValid = VERSION_PATTERN.test(proposal.target_version) && after.theory.version === proposal.target_version && (!policy.require_semver_change || proposal.target_version !== before.theory.version)
    const metadata = releaseMetadata(after.metadata.release_governance)
    const metadataValid = Boolean(
      metadata &&
      metadata.authority_decision_id === decision.decision_id &&
      metadata.action === proposal.action &&
      metadata.prior_manifest_hash === actualBeforeHash &&
      metadata.prior_version === before.theory.version &&
      metadata.release_authority_id === proposal.release_authority_id,
    )
    const maturityValid = after.maturity_level === targetMaturity(proposal.action, decision)
    const actionBindingValid = proposal.action === 'PROMOTION'
      ? before.theory.version === decision.package.version && before.maturity_level === decision.package.current_maturity_level
      : before.maturity_level === decision.package.target_level && releaseMetadata(before.metadata.release_governance)?.authority_decision_id === decision.decision_id
    afterPackageValid = packageValidation.ok && immutableValid && versionValid && metadataValid && maturityValid && actionBindingValid
    if (!packageValidation.ok) issues.push(issue('after_manifest', 'PACKAGE_VALIDATION_FAILED', `After manifest has ${packageValidation.issues.length} validation issue(s).`))
    if (!immutableValid) issues.push(issue('patch', 'IMMUTABLE_CONTENT_CHANGED', 'Patch changed package content outside version, maturity, and release-governance metadata.'))
    if (!versionValid) issues.push(issue('target_version', 'INVALID_VERSION_TRANSITION', 'Target version must be valid semver and differ from the before version.'))
    if (!metadataValid) issues.push(issue('/metadata/release_governance', 'RELEASE_METADATA_MISMATCH', 'Release metadata does not bind the exact decision, prior hash, prior version, action, and release authority.'))
    if (!maturityValid) issues.push(issue('/maturity_level', 'MATURITY_TARGET_MISMATCH', 'After maturity does not match the decision-authorized target for this action.'))
    if (!actionBindingValid) issues.push(issue('action', 'ACTION_SOURCE_MISMATCH', 'Before manifest is not the decision-authorized source state for this promotion or rollback.'))
  }

  if (!signatureValid) issues.push(issue('signature', 'INVALID_SIGNATURE', 'Release proposal signature is invalid.'))
  if (!proposalIdValid) issues.push(issue('proposal_id', 'INVALID_PROPOSAL_ID', 'Proposal id does not match its canonical signed body.'))
  if (!authorityKnown) issues.push(issue('release_authority_id', 'UNKNOWN_RELEASE_AUTHORITY', 'Release authority is not present in the authority bundle.'))
  if (!authorityActive) issues.push(issue('release_authority_id', 'INACTIVE_RELEASE_AUTHORITY', 'Release authority is not active.'))
  if (!authorityFingerprintValid) issues.push(issue('release_authority_id', 'AUTHORITY_FINGERPRINT_MISMATCH', 'Release authority id does not match its public-key fingerprint.'))
  if (!authorityScopeValid) issues.push(issue('release_authority_id', 'RELEASE_SCOPE_MISSING', `Release authority lacks ${requiredScope(proposal.action, policy)}.`))
  if (!authorityRoleValid) issues.push(issue('release_authority_id', 'RELEASE_ROLE_MISSING', `Release authority lacks role ${policy.release_role}.`))
  if (!authoritySeparationValid) issues.push(issue('release_authority_id', 'ROLE_SEPARATION_FAILED', 'Release authority must be separate from decision recorder and approving authorities.'))
  if (!independenceValid) issues.push(issue('release_authority_id', 'RELEASE_DOMAIN_NOT_INDEPENDENT', 'Release authority must declare an independence domain outside the governance quorum.'))
  if (!timeValid) issues.push(issue('expires_at_utc', 'PROPOSAL_EXPIRED', 'Release proposal is not yet valid or has expired.'))
  if (!decisionBindingValid) issues.push(issue('authority_decision_id', 'DECISION_BINDING_MISMATCH', 'Proposal does not bind the supplied signed authority decision.'))
  if (!packageBindingValid) issues.push(issue('package_id', 'PACKAGE_BINDING_MISMATCH', 'Proposal does not bind the exact source package id and version.'))
  if (!beforeHashValid) issues.push(issue('before_manifest_hash', 'BEFORE_HASH_MISMATCH', 'Before manifest hash does not match the supplied source manifest.'))
  if (!patchDigestValid) issues.push(issue('patch_digest', 'PATCH_DIGEST_MISMATCH', 'Patch digest does not match the canonical patch.'))
  if (!patchValid) issues.push(issue('patch', 'PATCH_NOT_ALLOWED', 'Patch must contain exactly one operation for each allowed release path and no other paths.'))
  if (!afterHashValid) issues.push(issue('after_manifest_hash', 'AFTER_HASH_MISMATCH', 'After manifest hash does not match the materialized patch result.'))

  const accepted = signatureValid && proposalIdValid && authorityKnown && Boolean(authorityActive) && authorityFingerprintValid && authorityScopeValid && authorityRoleValid && authoritySeparationValid && independenceValid && timeValid && decisionBindingValid && packageBindingValid && beforeHashValid && patchDigestValid && afterHashValid && patchValid && afterPackageValid
  return {
    after,
    verification: {
      proposal_id: proposal.proposal_id,
      signature_valid: signatureValid,
      proposal_id_valid: proposalIdValid,
      authority_known: authorityKnown,
      authority_active: Boolean(authorityActive),
      authority_fingerprint_valid: authorityFingerprintValid,
      authority_scope_valid: authorityScopeValid,
      authority_role_valid: authorityRoleValid,
      authority_separation_valid: authoritySeparationValid,
      independence_valid: independenceValid,
      time_valid: timeValid,
      decision_binding_valid: decisionBindingValid,
      package_binding_valid: packageBindingValid,
      before_hash_valid: beforeHashValid,
      patch_digest_valid: patchDigestValid,
      after_hash_valid: afterHashValid,
      patch_valid: patchValid,
      after_package_valid: afterPackageValid,
      accepted,
      issues,
    },
  }
}

async function decisionGate(
  decision: SignedPromotionAuthorityDecisionReceipt,
  authorityBundle: PromotionAuthorityBundle,
  action: ReleaseAction,
  now: string,
): Promise<{ open: boolean; blockers: string[] }> {
  if (action === 'PROMOTION') {
    const lifecycle = await evaluateSignedDecisionLifecycle(decision, authorityBundle, undefined, now)
    return { open: lifecycle.operative, blockers: [...lifecycle.blockers] }
  }
  const verification = await verifySignedPromotionDecision(decision, authorityBundle.authorities, decision.issued_at_utc)
  const rollback = await evaluateSignedRollback(decision, authorityBundle, undefined, now)
  const blockers: string[] = []
  const cryptographicDecisionValid = verification.signature_valid && verification.decision_id_valid && verification.recorder_known && verification.recorder_active && verification.recorder_scope_valid && verification.recorder_fingerprint_valid
  if (!cryptographicDecisionValid) blockers.push('Signed authority decision fails cryptographic or recorder verification.')
  if (rollback.status !== 'ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE') blockers.push(...rollback.blockers)
  return { open: cryptographicDecisionValid && rollback.status === 'ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE', blockers }
}

export async function buildControlledPackageReleaseProfile(
  before: TheoryPackage,
  decision: SignedPromotionAuthorityDecisionReceipt,
  authorityBundle: PromotionAuthorityBundle,
  proposal: SignedPackageReleaseProposal,
  policy: PackageReleasePolicy = DEFAULT_PACKAGE_RELEASE_POLICY,
  now = new Date().toISOString(),
): Promise<ControlledPackageReleaseProfile> {
  const gate = await decisionGate(decision, authorityBundle, proposal.action, now)
  const { verification, after } = await verifyPackageReleaseProposal(before, decision, authorityBundle, proposal, policy, now)
  const blockers: string[] = []
  if (!gate.open) blockers.push(...gate.blockers)
  if (!verification.accepted) blockers.push(...verification.issues.map((item) => `${item.code}: ${item.message}`))
  const warnings = [
    'An authorized release artifact is not a repository commit.',
    'The repository writer must compare the live manifest hash to before_manifest_hash immediately before applying the patch.',
    'The replay key must be rejected if it already exists in the external release ledger.',
    'A release receipt does not prove mathematical or empirical truth.',
  ]
  return {
    policy,
    action: proposal.action,
    package_id: before.theory.id,
    before_version: before.theory.version,
    target_version: proposal.target_version,
    decision_id: decision.decision_id,
    decision_gate_open: gate.open,
    decision_gate_blockers: gate.blockers,
    proposal_verification: verification,
    before_manifest_hash: proposal.before_manifest_hash,
    after_manifest_hash: proposal.after_manifest_hash,
    patch_digest: proposal.patch_digest,
    materialized_after_manifest: after,
    blockers,
    warnings,
    status: blockers.length === 0 ? 'AUTHORIZED_NOT_COMMITTED' : 'BLOCKED',
  }
}

export async function createSignedPackageReleaseReceipt(
  before: TheoryPackage,
  profile: ControlledPackageReleaseProfile,
  proposal: SignedPackageReleaseProposal,
  releaseAuthority: LocalAuthoritySession,
  issuedAt = new Date().toISOString(),
): Promise<SignedPackageReleaseReceipt> {
  if (releaseAuthority.identity.id !== proposal.release_authority_id) throw new Error('Release receipt signer must match the proposal release authority.')
  const targetLevel = profile.materialized_after_manifest?.maturity_level ?? before.maturity_level
  const replayKey = await sha256EvidenceDigest({ decision_id: profile.decision_id, before_hash: profile.before_manifest_hash, after_hash: profile.after_manifest_hash, action: profile.action })
  const unsigned = {
    schema_version: RELEASE_RECEIPT_SCHEMA_VERSION,
    receipt_type: 'controlled-release-authorization-not-repository-commit' as const,
    action: profile.action,
    proposal_id: proposal.proposal_id,
    authority_decision_id: profile.decision_id,
    package: {
      id: before.theory.id,
      before_version: before.theory.version,
      target_version: profile.target_version,
      before_maturity_level: before.maturity_level,
      target_maturity_level: targetLevel,
    },
    integrity: {
      before_manifest_hash: profile.before_manifest_hash,
      after_manifest_hash: profile.after_manifest_hash,
      patch_digest: profile.patch_digest,
      replay_key: replayKey,
    },
    release_authority_id: releaseAuthority.identity.id,
    status: profile.status,
    blockers: [...profile.blockers],
    warnings: [...profile.warnings],
    repository_commit_status: 'NOT_COMMITTED' as const,
    issued_at_utc: issuedAt,
    claims_supported: profile.status === 'AUTHORIZED_NOT_COMMITTED'
      ? ['The exact before manifest, exact patch, and exact after manifest are authorized for one separately controlled repository write under the named signed authority decision.']
      : ['The proposed package mutation remains blocked and may not be committed.'],
    prohibited_inferences: [
      'The repository was automatically modified.',
      'The package release was applied more than once.',
      'The package mathematics was proved by the release signatures.',
      'The package passed the Reality Gate.',
      'Historical manifests or decisions may be deleted.',
    ],
  }
  const signature = await signPayload(releaseAuthority.private_key, receiptPayload(unsigned))
  const digest = await sha256EvidenceDigest({ ...unsigned, signature })
  return { ...unsigned, signature, receipt_id: `release-receipt:${digest.slice('sha256:'.length)}` }
}

export async function verifySignedPackageReleaseReceipt(
  bundle: PackageReleaseBundle,
  authorities: PromotionAuthorityIdentity[],
): Promise<ReleaseReceiptVerification> {
  const receipt = bundle.receipt
  const proposal = bundle.proposal
  const authority = authorities.find((item) => item.id === receipt.release_authority_id)
  const payload = receiptPayload({
    schema_version: receipt.schema_version,
    receipt_type: receipt.receipt_type,
    action: receipt.action,
    proposal_id: receipt.proposal_id,
    authority_decision_id: receipt.authority_decision_id,
    package: receipt.package,
    integrity: receipt.integrity,
    release_authority_id: receipt.release_authority_id,
    status: receipt.status,
    blockers: receipt.blockers,
    warnings: receipt.warnings,
    repository_commit_status: receipt.repository_commit_status,
    issued_at_utc: receipt.issued_at_utc,
    claims_supported: receipt.claims_supported,
    prohibited_inferences: receipt.prohibited_inferences,
  })
  const signatureValid = authority ? await verifyPayload(authority, receipt.signature, payload) : false
  const digest = await sha256EvidenceDigest({ ...payload, signature: receipt.signature })
  const receiptIdValid = receipt.receipt_id === `release-receipt:${digest.slice('sha256:'.length)}`
  const authorityKnown = Boolean(authority)
  const authorityActive = authority?.status === 'active'
  const authorityFingerprintValid = authority ? await fingerprintValid(authority) : false
  const proposalBindingValid = receipt.proposal_id === proposal.proposal_id && receipt.authority_decision_id === proposal.authority_decision_id && receipt.action === proposal.action && receipt.release_authority_id === proposal.release_authority_id
  const beforeHash = await sha256EvidenceDigest(bundle.before_manifest)
  const afterHash = await sha256EvidenceDigest(bundle.after_manifest)
  const manifestBindingValid = receipt.integrity.before_manifest_hash === beforeHash && receipt.integrity.after_manifest_hash === afterHash && proposal.before_manifest_hash === beforeHash && proposal.after_manifest_hash === afterHash && receipt.integrity.patch_digest === proposal.patch_digest
  const issues: ReleaseIssue[] = []
  if (!signatureValid) issues.push(issue('receipt.signature', 'INVALID_RECEIPT_SIGNATURE', 'Release receipt signature is invalid.'))
  if (!receiptIdValid) issues.push(issue('receipt.receipt_id', 'INVALID_RECEIPT_ID', 'Release receipt id does not match its canonical signed body.'))
  if (!authorityKnown) issues.push(issue('receipt.release_authority_id', 'UNKNOWN_RELEASE_AUTHORITY', 'Release authority is unknown.'))
  if (!authorityActive) issues.push(issue('receipt.release_authority_id', 'INACTIVE_RELEASE_AUTHORITY', 'Release authority is inactive.'))
  if (!authorityFingerprintValid) issues.push(issue('receipt.release_authority_id', 'AUTHORITY_FINGERPRINT_MISMATCH', 'Release authority identity is not content-addressed to its public key.'))
  if (!proposalBindingValid) issues.push(issue('receipt.proposal_id', 'PROPOSAL_BINDING_MISMATCH', 'Receipt does not bind the exact signed release proposal.'))
  if (!manifestBindingValid) issues.push(issue('receipt.integrity', 'MANIFEST_BINDING_MISMATCH', 'Receipt and proposal hashes do not bind the supplied before and after manifests.'))
  return {
    receipt_id: receipt.receipt_id,
    signature_valid: signatureValid,
    receipt_id_valid: receiptIdValid,
    authority_known: authorityKnown,
    authority_active: Boolean(authorityActive),
    authority_fingerprint_valid: authorityFingerprintValid,
    proposal_binding_valid: proposalBindingValid,
    manifest_binding_valid: manifestBindingValid,
    accepted: signatureValid && receiptIdValid && authorityKnown && Boolean(authorityActive) && authorityFingerprintValid && proposalBindingValid && manifestBindingValid,
    issues,
  }
}

export function createPackageReleaseBundle(
  before: TheoryPackage,
  after: TheoryPackage,
  proposal: SignedPackageReleaseProposal,
  receipt: SignedPackageReleaseReceipt,
): PackageReleaseBundle {
  return {
    bundle_schema_version: RELEASE_BUNDLE_SCHEMA_VERSION,
    before_manifest: deepClone(before),
    after_manifest: deepClone(after),
    proposal: deepClone(proposal),
    receipt: deepClone(receipt),
    metadata: {
      portable_public_artifact: true,
      repository_commit_status: 'NOT_COMMITTED',
      generated_by: 'controlled-package-release:v0.7',
    },
  }
}

export function validatePackageReleaseBundle(value: unknown): ReleaseIssue[] {
  const issues: ReleaseIssue[] = []
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [issue('$', 'EXPECTED_OBJECT', 'Release bundle must be an object.')]
  const record = value as Record<string, unknown>
  if (record.bundle_schema_version !== RELEASE_BUNDLE_SCHEMA_VERSION) issues.push(issue('bundle_schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${RELEASE_BUNDLE_SCHEMA_VERSION}.`))
  for (const key of ['before_manifest', 'after_manifest', 'proposal', 'receipt'] as const) {
    if (typeof record[key] !== 'object' || record[key] === null || Array.isArray(record[key])) issues.push(issue(key, 'EXPECTED_OBJECT', `${key} must be an object.`))
  }
  return issues
}

export function parsePackageReleaseBundleJson(text: string): { bundle: PackageReleaseBundle | null; issues: ReleaseIssue[] } {
  try {
    const value: unknown = JSON.parse(text)
    const issues = validatePackageReleaseBundle(value)
    return { bundle: issues.length === 0 ? value as PackageReleaseBundle : null, issues }
  } catch (error) {
    return { bundle: null, issues: [issue('$', 'INVALID_JSON', error instanceof Error ? error.message : String(error))] }
  }
}
