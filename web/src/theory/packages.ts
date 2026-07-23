export const THEORY_PACKAGE_SCHEMA_VERSION = 'theory-package:v0.2' as const
export const OPERATOR_CONTRACT_SCHEMA_VERSION = 'operator-contract:v0.2' as const
export const RECEIPT_ENVELOPE_SCHEMA_VERSION = 'parallax-receipt-envelope:v0.2' as const

export type EvidenceClass = 'OBSERVED' | 'IMPLEMENTED' | 'DOCUMENTED' | 'INFERRED' | 'ASPIRATIONAL' | 'UNKNOWN'
export type DefinitionStatus = 'ACCEPTED' | 'PROVISIONAL' | 'CANDIDATE' | 'THEORY_MAP_OPEN'
export type PackageStatus = 'draft' | 'candidate' | 'active' | 'deprecated'
export type FailureOutcome = 'REJECT' | 'FAIL_RECEIPT' | 'WARN_RECEIPT'
export type ReversibilityClass = 'reversible' | 'conditionally_reversible' | 'irreversible' | 'not_applicable' | 'unknown'

export interface TheoryObjectDefinition {
  id: string
  name: string
  definition: string
  evidence_class: EvidenceClass
  status: DefinitionStatus
}

export interface OperatorParameterDefinition {
  id: string
  name: string
  type: string
  required: boolean
  constraints: string
}

export interface OperatorPredicateDefinition {
  id: string
  statement: string
  required: boolean
  tolerance?: string
}

export interface OperatorFailureDefinition {
  id: string
  condition: string
  outcome: FailureOutcome
}

export interface OperatorExecutionContract {
  contract_version: typeof OPERATOR_CONTRACT_SCHEMA_VERSION
  parameters: OperatorParameterDefinition[]
  preconditions: string[]
  assumptions_used: string[]
  invariants_checked: string[]
  predicates: OperatorPredicateDefinition[]
  failure_conditions: OperatorFailureDefinition[]
  reversibility: {
    classification: ReversibilityClass
    condition: string
  }
  receipt_fields: string[]
  first_falsifier: string
}

export interface TheoryOperatorDefinition {
  id: string
  name: string
  input_types: string[]
  output_types: string[]
  semantics: string
  evidence_class: EvidenceClass
  status: DefinitionStatus
  implementation?: string | null
  contract: OperatorExecutionContract
}

export interface TheoryStatementDefinition {
  id: string
  text: string
  evidence_class: EvidenceClass
  status: DefinitionStatus
  scope?: string
}

export interface TheoryImplementation {
  id: string
  language: string
  version: string
  status: 'reference' | 'mirror' | 'documentary'
  independent_from?: string[]
}

export interface TheoryPackage {
  schema_version: typeof THEORY_PACKAGE_SCHEMA_VERSION
  theory: {
    id: string
    name: string
    version: string
    status: PackageStatus
    summary: string
    motivation: string
  }
  maturity_level: 1 | 2 | 3 | 4 | 5
  objects: TheoryObjectDefinition[]
  operators: TheoryOperatorDefinition[]
  assumptions: TheoryStatementDefinition[]
  invariants: TheoryStatementDefinition[]
  claim_boundaries: {
    allowed: string[]
    prohibited: string[]
  }
  evidence: {
    reality_gate: 'not_evaluated' | 'planned' | 'in_progress' | 'passed' | 'failed'
    notes: string
  }
  implementations: TheoryImplementation[]
  metadata: Record<string, unknown>
}

export interface PackageValidationIssue {
  path: string
  code: string
  message: string
}

export interface PackageValidationResult {
  ok: boolean
  issues: PackageValidationIssue[]
}

export const MATURITY_LEVELS = [
  { level: 1, name: 'Documentary theory', description: 'Objects, assumptions, claims, sources, and open questions are mapped. Nothing is executable yet.' },
  { level: 2, name: 'Formal specification', description: 'Objects, operators, domains, and execution contracts are defined, but a reference implementation is not required.' },
  { level: 3, name: 'Executable reference', description: 'At least one implementation executes declared operations and emits contract-bound receipts.' },
  { level: 4, name: 'Conformance tested', description: 'A second implementation or independent test surface reproduces compatible behavior.' },
  { level: 5, name: 'Reality-Gate candidate', description: 'Empirical tests, datasets, predictions, and replication requirements are explicitly registered.' },
] as const

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/
const EVIDENCE_CLASSES: ReadonlySet<string> = new Set(['OBSERVED', 'IMPLEMENTED', 'DOCUMENTED', 'INFERRED', 'ASPIRATIONAL', 'UNKNOWN'])
const DEFINITION_STATUSES: ReadonlySet<string> = new Set(['ACCEPTED', 'PROVISIONAL', 'CANDIDATE', 'THEORY_MAP_OPEN'])
const FAILURE_OUTCOMES: ReadonlySet<string> = new Set(['REJECT', 'FAIL_RECEIPT', 'WARN_RECEIPT'])
const REVERSIBILITY_CLASSES: ReadonlySet<string> = new Set(['reversible', 'conditionally_reversible', 'irreversible', 'not_applicable', 'unknown'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function addIssue(issues: PackageValidationIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, message })
}

function validateIdentifier(issues: PackageValidationIssue[], path: string, value: unknown): void {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    addIssue(issues, path, 'INVALID_ID', 'Expected a stable lowercase identifier such as example-theory or state.v1.')
  }
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim() !== '')
}

