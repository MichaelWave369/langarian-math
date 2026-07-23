export const THEORY_PACKAGE_SCHEMA_VERSION = 'theory-package:v0.1' as const
export const RECEIPT_ENVELOPE_SCHEMA_VERSION = 'parallax-receipt-envelope:v0.1' as const

export type EvidenceClass = 'OBSERVED' | 'IMPLEMENTED' | 'DOCUMENTED' | 'INFERRED' | 'ASPIRATIONAL' | 'UNKNOWN'
export type DefinitionStatus = 'ACCEPTED' | 'PROVISIONAL' | 'CANDIDATE' | 'THEORY_MAP_OPEN'
export type PackageStatus = 'draft' | 'candidate' | 'active' | 'deprecated'

export interface TheoryObjectDefinition {
  id: string
  name: string
  definition: string
  evidence_class: EvidenceClass
  status: DefinitionStatus
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
  {
    level: 1,
    name: 'Documentary theory',
    description: 'Objects, assumptions, claims, sources, and open questions are mapped. Nothing is executable yet.',
  },
  {
    level: 2,
    name: 'Formal specification',
    description: 'Objects, operators, domains, and proof obligations are defined, but a reference implementation is not required.',
  },
  {
    level: 3,
    name: 'Executable reference',
    description: 'At least one implementation can execute declared operations and emit package-bound receipts.',
  },
  {
    level: 4,
    name: 'Conformance tested',
    description: 'A second implementation or independent test surface reproduces compatible behavior.',
  },
  {
    level: 5,
    name: 'Reality-Gate candidate',
    description: 'Empirical tests, datasets, predictions, and replication requirements are explicitly registered.',
  },
] as const

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/
const EVIDENCE_CLASSES: ReadonlySet<string> = new Set(['OBSERVED', 'IMPLEMENTED', 'DOCUMENTED', 'INFERRED', 'ASPIRATIONAL', 'UNKNOWN'])
const DEFINITION_STATUSES: ReadonlySet<string> = new Set(['ACCEPTED', 'PROVISIONAL', 'CANDIDATE', 'THEORY_MAP_OPEN'])

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

