import { buildConformanceProfile, type ContractConformanceProfile, type ContractConformanceSuite } from './conformance.js'
import {
  custodyLocatorForSuite,
  sha256EvidenceDigest,
  verifyCustodyBundle,
  type CustodyValidationIssue,
  type EvidenceCustodyBundle,
  type EvidenceCustodyEnvelope,
  type EvidenceRevocationRecord,
  type EvidenceSignerIdentity,
} from './custody.js'
import { validateTheoryPackage, type TheoryPackage } from './packages.js'

export const PROMOTION_POLICY_SCHEMA_VERSION = 'promotion-policy:v0.1' as const
export const PROMOTION_ASSESSMENT_SCHEMA_VERSION = 'promotion-assessment:v0.1' as const

export type PromotionAssessmentStatus = 'ELIGIBLE_FOR_REVIEW' | 'BLOCKED'

export interface PromotionPolicy {
  schema_version: typeof PROMOTION_POLICY_SCHEMA_VERSION
  id: string
  version: string
  target_level: 4
  minimum_active_evidence_envelopes: number
  minimum_distinct_evidence_signers: number
  required_subject_kind: 'contract-conformance-suite'
  required_signer_scopes: string[]
  require_exact_subject_digest: boolean
  require_exact_package_metadata: boolean
  require_authorized_revocations: boolean
  require_lifecycle_consistency: boolean
  require_conformance_eligibility: boolean
  metadata: Record<string, unknown>
}

export interface PromotionGovernanceIssue {
  path: string
  code: string
  message: string
}

export interface AdmissibleEvidenceRecord {
  evidence_id: string
  signer_id: string
  subject_locator: string
  subject_digest: string
  signer_fingerprint_valid: boolean
  signer_scope_valid: boolean
  package_binding_valid: boolean
  lifecycle_valid: boolean
  admissible: boolean
  issues: PromotionGovernanceIssue[]
}

export interface PromotionGovernanceProfile {
  package_id: string
  package_version: string
  target_level: 4
  suite_locator: string
  suite_digest: string
  policy: PromotionPolicy
  conformance: ContractConformanceProfile
  custody_bundle_valid: boolean
  custody_ready: boolean
  admissible_evidence: AdmissibleEvidenceRecord[]
  admissible_evidence_ids: string[]
  distinct_admissible_signers: string[]
  lifecycle_issues: PromotionGovernanceIssue[]
  blockers: string[]
  warnings: string[]
  status: PromotionAssessmentStatus
}

export interface PromotionAssessmentReceipt {
  schema_version: typeof PROMOTION_ASSESSMENT_SCHEMA_VERSION
  assessment_id: string
  assessment_type: 'eligibility-review-not-package-mutation'
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
  evidence: {
    suite_locator: string
    suite_digest: string
    admissible_evidence_ids: string[]
    distinct_signer_ids: string[]
  }
  conformance: {
    suite_schema_version: string
    promotion_eligible: boolean
    operator_count: number
    blockers: string[]
  }
  custody: {
    bundle_valid: boolean
    custody_ready: boolean
    admissible_evidence_count: number
    lifecycle_issue_count: number
  }
  status: PromotionAssessmentStatus
  blockers: string[]
  warnings: string[]
  issued_at_utc: string
  claims_supported: string[]
  prohibited_inferences: string[]
}

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)*$/

function issue(path: string, code: string, message: string): PromotionGovernanceIssue {
  return { path, code, message }
}

function signerFingerprintExpected(identity: EvidenceSignerIdentity): Promise<string> {
  return sha256EvidenceDigest(identity.public_key_jwk).then((digest) => `signer:${digest.slice('sha256:'.length)}`)
}

function requiredScopeForSubjectKind(subjectKind: string): string {
  return `sign:${subjectKind}`
}

function envelopeById(bundle: EvidenceCustodyBundle): Map<string, EvidenceCustodyEnvelope> {
  return new Map(bundle.envelopes.map((envelope) => [envelope.evidence_id, envelope]))
}

function signerById(bundle: EvidenceCustodyBundle): Map<string, EvidenceSignerIdentity> {
  return new Map(bundle.signers.map((signer) => [signer.id, signer]))
}

function revocationAuthorized(
  record: EvidenceRevocationRecord,
  target: EvidenceCustodyEnvelope | undefined,
  authority: EvidenceSignerIdentity | undefined,
): boolean {
  if (!target || !authority) return false
  if (authority.id === target.signer_id) return authority.authority_scope.includes('revoke:self-issued-evidence')
  return authority.authority_scope.includes('revoke:any-evidence')
}

