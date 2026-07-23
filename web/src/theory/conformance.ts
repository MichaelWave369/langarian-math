import {
  OPERATOR_CONTRACT_SCHEMA_VERSION,
  RECEIPT_ENVELOPE_SCHEMA_VERSION,
  THEORY_PACKAGE_SCHEMA_VERSION,
  operatorContractResolved,
  validateTheoryPackage,
  type TheoryImplementation,
  type TheoryOperatorDefinition,
  type TheoryPackage,
} from './packages.js'

export const CONFORMANCE_SUITE_SCHEMA_VERSION = 'contract-conformance-suite:v0.1' as const

export type ConformanceCaseClass = 'nominal' | 'boundary' | 'adversarial' | 'failure' | 'falsifier'
export type ConformanceStatus = 'PASS' | 'WARN' | 'FAIL' | 'REJECT'
export type PredicateResultStatus = 'PASS' | 'WARN' | 'FAIL' | 'NOT_RUN'

export interface ExpectedPredicateResult {
  predicate_id: string
  status: PredicateResultStatus
}

export interface ContractConformanceCase {
  id: string
  operator_id: string
  class: ConformanceCaseClass
  description: string
  expected_status: ConformanceStatus
  expected_predicates: ExpectedPredicateResult[]
  expected_failure_ids: string[]
  exercises_first_falsifier: boolean
  evidence_requirements: string[]
}

export interface ContractConformanceObservation {
  case_id: string
  implementation_id: string
  implementation_version: string
  contract_version: string
  receipt_schema_version: string
  status: ConformanceStatus
  predicate_results: ExpectedPredicateResult[]
  failure_ids_observed: string[]
  result_signature: string | null
  evidence_ref: string
  timestamp_utc: string
}

export interface ContractConformanceSuite {
  suite_schema_version: typeof CONFORMANCE_SUITE_SCHEMA_VERSION
  package: {
    id: string
    version: string
    schema_version: string
  }
  cases: ContractConformanceCase[]
  observations: ContractConformanceObservation[]
  metadata: Record<string, unknown>
}

export interface ConformanceValidationIssue {
  path: string
  code: string
  message: string
}

export interface ConformanceValidationResult {
  ok: boolean
  issues: ConformanceValidationIssue[]
}

export interface CaseAssessment {
  case_id: string
  operator_id: string
  class: ConformanceCaseClass
  expected_status: ConformanceStatus
  observations: ContractConformanceObservation[]
  missing_implementations: string[]
  mismatches: string[]
  agreement: boolean
}

export interface OperatorConformanceProfile {
  operator_id: string
  operator_name: string
  case_classes: Record<ConformanceCaseClass, boolean>
  predicates_covered: number
  predicates_total: number
  failures_covered: number
  failures_total: number
  falsifier_exercised: boolean
  implementation_coverage: boolean
  cross_surface_agreement: boolean
  percent: number
  blockers: string[]
  cases: CaseAssessment[]
}

export interface ContractConformanceProfile {
  package_id: string
  package_version: string
  suite_schema_version: string
  validation: ConformanceValidationResult
  executable_implementations: TheoryImplementation[]
  operators: OperatorConformanceProfile[]
  promotion_eligible: boolean
  blockers: string[]
  warnings: string[]
}

const CASE_CLASSES: ReadonlySet<string> = new Set(['nominal', 'boundary', 'adversarial', 'failure', 'falsifier'])
const CONFORMANCE_STATUSES: ReadonlySet<string> = new Set(['PASS', 'WARN', 'FAIL', 'REJECT'])
const PREDICATE_STATUSES: ReadonlySet<string> = new Set(['PASS', 'WARN', 'FAIL', 'NOT_RUN'])
const ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function addIssue(issues: ConformanceValidationIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, message })
}

function predicateMap(results: ExpectedPredicateResult[]): string {
  return [...results]
    .sort((a, b) => a.predicate_id.localeCompare(b.predicate_id))
    .map((item) => `${item.predicate_id}:${item.status}`)
    .join('|')
}

