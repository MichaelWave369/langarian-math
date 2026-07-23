import { describe, expect, it } from 'vitest'

import {
  BUNDLED_THEORY_PACKAGES,
  OPERATOR_CONTRACT_SCHEMA_VERSION,
  RECEIPT_ENVELOPE_SCHEMA_VERSION,
  THEORY_PACKAGE_SCHEMA_VERSION,
  buildReceiptEnvelope,
  canExecutePackage,
  makeDraftPackage,
  operatorContractResolved,
  parseTheoryPackageJson,
  validateTheoryPackage,
} from '../../src/theory/packages.js'

const langarian = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex')!
const generic = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'generic-provenance-workflow')!

describe('bundled theory packages', () => {
  it('validates every bundled package', () => {
    for (const theoryPackage of BUNDLED_THEORY_PACKAGES) {
      const result = validateTheoryPackage(theoryPackage)
      expect(result.issues, theoryPackage.theory.id).toEqual([])
      expect(result.ok).toBe(true)
    }
  })

  it('keeps execution package-specific', () => {
    expect(canExecutePackage(langarian)).toBe(true)
    expect(langarian.maturity_level).toBe(4)
    expect(canExecutePackage(generic)).toBe(false)
    expect(generic.maturity_level).toBe(2)
    expect(generic.operators.every((operator) => operator.implementation === null)).toBe(true)
  })

  it('ships only neutral public package examples', () => {
    expect(BUNDLED_THEORY_PACKAGES.map((item) => item.theory.id)).toEqual([
      'langarian-finite-complex',
      'generic-provenance-workflow',
    ])
  })
})

describe('manifest validator', () => {
  it('rejects unknown object references', () => {
    const broken = structuredClone(langarian)
    broken.operators[0]!.input_types = ['missing-type']
    const result = validateTheoryPackage(broken)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'UNKNOWN_OBJECT_TYPE')).toBe(true)
  })

  it('rejects missing execution contracts', () => {
    const broken = structuredClone(generic) as unknown as Record<string, unknown>
    const operators = broken.operators as Record<string, unknown>[]
    delete operators[0]!.contract
    const result = validateTheoryPackage(broken)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'MISSING_EXECUTION_CONTRACT')).toBe(true)
  })

  it('rejects unknown assumption and invariant links', () => {
    const broken = structuredClone(generic)
    broken.operators[0]!.contract.assumptions_used = ['missing-assumption']
    broken.operators[0]!.contract.invariants_checked = ['missing-invariant']
    const result = validateTheoryPackage(broken)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'UNKNOWN_ASSUMPTION')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'UNKNOWN_INVARIANT')).toBe(true)
  })

  it('requires executable surfaces and operator locations for claimed maturity', () => {
    const broken = structuredClone(generic)
    broken.maturity_level = 4
    const result = validateTheoryPackage(broken)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'LEVEL_REQUIRES_IMPLEMENTATION')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'LEVEL_REQUIRES_CONFORMANCE')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'EXECUTABLE_OPERATOR_REQUIRES_LOCATION')).toBe(true)
  })

  it('parses valid JSON and rejects old or malformed JSON', () => {
    const valid = parseTheoryPackageJson(JSON.stringify(langarian))
    expect(valid.validation.ok).toBe(true)
    expect(valid.package?.schema_version).toBe(THEORY_PACKAGE_SCHEMA_VERSION)

    const old = structuredClone(langarian) as unknown as Record<string, unknown>
    old.schema_version = 'theory-package:v0.1'
    expect(parseTheoryPackageJson(JSON.stringify(old)).validation.issues.some((issue) => issue.code === 'UNSUPPORTED_SCHEMA')).toBe(true)

    const invalid = parseTheoryPackageJson('{ nope')
    expect(invalid.package).toBeNull()
    expect(invalid.validation.issues[0]?.code).toBe('INVALID_JSON')
  })
})

describe('theory definition wizard output', () => {
  it('creates an honest documentary draft with open contract semantics', () => {
    const draft = makeDraftPackage({
      id: 'example-theory',
      name: 'Example Theory',
      version: '0.1.0',
      summary: 'A documentary theory package.',
      motivation: 'Make assumptions and claims inspectable.',
      maturityLevel: 1,
      objects: ['State'],
      operators: ['Evolve'],
      assumptions: ['The state is finite.'],
      invariants: ['Declared ancestry remains addressable.'],
      allowedClaims: ['The package records a candidate operator.'],
      prohibitedClaims: ['The theory describes nature.'],
    })
    const result = validateTheoryPackage(draft)
    expect(result.ok).toBe(true)
    expect(draft.operators[0]?.status).toBe('THEORY_MAP_OPEN')
    expect(draft.operators[0]?.contract.contract_version).toBe(OPERATOR_CONTRACT_SCHEMA_VERSION)
    expect(operatorContractResolved(draft.operators[0]!)).toBe(false)
    expect(canExecutePackage(draft)).toBe(false)
  })
})

describe('generic receipt envelope', () => {
  it('binds the operation to its package and exact contract without claiming execution', () => {
    const receipt = buildReceiptEnvelope(langarian, 'phase-shift', {
      timestamp_utc: '1970-01-01T00:00:00Z',
      parent_receipts: ['receipt:parent'],
    })
    expect(receipt.receipt_schema_version).toBe(RECEIPT_ENVELOPE_SCHEMA_VERSION)
    expect(receipt.theory_package).toEqual({ id: 'langarian-finite-complex', version: '0.3.1', schema_version: THEORY_PACKAGE_SCHEMA_VERSION })
    expect(receipt.operation_id).toBe('phase-shift')
    expect(receipt.operator_contract.version).toBe(OPERATOR_CONTRACT_SCHEMA_VERSION)
    expect(receipt.operator_contract.predicate_ids).toContain('norm-preserved')
    expect(receipt.assumptions_used).toEqual(['a1'])
    expect(receipt.implementation.id).toBe('python-reference')
    expect(receipt.parent_receipts).toEqual(['receipt:parent'])
    expect(receipt.status).toBe('NOT_RUN')
    expect(receipt.checks.every((check) => check.status === 'NOT_RUN')).toBe(true)
  })

  it('rejects operations not declared by the package', () => {
    expect(() => buildReceiptEnvelope(langarian, 'not-an-operator')).toThrow(/Unknown operation/)
  })
})