function validateStringArray(issues: PackageValidationIssue[], path: string, value: unknown, minimum = 0): string[] {
  if (!stringArray(value)) {
    addIssue(issues, path, 'INVALID_STRING_LIST', 'Expected an array of non-empty strings.')
    return []
  }
  if (value.length < minimum) addIssue(issues, path, 'LIST_TOO_SHORT', `Expected at least ${minimum} item(s).`)
  return value
}

function collectDefinitionIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set()
  return new Set(value.filter(isRecord).map((item) => item.id).filter((id): id is string => typeof id === 'string'))
}

function validateDefinitions(
  issues: PackageValidationIssue[],
  path: string,
  value: unknown,
  objectIds: Set<string>,
  kind: 'object' | 'operator' | 'statement',
): void {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'EXPECTED_ARRAY', 'Expected an array.')
    return
  }
  const ids = new Set<string>()
  value.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`
    if (!isRecord(entry)) {
      addIssue(issues, itemPath, 'EXPECTED_OBJECT', 'Expected an object definition.')
      return
    }
    validateIdentifier(issues, `${itemPath}.id`, entry.id)
    if (typeof entry.id === 'string') {
      if (ids.has(entry.id)) addIssue(issues, `${itemPath}.id`, 'DUPLICATE_ID', `Duplicate id ${entry.id}.`)
      ids.add(entry.id)
      if (kind === 'object') objectIds.add(entry.id)
    }
    if (kind !== 'statement' && (typeof entry.name !== 'string' || entry.name.trim() === '')) {
      addIssue(issues, `${itemPath}.name`, 'REQUIRED_TEXT', 'name must be non-empty.')
    }
    const textKey = kind === 'statement' ? 'text' : kind === 'operator' ? 'semantics' : 'definition'
    if (typeof entry[textKey] !== 'string' || entry[textKey].trim() === '') {
      addIssue(issues, `${itemPath}.${textKey}`, 'MISSING_DEFINITION', `Expected a non-empty ${textKey}.`)
    }
    if (!EVIDENCE_CLASSES.has(String(entry.evidence_class))) {
      addIssue(issues, `${itemPath}.evidence_class`, 'INVALID_EVIDENCE_CLASS', 'Use OBSERVED, IMPLEMENTED, DOCUMENTED, INFERRED, ASPIRATIONAL, or UNKNOWN.')
    }
    if (!DEFINITION_STATUSES.has(String(entry.status))) {
      addIssue(issues, `${itemPath}.status`, 'INVALID_STATUS', 'Use ACCEPTED, PROVISIONAL, CANDIDATE, or THEORY_MAP_OPEN.')
    }
  })
}

function validateContract(
  issues: PackageValidationIssue[],
  path: string,
  value: unknown,
  assumptionIds: Set<string>,
  invariantIds: Set<string>,
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, 'MISSING_EXECUTION_CONTRACT', 'Every operator requires an execution contract in theory-package:v0.2.')
    return
  }
  if (value.contract_version !== OPERATOR_CONTRACT_SCHEMA_VERSION) {
    addIssue(issues, `${path}.contract_version`, 'UNSUPPORTED_CONTRACT', `Expected ${OPERATOR_CONTRACT_SCHEMA_VERSION}.`)
  }

  if (!Array.isArray(value.parameters)) {
    addIssue(issues, `${path}.parameters`, 'EXPECTED_ARRAY', 'Expected a parameter definition array.')
  } else {
    const parameterIds = new Set<string>()
    value.parameters.forEach((parameter, index) => {
      const itemPath = `${path}.parameters[${index}]`
      if (!isRecord(parameter)) {
        addIssue(issues, itemPath, 'EXPECTED_OBJECT', 'Expected a parameter definition.')
        return
      }
      validateIdentifier(issues, `${itemPath}.id`, parameter.id)
      if (typeof parameter.id === 'string') {
        if (parameterIds.has(parameter.id)) addIssue(issues, `${itemPath}.id`, 'DUPLICATE_ID', `Duplicate parameter id ${parameter.id}.`)
        parameterIds.add(parameter.id)
      }
      for (const key of ['name', 'type', 'constraints'] as const) {
        if (typeof parameter[key] !== 'string' || parameter[key].trim() === '') addIssue(issues, `${itemPath}.${key}`, 'REQUIRED_TEXT', `${key} must be non-empty.`)
      }
      if (typeof parameter.required !== 'boolean') addIssue(issues, `${itemPath}.required`, 'EXPECTED_BOOLEAN', 'required must be boolean.')
    })
  }

  validateStringArray(issues, `${path}.preconditions`, value.preconditions, 1)
  const assumptions = validateStringArray(issues, `${path}.assumptions_used`, value.assumptions_used)
  assumptions.forEach((id, index) => {
    if (!assumptionIds.has(id)) addIssue(issues, `${path}.assumptions_used[${index}]`, 'UNKNOWN_ASSUMPTION', `Unknown assumption ${id}.`)
  })
  const invariants = validateStringArray(issues, `${path}.invariants_checked`, value.invariants_checked)
  invariants.forEach((id, index) => {
    if (!invariantIds.has(id)) addIssue(issues, `${path}.invariants_checked[${index}]`, 'UNKNOWN_INVARIANT', `Unknown invariant ${id}.`)
  })

  if (!Array.isArray(value.predicates) || value.predicates.length === 0) {
    addIssue(issues, `${path}.predicates`, 'PREDICATES_REQUIRED', 'Declare at least one named predicate.')
  } else {
    const predicateIds = new Set<string>()
    value.predicates.forEach((predicate, index) => {
      const itemPath = `${path}.predicates[${index}]`
      if (!isRecord(predicate)) {
        addIssue(issues, itemPath, 'EXPECTED_OBJECT', 'Expected a predicate definition.')
        return
      }
      validateIdentifier(issues, `${itemPath}.id`, predicate.id)
      if (typeof predicate.id === 'string') {
        if (predicateIds.has(predicate.id)) addIssue(issues, `${itemPath}.id`, 'DUPLICATE_ID', `Duplicate predicate id ${predicate.id}.`)
        predicateIds.add(predicate.id)
      }
      if (typeof predicate.statement !== 'string' || predicate.statement.trim() === '') addIssue(issues, `${itemPath}.statement`, 'REQUIRED_TEXT', 'statement must be non-empty.')
      if (typeof predicate.required !== 'boolean') addIssue(issues, `${itemPath}.required`, 'EXPECTED_BOOLEAN', 'required must be boolean.')
      if ('tolerance' in predicate && typeof predicate.tolerance !== 'string') addIssue(issues, `${itemPath}.tolerance`, 'EXPECTED_STRING', 'tolerance must be a string when present.')
    })
  }

  if (!Array.isArray(value.failure_conditions) || value.failure_conditions.length === 0) {
    addIssue(issues, `${path}.failure_conditions`, 'FAILURES_REQUIRED', 'Declare at least one failure or rejection condition.')
  } else {
    value.failure_conditions.forEach((failure, index) => {
      const itemPath = `${path}.failure_conditions[${index}]`
      if (!isRecord(failure)) {
        addIssue(issues, itemPath, 'EXPECTED_OBJECT', 'Expected a failure definition.')
        return
      }
      validateIdentifier(issues, `${itemPath}.id`, failure.id)
      if (typeof failure.condition !== 'string' || failure.condition.trim() === '') addIssue(issues, `${itemPath}.condition`, 'REQUIRED_TEXT', 'condition must be non-empty.')
      if (!FAILURE_OUTCOMES.has(String(failure.outcome))) addIssue(issues, `${itemPath}.outcome`, 'INVALID_FAILURE_OUTCOME', 'Use REJECT, FAIL_RECEIPT, or WARN_RECEIPT.')
    })
  }

  if (!isRecord(value.reversibility)) {
    addIssue(issues, `${path}.reversibility`, 'EXPECTED_OBJECT', 'Reversibility classification is required.')
  } else {
    if (!REVERSIBILITY_CLASSES.has(String(value.reversibility.classification))) addIssue(issues, `${path}.reversibility.classification`, 'INVALID_REVERSIBILITY', 'Use reversible, conditionally_reversible, irreversible, not_applicable, or unknown.')
    if (typeof value.reversibility.condition !== 'string' || value.reversibility.condition.trim() === '') addIssue(issues, `${path}.reversibility.condition`, 'REQUIRED_TEXT', 'A reversibility condition or boundary is required.')
  }

  validateStringArray(issues, `${path}.receipt_fields`, value.receipt_fields, 1)
  if (typeof value.first_falsifier !== 'string' || value.first_falsifier.trim() === '') addIssue(issues, `${path}.first_falsifier`, 'FIRST_FALSIFIER_REQUIRED', 'State the first admissible counterexample or execution that would falsify the operator claim.')
}

export function operatorContractResolved(operator: TheoryOperatorDefinition): boolean {
  const contractText = [
    ...operator.contract.preconditions,
    ...operator.contract.predicates.map((item) => item.statement),
    ...operator.contract.failure_conditions.map((item) => item.condition),
    operator.contract.reversibility.condition,
    operator.contract.first_falsifier,
  ].join(' ').toUpperCase()
  return operator.contract.reversibility.classification !== 'unknown' && !contractText.includes('THEORY MAP OPEN')
}

export function validateTheoryPackage(value: unknown): PackageValidationResult {
  const issues: PackageValidationIssue[] = []
  if (!isRecord(value)) return { ok: false, issues: [{ path: '$', code: 'EXPECTED_OBJECT', message: 'Package must be a JSON object.' }] }

  if (value.schema_version !== THEORY_PACKAGE_SCHEMA_VERSION) addIssue(issues, 'schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${THEORY_PACKAGE_SCHEMA_VERSION}.`)

  if (!isRecord(value.theory)) {
    addIssue(issues, 'theory', 'EXPECTED_OBJECT', 'Missing theory identity block.')
  } else {
    validateIdentifier(issues, 'theory.id', value.theory.id)
    for (const key of ['name', 'summary', 'motivation'] as const) {
      if (typeof value.theory[key] !== 'string' || value.theory[key].trim() === '') addIssue(issues, `theory.${key}`, 'REQUIRED_TEXT', `${key} must be non-empty.`)
    }
    if (typeof value.theory.version !== 'string' || !VERSION_PATTERN.test(value.theory.version)) addIssue(issues, 'theory.version', 'INVALID_VERSION', 'Use semantic versioning such as 0.1.0 or 1.0.0-rc.1.')
    if (!['draft', 'candidate', 'active', 'deprecated'].includes(String(value.theory.status))) addIssue(issues, 'theory.status', 'INVALID_PACKAGE_STATUS', 'Use draft, candidate, active, or deprecated.')
  }

  if (!Number.isInteger(value.maturity_level) || Number(value.maturity_level) < 1 || Number(value.maturity_level) > 5) addIssue(issues, 'maturity_level', 'INVALID_LEVEL', 'Maturity level must be an integer from 1 through 5.')

  const objectIds = new Set<string>()
  validateDefinitions(issues, 'objects', value.objects, objectIds, 'object')
  validateDefinitions(issues, 'operators', value.operators, objectIds, 'operator')
  validateDefinitions(issues, 'assumptions', value.assumptions, objectIds, 'statement')
  validateDefinitions(issues, 'invariants', value.invariants, objectIds, 'statement')

  const assumptionIds = collectDefinitionIds(value.assumptions)
  const invariantIds = collectDefinitionIds(value.invariants)

  if (Array.isArray(value.operators)) {
    value.operators.forEach((entry, index) => {
      if (!isRecord(entry)) return
      for (const key of ['input_types', 'output_types'] as const) {
        const refs = entry[key]
        if (!Array.isArray(refs)) {
          addIssue(issues, `operators[${index}].${key}`, 'EXPECTED_ARRAY', 'Expected an array of declared object ids.')
          continue
        }
        refs.forEach((ref, refIndex) => {
          if (typeof ref !== 'string' || !objectIds.has(ref)) addIssue(issues, `operators[${index}].${key}[${refIndex}]`, 'UNKNOWN_OBJECT_TYPE', `Unknown object type ${String(ref)}.`)
        })
      }
      validateContract(issues, `operators[${index}].contract`, entry.contract, assumptionIds, invariantIds)
    })
  }

  if (!isRecord(value.claim_boundaries)) {
    addIssue(issues, 'claim_boundaries', 'EXPECTED_OBJECT', 'Claim boundaries are required.')
  } else {
    validateStringArray(issues, 'claim_boundaries.allowed', value.claim_boundaries.allowed, 1)
    validateStringArray(issues, 'claim_boundaries.prohibited', value.claim_boundaries.prohibited, 1)
  }

  if (!isRecord(value.evidence) || !['not_evaluated', 'planned', 'in_progress', 'passed', 'failed'].includes(String(value.evidence.reality_gate))) addIssue(issues, 'evidence.reality_gate', 'INVALID_REALITY_GATE', 'Reality Gate must be explicitly classified.')

  if (!Array.isArray(value.implementations)) {
    addIssue(issues, 'implementations', 'EXPECTED_ARRAY', 'Expected an implementations array.')
  } else {
    const executable = value.implementations.filter((item) => isRecord(item) && ['reference', 'mirror'].includes(String(item.status)))
    if (Number(value.maturity_level) >= 3 && executable.length < 1) addIssue(issues, 'implementations', 'LEVEL_REQUIRES_IMPLEMENTATION', 'Level 3 or higher requires at least one reference or mirror implementation.')
    if (Number(value.maturity_level) >= 4 && executable.length < 2) addIssue(issues, 'implementations', 'LEVEL_REQUIRES_CONFORMANCE', 'Level 4 or higher requires at least two executable implementation surfaces.')
  }

  if (Number(value.maturity_level) >= 3 && Array.isArray(value.operators)) {
    value.operators.forEach((operator, index) => {
      if (isRecord(operator) && (typeof operator.implementation !== 'string' || operator.implementation.trim() === '')) addIssue(issues, `operators[${index}].implementation`, 'EXECUTABLE_OPERATOR_REQUIRES_LOCATION', 'Every Level 3+ operator must name an implementation location.')
    })
  }

  return { ok: issues.length === 0, issues }
}