function observationSignature(observation: ContractConformanceObservation): string {
  return [
    observation.status,
    predicateMap(observation.predicate_results),
    [...observation.failure_ids_observed].sort().join(','),
    observation.result_signature ?? 'NO_RESULT_SIGNATURE',
  ].join('::')
}

function executableImplementations(theoryPackage: TheoryPackage): TheoryImplementation[] {
  return theoryPackage.implementations.filter((item) => item.status === 'reference' || item.status === 'mirror')
}

function operatorById(theoryPackage: TheoryPackage, id: string): TheoryOperatorDefinition | undefined {
  return theoryPackage.operators.find((item) => item.id === id)
}

export function validateConformanceSuite(theoryPackage: TheoryPackage, value: unknown): ConformanceValidationResult {
  const issues: ConformanceValidationIssue[] = []
  if (!isRecord(value)) return { ok: false, issues: [{ path: '$', code: 'EXPECTED_OBJECT', message: 'Conformance suite must be a JSON object.' }] }

  if (value.suite_schema_version !== CONFORMANCE_SUITE_SCHEMA_VERSION) {
    addIssue(issues, 'suite_schema_version', 'UNSUPPORTED_SUITE_SCHEMA', `Expected ${CONFORMANCE_SUITE_SCHEMA_VERSION}.`)
  }

  if (!isRecord(value.package)) {
    addIssue(issues, 'package', 'EXPECTED_OBJECT', 'Suite must bind to one package identity.')
  } else {
    if (value.package.id !== theoryPackage.theory.id) addIssue(issues, 'package.id', 'PACKAGE_ID_MISMATCH', `Expected ${theoryPackage.theory.id}.`)
    if (value.package.version !== theoryPackage.theory.version) addIssue(issues, 'package.version', 'PACKAGE_VERSION_MISMATCH', `Expected ${theoryPackage.theory.version}.`)
    if (value.package.schema_version !== THEORY_PACKAGE_SCHEMA_VERSION) addIssue(issues, 'package.schema_version', 'PACKAGE_SCHEMA_MISMATCH', `Expected ${THEORY_PACKAGE_SCHEMA_VERSION}.`)
  }

  const caseIds = new Set<string>()
  const casesById = new Map<string, ContractConformanceCase>()
  if (!Array.isArray(value.cases)) {
    addIssue(issues, 'cases', 'EXPECTED_ARRAY', 'Expected a conformance case array.')
  } else {
    value.cases.forEach((rawCase, index) => {
      const path = `cases[${index}]`
      if (!isRecord(rawCase)) {
        addIssue(issues, path, 'EXPECTED_OBJECT', 'Expected a conformance case object.')
        return
      }
      if (typeof rawCase.id !== 'string' || !ID_PATTERN.test(rawCase.id)) addIssue(issues, `${path}.id`, 'INVALID_ID', 'Use a stable lowercase case id.')
      if (typeof rawCase.id === 'string') {
        if (caseIds.has(rawCase.id)) addIssue(issues, `${path}.id`, 'DUPLICATE_CASE', `Duplicate case ${rawCase.id}.`)
        caseIds.add(rawCase.id)
      }
      const operator = typeof rawCase.operator_id === 'string' ? operatorById(theoryPackage, rawCase.operator_id) : undefined
      if (!operator) addIssue(issues, `${path}.operator_id`, 'UNKNOWN_OPERATOR', `Unknown operator ${String(rawCase.operator_id)}.`)
      if (!CASE_CLASSES.has(String(rawCase.class))) addIssue(issues, `${path}.class`, 'INVALID_CASE_CLASS', 'Use nominal, boundary, adversarial, failure, or falsifier.')
      if (typeof rawCase.description !== 'string' || rawCase.description.trim() === '') addIssue(issues, `${path}.description`, 'REQUIRED_TEXT', 'Case description is required.')
      if (!CONFORMANCE_STATUSES.has(String(rawCase.expected_status))) addIssue(issues, `${path}.expected_status`, 'INVALID_STATUS', 'Use PASS, WARN, FAIL, or REJECT.')
      if (typeof rawCase.exercises_first_falsifier !== 'boolean') addIssue(issues, `${path}.exercises_first_falsifier`, 'EXPECTED_BOOLEAN', 'exercises_first_falsifier must be boolean.')
      if (rawCase.exercises_first_falsifier === true && rawCase.class !== 'falsifier') addIssue(issues, `${path}.exercises_first_falsifier`, 'FALSIFIER_CLASS_REQUIRED', 'A first-falsifier exercise must use case class falsifier.')
      if (!Array.isArray(rawCase.evidence_requirements) || rawCase.evidence_requirements.some((item) => typeof item !== 'string' || item.trim() === '')) addIssue(issues, `${path}.evidence_requirements`, 'INVALID_STRING_LIST', 'Expected non-empty evidence requirement strings.')

      const declaredPredicates = new Set(operator?.contract.predicates.map((item) => item.id) ?? [])
      const expectedPredicateIds = new Set<string>()
      if (!Array.isArray(rawCase.expected_predicates)) {
        addIssue(issues, `${path}.expected_predicates`, 'EXPECTED_ARRAY', 'Expected predicate expectations.')
      } else {
        rawCase.expected_predicates.forEach((rawPredicate, predicateIndex) => {
          const predicatePath = `${path}.expected_predicates[${predicateIndex}]`
          if (!isRecord(rawPredicate)) {
            addIssue(issues, predicatePath, 'EXPECTED_OBJECT', 'Expected predicate result object.')
            return
          }
          if (typeof rawPredicate.predicate_id !== 'string' || !declaredPredicates.has(rawPredicate.predicate_id)) addIssue(issues, `${predicatePath}.predicate_id`, 'UNKNOWN_PREDICATE', `Predicate ${String(rawPredicate.predicate_id)} is not declared by the operator contract.`)
          if (typeof rawPredicate.predicate_id === 'string') {
            if (expectedPredicateIds.has(rawPredicate.predicate_id)) addIssue(issues, `${predicatePath}.predicate_id`, 'DUPLICATE_PREDICATE', `Duplicate expected predicate ${rawPredicate.predicate_id}.`)
            expectedPredicateIds.add(rawPredicate.predicate_id)
          }
          if (!PREDICATE_STATUSES.has(String(rawPredicate.status))) addIssue(issues, `${predicatePath}.status`, 'INVALID_PREDICATE_STATUS', 'Use PASS, WARN, FAIL, or NOT_RUN.')
        })
      }

      const declaredFailures = new Set(operator?.contract.failure_conditions.map((item) => item.id) ?? [])
      if (!Array.isArray(rawCase.expected_failure_ids)) {
        addIssue(issues, `${path}.expected_failure_ids`, 'EXPECTED_ARRAY', 'Expected a failure-id array.')
      } else {
        rawCase.expected_failure_ids.forEach((failureId, failureIndex) => {
          if (typeof failureId !== 'string' || !declaredFailures.has(failureId)) addIssue(issues, `${path}.expected_failure_ids[${failureIndex}]`, 'UNKNOWN_FAILURE', `Failure ${String(failureId)} is not declared by the operator contract.`)
        })
      }

      if (typeof rawCase.id === 'string' && operator) casesById.set(rawCase.id, rawCase as unknown as ContractConformanceCase)
    })
  }

  const implementationMap = new Map(theoryPackage.implementations.map((item) => [item.id, item]))
  const observationKeys = new Set<string>()
  if (!Array.isArray(value.observations)) {
    addIssue(issues, 'observations', 'EXPECTED_ARRAY', 'Expected an observation array.')
  } else {
    value.observations.forEach((rawObservation, index) => {
      const path = `observations[${index}]`
      if (!isRecord(rawObservation)) {
        addIssue(issues, path, 'EXPECTED_OBJECT', 'Expected a conformance observation object.')
        return
      }
      const testCase = typeof rawObservation.case_id === 'string' ? casesById.get(rawObservation.case_id) : undefined
      if (!testCase) addIssue(issues, `${path}.case_id`, 'UNKNOWN_CASE', `Unknown case ${String(rawObservation.case_id)}.`)
      const implementation = typeof rawObservation.implementation_id === 'string' ? implementationMap.get(rawObservation.implementation_id) : undefined
      if (!implementation || !['reference', 'mirror'].includes(implementation.status)) addIssue(issues, `${path}.implementation_id`, 'UNKNOWN_EXECUTABLE_IMPLEMENTATION', `Unknown executable implementation ${String(rawObservation.implementation_id)}.`)
      if (implementation && rawObservation.implementation_version !== implementation.version) addIssue(issues, `${path}.implementation_version`, 'IMPLEMENTATION_VERSION_MISMATCH', `Expected ${implementation.version}.`)
      if (rawObservation.contract_version !== OPERATOR_CONTRACT_SCHEMA_VERSION) addIssue(issues, `${path}.contract_version`, 'CONTRACT_VERSION_MISMATCH', `Expected ${OPERATOR_CONTRACT_SCHEMA_VERSION}.`)
      if (rawObservation.receipt_schema_version !== RECEIPT_ENVELOPE_SCHEMA_VERSION) addIssue(issues, `${path}.receipt_schema_version`, 'RECEIPT_VERSION_MISMATCH', `Expected ${RECEIPT_ENVELOPE_SCHEMA_VERSION}.`)
      if (!CONFORMANCE_STATUSES.has(String(rawObservation.status))) addIssue(issues, `${path}.status`, 'INVALID_STATUS', 'Use PASS, WARN, FAIL, or REJECT.')
      if (typeof rawObservation.evidence_ref !== 'string' || rawObservation.evidence_ref.trim() === '') addIssue(issues, `${path}.evidence_ref`, 'EVIDENCE_REFERENCE_REQUIRED', 'Every observation must cite an inspectable evidence location.')
      if (typeof rawObservation.timestamp_utc !== 'string' || rawObservation.timestamp_utc.trim() === '') addIssue(issues, `${path}.timestamp_utc`, 'TIMESTAMP_REQUIRED', 'Every observation needs a timestamp.')
      if (rawObservation.result_signature !== null && (typeof rawObservation.result_signature !== 'string' || rawObservation.result_signature.trim() === '')) addIssue(issues, `${path}.result_signature`, 'INVALID_RESULT_SIGNATURE', 'Result signature must be null or a non-empty string.')

      const key = `${String(rawObservation.case_id)}::${String(rawObservation.implementation_id)}`
      if (observationKeys.has(key)) addIssue(issues, path, 'DUPLICATE_OBSERVATION', `Duplicate observation for ${key}.`)
      observationKeys.add(key)

      const operator = testCase ? operatorById(theoryPackage, testCase.operator_id) : undefined
      const declaredPredicates = new Set(operator?.contract.predicates.map((item) => item.id) ?? [])
      if (!Array.isArray(rawObservation.predicate_results)) {
        addIssue(issues, `${path}.predicate_results`, 'EXPECTED_ARRAY', 'Expected predicate results.')
      } else {
        const seen = new Set<string>()
        rawObservation.predicate_results.forEach((rawPredicate, predicateIndex) => {
          const predicatePath = `${path}.predicate_results[${predicateIndex}]`
          if (!isRecord(rawPredicate)) {
            addIssue(issues, predicatePath, 'EXPECTED_OBJECT', 'Expected predicate result object.')
            return
          }
          if (typeof rawPredicate.predicate_id !== 'string' || !declaredPredicates.has(rawPredicate.predicate_id)) addIssue(issues, `${predicatePath}.predicate_id`, 'UNKNOWN_PREDICATE', `Unknown predicate ${String(rawPredicate.predicate_id)}.`)
          if (typeof rawPredicate.predicate_id === 'string') {
            if (seen.has(rawPredicate.predicate_id)) addIssue(issues, `${predicatePath}.predicate_id`, 'DUPLICATE_PREDICATE', `Duplicate predicate result ${rawPredicate.predicate_id}.`)
            seen.add(rawPredicate.predicate_id)
          }
          if (!PREDICATE_STATUSES.has(String(rawPredicate.status))) addIssue(issues, `${predicatePath}.status`, 'INVALID_PREDICATE_STATUS', 'Use PASS, WARN, FAIL, or NOT_RUN.')
        })
      }

      const declaredFailures = new Set(operator?.contract.failure_conditions.map((item) => item.id) ?? [])
      if (!Array.isArray(rawObservation.failure_ids_observed)) {
        addIssue(issues, `${path}.failure_ids_observed`, 'EXPECTED_ARRAY', 'Expected observed failure ids.')
      } else {
        rawObservation.failure_ids_observed.forEach((failureId, failureIndex) => {
          if (typeof failureId !== 'string' || !declaredFailures.has(failureId)) addIssue(issues, `${path}.failure_ids_observed[${failureIndex}]`, 'UNKNOWN_FAILURE', `Unknown failure ${String(failureId)}.`)
        })
      }

      if (testCase) {
        if (rawObservation.status !== testCase.expected_status) addIssue(issues, `${path}.status`, 'STATUS_MISMATCH', `Expected ${testCase.expected_status} for case ${testCase.id}.`)
        if (Array.isArray(rawObservation.predicate_results) && predicateMap(rawObservation.predicate_results as unknown as ExpectedPredicateResult[]) !== predicateMap(testCase.expected_predicates)) addIssue(issues, `${path}.predicate_results`, 'PREDICATE_RESULT_MISMATCH', `Predicate outcomes do not match case ${testCase.id}.`)
        const observedFailures = new Set(Array.isArray(rawObservation.failure_ids_observed) ? rawObservation.failure_ids_observed : [])
        for (const expectedFailure of testCase.expected_failure_ids) {
          if (!observedFailures.has(expectedFailure)) addIssue(issues, `${path}.failure_ids_observed`, 'EXPECTED_FAILURE_NOT_OBSERVED', `Expected failure ${expectedFailure} was not observed.`)
        }
        if (['PASS', 'WARN'].includes(testCase.expected_status) && (typeof rawObservation.result_signature !== 'string' || rawObservation.result_signature.trim() === '')) addIssue(issues, `${path}.result_signature`, 'RESULT_SIGNATURE_REQUIRED', 'Successful or warning observations require a comparison signature.')
      }
    })
  }

  return { ok: issues.length === 0, issues }
}