function detectSupersessionCycle(bundle: EvidenceCustodyBundle): string[] {
  const graph = new Map(bundle.envelopes.map((envelope) => [envelope.evidence_id, [...envelope.supersedes]]))
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
    for (const next of graph.get(id) ?? []) visit(next)
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of graph.keys()) visit(id)
  return [...cycles]
}

function lifecycleIssues(bundle: EvidenceCustodyBundle, relevantLocator: string): PromotionGovernanceIssue[] {
  const issues: PromotionGovernanceIssue[] = []
  const envelopes = envelopeById(bundle)
  const signers = signerById(bundle)

  for (const record of bundle.revocations) {
    const target = envelopes.get(record.target_evidence_id)
    const authority = signers.get(record.authority_id)
    if (!target) {
      issues.push(issue(record.revocation_id, 'REVOCATION_TARGET_UNKNOWN', `Revocation targets unknown evidence ${record.target_evidence_id}.`))
      continue
    }
    if (target.subject_locator !== relevantLocator) continue
    if (!revocationAuthorized(record, target, authority)) {
      issues.push(issue(record.revocation_id, 'REVOCATION_AUTHORITY_SCOPE_MISSING', `Authority ${record.authority_id} is not scoped to revoke ${record.target_evidence_id}.`))
    }
  }

  for (const envelope of bundle.envelopes.filter((item) => item.subject_locator === relevantLocator)) {
    for (const priorId of envelope.supersedes) {
      const prior = envelopes.get(priorId)
      if (!prior) {
        issues.push(issue(envelope.evidence_id, 'SUPERSESSION_TARGET_UNKNOWN', `Supersession target ${priorId} does not exist.`))
        continue
      }
      if (prior.evidence_id === envelope.evidence_id) issues.push(issue(envelope.evidence_id, 'SELF_SUPERSESSION', 'Evidence may not supersede itself.'))
      if (prior.subject_locator !== envelope.subject_locator || prior.subject_kind !== envelope.subject_kind) {
        issues.push(issue(envelope.evidence_id, 'CROSS_SUBJECT_SUPERSESSION', `Evidence ${envelope.evidence_id} supersedes a different subject.`))
      }
      const signer = signers.get(envelope.signer_id)
      if (prior.signer_id !== envelope.signer_id && !signer?.authority_scope.includes('supersede:any-evidence')) {
        issues.push(issue(envelope.evidence_id, 'SUPERSESSION_AUTHORITY_SCOPE_MISSING', `Signer ${envelope.signer_id} is not scoped to supersede evidence issued by ${prior.signer_id}.`))
      }
    }
  }

  for (const cycleId of detectSupersessionCycle(bundle)) {
    issues.push(issue(cycleId, 'SUPERSESSION_CYCLE', 'The supersession graph contains a cycle.'))
  }

  return issues
}

export const DEFAULT_LEVEL4_PROMOTION_POLICY: PromotionPolicy = {
  schema_version: PROMOTION_POLICY_SCHEMA_VERSION,
  id: 'level4-custody-aware-promotion',
  version: '0.1.0',
  target_level: 4,
  minimum_active_evidence_envelopes: 1,
  minimum_distinct_evidence_signers: 1,
  required_subject_kind: 'contract-conformance-suite',
  required_signer_scopes: ['sign:contract-conformance-suite'],
  require_exact_subject_digest: true,
  require_exact_package_metadata: true,
  require_authorized_revocations: true,
  require_lifecycle_consistency: true,
  require_conformance_eligibility: true,
  metadata: {
    decision_boundary: 'This policy evaluates eligibility for governance review. It does not mutate a package manifest or prove empirical truth.',
  },
}

export function validatePromotionPolicy(value: PromotionPolicy): PromotionGovernanceIssue[] {
  const issues: PromotionGovernanceIssue[] = []
  if (value.schema_version !== PROMOTION_POLICY_SCHEMA_VERSION) issues.push(issue('schema_version', 'UNSUPPORTED_POLICY_SCHEMA', `Expected ${PROMOTION_POLICY_SCHEMA_VERSION}.`))
  if (!ID_PATTERN.test(value.id)) issues.push(issue('id', 'INVALID_POLICY_ID', 'Policy id must be stable and lowercase.'))
  if (value.target_level !== 4) issues.push(issue('target_level', 'UNSUPPORTED_TARGET_LEVEL', 'v0.1 supports Level 4 promotion only.'))
  if (!Number.isInteger(value.minimum_active_evidence_envelopes) || value.minimum_active_evidence_envelopes < 1) issues.push(issue('minimum_active_evidence_envelopes', 'INVALID_MINIMUM', 'At least one active envelope is required.'))
  if (!Number.isInteger(value.minimum_distinct_evidence_signers) || value.minimum_distinct_evidence_signers < 1) issues.push(issue('minimum_distinct_evidence_signers', 'INVALID_MINIMUM', 'At least one distinct signer is required.'))
  if (!Array.isArray(value.required_signer_scopes) || value.required_signer_scopes.length === 0) issues.push(issue('required_signer_scopes', 'SCOPE_REQUIRED', 'At least one evidence-signing scope is required.'))
  return issues
}

