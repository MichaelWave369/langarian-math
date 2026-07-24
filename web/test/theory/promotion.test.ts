import { describe, expect, it } from 'vitest'

import {
  CONFORMANCE_SUITE_SCHEMA_VERSION,
  type ContractConformanceCase,
  type ContractConformanceObservation,
  type ContractConformanceSuite,
} from '../../src/theory/conformance.js'
import {
  emptyCustodyBundle,
  generateLocalSigner,
  revokeEvidence,
  signEvidenceSubject,
  type EvidenceCustodyBundle,
} from '../../src/theory/custody.js'
import {
  BUNDLED_THEORY_PACKAGES,
  OPERATOR_CONTRACT_SCHEMA_VERSION,
  RECEIPT_ENVELOPE_SCHEMA_VERSION,
  type TheoryPackage,
} from '../../src/theory/packages.js'
import {
  DEFAULT_LEVEL4_PROMOTION_POLICY,
  buildPromotionGovernanceProfile,
  createPromotionAssessmentReceipt,
} from '../../src/theory/promotion.js'

const langarian = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex')!

function expectedAll(status: 'PASS' | 'FAIL') {
  return [
    { predicate_id: 'output-well-typed', status },
    { predicate_id: 'norm-preserved', status },
    { predicate_id: 'receipt-bound', status },
  ]
}

function completePhasePackage(): TheoryPackage {
  const theoryPackage = structuredClone(langarian) as TheoryPackage
  theoryPackage.operators = theoryPackage.operators.filter((item) => item.id === 'phase-shift')
  return theoryPackage
}

function completeSuite(theoryPackage: TheoryPackage): ContractConformanceSuite {
  const cases: ContractConformanceCase[] = [
    {
      id: 'phase-nominal', operator_id: 'phase-shift', class: 'nominal', description: 'Ordinary finite phase rotation.', expected_status: 'PASS',
      expected_predicates: expectedAll('PASS'), expected_failure_ids: [], exercises_first_falsifier: false, evidence_requirements: ['two implementation surfaces'],
    },
    {
      id: 'phase-boundary', operator_id: 'phase-shift', class: 'boundary', description: 'Zero-state phase boundary.', expected_status: 'PASS',
      expected_predicates: expectedAll('PASS'), expected_failure_ids: [], exercises_first_falsifier: false, evidence_requirements: ['two implementation surfaces'],
    },
    {
      id: 'phase-adversarial', operator_id: 'phase-shift', class: 'adversarial', description: 'Non-finite angle rejected.', expected_status: 'REJECT',
      expected_predicates: [], expected_failure_ids: ['nonfinite-angle'], exercises_first_falsifier: false, evidence_requirements: ['typed rejection evidence'],
    },
    {
      id: 'phase-failure', operator_id: 'phase-shift', class: 'failure', description: 'Invalid state rejected.', expected_status: 'REJECT',
      expected_predicates: [], expected_failure_ids: ['invalid-state'], exercises_first_falsifier: false, evidence_requirements: ['typed rejection evidence'],
    },
    {
      id: 'phase-falsifier', operator_id: 'phase-shift', class: 'falsifier', description: 'Required norm predicate failure path.', expected_status: 'FAIL',
      expected_predicates: expectedAll('FAIL'), expected_failure_ids: ['invariant-failure'], exercises_first_falsifier: true, evidence_requirements: ['counterexample fixture'],
    },
  ]

  const observation = (testCase: ContractConformanceCase, implementationId: string, implementationVersion: string): ContractConformanceObservation => ({
    case_id: testCase.id,
    implementation_id: implementationId,
    implementation_version: implementationVersion,
    contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
    receipt_schema_version: RECEIPT_ENVELOPE_SCHEMA_VERSION,
    status: testCase.expected_status,
    predicate_results: testCase.expected_predicates.map((item) => ({ ...item })),
    failure_ids_observed: [...testCase.expected_failure_ids],
    result_signature: ['PASS', 'WARN'].includes(testCase.expected_status) ? `signature:${testCase.id}` : null,
    evidence_ref: `test-evidence:${implementationId}:${testCase.id}`,
    timestamp_utc: '2026-07-23T00:00:00Z',
  })

  return {
    suite_schema_version: CONFORMANCE_SUITE_SCHEMA_VERSION,
    package: { id: theoryPackage.theory.id, version: theoryPackage.theory.version, schema_version: theoryPackage.schema_version },
    cases,
    observations: cases.flatMap((testCase) => theoryPackage.implementations.map((implementation) => observation(testCase, implementation.id, implementation.version))),
    metadata: { synthetic_complete_suite: true },
  }
}

async function signedBundle(theoryPackage: TheoryPackage, suite: ContractConformanceSuite, scopes?: string[]): Promise<EvidenceCustodyBundle> {
  const signer = await generateLocalSigner('Promotion test signer', scopes, '2026-07-23T00:00:00Z')
  const envelope = await signEvidenceSubject(
    suite,
    'contract-conformance-suite',
    `conformance-suite:${suite.package.id}@${suite.package.version}`,
    signer,
    {
      signed_at_utc: '2026-07-23T00:01:00Z',
      metadata: { package_id: theoryPackage.theory.id, package_version: theoryPackage.theory.version },
    },
  )
  return {
    bundle_schema_version: 'evidence-custody-bundle:v0.1',
    signers: [signer.identity],
    envelopes: [envelope],
    revocations: [],
    metadata: { test_fixture: true },
  }
}

