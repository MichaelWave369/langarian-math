import { describe, expect, it } from 'vitest'

import { pyFloat, type CanonicalValue } from '../../src/kernel/canonical.js'
import {
  LangarianError,
  LangarianTypeError,
  LimitError,
  MAX_DIM,
  MAX_GLYPH_CHARS,
  MAX_LABEL_CHARS,
  MAX_METADATA_BYTES,
  MAX_PHI_SCALE_POWER,
  ValueError,
} from '../../src/kernel/limits.js'
import { phiScale } from '../../src/kernel/operators.js'
import { ResonantState } from '../../src/kernel/state.js'

describe('limits', () => {
  it('exports the v0.3 limit constants', () => {
    expect(MAX_DIM).toBe(64)
    expect(MAX_PHI_SCALE_POWER).toBe(64)
    expect(MAX_METADATA_BYTES).toBe(4096)
    expect(MAX_LABEL_CHARS).toBe(120)
    expect(MAX_GLYPH_CHARS).toBe(16)
  })

  it('rejects dim==0 with ValueError and dim>MAX_DIM with LimitError', () => {
    expect(() => new ResonantState([])).toThrowError(ValueError)
    expect(() => new ResonantState(Array.from({ length: MAX_DIM + 1 }, () => ({ re: 0, im: 0 })))).toThrowError(
      LimitError,
    )
    expect(() => new ResonantState(Array.from({ length: MAX_DIM }, () => ({ re: 0, im: 0 })))).not.toThrow()
  })

  it('rejects non-finite vectors', () => {
    expect(() => new ResonantState([{ re: NaN, im: 0 }])).toThrowError(ValueError)
    expect(() => new ResonantState([{ re: 0, im: Infinity }])).toThrowError(ValueError)
  })

  it('enforces label and glyph length limits', () => {
    const v = [{ re: 1, im: 0 }]
    expect(() => new ResonantState(v, { label: 'x'.repeat(MAX_LABEL_CHARS + 1) })).toThrowError(LimitError)
    expect(() => new ResonantState(v, { glyph: 'x'.repeat(MAX_GLYPH_CHARS + 1) })).toThrowError(LimitError)
    expect(() => new ResonantState(v, { label: 'x'.repeat(MAX_LABEL_CHARS) })).not.toThrow()
  })

  it('enforces the metadata byte limit and typed metadata errors', () => {
    const big = 'x'.repeat(MAX_METADATA_BYTES)
    expect(() => new ResonantState([{ re: 1, im: 0 }], { metadata: { blob: big } })).toThrowError(LimitError)
    expect(() => new ResonantState([{ re: 1, im: 0 }], { metadata: { x: NaN } })).toThrowError(ValueError)
    expect(
      () => new ResonantState([{ re: 1, im: 0 }], { metadata: { arr: new Map() as unknown as CanonicalValue } }),
    ).toThrowError(LangarianTypeError)
    // LangarianTypeError keeps error.name === 'TypeError' (conformance contract).
    try {
      new ResonantState([{ re: 1, im: 0 }], { metadata: { arr: new Map() as unknown as CanonicalValue } })
      expect.unreachable()
    } catch (exc) {
      expect(exc).toBeInstanceOf(LangarianError)
      expect((exc as Error).name).toBe('TypeError')
    }
  })

  it('phi_scale rejects out-of-range and non-integral exponents with typed errors', () => {
    const one = ResonantState.fromPairs([[1, 0]])
    expect(() => phiScale(one, MAX_PHI_SCALE_POWER + 1)).toThrowError(LimitError)
    expect(() => phiScale(one, -(MAX_PHI_SCALE_POWER + 1))).toThrowError(LimitError)
    expect(() => phiScale(one, 2.7)).toThrowError(LangarianTypeError)
    expect(() => phiScale(one, 2.7)).toThrowError(LangarianError)
    expect(() => phiScale(one, NaN)).toThrowError(ValueError)
    expect(() => phiScale(one, MAX_PHI_SCALE_POWER)).not.toThrow()
  })

  it('metadata accepts JSON-safe values and boxes floats', () => {
    const state = new ResonantState([{ re: 1, im: 0 }], {
      metadata: { i: 3, f: 1.5, boxed: pyFloat(2), s: 'ok', b: true, n: null, list: [1, 2.5] },
    })
    expect(state.metadata.f).toBeInstanceOf(Object)
  })
})

describe('immutability', () => {
  it('freezes the vector, metadata, and history', () => {
    const state = ResonantState.fromPairs([[1, 2]], { label: 'x', metadata: { a: 1 } })
    expect(Object.isFrozen(state.vector)).toBe(true)
    expect(Object.isFrozen(state.metadata)).toBe(true)
    expect(Object.isFrozen(state.history)).toBe(true)
    expect(() => {
      ;(state as { vector: unknown }).vector = []
    }).toThrowError(TypeError)
  })

  it('defensively copies constructor inputs', () => {
    const pairs: [number, number][] = [[1, 0]]
    const metadata: Record<string, CanonicalValue> = { a: 1 }
    const state = ResonantState.fromPairs(pairs, { metadata })
    pairs[0]![0] = 99
    metadata.a = 99
    expect(state.vector[0]!.re).toBe(1)
    expect(state.metadata.a).toBe(1)
  })
})