export async function buildPromotionGovernanceProfile(
  theoryPackage: TheoryPackage,
  suite: ContractConformanceSuite,
  custodyBundle: EvidenceCustodyBundle,
  policy: PromotionPolicy = DEFAULT_LEVEL4_PROMOTION_POLICY,
): Promise<PromotionGovernanceProfile> {
  const suiteLocator = custodyLocatorForSuite(suite)
  const suiteDigest = await sha256EvidenceDigest(suite)
  const conformance = buildConformanceProfile(theoryPackage, suite)
  const custody = await verifyCustodyBundle(custodyBundle, { [suiteLocator]: suite })
  const policyIssues = validatePromotionPolicy(policy)
  const lifecycle = lifecycleIssues(custodyBundle, suiteLocator)
  const signers = signerById(custodyBundle)
  const rawEnvelopes = envelopeById(custodyBundle)
  const relevantActive = custody.active_envelopes.filter((result) => result.subject_locator === suiteLocator)
  const admissibleEvidence: AdmissibleEvidenceRecord[] = []

  for (const verified of relevantActive) {
    const envelope = rawEnvelopes.get(verified.evidence_id)
    const signer = envelope ? signers.get(envelope.signer_id) : undefined
    const recordIssues: PromotionGovernanceIssue[] = []
    const expectedSignerId = signer ? await signerFingerprintExpected(signer) : null
    const fingerprintValid = Boolean(signer && expectedSignerId === signer.id)
    if (!fingerprintValid) recordIssues.push(issue(verified.evidence_id, 'SIGNER_FINGERPRINT_MISMATCH', 'Signer id is not derived from the supplied public key fingerprint.'))

    const requiredScopes = new Set([...policy.required_signer_scopes, requiredScopeForSubjectKind(envelope?.subject_kind ?? '')])
    const signerScopeValid = Boolean(signer && [...requiredScopes].every((scope) => signer.authority_scope.includes(scope)))
    if (!signerScopeValid) recordIssues.push(issue(verified.evidence_id, 'SIGNER_SCOPE_MISSING', `Signer lacks one or more required scopes: ${[...requiredScopes].join(', ')}.`))

    const packageBindingValid = Boolean(
      envelope &&
      envelope.subject_kind === policy.required_subject_kind &&
      envelope.subject_locator === suiteLocator &&
      (!policy.require_exact_subject_digest || envelope.subject_digest === suiteDigest) &&
      (!policy.require_exact_package_metadata || (
        envelope.metadata.package_id === theoryPackage.theory.id &&
        envelope.metadata.package_version === theoryPackage.theory.version
      )),
    )
    if (!packageBindingValid) recordIssues.push(issue(verified.evidence_id, 'PACKAGE_BINDING_MISMATCH', 'Evidence is not bound to the exact package, suite locator, subject kind, and digest required by policy.'))

    const lifecycleValid = !lifecycle.some((item) => item.path === verified.evidence_id)
    if (!lifecycleValid) recordIssues.push(issue(verified.evidence_id, 'LIFECYCLE_INVALID', 'Evidence participates in an invalid revocation or supersession relation.'))

    const admissible = verified.accepted && fingerprintValid && signerScopeValid && packageBindingValid && lifecycleValid
    admissibleEvidence.push({
      evidence_id: verified.evidence_id,
      signer_id: verified.signer_id,
      subject_locator: verified.subject_locator,
      subject_digest: envelope?.subject_digest ?? '',
      signer_fingerprint_valid: fingerprintValid,
      signer_scope_valid: signerScopeValid,
      package_binding_valid: packageBindingValid,
      lifecycle_valid: lifecycleValid,
      admissible,
      issues: recordIssues,
    })
  }

  const admissible = admissibleEvidence.filter((item) => item.admissible)
  const distinctSigners = [...new Set(admissible.map((item) => item.signer_id))]
  const blockers: string[] = []
  const packageValidation = validateTheoryPackage(theoryPackage)
  if (!packageValidation.ok) blockers.push(`Theory package has ${packageValidation.issues.length} validation issue(s).`)
  if (policyIssues.length > 0) blockers.push(`Promotion policy has ${policyIssues.length} validation issue(s).`)
  if (policy.require_conformance_eligibility && !conformance.promotion_eligible) blockers.push('Contract conformance has not earned Level-4 eligibility.')
  if (!custody.bundle_valid) blockers.push('Custody bundle fails structural validation.')
  if (!custody.custody_ready) blockers.push('No active cryptographically accepted custody envelope is available for the exact suite.')
  if (admissible.length < policy.minimum_active_evidence_envelopes) blockers.push(`Policy requires at least ${policy.minimum_active_evidence_envelopes} admissible active evidence envelope(s).`)
  if (distinctSigners.length < policy.minimum_distinct_evidence_signers) blockers.push(`Policy requires at least ${policy.minimum_distinct_evidence_signers} distinct admissible evidence signer(s).`)
  if (policy.require_authorized_revocations && lifecycle.some((item) => item.code.startsWith('REVOCATION_'))) blockers.push('Revocation lifecycle contains an authority or target ambiguity.')
  if (policy.require_lifecycle_consistency && lifecycle.some((item) => item.code.includes('SUPERSESSION'))) blockers.push('Supersession lifecycle is inconsistent or cyclic.')
  for (const item of admissibleEvidence.filter((record) => !record.admissible)) blockers.push(`${item.evidence_id}: custody admission failed.`)

  const warnings: string[] = []
  if (theoryPackage.maturity_level >= 4 && blockers.length > 0) warnings.push('The package declares Level 4, but custody-aware promotion has not re-earned that status under this policy.')
  if (custodyBundle.metadata.planning_artifact === true) warnings.push('The custody bundle is marked as a planning artifact.')
  warnings.push('An eligible assessment authorizes governance review only. It does not mutate the package manifest and does not pass the Reality Gate.')

  return {
    package_id: theoryPackage.theory.id,
    package_version: theoryPackage.theory.version,
    target_level: 4,
    suite_locator: suiteLocator,
    suite_digest: suiteDigest,
    policy,
    conformance,
    custody_bundle_valid: custody.bundle_valid,
    custody_ready: custody.custody_ready,
    admissible_evidence: admissibleEvidence,
    admissible_evidence_ids: admissible.map((item) => item.evidence_id),
    distinct_admissible_signers: distinctSigners,
    lifecycle_issues: [...policyIssues, ...lifecycle],
    blockers,
    warnings,
    status: blockers.length === 0 ? 'ELIGIBLE_FOR_REVIEW' : 'BLOCKED',
  }
}