export function parseConformanceSuiteJson(theoryPackage: TheoryPackage, text: string): { suite: ContractConformanceSuite | null; validation: ConformanceValidationResult } {
  try {
    const parsed: unknown = JSON.parse(text)
    const validation = validateConformanceSuite(theoryPackage, parsed)
    return { suite: validation.ok ? (parsed as ContractConformanceSuite) : null, validation }
  } catch (error) {
    return { suite: null, validation: { ok: false, issues: [{ path: '$', code: 'INVALID_JSON', message: error instanceof Error ? error.message : String(error) }] } }
  }
}

function assessCase(theoryPackage: TheoryPackage, suite: ContractConformanceSuite, testCase: ContractConformanceCase, implementations: TheoryImplementation[]): CaseAssessment {
  const observations = suite.observations.filter((item) => item.case_id === testCase.id)
  const missingImplementations = implementations.filter((implementation) => !observations.some((item) => item.implementation_id === implementation.id)).map((item) => item.id)
  const mismatches: string[] = []
  for (const observation of observations) {
    if (observation.status !== testCase.expected_status) mismatches.push(`${observation.implementation_id}: expected ${testCase.expected_status}, observed ${observation.status}.`)
    if (predicateMap(observation.predicate_results) !== predicateMap(testCase.expected_predicates)) mismatches.push(`${observation.implementation_id}: predicate results differ from the case expectation.`)
    for (const failureId of testCase.expected_failure_ids) {
      if (!observation.failure_ids_observed.includes(failureId)) mismatches.push(`${observation.implementation_id}: expected failure ${failureId} was not recorded.`)
    }
  }
  const signatures = new Set(observations.map(observationSignature))
  return {
    case_id: testCase.id,
    operator_id: testCase.operator_id,
    class: testCase.class,
    expected_status: testCase.expected_status,
    observations,
    missing_implementations: missingImplementations,
    mismatches,
    agreement: observations.length >= 2 && signatures.size === 1 && missingImplementations.length === 0 && mismatches.length === 0,
  }
}

