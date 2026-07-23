import { describe, expect, it } from 'vitest'

import {
  BUNDLED_CONFORMANCE_SUITES,
  CONFORMANCE_SUITE_SCHEMA_VERSION,
  buildConformanceProfile,
  buildConformanceSuiteScaffold,
  parseConformanceSuiteJson,
  validateConformanceSuite,
  type ContractConformanceCase,
  type ContractConformanceObservation,
  type ContractConformanceSuite,
} from '../../src/theory/conformance.js'
import {
  BUNDLED_THEORY_PACKAGES,
  OPERATOR_CONTRACT_SCHEMA_VERSION,
  RECEIPT_ENVELOPE_SCHEMA_VERSION,
  type TheoryPackage,
} from '../../src/theory/packages.js'

const langarian = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex')!
const bundledSuite = BUNDLED_CONFORMANCE_SUITES.find((item) => item.package.id === langarian.theory.id)!

describe('bundled contract-conformance evidence', () => {
  it('validates the evidence registry without inventing missing cases', () => {
    const validation = validateConformanceSuite(langarian, bundledSuite)
    expect(validation.issues).toEqual([])
    expect(validation.ok).toBe(true)
    expect(bundledSuite.metadata.partial_evidence).toBe(true)
  })

  it('preserves the stricter Level-4 gate as blocked', () => {
    const profile = buildConformanceProfile(langarian, bundledSuite)
    expect(profile.promotion_eligible).toBe(false)
    expect(profile.warnings.some((item) => item.includes('re-earned Level 4'))).toBe(true)
    expect(profile.operators.some((operator) => !operator.case_classes.adversarial)).toBe(true)
    expect(profile.operators.some((operator) => !operator.case_classes.failure)).toBe(true)
    expect(profile.operators.some((operator) => !operator.falsifier_exercised)).toBe(true)
  })

  it('contains only public Langarian evidence', () => {
    const serialized = JSON.stringify(BUNDLED_CONFORMANCE_SUITES).toLowerCase()
    expect(serialized).not.toContain('saasy')
    expect(serialized).not.toContain('reduced-hamiltonian')
  })
})

describe('conformance suite validation', () => {
  it('rejects observations for unknown implementations', () => {
    const broken = structuredClone(bundledSuite)
    broken.observations[0]!.implementation_id = 'unknown-runtime'
    const result = validateConformanceSuite(langarian, broken)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'UNKNOWN_EXECUTABLE_IMPLEMENTATION')).toBe(true)
  })

  it('rejects predicate outcomes that disagree with the case expectation', () => {
    const broken = structuredClone(bundledSuite)
    const original = broken.observations[0]!.predicate_results[0]!
    broken.observations[0]!.predicate_results[0] = { ...original, status: 'FAIL' }
    const result = validateConformanceSuite(langarian, broken)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'PREDICATE_RESULT_MISMATCH')).toBe(true)
  })

  it('parses valid JSON and reports malformed JSON', () => {
    const valid = parseConformanceSuiteJson(langarian, JSON.stringify(bundledSuite))
    expect(valid.validation.ok).toBe(true)
    expect(valid.suite?.suite_schema_version).toBe(CONFORMANCE_SUITE_SCHEMA_VERSION)

    const malformed = parseConformanceSuiteJson(langarian, '{ nope')
    expect(malformed.suite).toBeNull()
    expect(malformed.validation.issues[0]?.code).toBe('INVALID_JSON')
  })
})

describe('conformance planning scaffold', () => {
  it('creates all five case classes without manufacturing observations', () => {
    const scaffold = buildConformanceSuiteScaffold(langarian)
    const phaseCases = scaffold.cases.filter((item) => item.operator_id === 'phase-shift')
    expect(new Set(phaseCases.map((item) => item.class))).toEqual(new Set(['nominal', 'boundary', 'adversarial', 'failure', 'falsifier']))
    expect(scaffold.observations).toEqual([])
    expect(scaffold.metadata.planning_artifact).toBe(true)
    expect(buildConformanceProfile(langarian, scaffold).promotion_eligible).toBe(false)
  })
})

function expectedAll(status: 'PASS' | 'FAIL') {
  return [
    { predicate_id: 'output-well-typed', status },
    { predicate_id: 'norm-preserved', status },
    { predicate_id: 'receipt-bound', status },
  ] as const
}