export async function createPromotionAssessmentReceipt(
  profile: PromotionGovernanceProfile,
  currentMaturityLevel: number,
  now = new Date().toISOString(),
): Promise<PromotionAssessmentReceipt> {
  const unsigned = {
    schema_version: PROMOTION_ASSESSMENT_SCHEMA_VERSION,
    assessment_type: 'eligibility-review-not-package-mutation' as const,
    package: {
      id: profile.package_id,
      version: profile.package_version,
      current_maturity_level: currentMaturityLevel,
      target_level: profile.target_level,
    },
    policy: {
      id: profile.policy.id,
      version: profile.policy.version,
      schema_version: profile.policy.schema_version,
    },
    evidence: {
      suite_locator: profile.suite_locator,
      suite_digest: profile.suite_digest,
      admissible_evidence_ids: [...profile.admissible_evidence_ids],
      distinct_signer_ids: [...profile.distinct_admissible_signers],
    },
    conformance: {
      suite_schema_version: profile.conformance.suite_schema_version,
      promotion_eligible: profile.conformance.promotion_eligible,
      operator_count: profile.conformance.operators.length,
      blockers: [...profile.conformance.blockers],
    },
    custody: {
      bundle_valid: profile.custody_bundle_valid,
      custody_ready: profile.custody_ready,
      admissible_evidence_count: profile.admissible_evidence_ids.length,
      lifecycle_issue_count: profile.lifecycle_issues.length,
    },
    status: profile.status,
    blockers: [...profile.blockers],
    warnings: [...profile.warnings],
    issued_at_utc: now,
    claims_supported: profile.status === 'ELIGIBLE_FOR_REVIEW'
      ? ['The exact package and conformance suite are eligible to enter a separate Level-4 governance review under the named policy.']
      : ['The named package remains blocked from Level-4 governance review under the named policy.'],
    prohibited_inferences: [
      'The package maturity level was automatically changed.',
      'The mathematics was proved solely because evidence was signed.',
      'The theory passed the empirical Reality Gate.',
      'A signer endorsement is equivalent to independent scientific replication.',
    ],
  }
  const digest = await sha256EvidenceDigest(unsigned)
  return { ...unsigned, assessment_id: `assessment:${digest.slice('sha256:'.length)}` }
}
