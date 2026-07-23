import { describe, expect, it } from 'vitest'

import {
  canonicalJson,
  parseStrictJson,
  PyFloat,
  pyFloat,
  reprFloat,
} from '../../src/kernel/canonical.js'
import { sha256Hex } from '../../src/kernel/sha256.js'
import { ValueError } from '../../src/kernel/limits.js'

describe('reprFloat (CPython float repr)', () => {
  const cases: [number, string][] = [
    [0, '0.0'],
    [-0, '0.0'], // -0.0 normalizes to 0.0
    [1, '1.0'],
    [-2.5, '-2.5'],
    [0.1, '0.1'],
    [0.1 + 0.2, '0.30000000000000004'],
    [1e15, '1000000000000000.0'],
    [1e16, '1e+16'],
    [1e20, '1e+20'],
    [1e21, '1e+21'],
    [1e-4, '0.0001'],
    [1e-5, '1e-05'],
    [1e-7, '1e-07'],
    [5e-162, '5e-162'],
    [1e200, '1e+200'],
    [1e-200, '1e-200'],
    [5.477225575051662, '5.477225575051662'],
    [4.999999999999999e-162, '4.999999999999999e-162'],
    [123456789, '123456789.0'],
    [0.09999999999999999, '0.09999999999999999'],
  ]
  for (const [value, expected] of cases) {
    it(`repr(${String(value)}) === ${expected}`, () => {
      expect(reprFloat(value)).toBe(expected)
    })
  }

  it('rejects non-finite floats with a typed error', () => {
    expect(() => reprFloat(NaN)).toThrowError(ValueError)
    expect(() => reprFloat(Infinity)).toThrowError(ValueError)
    expect(() => reprFloat(-Infinity)).toThrowError(ValueError)
    expect(() => pyFloat(NaN)).toThrowError(ValueError)
  })
})

describe('canonicalJson', () => {
  it('sorts keys and uses tight separators', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
  })

  it('emits non-ASCII raw (ensure_ascii=False)', () => {
    expect(canonicalJson({ glyph: '(∅⊕∅)' })).toBe('{"glyph":"(∅⊕∅)"}')
  })

  it('serializes ints without .0 and PyFloat with CPython repr', () => {
    expect(canonicalJson({ n: 2, x: pyFloat(2) })).toBe('{"n":2,"x":2.0}')
    expect(canonicalJson([pyFloat(1), pyFloat(1e-7)])).toBe('[1.0,1e-07]')
  })

  it('serializes null/booleans/arrays like Python json', () => {
    expect(canonicalJson({ a: null, b: true, c: false, d: [] })).toBe('{"a":null,"b":true,"c":false,"d":[]}')
  })

  it('rejects non-safe plain numbers', () => {
    expect(() => canonicalJson(1.5)).toThrowError(ValueError)
  })

  it('escapes control characters like Python json', () => {
    expect(canonicalJson('a\nb')).toBe('"a\\nb\\u0001"')
    expect(canonicalJson('quote " backslash \\')).toBe('"quote \\" backslash \\\\"')
  })
})

describe('sha256Hex', () => {
  it('matches published SHA-256 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('hashes UTF-8 input (not UTF-16)', () => {
    // sha256 of the UTF-8 encoding of "(∅⊕∅)"
    expect(sha256Hex('(∅⊕∅)')).toBe('e7fafb662656b00e1d284052777fc9ad1df6015c2ac67f460b1e7a832a4c5a03')
  })
})

describe('parseStrictJson', () => {
  it('parses values and boxes float-syntax numbers', () => {
    const value = parseStrictJson('{"a": 1.0, "b": 2, "c": [true, null, "x"], "d": 1e+21}')
    expect(canonicalJson(value)).toBe('{"a":1.0,"b":2,"c":[true,null,"x"],"d":1e+21}')
  })

  it('round-trips canonical JSON byte-exactly', () => {
    const original = '{"n":2,"s":"(∅⊕∅)","x":[1.0,0.30000000000000004,5e-162]}'
    expect(canonicalJson(parseStrictJson(original))).toBe(original)
  })

  it('rejects prototype-pollution keys', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(() => parseStrictJson(`{"${key}": {}}`)).toThrowError(/forbidden object key/)
      expect(() => parseStrictJson(`{"outer": {"${key}": 1}}`)).toThrowError(/forbidden object key/)
    }
  })

  it('rejects duplicate keys', () => {
    expect(() => parseStrictJson('{"a": 1, "a": 2}')).toThrowError(/duplicate object key/)
  })

  it('rejects nesting deeper than the limit', () => {
    const deep = '['.repeat(33) + ']'.repeat(33)
    expect(() => parseStrictJson(deep)).toThrowError(/depth/)
    const ok = '['.repeat(32) + ']'.repeat(32)
    expect(() => parseStrictJson(ok)).not.toThrow()
  })

  it('rejects non-finite literals and trailing garbage', () => {
    expect(() => parseStrictJson('NaN')).toThrowError(ValueError)
    expect(() => parseStrictJson('Infinity')).toThrowError(ValueError)
    expect(() => parseStrictJson('{"a": 1} extra')).toThrowError(/trailing/)
    expect(() => parseStrictJson('{"a": 1,}')).toThrowError(ValueError)
    expect(() => parseStrictJson("'single'")).toThrowError(ValueError)
  })

  it('rejects unsafe integers', () => {
    expect(() => parseStrictJson('9007199254740993')).toThrowError(/safe integer/)
  })
})