export function parseTheoryPackageJson(text: string): { package: TheoryPackage | null; validation: PackageValidationResult } {
  try {
    const parsed: unknown = JSON.parse(text)
    const validation = validateTheoryPackage(parsed)
    return { package: validation.ok ? (parsed as TheoryPackage) : null, validation }
  } catch (error) {
    return { package: null, validation: { ok: false, issues: [{ path: '$', code: 'INVALID_JSON', message: error instanceof Error ? error.message : String(error) }] } }
  }
}

export interface ReceiptEnvelope {
  receipt_schema_version: typeof RECEIPT_ENVELOPE_SCHEMA_VERSION
  theory_package: { id: string; version: string; schema_version: string }
  operation_id: string
  operator_contract: {
    version: string
    assumption_ids: string[]
    invariant_ids: string[]
    predicate_ids: string[]
    first_falsifier: string
  }
  implementation: { id: string | null; version: string | null }
  inputs: unknown[]
  parameters: Record<string, unknown>
  outputs: unknown[]
  assumptions_used: string[]
  checks: { predicate_id: string; status: 'PASS' | 'WARN' | 'FAIL' | 'NOT_RUN'; observed?: unknown; expected?: unknown }[]
  claims_supported: string[]
  claims_prohibited: string[]
  parent_receipts: string[]
  status: 'PASS' | 'WARN' | 'FAIL' | 'NOT_RUN'
  timestamp_utc: string
}

