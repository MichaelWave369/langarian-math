import { describe, expect, it } from 'vitest'

import { canonicalJson, parseStrictJson, type CanonicalValue } from '../../src/kernel/canonical.js'
import { combineStatuses } from '../../src/kernel/contracts.js'
import { phaseShift } from '../../src/kernel/operators.js'
import { ResonantState } from '../../src/kernel/state.js'
import {
  recomputeContentHash,
  recomputeReceiptId,
  recomputeStatus,
  validateReceiptData,
} from '../../src/kernel/validation.js'
import { KERNEL_VERSION } from '../../src/kernel/version.js'

const FIXED_TIMESTAMP = '1970-01-01T00:00:00+00:00'

function makeReceiptBody(): Record<string, CanonicalValue> {
  const state = ResonantState.fromPairs(
    [
      [1, 2],
      [3, -4],
    ],
    { label: 'mixed_2' },
  )
  const { receipt } = phaseShift(state, Math.PI / 3, { timestampUtc: FIXED_TIMESTAMP })
  return receipt.toBody()
}

describe('validation levels', () => {
  it('a kernel-generated receipt passes all four levels after strict parsing', () => {
    const body = makeReceiptBody()
    const reparsed = parseStrictJson(canonicalJson(body))
    const validation = validateReceiptData(reparsed)
    expect(validation.ok).toBe(true)
    expect(validation.summary).toEqual({
      schema_valid: true,
      hash_valid: true,
      status_consistent: true,
      version_allowed: true,
    })
    expect(validation.schemaOnlyOk).toBe(false)
    expect(recomputeContentHash(reparsed as Record<string, CanonicalValue>)).toBe(body.content_hash)
    expect(recomputeReceiptId(reparsed as Record<string, CanonicalValue>)).toBe(body.receipt_id)
  })

  it('empty invariant list collapses to FAIL, never PASS', () => {
    expect(combineStatuses([])).toBe('FAIL')
    expect(combineStatuses(['PASS', 'WARN'])).toBe('WARN')
    expect(combineStatuses(['PASS', 'FAIL', 'WARN'])).toBe('FAIL')
    const body = makeReceiptBody()
    body.invariant_results = []
    expect(recomputeStatus(body)).toBe('FAIL')
    const validation = validateReceiptData(body)
    expect(validation.level('schema').ok).toBe(false) // empty invariants fail schema
  })

  it('a shape-only pass is not verification (schemaOnlyOk)', () => {
    const body = makeReceiptBody()
    body.output_hash = 'sha256:' + '0'.repeat(64) // tamper: hash level fails
    const validation = validateReceiptData(body)
    expect(validation.ok).toBe(false)
    expect(validation.schemaOnlyOk).toBe(true)
    expect(validation.summary.schema_valid).toBe(true)
    expect(validation.summary.hash_valid).toBe(false)
  })

  it('rejects older/unknown versions (no silent downgrade)', () => {
    const body = makeReceiptBody()
    body.kernel_version = 'langarian-python-ref-v0.2.0'
    const validation = validateReceiptData(body)
    expect(validation.summary.version_allowed).toBe(false)
    expect(validation.ok).toBe(false)

    const body2 = makeReceiptBody()
    body2.metric_version = 'metric:v0.2'
    expect(validateReceiptData(body2).summary.version_allowed).toBe(false)

    const body3 = makeReceiptBody()
    body3.receipt_schema_version = 'receipt:v0.2'
    expect(validateReceiptData(body3).summary.version_allowed).toBe(false)
  })

  it('detects status tampering at the status level', () => {
    const body = makeReceiptBody()
    body.status = 'FAIL'
    const validation = validateReceiptData(body)
    expect(validation.summary.status_consistent).toBe(false)
    expect(validation.summary.schema_valid).toBe(true)
  })

  it('rejects non-object receipts at the schema level only', () => {
    const validation = validateReceiptData([1, 2, 3])
    expect(validation.levels).toHaveLength(1)
    expect(validation.ok).toBe(false)
  })

  it('rejects missing required fields', () => {
    const body = makeReceiptBody()
    delete body.output_hash
    const validation = validateReceiptData(body)
    expect(validation.summary.schema_valid).toBe(false)
    expect(validation.level('schema').errors.some((e) => e.includes('output_hash'))).toBe(true)
  })

  it('version.ts mirrors the Python kernel version', () => {
    expect(KERNEL_VERSION).toBe('langarian-python-ref-v0.3.0')
  })
})