export function validateTheoryPackage(value: unknown): PackageValidationResult {
  const issues: PackageValidationIssue[] = []
  if (!isRecord(value)) return { ok: false, issues: [{ path: '$', code: 'EXPECTED_OBJECT', message: 'Package must be a JSON object.' }] }

  if (value.schema_version !== THEORY_PACKAGE_SCHEMA_VERSION) {
    addIssue(issues, 'schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${THEORY_PACKAGE_SCHEMA_VERSION}.`)
  }

  if (!isRecord(value.theory)) {
    addIssue(issues, 'theory', 'EXPECTED_OBJECT', 'Missing theory identity block.')
  } else {
    validateIdentifier(issues, 'theory.id', value.theory.id)
    for (const key of ['name', 'summary', 'motivation'] as const) {
      if (typeof value.theory[key] !== 'string' || value.theory[key].trim() === '') {
        addIssue(issues, `theory.${key}`, 'REQUIRED_TEXT', `${key} must be non-empty.`)
      }
    }
    if (typeof value.theory.version !== 'string' || !VERSION_PATTERN.test(value.theory.version)) {
      addIssue(issues, 'theory.version', 'INVALID_VERSION', 'Use semantic versioning such as 0.1.0 or 1.0.0-rc.1.')
    }
    if (!['draft', 'candidate', 'active', 'deprecated'].includes(String(value.theory.status))) {
      addIssue(issues, 'theory.status', 'INVALID_PACKAGE_STATUS', 'Use draft, candidate, active, or deprecated.')
    }
  }

  if (!Number.isInteger(value.maturity_level) || Number(value.maturity_level) < 1 || Number(value.maturity_level) > 5) {
    addIssue(issues, 'maturity_level', 'INVALID_LEVEL', 'Maturity level must be an integer from 1 through 5.')
  }

  const objectIds = new Set<string>()
  validateDefinitions(issues, 'objects', value.objects, objectIds, 'object')
  validateDefinitions(issues, 'operators', value.operators, objectIds, 'operator')
  validateDefinitions(issues, 'assumptions', value.assumptions, objectIds, 'statement')
  validateDefinitions(issues, 'invariants', value.invariants, objectIds, 'statement')

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
          if (typeof ref !== 'string' || !objectIds.has(ref)) {
            addIssue(issues, `operators[${index}].${key}[${refIndex}]`, 'UNKNOWN_OBJECT_TYPE', `Unknown object type ${String(ref)}.`)
          }
        })
      }
    })
  }

  if (!isRecord(value.claim_boundaries)) {
    addIssue(issues, 'claim_boundaries', 'EXPECTED_OBJECT', 'Claim boundaries are required.')
  } else {
    for (const key of ['allowed', 'prohibited'] as const) {
      if (!Array.isArray(value.claim_boundaries[key]) || value.claim_boundaries[key].some((item) => typeof item !== 'string' || item.trim() === '')) {
        addIssue(issues, `claim_boundaries.${key}`, 'INVALID_CLAIM_LIST', 'Expected a list of non-empty claim strings.')
      }
    }
  }

  if (!isRecord(value.evidence) || !['not_evaluated', 'planned', 'in_progress', 'passed', 'failed'].includes(String(value.evidence.reality_gate))) {
    addIssue(issues, 'evidence.reality_gate', 'INVALID_REALITY_GATE', 'Reality Gate must be explicitly classified.')
  }

  if (!Array.isArray(value.implementations)) {
    addIssue(issues, 'implementations', 'EXPECTED_ARRAY', 'Expected an implementations array.')
  } else {
    const executable = value.implementations.filter((item) => isRecord(item) && ['reference', 'mirror'].includes(String(item.status)))
    if (Number(value.maturity_level) >= 3 && executable.length < 1) {
      addIssue(issues, 'implementations', 'LEVEL_REQUIRES_IMPLEMENTATION', 'Level 3 or higher requires at least one reference or mirror implementation.')
    }
    if (Number(value.maturity_level) >= 4 && executable.length < 2) {
      addIssue(issues, 'implementations', 'LEVEL_REQUIRES_CONFORMANCE', 'Level 4 or higher requires at least two executable implementation surfaces.')
    }
  }

  return { ok: issues.length === 0, issues }
}

export function parseTheoryPackageJson(text: string): { package: TheoryPackage | null; validation: PackageValidationResult } {
  try {
    const parsed: unknown = JSON.parse(text)
    const validation = validateTheoryPackage(parsed)
    return { package: validation.ok ? (parsed as TheoryPackage) : null, validation }
  } catch (error) {
    return {
      package: null,
      validation: {
        ok: false,
        issues: [{ path: '$', code: 'INVALID_JSON', message: error instanceof Error ? error.message : String(error) }],
      },
    }
  }
}

