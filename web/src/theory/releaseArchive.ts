import type { PromotionAuthorityBundle } from './authority.js'
import type { SignedPromotionAuthorityDecisionReceipt } from './signedDecision.js'
import {
  buildControlledPackageReleaseProfile,
  createPackageReleaseBundle,
  validatePackageReleaseBundle,
  verifySignedPackageReleaseReceipt,
  type PackageReleaseBundle,
  type PackageReleasePolicy,
  type ReleaseIssue,
  type ReleaseReceiptVerification,
  type SignedPackageReleaseProposal,
  type SignedPackageReleaseReceipt,
  DEFAULT_PACKAGE_RELEASE_POLICY,
} from './release.js'
import type { TheoryPackage } from './packages.js'

export const RELEASE_ARCHIVE_SCHEMA_VERSION = 'package-release-archive:v0.1' as const

export interface PackageReleaseArchive {
  archive_schema_version: typeof RELEASE_ARCHIVE_SCHEMA_VERSION
  signed_authority_decision: SignedPromotionAuthorityDecisionReceipt
  authority_bundle: PromotionAuthorityBundle
  release_bundle: PackageReleaseBundle
  metadata: Record<string, unknown>
}

export interface ReleaseArchiveVerification {
  structurally_valid: boolean
  decision_binding_valid: boolean
  release_profile_status: 'AUTHORIZED_NOT_COMMITTED' | 'BLOCKED'
  receipt_verification: ReleaseReceiptVerification
  accepted: boolean
  issues: ReleaseIssue[]
}

function issue(path: string, code: string, message: string): ReleaseIssue {
  return { path, code, message }
}

export function createPackageReleaseArchive(
  before: TheoryPackage,
  after: TheoryPackage,
  proposal: SignedPackageReleaseProposal,
  receipt: SignedPackageReleaseReceipt,
  decision: SignedPromotionAuthorityDecisionReceipt,
  authorityBundle: PromotionAuthorityBundle,
): PackageReleaseArchive {
  return {
    archive_schema_version: RELEASE_ARCHIVE_SCHEMA_VERSION,
    signed_authority_decision: JSON.parse(JSON.stringify(decision)),
    authority_bundle: JSON.parse(JSON.stringify(authorityBundle)),
    release_bundle: createPackageReleaseBundle(before, after, proposal, receipt),
    metadata: {
      portable_public_artifact: true,
      repository_commit_status: 'NOT_COMMITTED',
      generated_by: 'controlled-package-release-archive:v0.7',
    },
  }
}

export function validatePackageReleaseArchive(value: unknown): ReleaseIssue[] {
  const issues: ReleaseIssue[] = []
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [issue('$', 'EXPECTED_OBJECT', 'Release archive must be an object.')]
  const record = value as Record<string, unknown>
  if (record.archive_schema_version !== RELEASE_ARCHIVE_SCHEMA_VERSION) issues.push(issue('archive_schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${RELEASE_ARCHIVE_SCHEMA_VERSION}.`))
  if (typeof record.signed_authority_decision !== 'object' || record.signed_authority_decision === null || Array.isArray(record.signed_authority_decision)) issues.push(issue('signed_authority_decision', 'EXPECTED_OBJECT', 'Signed authority decision is required.'))
  if (typeof record.authority_bundle !== 'object' || record.authority_bundle === null || Array.isArray(record.authority_bundle)) issues.push(issue('authority_bundle', 'EXPECTED_OBJECT', 'Authority bundle is required.'))
  if (typeof record.release_bundle !== 'object' || record.release_bundle === null || Array.isArray(record.release_bundle)) issues.push(issue('release_bundle', 'EXPECTED_OBJECT', 'Release bundle is required.'))
  else issues.push(...validatePackageReleaseBundle(record.release_bundle).map((item) => ({ ...item, path: `release_bundle.${item.path}` })))
  return issues
}

export async function verifyPackageReleaseArchive(
  archive: PackageReleaseArchive,
  policy: PackageReleasePolicy = DEFAULT_PACKAGE_RELEASE_POLICY,
  now = new Date().toISOString(),
): Promise<ReleaseArchiveVerification> {
  const structuralIssues = validatePackageReleaseArchive(archive)
  const { release_bundle: bundle, signed_authority_decision: decision, authority_bundle: authorityBundle } = archive
  const decisionBindingValid = bundle.proposal.authority_decision_id === decision.decision_id && bundle.receipt.authority_decision_id === decision.decision_id
  const receiptVerification = await verifySignedPackageReleaseReceipt(bundle, authorityBundle.authorities)
  const profile = await buildControlledPackageReleaseProfile(bundle.before_manifest, decision, authorityBundle, bundle.proposal, policy, now)
  const issues: ReleaseIssue[] = [...structuralIssues]
  if (!decisionBindingValid) issues.push(issue('signed_authority_decision.decision_id', 'DECISION_BINDING_MISMATCH', 'Release proposal and receipt do not bind the archived signed authority decision.'))
  if (bundle.receipt.status !== profile.status) issues.push(issue('release_bundle.receipt.status', 'PROFILE_STATUS_MISMATCH', 'Archived receipt status does not match a fresh evaluation of the archived inputs.'))
  issues.push(...receiptVerification.issues)
  return {
    structurally_valid: structuralIssues.length === 0,
    decision_binding_valid: decisionBindingValid,
    release_profile_status: profile.status,
    receipt_verification: receiptVerification,
    accepted: structuralIssues.length === 0 && decisionBindingValid && receiptVerification.accepted && bundle.receipt.status === profile.status,
    issues,
  }
}

export function parsePackageReleaseArchiveJson(text: string): { archive: PackageReleaseArchive | null; issues: ReleaseIssue[] } {
  try {
    const value: unknown = JSON.parse(text)
    const issues = validatePackageReleaseArchive(value)
    return { archive: issues.length === 0 ? value as PackageReleaseArchive : null, issues }
  } catch (error) {
    return { archive: null, issues: [issue('$', 'INVALID_JSON', error instanceof Error ? error.message : String(error))] }
  }
}