export function buildReceiptEnvelope(
  theoryPackage: TheoryPackage,
  operationId: string,
  options: Partial<Omit<ReceiptEnvelope, 'receipt_schema_version' | 'theory_package' | 'operation_id' | 'operator_contract'>> = {},
): ReceiptEnvelope {
  const operator = theoryPackage.operators.find((item) => item.id === operationId)
  if (!operator) throw new Error(`Unknown operation ${operationId} for package ${theoryPackage.theory.id}.`)
  const defaultImplementation = theoryPackage.implementations.find((item) => item.status === 'reference') ?? null
  return {
    receipt_schema_version: RECEIPT_ENVELOPE_SCHEMA_VERSION,
    theory_package: { id: theoryPackage.theory.id, version: theoryPackage.theory.version, schema_version: theoryPackage.schema_version },
    operation_id: operationId,
    operator_contract: {
      version: operator.contract.contract_version,
      assumption_ids: [...operator.contract.assumptions_used],
      invariant_ids: [...operator.contract.invariants_checked],
      predicate_ids: operator.contract.predicates.map((item) => item.id),
      first_falsifier: operator.contract.first_falsifier,
    },
    implementation: options.implementation ?? { id: defaultImplementation?.id ?? null, version: defaultImplementation?.version ?? null },
    inputs: options.inputs ?? [],
    parameters: options.parameters ?? {},
    outputs: options.outputs ?? [],
    assumptions_used: options.assumptions_used ?? [...operator.contract.assumptions_used],
    checks: options.checks ?? operator.contract.predicates.map((predicate) => ({ predicate_id: predicate.id, status: 'NOT_RUN' as const, expected: predicate.statement })),
    claims_supported: options.claims_supported ?? [],
    claims_prohibited: options.claims_prohibited ?? [...theoryPackage.claim_boundaries.prohibited],
    parent_receipts: options.parent_receipts ?? [],
    status: options.status ?? 'NOT_RUN',
    timestamp_utc: options.timestamp_utc ?? new Date().toISOString(),
  }
}