function observation(
  testCase: ContractConformanceCase,
  implementationId: string,
  implementationVersion: string,
): ContractConformanceObservation {
  return {
    case_id: testCase.id,
    implementation_id: implementationId,
    implementation_version: implementationVersion,
    contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
    receipt_schema_version: RECEIPT_ENVELOPE_SCHEMA_VERSION,
    status: testCase.expected_status,
    predicate_results: testCase.expected_predicates.map((item) => ({ ...item })),
    failure_ids_observed: [...testCase.expected_failure_ids],
    result_signature: testCase.expected_status === 'PASS' || testCase.expected_status === 'WARN' ? `signature:${testCase.id}` : null,
    evidence_ref: `test-evidence:${implementationId}:${testCase.id}`,
    timestamp_utc: '1970-01-01T00:00:00Z',
  }
}

describe('promotion proof', () => {
  it('earns the gate only with complete cases, failures, falsifier, coverage, and agreement', () => {
    const packageUnderTest = structuredClone(langarian) as TheoryPackage
    packageUnderTest.operators = packageUnderTest.operators.filter((item) => item.id === 'phase-shift')

    const cases: ContractConformanceCase[] = [
      {
        id: 'phase-nominal', operator_id: 'phase-shift', class: 'nominal', description: 'Ordinary rotation.', expected_status: 'PASS',
        expected_predicates: [...expectedAll('PASS')], expected_failure_ids: [], exercises_first_falsifier: false, evidence_requirements: ['two surfaces'],
      },
      {
        id: 'phase-boundary', operator_id: 'phase-shift', class: 'boundary', description: 'Zero-state boundary.', expected_status: 'PASS',
        expected_predicates: [...expectedAll('PASS')], expected_failure_ids: [], exercises_first_falsifier: false, evidence_requirements: ['two surfaces'],
      },
      {
        id: 'phase-adversarial', operator_id: 'phase-shift', class: 'adversarial', description: 'Non-finite angle rejected.', expected_status: 'REJECT',
        expected_predicates: [], expected_failure_ids: ['nonfinite-angle'], exercises_first_falsifier: false, evidence_requirements: ['rejection receipt'],
      },
      {
        id: 'phase-failure', operator_id: 'phase-shift', class: 'failure', description: 'Invalid input rejected.', expected_status: 'REJECT',
        expected_predicates: [], expected_failure_ids: ['invalid-state'], exercises_first_falsifier: false, evidence_requirements: ['rejection receipt'],
      },
      {
        id: 'phase-falsifier', operator_id: 'phase-shift', class: 'falsifier', description: 'Norm-preservation counterexample path.', expected_status: 'FAIL',
        expected_predicates: [...expectedAll('FAIL')], expected_failure_ids: ['invariant-failure'], exercises_first_falsifier: true, evidence_requirements: ['counterexample fixture'],
      },
    ]
    const suite: ContractConformanceSuite = {
      suite_schema_version: CONFORMANCE_SUITE_SCHEMA_VERSION,
      package: { id: packageUnderTest.theory.id, version: packageUnderTest.theory.version, schema_version: packageUnderTest.schema_version },
      cases,
      observations: cases.flatMap((testCase) => packageUnderTest.implementations.map((implementation) => observation(testCase, implementation.id, implementation.version))),
      metadata: { synthetic_test: true },
    }

    const profile = buildConformanceProfile(packageUnderTest, suite)
    expect(profile.validation.issues).toEqual([])
    expect(profile.promotion_eligible).toBe(true)
    expect(profile.blockers).toEqual([])
    expect(profile.operators[0]?.percent).toBe(100)
  })

  it('blocks promotion when surfaces disagree', () => {
    const packageUnderTest = structuredClone(langarian) as TheoryPackage
    packageUnderTest.operators = packageUnderTest.operators.filter((item) => item.id === 'phase-shift')
    const scaffold = buildConformanceSuiteScaffold(packageUnderTest)
    const profile = buildConformanceProfile(packageUnderTest, scaffold)
    expect(profile.promotion_eligible).toBe(false)
    expect(profile.blockers.length).toBeGreaterThan(0)
  })
})