describe('custody-aware promotion gate', () => {
  it('blocks an unsigned suite even when conformance is complete', async () => {
    const theoryPackage = completePhasePackage()
    const suite = completeSuite(theoryPackage)
    const profile = await buildPromotionGovernanceProfile(theoryPackage, suite, emptyCustodyBundle())
    expect(profile.conformance.promotion_eligible).toBe(true)
    expect(profile.status).toBe('BLOCKED')
    expect(profile.blockers.some((item) => item.includes('custody'))).toBe(true)
  })

  it('earns eligibility only with complete conformance and admissible signed custody', async () => {
    const theoryPackage = completePhasePackage()
    const suite = completeSuite(theoryPackage)
    const bundle = await signedBundle(theoryPackage, suite)
    const profile = await buildPromotionGovernanceProfile(theoryPackage, suite, bundle)
    expect(profile.conformance.promotion_eligible).toBe(true)
    expect(profile.admissible_evidence_ids).toHaveLength(1)
    expect(profile.distinct_admissible_signers).toHaveLength(1)
    expect(profile.blockers).toEqual([])
    expect(profile.status).toBe('ELIGIBLE_FOR_REVIEW')
  })

  it('blocks evidence when the signer lacks the required signing scope', async () => {
    const theoryPackage = completePhasePackage()
    const suite = completeSuite(theoryPackage)
    const bundle = await signedBundle(theoryPackage, suite, [])
    const profile = await buildPromotionGovernanceProfile(theoryPackage, suite, bundle)
    expect(profile.status).toBe('BLOCKED')
    expect(profile.admissible_evidence[0]?.signer_scope_valid).toBe(false)
  })

  it('blocks exact signatures with incorrect package metadata binding', async () => {
    const theoryPackage = completePhasePackage()
    const suite = completeSuite(theoryPackage)
    const signer = await generateLocalSigner('Metadata test')
    const envelope = await signEvidenceSubject(suite, 'contract-conformance-suite', `conformance-suite:${suite.package.id}@${suite.package.version}`, signer, {
      metadata: { package_id: 'wrong-package', package_version: suite.package.version },
    })
    const bundle: EvidenceCustodyBundle = { bundle_schema_version: 'evidence-custody-bundle:v0.1', signers: [signer.identity], envelopes: [envelope], revocations: [], metadata: {} }
    const profile = await buildPromotionGovernanceProfile(theoryPackage, suite, bundle)
    expect(profile.status).toBe('BLOCKED')
    expect(profile.admissible_evidence[0]?.package_binding_valid).toBe(false)
  })

  it('blocks an unauthorized cross-signer revocation ambiguity', async () => {
    const theoryPackage = completePhasePackage()
    const suite = completeSuite(theoryPackage)
    const bundle = await signedBundle(theoryPackage, suite)
    const unrelated = await generateLocalSigner('Unrelated revoker')
    const revocation = await revokeEvidence(bundle.envelopes[0]!.evidence_id, unrelated, 'Unauthorized withdrawal.', { issued_at_utc: '2026-07-23T00:02:00Z' })
    bundle.signers.push(unrelated.identity)
    bundle.revocations.push(revocation)
    const profile = await buildPromotionGovernanceProfile(theoryPackage, suite, bundle)
    expect(profile.status).toBe('BLOCKED')
    expect(profile.lifecycle_issues.some((item) => item.code === 'REVOCATION_AUTHORITY_SCOPE_MISSING')).toBe(true)
  })

  it('keeps the current bundled Langarian suite blocked despite valid local custody', async () => {
    const suiteModule = await import('../../src/theory/conformance.js')
    const suite = suiteModule.suiteForPackage(langarian)!
    const bundle = await signedBundle(langarian, suite)
    const profile = await buildPromotionGovernanceProfile(langarian, suite, bundle)
    expect(profile.admissible_evidence_ids).toHaveLength(1)
    expect(profile.conformance.promotion_eligible).toBe(false)
    expect(profile.status).toBe('BLOCKED')
  })
})

describe('promotion assessment receipts', () => {
  it('emits a deterministic eligibility assessment without mutating maturity', async () => {
    const theoryPackage = completePhasePackage()
    const suite = completeSuite(theoryPackage)
    const bundle = await signedBundle(theoryPackage, suite)
    const profile = await buildPromotionGovernanceProfile(theoryPackage, suite, bundle, DEFAULT_LEVEL4_PROMOTION_POLICY)
    const first = await createPromotionAssessmentReceipt(profile, theoryPackage.maturity_level, '2026-07-23T00:03:00Z')
    const second = await createPromotionAssessmentReceipt(profile, theoryPackage.maturity_level, '2026-07-23T00:03:00Z')
    expect(first.assessment_id).toBe(second.assessment_id)
    expect(first.status).toBe('ELIGIBLE_FOR_REVIEW')
    expect(first.assessment_type).toBe('eligibility-review-not-package-mutation')
    expect(first.package.current_maturity_level).toBe(theoryPackage.maturity_level)
    expect(first.prohibited_inferences.join(' ')).toMatch(/automatically changed/)
  })

  it('contains no private research identifiers', async () => {
    const serialized = JSON.stringify({ policy: DEFAULT_LEVEL4_PROMOTION_POLICY, schema: 'promotion-assessment:v0.1' }).toLowerCase()
    expect(serialized).not.toContain('saasy')
    expect(serialized).not.toContain('reduced-hamiltonian')
  })
})