export function packageLevelName(level: number): string {
  return MATURITY_LEVELS.find((item) => item.level === level)?.name ?? 'Unknown level'
}

export function canExecutePackage(theoryPackage: TheoryPackage): boolean {
  return validateTheoryPackage(theoryPackage).ok && theoryPackage.maturity_level >= 3 && theoryPackage.operators.every((item) => Boolean(item.implementation)) && theoryPackage.implementations.some((item) => item.status === 'reference' || item.status === 'mirror')
}

export function normalizePackageId(value: string): string {
  const cleaned = value.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z]+/, '').replace(/[-_.]+$/g, '')
  return cleaned || 'untitled-theory'
}

function openContract(index: number): OperatorExecutionContract {
  return {
    contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
    parameters: [],
    preconditions: ['THEORY MAP OPEN — define admissible inputs and parameter bounds.'],
    assumptions_used: [],
    invariants_checked: [],
    predicates: [{ id: `predicate-open-${index + 1}`, statement: 'THEORY MAP OPEN — define the exact predicate checked.', required: true }],
    failure_conditions: [{ id: `failure-open-${index + 1}`, condition: 'THEORY MAP OPEN — define rejection and failure behavior.', outcome: 'REJECT' }],
    reversibility: { classification: 'unknown', condition: 'THEORY MAP OPEN — classify reversibility.' },
    receipt_fields: ['theory_package', 'operation_id', 'operator_contract', 'status'],
    first_falsifier: 'THEORY MAP OPEN — state the first admissible counterexample.',
  }
}

