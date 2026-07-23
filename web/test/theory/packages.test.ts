import { describe, expect, it } from 'vitest'

import {
  BUNDLED_THEORY_PACKAGES,
  RECEIPT_ENVELOPE_SCHEMA_VERSION,
  THEORY_PACKAGE_SCHEMA_VERSION,
  buildReceiptEnvelope,
  canExecutePackage,
  makeDraftPackage,
  parseTheoryPackageJson,
  validateTheoryPackage,
} from '../../src/theory/packages.js'

describe('bundled theory packages', () => {
  it('validates every bundled package', () => {
    for (const theoryPackage of BUNDLED_THEORY_PACKAGES) {
      const result = validateTheoryPackage(theoryPackage)
      expect(result.issues, theoryPackage.theory.id).toEqual([])
      expect(result.ok).toBe(true)
    }
  })

  it('keeps execution package-specific', () => {
    const langarian = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex')!
    const saasy = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'saasy-reduced-hamiltonian')!
    expect(canExecutePackage(langarian)).toBe(true)
    expect(langarian.maturity_level).toBe(4)
    expect(canExecutePackage(saasy)).toBe(false)
    expect(saasy.maturity_level).toBe(2)
    expect(saasy.operators.every((operator) => operator.implementation === null)).toBe(true)
  })
})

describe('manifest validator', () => {
  it('rejects unknown object references', () => {
    const broken = structuredClone(BUNDLED_THEORY_PACKAGES[0])
    broken.operators[0]!.input_types = ['missing-type']
    const result = validateTheoryPackage(broken)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'UNKNOWN_OBJECT_TYPE')).toBe(true)
  })

  it('requires executable surfaces for claimed maturity', () => {
    const broken = structuredClone(BUNDLED_THEORY_PACKAGES[1])
    broken.maturity_level = 4
    const result = validateTheoryPackage(broken)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'LEVEL_REQUIRES_IMPLEMENTATION')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'LEVEL_REQUIRES_CONFORMANCE')).toBe(true)
  })

  it('parses valid JSON and rejects malformed JSON', () => {
    const source = JSON.stringify(BUNDLED_THEORY_PACKAGES[0])
    const valid = parseTheoryPackageJson(source)
    expect(valid.validation.ok).toBe(true)
    expect(valid.package?.schema_version).toBe(THEORY_PACKAGE_SCHEMA_VERSION)

    const invalid = parseTheoryPackageJson('{ nope')
    expect(invalid.package).toBeNull()
    expect(invalid.validation.issues[0]?.code).toBe('INVALID_JSON')
  })
})

describe('theory definition wizard output', () => {
  it('creates an honest documentary draft with open semantics', () => {
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
    expect(draft.operators[0]?.implementation).toBeNull()
    expect(canExecutePackage(draft)).toBe(false)
  })
})

describe('generic receipt envelope', () => {
  it('binds the operation to its theory package without claiming execution', () => {
    const theoryPackage = BUNDLED_THEORY_PACKAGES[0]!
    const receipt = buildReceiptEnvelope(theoryPackage, 'phase-shift', {
      timestamp_utc: '1970-01-01T00:00:00Z',
      parent_receipts: ['receipt:parent'],
    })
    expect(receipt.receipt_schema_version).toBe(RECEIPT_ENVELOPE_SCHEMA_VERSION)
    expect(receipt.theory_package).toEqual({
      id: 'langarian-finite-complex',
      version: '0.3.1',
      schema_version: THEORY_PACKAGE_SCHEMA_VERSION,
    })
    expect(receipt.operation_id).toBe('phase-shift')
    expect(receipt.implementation.id).toBe('python-reference')
    expect(receipt.parent_receipts).toEqual(['receipt:parent'])
    expect(receipt.status).toBe('NOT_RUN')
  })

  it('rejects operations not declared by the package', () => {
    expect(() => buildReceiptEnvelope(BUNDLED_THEORY_PACKAGES[0]!, 'not-an-operator')).toThrow(/Unknown operation/)
  })
})