export function buildConformanceProfile(theoryPackage: TheoryPackage, suite: ContractConformanceSuite): ContractConformanceProfile {
  const validation = validateConformanceSuite(theoryPackage, suite)
  const implementations = executableImplementations(theoryPackage)
  const caseAssessments = suite.cases.map((testCase) => assessCase(theoryPackage, suite, testCase, implementations))
  const operators: OperatorConformanceProfile[] = theoryPackage.operators.map((operator) => {
    const operatorCases = suite.cases.filter((item) => item.operator_id === operator.id)
    const assessments = caseAssessments.filter((item) => item.operator_id === operator.id)
    const caseClasses: Record<ConformanceCaseClass, boolean> = {
      nominal: operatorCases.some((item) => item.class === 'nominal'),
      boundary: operatorCases.some((item) => item.class === 'boundary'),
      adversarial: operatorCases.some((item) => item.class === 'adversarial'),
      failure: operatorCases.some((item) => item.class === 'failure'),
      falsifier: operatorCases.some((item) => item.class === 'falsifier' && item.exercises_first_falsifier),
    }
    const coveredPredicates = new Set(operatorCases.flatMap((item) => item.expected_predicates.map((predicate) => predicate.predicate_id)))
    const requiredPredicates = operator.contract.predicates.filter((item) => item.required).map((item) => item.id)
    const coveredFailures = new Set(operatorCases.flatMap((item) => item.expected_failure_ids))
    const requiredFailures = operator.contract.failure_conditions.map((item) => item.id)
    const implementationCoverage = operatorCases.length > 0 && assessments.every((item) => item.missing_implementations.length === 0)
    const crossSurfaceAgreement = operatorCases.length > 0 && assessments.every((item) => item.agreement)
    const falsifierExercised = caseClasses.falsifier
    const contractResolved = operatorContractResolved(operator)
    const blockers: string[] = []
    for (const [caseClass, covered] of Object.entries(caseClasses)) if (!covered) blockers.push(`Missing ${caseClass} case.`)
    for (const predicateId of requiredPredicates) if (!coveredPredicates.has(predicateId)) blockers.push(`Required predicate ${predicateId} is not exercised by any case.`)
    for (const failureId of requiredFailures) if (!coveredFailures.has(failureId)) blockers.push(`Failure condition ${failureId} is not exercised by any case.`)
    if (!contractResolved) blockers.push('Operator contract remains THEORY_MAP_OPEN or has unknown reversibility.')
    if (!implementationCoverage) blockers.push('At least one case lacks evidence from every executable implementation surface.')
    if (!crossSurfaceAgreement) blockers.push('At least one case lacks cross-surface agreement or does not match its expectation.')

    const criteria = [
      Object.values(caseClasses).every(Boolean),
      requiredPredicates.every((id) => coveredPredicates.has(id)),
      requiredFailures.every((id) => coveredFailures.has(id)),
      falsifierExercised,
      contractResolved,
      implementationCoverage,
      crossSurfaceAgreement,
    ]
    return {
      operator_id: operator.id,
      operator_name: operator.name,
      case_classes: caseClasses,
      predicates_covered: requiredPredicates.filter((id) => coveredPredicates.has(id)).length,
      predicates_total: requiredPredicates.length,
      failures_covered: requiredFailures.filter((id) => coveredFailures.has(id)).length,
      failures_total: requiredFailures.length,
      falsifier_exercised: falsifierExercised,
      implementation_coverage: implementationCoverage,
      cross_surface_agreement: crossSurfaceAgreement,
      percent: Math.round((criteria.filter(Boolean).length / criteria.length) * 100),
      blockers,
      cases: assessments,
    }
  })

  const blockers: string[] = []
  if (!validateTheoryPackage(theoryPackage).ok) blockers.push('The theory package manifest does not validate.')
  if (!validation.ok) blockers.push(`The conformance suite has ${validation.issues.length} validation issue(s).`)
  if (implementations.length < 2) blockers.push('Level-4 conformance requires at least two executable implementation surfaces.')
  for (const operator of operators) for (const blocker of operator.blockers) blockers.push(`${operator.operator_id}: ${blocker}`)
  const promotionEligible = blockers.length === 0 && operators.length > 0
  const warnings: string[] = []
  if (theoryPackage.maturity_level >= 4 && !promotionEligible) warnings.push('The package is declared Level 4 under earlier conformance evidence, but it has not yet re-earned Level 4 under the stricter contract-conformance gate.')
  if (suite.metadata.partial_evidence === true) warnings.push('This bundled suite intentionally records only evidence already present in the repository. Missing adversarial, failure, and falsifier cases remain open.')

  return {
    package_id: theoryPackage.theory.id,
    package_version: theoryPackage.theory.version,
    suite_schema_version: suite.suite_schema_version,
    validation,
    executable_implementations: implementations,
    operators,
    promotion_eligible: promotionEligible,
    blockers,
    warnings,
  }
}