export function makeDraftPackage(input: {
  id: string
  name: string
  version: string
  summary: string
  motivation: string
  maturityLevel: number
  objects: string[]
  operators: string[]
  assumptions: string[]
  invariants: string[]
  allowedClaims: string[]
  prohibitedClaims: string[]
}): TheoryPackage {
  const objectDefs = input.objects.map((name, index) => ({ id: normalizePackageId(name || `object-${index + 1}`), name: name || `Object ${index + 1}`, definition: 'THEORY MAP OPEN — define identity, fields, and admissible values.', evidence_class: 'ASPIRATIONAL' as EvidenceClass, status: 'THEORY_MAP_OPEN' as DefinitionStatus }))
  const fallbackObject = objectDefs[0]?.id ?? 'state'
  if (objectDefs.length === 0) objectDefs.push({ id: fallbackObject, name: 'State', definition: 'THEORY MAP OPEN — define the primary object.', evidence_class: 'ASPIRATIONAL', status: 'THEORY_MAP_OPEN' })
  return {
    schema_version: THEORY_PACKAGE_SCHEMA_VERSION,
    theory: { id: normalizePackageId(input.id || input.name), name: input.name || 'Untitled Theory', version: input.version || '0.1.0', status: 'draft', summary: input.summary || 'Candidate theory package generated by the Theory Definition Wizard.', motivation: input.motivation || 'Not yet supplied.' },
    maturity_level: Math.min(5, Math.max(1, Math.trunc(input.maturityLevel || 1))) as 1 | 2 | 3 | 4 | 5,
    objects: objectDefs,
    operators: input.operators.map((name, index) => ({ id: normalizePackageId(name || `operator-${index + 1}`), name: name || `Operator ${index + 1}`, input_types: [fallbackObject], output_types: [fallbackObject], semantics: 'THEORY MAP OPEN — provide a mathematical or computational map.', evidence_class: 'ASPIRATIONAL', status: 'THEORY_MAP_OPEN', implementation: null, contract: openContract(index) })),
    assumptions: input.assumptions.map((text, index) => ({ id: `a${index + 1}`, text, evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' })),
    invariants: input.invariants.map((text, index) => ({ id: `i${index + 1}`, text, scope: 'candidate', evidence_class: 'ASPIRATIONAL', status: 'CANDIDATE' })),
    claim_boundaries: { allowed: input.allowedClaims.length > 0 ? input.allowedClaims : ['the package records its declared structure'], prohibited: input.prohibitedClaims.length > 0 ? input.prohibitedClaims : ['empirical truth without Reality Gate evidence'] },
    evidence: { reality_gate: 'not_evaluated', notes: 'No empirical evaluation recorded.' },
    implementations: [],
    metadata: { generated_by: 'theory-definition-wizard:v0.2' },
  }
}

const commonReceiptFields = ['theory_package', 'operation_id', 'operator_contract', 'implementation', 'inputs', 'parameters', 'outputs', 'assumptions_used', 'checks', 'claims_supported', 'claims_prohibited', 'parent_receipts', 'status', 'timestamp_utc']

export const BUNDLED_THEORY_PACKAGES: TheoryPackage[] = [
  {
    schema_version: THEORY_PACKAGE_SCHEMA_VERSION,
    theory: {
      id: 'langarian-finite-complex',
      name: 'Langarian Finite Complex Transformations',
      version: '0.3.1',
      status: 'active',
      summary: 'The executable finite-complex-vector package currently powering the workbench.',
      motivation: 'Make mathematical transformations reproducible, receipt-bearing, and unable to overstate what one computation establishes.',
    },
    maturity_level: 4,
    objects: [
      { id: 'state', name: 'ResonantState', definition: 'A finite vector in C^n, 1 <= n <= 64, plus bounded metadata and receipt history.', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED' },
      { id: 'receipt', name: 'OperationReceipt', definition: 'A versioned integrity record for one operator execution and its checks.', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED' },
      { id: 'bridge-result', name: 'BridgeResult', definition: 'A recorded source/target relation candidate with similarity and edge-local declared cost.', evidence_class: 'IMPLEMENTED', status: 'PROVISIONAL' },
    ],
    operators: [
      {
        id: 'phase-shift', name: 'phase_shift', input_types: ['state'], output_types: ['state'], semantics: 'P_theta(x) = exp(i theta) x.', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED', implementation: 'src/langarian/operators.py#phase_shift',
        contract: {
          contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
          parameters: [{ id: 'angle', name: 'Angle', type: 'finite real radians', required: true, constraints: 'Must be finite.' }],
          preconditions: ['Input is a valid finite complex state.', 'angle is a finite real number in radians.'],
          assumptions_used: ['a1'],
          invariants_checked: ['i1', 'i2'],
          predicates: [
            { id: 'output-well-typed', statement: 'The output is a finite state with the same dimension as the input.', required: true },
            { id: 'norm-preserved', statement: 'Output norm equals input norm within the declared numerical policy.', required: true, tolerance: 'docs/NUMERICAL_POLICY.md' },
            { id: 'receipt-bound', statement: 'The receipt records input hash, output hash, operator, parameters, and versions.', required: true },
          ],
          failure_conditions: [
            { id: 'invalid-state', condition: 'Input fails state validation or dimension limits.', outcome: 'REJECT' },
            { id: 'nonfinite-angle', condition: 'angle is NaN or infinite.', outcome: 'REJECT' },
            { id: 'invariant-failure', condition: 'A required predicate fails after execution.', outcome: 'FAIL_RECEIPT' },
          ],
          reversibility: { classification: 'reversible', condition: 'Inverse is phase_shift with angle -theta.' },
          receipt_fields: commonReceiptFields,
          first_falsifier: 'An admissible finite input and angle for which independent high-precision evaluation disagrees with exp(i theta)x beyond the numerical policy.',
        },
      },
      {
        id: 'harmonic-sum', name: 'harmonic_sum', input_types: ['state', 'state'], output_types: ['state'], semantics: 'Zero-pad to a common dimension and add componentwise.', evidence_class: 'IMPLEMENTED', status: 'PROVISIONAL', implementation: 'src/langarian/operators.py#harmonic_sum',
        contract: {
          contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
          parameters: [],
          preconditions: ['Both inputs are valid finite complex states.', 'Each dimension is within MAX_DIM.'],
          assumptions_used: ['a1', 'a2'],
          invariants_checked: ['i2'],
          predicates: [
            { id: 'output-well-typed', statement: 'The output is a valid finite complex state.', required: true },
            { id: 'common-dimension', statement: 'Output dimension equals max(dim(a), dim(b)).', required: true },
            { id: 'componentwise-sum', statement: 'Each output component equals the sum of the explicitly padded input components.', required: true, tolerance: 'docs/NUMERICAL_POLICY.md' },
            { id: 'receipt-bound', statement: 'The receipt records both input hashes and the output hash.', required: true },
          ],
          failure_conditions: [
            { id: 'invalid-input', condition: 'Either input fails validation.', outcome: 'REJECT' },
            { id: 'dimension-limit', condition: 'The common dimension exceeds MAX_DIM.', outcome: 'REJECT' },
            { id: 'predicate-failure', condition: 'A required output predicate fails.', outcome: 'FAIL_RECEIPT' },
          ],
          reversibility: { classification: 'irreversible', condition: 'The output alone does not uniquely recover both input vectors.' },
          receipt_fields: commonReceiptFields,
          first_falsifier: 'A valid input pair for which the implementation output differs from explicit zero-padding followed by componentwise addition.',
        },
      },
      {
        id: 'phase-weighted-scale', name: 'attenuated_phase_shift', input_types: ['state'], output_types: ['state'], semantics: 'A_(theta,eta)(x) = eta exp(i theta) x for eta >= 0.', evidence_class: 'IMPLEMENTED', status: 'PROVISIONAL', implementation: 'src/langarian/operators.py#attenuated_phase_shift',
        contract: {
          contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
          parameters: [
            { id: 'angle', name: 'Angle', type: 'finite real radians', required: true, constraints: 'Must be finite.' },
            { id: 'attenuation', name: 'Scale factor', type: 'finite non-negative real', required: true, constraints: 'eta >= 0; eta > 1 is amplification.' },
            { id: 'cost-label', name: 'Declared cost label', type: 'string or null', required: false, constraints: 'Required by the current I3 gate when eta < 1.' },
          ],
          preconditions: ['Input is a valid finite complex state.', 'angle is finite.', 'attenuation is finite and non-negative.'],
          assumptions_used: ['a1'],
          invariants_checked: ['i2'],
          predicates: [
            { id: 'output-well-typed', statement: 'The output is a valid finite state with unchanged dimension.', required: true },
            { id: 'norm-scaled', statement: 'Output norm equals eta times input norm within the numerical policy.', required: true, tolerance: 'docs/NUMERICAL_POLICY.md' },
            { id: 'decrease-accounted', statement: 'When eta < 1, a non-empty declared cost label is present.', required: true },
            { id: 'receipt-bound', statement: 'The receipt records input hash, output hash, theta, eta, cost declaration, and versions.', required: true },
          ],
          failure_conditions: [
            { id: 'invalid-input', condition: 'Input fails state validation.', outcome: 'REJECT' },
            { id: 'invalid-parameter', condition: 'angle or attenuation is non-finite, or attenuation is negative.', outcome: 'REJECT' },
            { id: 'missing-cost', condition: 'eta < 1 and no declared cost label is supplied.', outcome: 'FAIL_RECEIPT' },
            { id: 'amplification-unaccounted', condition: 'eta > 1 under the current decrease-only accounting rule.', outcome: 'WARN_RECEIPT' },
          ],
          reversibility: { classification: 'conditionally_reversible', condition: 'Reversible exactly when eta > 0, using angle -theta and scale 1/eta; eta = 0 is irreversible.' },
          receipt_fields: commonReceiptFields,
          first_falsifier: 'An admissible input, angle, and eta for which the output differs from eta exp(i theta)x or the receipt misstates the declared cost boundary.',
        },
      },
      {
        id: 'bridge', name: 'bridge', input_types: ['state', 'state'], output_types: ['bridge-result'], semantics: 'Record a source/target relation candidate, normalized similarity, and an edge-local caller declaration.', evidence_class: 'IMPLEMENTED', status: 'THEORY_MAP_OPEN', implementation: 'src/langarian/operators.py#bridge',
        contract: {
          contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
          parameters: [{ id: 'cost', name: 'Declared edge cost', type: 'finite real', required: false, constraints: 'Edge-local caller declaration only; not accumulated path cost.' }],
          preconditions: ['Source and target are valid finite complex states.', 'Declared edge cost is finite.'],
          assumptions_used: ['a1'],
          invariants_checked: ['i2', 'i3'],
          predicates: [
            { id: 'endpoints-well-typed', statement: 'Both source and target states pass validation.', required: true },
            { id: 'similarity-bounded', statement: 'Recorded normalized similarity lies in [0,1] under the software zero-vector convention.', required: true, tolerance: 'docs/NUMERICAL_POLICY.md' },
            { id: 'edge-cost-local', statement: 'The receipt labels cost as edge-local and does not infer accumulated path cost.', required: true },
            { id: 'receipt-bound', statement: 'The receipt records both endpoint hashes, similarity, declared edge cost, and versions.', required: true },
          ],
          failure_conditions: [
            { id: 'invalid-endpoint', condition: 'Either endpoint fails validation.', outcome: 'REJECT' },
            { id: 'nonfinite-cost', condition: 'Declared edge cost is NaN or infinite.', outcome: 'REJECT' },
            { id: 'claim-overreach', condition: 'The result is presented as equality, path equivalence, provenance completeness, or zero path cost.', outcome: 'FAIL_RECEIPT' },
          ],
          reversibility: { classification: 'not_applicable', condition: 'The current operation records a relation candidate and does not transform source into target.' },
          receipt_fields: commonReceiptFields,
          first_falsifier: 'A valid run whose receipt erases intermediate history, treats edge cost as path cost, or records similarity outside the declared bounded convention.',
        },
      },
    ],
    assumptions: [
      { id: 'a1', text: 'The executable model is finite-dimensional and represented with finite IEEE-754 components.', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED' },
      { id: 'a2', text: 'Zero-padding is the selected embedding convention for unequal dimensions.', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
    ],
    invariants: [
      { id: 'i1', text: 'phase_shift preserves Euclidean norm in exact arithmetic.', scope: 'general theorem plus per-instance conformance', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED' },
      { id: 'i2', text: 'Every operation receipt records declared input hashes and an output hash or relation target hash.', scope: 'current implementation', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED' },
      { id: 'i3', text: 'A bridge edge declaration must not be promoted into a claim about accumulated path cost or state equality.', scope: 'governance boundary', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
    ],
    claim_boundaries: {
      allowed: ['a declared transformation was computed', 'listed contract predicates ran under declared versions', 'two implementation surfaces conform to reviewed fixtures'],
      prohibited: ['the model describes nature', 'a demonstration fixture is mathematically privileged', 'Formal Eligibility equals proof', 'zero bridge edge cost means zero historical path cost', 'implementation agreement is independent scientific confirmation'],
    },
    evidence: { reality_gate: 'not_evaluated', notes: 'The package is a mathematical software workbench, not an empirically validated physical theory.' },
    implementations: [
      { id: 'python-reference', language: 'Python', version: 'langarian-python-ref-v0.3.0', status: 'reference' },
      { id: 'typescript-mirror', language: 'TypeScript', version: 'langarian-ts-port-v0.3.0', status: 'mirror', independent_from: ['python-reference:algorithmically mirrored, not epistemically independent'] },
    ],
    metadata: { bundled: true, execution_route: 'program' },
  },
  {
    schema_version: THEORY_PACKAGE_SCHEMA_VERSION,
    theory: {
      id: 'generic-provenance-workflow',
      name: 'Generic Provenance Workflow',
      version: '0.2.0',
      status: 'candidate',
      summary: 'A neutral formal example showing how non-executable theory packages declare exact operator contracts.',
      motivation: 'Demonstrate portable provenance and review semantics without publishing or depending on any private research program.',
    },
    maturity_level: 2,
    objects: [
      { id: 'record', name: 'Record', definition: 'A versioned item with a stable identifier, content hash, and addressable ancestry.', evidence_class: 'DOCUMENTED', status: 'ACCEPTED' },
      { id: 'claim', name: 'Claim', definition: 'A bounded proposition with status, evidence references, and an immutable version identity.', evidence_class: 'DOCUMENTED', status: 'ACCEPTED' },
      { id: 'review-result', name: 'Review result', definition: 'A decision record naming the reviewed claim, reviewer class, checks, and disposition.', evidence_class: 'DOCUMENTED', status: 'ACCEPTED' },
    ],
    operators: [
      {
        id: 'attach-source', name: 'attach_source', input_types: ['claim', 'record'], output_types: ['claim'], semantics: 'Create a new claim version whose evidence set includes the supplied record while preserving prior ancestry.', evidence_class: 'DOCUMENTED', status: 'ACCEPTED', implementation: null,
        contract: {
          contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
          parameters: [],
          preconditions: ['The claim and record have stable identifiers and content hashes.', 'The record is not already attached to the current claim version.'],
          assumptions_used: ['a1', 'a2'],
          invariants_checked: ['i1'],
          predicates: [
            { id: 'ancestry-preserved', statement: 'Every prior ancestor of the input claim remains reachable from the output claim version.', required: true },
            { id: 'source-attached-once', statement: 'The supplied record appears exactly once in the output evidence set.', required: true },
          ],
          failure_conditions: [
            { id: 'missing-identity', condition: 'Either input lacks a stable identifier or content hash.', outcome: 'REJECT' },
            { id: 'duplicate-source', condition: 'The source record is already attached.', outcome: 'WARN_RECEIPT' },
            { id: 'ancestry-loss', condition: 'Any prior claim ancestry becomes unreachable.', outcome: 'FAIL_RECEIPT' },
          ],
          reversibility: { classification: 'conditionally_reversible', condition: 'A later superseding claim version may remove the active attachment only while preserving a tombstone and the prior version.' },
          receipt_fields: commonReceiptFields,
          first_falsifier: 'An admissible attachment that produces a new claim version from which a prior ancestor or the supplied record cannot be addressed.',
        },
      },
      {
        id: 'review-claim', name: 'review_claim', input_types: ['claim', 'record'], output_types: ['review-result'], semantics: 'Evaluate a claim against a declared evidence record and emit a bounded review disposition without mutating the claim.', evidence_class: 'DOCUMENTED', status: 'ACCEPTED', implementation: null,
        contract: {
          contract_version: OPERATOR_CONTRACT_SCHEMA_VERSION,
          parameters: [{ id: 'reviewer-class', name: 'Reviewer class', type: 'string enum', required: true, constraints: 'Must be one of the package-authorized reviewer classes.' }],
          preconditions: ['The claim and evidence record are addressable.', 'The reviewer class is authorized for this review type.'],
          assumptions_used: ['a1'],
          invariants_checked: ['i2'],
          predicates: [
            { id: 'inputs-addressable', statement: 'The review result names exact claim and evidence identities.', required: true },
            { id: 'decision-bounded', statement: 'The disposition states what was checked and prohibits unsupported promotion.', required: true },
          ],
          failure_conditions: [
            { id: 'unauthorized-reviewer', condition: 'The reviewer class is not authorized.', outcome: 'REJECT' },
            { id: 'missing-evidence', condition: 'The evidence record cannot be resolved.', outcome: 'FAIL_RECEIPT' },
            { id: 'unsupported-promotion', condition: 'The review attempts to promote beyond the declared checks.', outcome: 'FAIL_RECEIPT' },
          ],
          reversibility: { classification: 'not_applicable', condition: 'A review result is append-only; later reviews may supersede but do not erase it.' },
          receipt_fields: commonReceiptFields,
          first_falsifier: 'A valid review result that cannot identify its claim, evidence, reviewer class, checks, or bounded disposition.',
        },
      },
    ],
    assumptions: [
      { id: 'a1', text: 'Every object has a stable identifier and deterministic content hash.', evidence_class: 'DOCUMENTED', status: 'ACCEPTED' },
      { id: 'a2', text: 'Version history is append-only; supersession does not erase prior versions.', evidence_class: 'DOCUMENTED', status: 'ACCEPTED' },
    ],
    invariants: [
      { id: 'i1', text: 'All prior claim ancestry remains addressable after a source attachment.', scope: 'provenance invariant', evidence_class: 'DOCUMENTED', status: 'ACCEPTED' },
      { id: 'i2', text: 'Every review result remains attached to the exact claim, evidence, checks, and disposition that produced it.', scope: 'review invariant', evidence_class: 'DOCUMENTED', status: 'ACCEPTED' },
    ],
    claim_boundaries: {
      allowed: ['the package defines a portable formal provenance workflow', 'an implementation may be built against the declared contracts'],
      prohibited: ['the example is an empirical theory', 'a valid manifest proves an implementation correct', 'a review result establishes truth beyond its declared checks'],
    },
    evidence: { reality_gate: 'not_evaluated', notes: 'This neutral package is a formal governance example and has no empirical truth claim.' },
    implementations: [{ id: 'documentary-package', language: 'JSON/Markdown', version: '0.2.0', status: 'documentary' }],
    metadata: { bundled: true, execution_route: null, example_kind: 'neutral-public' },
  },
]