export interface ReceiptEnvelope {
  receipt_schema_version: typeof RECEIPT_ENVELOPE_SCHEMA_VERSION
  theory_package: { id: string; version: string; schema_version: string }
  operation_id: string
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
  options: Partial<Omit<ReceiptEnvelope, 'receipt_schema_version' | 'theory_package' | 'operation_id'>> = {},
): ReceiptEnvelope {
  const operator = theoryPackage.operators.find((item) => item.id === operationId)
  if (!operator) throw new Error(`Unknown operation ${operationId} for package ${theoryPackage.theory.id}.`)
  const defaultImplementation = theoryPackage.implementations.find((item) => item.status === 'reference') ?? null
  return {
    receipt_schema_version: RECEIPT_ENVELOPE_SCHEMA_VERSION,
    theory_package: {
      id: theoryPackage.theory.id,
      version: theoryPackage.theory.version,
      schema_version: theoryPackage.schema_version,
    },
    operation_id: operationId,
    implementation: options.implementation ?? {
      id: defaultImplementation?.id ?? null,
      version: defaultImplementation?.version ?? null,
    },
    inputs: options.inputs ?? [],
    parameters: options.parameters ?? {},
    outputs: options.outputs ?? [],
    assumptions_used: options.assumptions_used ?? [],
    checks: options.checks ?? [],
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
  return theoryPackage.maturity_level >= 3 && theoryPackage.implementations.some((item) => item.status === 'reference' || item.status === 'mirror')
}

export function normalizePackageId(value: string): string {
  const cleaned = value.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z]+/, '').replace(/[-_.]+$/g, '')
  return cleaned || 'untitled-theory'
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
  const objectDefs = input.objects.map((name, index) => ({
    id: normalizePackageId(name || `object-${index + 1}`),
    name: name || `Object ${index + 1}`,
    definition: 'THEORY MAP OPEN — define identity, fields, and admissible values.',
    evidence_class: 'ASPIRATIONAL' as EvidenceClass,
    status: 'THEORY_MAP_OPEN' as DefinitionStatus,
  }))
  const fallbackObject = objectDefs[0]?.id ?? 'state'
  if (objectDefs.length === 0) {
    objectDefs.push({
      id: fallbackObject,
      name: 'State',
      definition: 'THEORY MAP OPEN — define the primary object.',
      evidence_class: 'ASPIRATIONAL',
      status: 'THEORY_MAP_OPEN',
    })
  }
  return {
    schema_version: THEORY_PACKAGE_SCHEMA_VERSION,
    theory: {
      id: normalizePackageId(input.id || input.name),
      name: input.name || 'Untitled Theory',
      version: input.version || '0.1.0',
      status: 'draft',
      summary: input.summary || 'Candidate theory package generated by the Theory Definition Wizard.',
      motivation: input.motivation || 'Not yet supplied.',
    },
    maturity_level: Math.min(5, Math.max(1, Math.trunc(input.maturityLevel || 1))) as 1 | 2 | 3 | 4 | 5,
    objects: objectDefs,
    operators: input.operators.map((name, index) => ({
      id: normalizePackageId(name || `operator-${index + 1}`),
      name: name || `Operator ${index + 1}`,
      input_types: [fallbackObject],
      output_types: [fallbackObject],
      semantics: 'THEORY MAP OPEN — provide a mathematical or computational map.',
      evidence_class: 'ASPIRATIONAL',
      status: 'THEORY_MAP_OPEN',
      implementation: null,
    })),
    assumptions: input.assumptions.map((text, index) => ({
      id: `a${index + 1}`,
      text,
      evidence_class: 'DOCUMENTED',
      status: 'PROVISIONAL',
    })),
    invariants: input.invariants.map((text, index) => ({
      id: `i${index + 1}`,
      text,
      scope: 'candidate',
      evidence_class: 'ASPIRATIONAL',
      status: 'CANDIDATE',
    })),
    claim_boundaries: {
      allowed: input.allowedClaims,
      prohibited: input.prohibitedClaims.length > 0 ? input.prohibitedClaims : ['empirical truth without Reality Gate evidence'],
    },
    evidence: { reality_gate: 'not_evaluated', notes: 'No empirical evaluation recorded.' },
    implementations: [],
    metadata: { generated_by: 'theory-definition-wizard:v0.1' },
  }
}

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
      { id: 'phase-shift', name: 'phase_shift', input_types: ['state'], output_types: ['state'], semantics: 'P_theta(x) = exp(i theta) x.', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED', implementation: 'src/langarian/operators.py#phase_shift' },
      { id: 'harmonic-sum', name: 'harmonic_sum', input_types: ['state', 'state'], output_types: ['state'], semantics: 'Zero-pad to a common dimension and add componentwise.', evidence_class: 'IMPLEMENTED', status: 'PROVISIONAL', implementation: 'src/langarian/operators.py#harmonic_sum' },
      { id: 'phase-weighted-scale', name: 'attenuated_phase_shift', input_types: ['state'], output_types: ['state'], semantics: 'A_(theta,eta)(x) = eta exp(i theta) x for eta >= 0.', evidence_class: 'IMPLEMENTED', status: 'PROVISIONAL', implementation: 'src/langarian/operators.py#attenuated_phase_shift' },
      { id: 'bridge', name: 'bridge', input_types: ['state', 'state'], output_types: ['bridge-result'], semantics: 'Record a source/target relation candidate, normalized similarity, and an edge-local caller declaration.', evidence_class: 'IMPLEMENTED', status: 'THEORY_MAP_OPEN', implementation: 'src/langarian/operators.py#bridge' },
    ],
    assumptions: [
      { id: 'a1', text: 'The executable model is finite-dimensional and represented with finite IEEE-754 components.', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED' },
      { id: 'a2', text: 'Zero-padding is the selected embedding convention for unequal dimensions.', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
    ],
    invariants: [
      { id: 'i1', text: 'phase_shift preserves Euclidean norm in exact arithmetic.', scope: 'general theorem plus per-instance conformance', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED' },
      { id: 'i2', text: 'Every operation receipt records declared input hashes and an output hash.', scope: 'current implementation', evidence_class: 'IMPLEMENTED', status: 'ACCEPTED' },
    ],
    claim_boundaries: {
      allowed: ['a declared transformation was computed', 'listed checks ran under declared versions', 'two implementation surfaces conform to reviewed fixtures'],
      prohibited: ['the model describes nature', 'a demonstration fixture is mathematically privileged', 'Formal Eligibility equals proof', 'zero bridge edge cost means zero historical path cost'],
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
      id: 'saasy-reduced-hamiltonian',
      name: 'SaaSy Reduced Hamiltonian Program',
      version: '0.1.0',
      status: 'candidate',
      summary: 'A documentary/formal package shell for the reduced Hamiltonian closure research program.',
      motivation: 'Bring an active theory into Parallax before pretending every derivation has already become executable software.',
    },
    maturity_level: 2,
    objects: [
      { id: 'parent-system', name: 'Parent system', definition: 'The unreduced mathematical system from which a bounded reduced description is derived.', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
      { id: 'reduced-system', name: 'Reduced system', definition: 'The retained variables, operators, and terms after a declared reduction.', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
      { id: 'derivation-step', name: 'Derivation step', definition: 'A typed transformation or identity in the derivation tower with explicit dependencies.', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
      { id: 'claim', name: 'Bounded claim', definition: 'A proposition tagged by scope, evidence, dependencies, and promotion status.', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
    ],
    operators: [
      { id: 'reduce', name: 'reduction map', input_types: ['parent-system'], output_types: ['reduced-system'], semantics: 'CANDIDATE — specify the exact admissible reduction and retained/discarded information.', evidence_class: 'DOCUMENTED', status: 'THEORY_MAP_OPEN', implementation: null },
      { id: 'derive', name: 'derivation step', input_types: ['derivation-step'], output_types: ['derivation-step'], semantics: 'CANDIDATE — apply one lawful symbolic derivation rule with explicit assumptions and dependencies.', evidence_class: 'DOCUMENTED', status: 'THEORY_MAP_OPEN', implementation: null },
      { id: 'promote-claim', name: 'claim promotion', input_types: ['claim'], output_types: ['claim'], semantics: 'Move a claim to a stronger review state only when its declared proof obligations are satisfied.', evidence_class: 'ASPIRATIONAL', status: 'CANDIDATE', implementation: null },
    ],
    assumptions: [
      { id: 'a1', text: 'Every retained and discarded term must be explicitly classified.', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
      { id: 'a2', text: 'A reduced closure claim remains bounded to its declared dimensional and source assumptions.', evidence_class: 'DOCUMENTED', status: 'PROVISIONAL' },
    ],
    invariants: [
      { id: 'i1', text: 'No derivation step may lose its declared dependency set.', scope: 'candidate provenance invariant', evidence_class: 'ASPIRATIONAL', status: 'CANDIDATE' },
      { id: 'i2', text: 'A promoted claim must remain attached to the derivation and assumptions that earned promotion.', scope: 'candidate governance invariant', evidence_class: 'ASPIRATIONAL', status: 'CANDIDATE' },
    ],
    claim_boundaries: {
      allowed: ['the package documents objects, assumptions, derivation dependencies, and proof obligations', 'a statement is identified as candidate, derived, or unresolved'],
      prohibited: ['the theory is executable in the current finite-vector kernel', 'a documentary package proves closure', 'formal coherence alone establishes physical truth'],
    },
    evidence: { reality_gate: 'planned', notes: 'Empirical and literature comparison requirements remain to be registered as a separate evidence lane.' },
    implementations: [{ id: 'documentary-package', language: 'Markdown/JSON', version: '0.1.0', status: 'documentary' }],
    metadata: { bundled: true, execution_route: null, steward: 'Emet', auditor: 'Ori', custodian: 'Hughes' },
  },
]