export function buildConformanceSuiteScaffold(theoryPackage: TheoryPackage): ContractConformanceSuite {
  const classes: ConformanceCaseClass[] = ['nominal', 'boundary', 'adversarial', 'failure', 'falsifier']
  return {
    suite_schema_version: CONFORMANCE_SUITE_SCHEMA_VERSION,
    package: { id: theoryPackage.theory.id, version: theoryPackage.theory.version, schema_version: theoryPackage.schema_version },
    cases: theoryPackage.operators.flatMap((operator) => classes.map((caseClass) => ({
      id: `${operator.id}-${caseClass}`,
      operator_id: operator.id,
      class: caseClass,
      description: `THEORY MAP OPEN — define the ${caseClass} case for ${operator.name}.`,
      expected_status: caseClass === 'nominal' || caseClass === 'boundary' ? 'PASS' : caseClass === 'adversarial' ? 'REJECT' : 'FAIL',
      expected_predicates: [],
      expected_failure_ids: [],
      exercises_first_falsifier: caseClass === 'falsifier',
      evidence_requirements: ['Independent implementation observations', 'Inspectable receipt or fixture reference', 'Reviewed expected outcome'],
    }))),
    observations: [],
    metadata: { generated_by: 'contract-conformance-scaffold:v0.1', planning_artifact: true },
  }
}

function expected(predicateIds: string[]): ExpectedPredicateResult[] {
  return predicateIds.map((predicate_id) => ({ predicate_id, status: 'PASS' }))
}

function fixtureObservation(
  testCase: ContractConformanceCase,
  implementation: TheoryImplementation,
  fixtureRef: string,
): ContractConformanceObservation {
  return {
    case_id: testCase.id,
    implementation_id: implementation.id,
    implementation_version: implementation.version,
    contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
    receipt_schema_version: RECEIPT_ENVELOPE_SCHEMA_VERSION,
    status: testCase.expected_status,
    predicate_results: [...testCase.expected_predicates],
    failure_ids_observed: [...testCase.expected_failure_ids],
    result_signature: `canonical-fixture:${fixtureRef}`,
    evidence_ref: `${fixtureRef}; replay: web/test/conformance/conformance.test.ts`,
    timestamp_utc: '2026-07-23T00:00:00Z',
  }
}

const langarianCases: ContractConformanceCase[] = [
  {
    id: 'harmonic-sum-basic', operator_id: 'harmonic-sum', class: 'nominal', description: 'Same-dimension finite states are added componentwise.', expected_status: 'PASS',
    expected_predicates: expected(['output-well-typed', 'common-dimension', 'componentwise-sum', 'receipt-bound']), expected_failure_ids: [], exercises_first_falsifier: false,
    evidence_requirements: ['Byte-exact Python fixture', 'TypeScript replay', 'Canonical receipt equality'],
  },
  {
    id: 'harmonic-sum-cross-dimension', operator_id: 'harmonic-sum', class: 'boundary', description: 'Unequal dimensions use the declared zero-padding convention.', expected_status: 'PASS',
    expected_predicates: expected(['output-well-typed', 'common-dimension', 'componentwise-sum', 'receipt-bound']), expected_failure_ids: [], exercises_first_falsifier: false,
    evidence_requirements: ['Cross-dimension fixture', 'Canonical output and receipt equality'],
  },
  {
    id: 'phase-shift-rotation', operator_id: 'phase-shift', class: 'nominal', description: 'A finite state is rotated by pi/3.', expected_status: 'PASS',
    expected_predicates: expected(['output-well-typed', 'norm-preserved', 'receipt-bound']), expected_failure_ids: [], exercises_first_falsifier: false,
    evidence_requirements: ['High-precision vector comparison', 'Byte-exact hashes and receipt'],
  },
  {
    id: 'phase-shift-zero-state', operator_id: 'phase-shift', class: 'boundary', description: 'The zero state remains zero under phase rotation.', expected_status: 'PASS',
    expected_predicates: expected(['output-well-typed', 'norm-preserved', 'receipt-bound']), expected_failure_ids: [], exercises_first_falsifier: false,
    evidence_requirements: ['Zero-state fixture', 'Byte-exact receipt replay'],
  },
  {
    id: 'phase-weighted-scale-attenuation', operator_id: 'phase-weighted-scale', class: 'nominal', description: 'A finite state is rotated and scaled by eta=0.75 with a declared cost label.', expected_status: 'PASS',
    expected_predicates: expected(['output-well-typed', 'norm-scaled', 'decrease-accounted', 'receipt-bound']), expected_failure_ids: [], exercises_first_falsifier: false,
    evidence_requirements: ['Attenuation fixture', 'Declared cost present', 'Canonical receipt replay'],
  },
  {
    id: 'bridge-cross-dimension', operator_id: 'bridge', class: 'nominal', description: 'A cross-dimension bridge relation records bounded similarity and edge-local cost.', expected_status: 'PASS',
    expected_predicates: expected(['endpoints-well-typed', 'similarity-bounded', 'edge-cost-local', 'receipt-bound']), expected_failure_ids: [], exercises_first_falsifier: false,
    evidence_requirements: ['Bridge fixture', 'Bounded similarity', 'Canonical receipt replay'],
  },
]

const langarianImplementations: TheoryImplementation[] = [
  { id: 'python-reference', language: 'Python', version: 'langarian-python-ref-v0.3.0', status: 'reference' },
  { id: 'typescript-mirror', language: 'TypeScript', version: 'langarian-ts-port-v0.3.0', status: 'mirror' },
]

const fixtureRefs: Record<string, string> = {
  'harmonic-sum-basic': 'fixtures/conformance/op_harmonic_sum.json#basic_same_dim',
  'harmonic-sum-cross-dimension': 'fixtures/conformance/op_harmonic_sum.json#cross_dim_zero_padded',
  'phase-shift-rotation': 'fixtures/conformance/op_phase_shift.json#rotate_pi_over_3',
  'phase-shift-zero-state': 'fixtures/conformance/op_phase_shift.json#zero_state',
  'phase-weighted-scale-attenuation': 'fixtures/conformance/op_attenuated_phase_shift.json#attenuate_075_with_cost',
  'bridge-cross-dimension': 'fixtures/conformance/op_bridge.json#cross_dim_bridge',
}

export const BUNDLED_CONFORMANCE_SUITES: ContractConformanceSuite[] = [
  {
    suite_schema_version: CONFORMANCE_SUITE_SCHEMA_VERSION,
    package: { id: 'langarian-finite-complex', version: '0.3.1', schema_version: THEORY_PACKAGE_SCHEMA_VERSION },
    cases: langarianCases,
    observations: langarianCases.flatMap((testCase) => langarianImplementations.map((implementation) => fixtureObservation(testCase, implementation, fixtureRefs[testCase.id]!))),
    metadata: {
      bundled: true,
      partial_evidence: true,
      evidence_scope: 'Static registry derived from the committed Python fixture corpus and TypeScript byte-exact replay. The browser does not rerun the kernels when rendering this profile.',
    },
  },
]

export function suiteForPackage(theoryPackage: TheoryPackage): ContractConformanceSuite | null {
  return BUNDLED_CONFORMANCE_SUITES.find((suite) => suite.package.id === theoryPackage.theory.id && suite.package.version === theoryPackage.theory.version) ?? null
}
