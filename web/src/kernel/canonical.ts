/**
 * Canonical JSON per SPEC section 3.10, byte-compatible with the Python
 * kernel's json.dumps(data, sort_keys=True, separators=(",", ":"),
 * ensure_ascii=False):
 *
 * - Object keys sorted (by code point), tight "," / ":" separators.
 * - Floats use CPython shortest-repr semantics: integral floats keep ".0",
 *   exponent form "e±NN" with zero-padded 2-digit exponent, fixed notation
 *   for -4 < decimal point position <= 16.
 * - -0.0 normalizes to 0.0. Non-finite floats are rejected with a typed
 *   error and never emitted.
 *
 * Because JavaScript cannot distinguish int 2 from float 2.0, floats are
 * boxed in PyFloat; plain numbers serialize as JSON integers.
 *
 * The strict parser additionally enforces import safety: it rejects
 * __proto__/constructor/prototype keys, duplicate keys, nesting deeper than
 * MAX_AST_DEPTH, and non-finite literals.
 */

import { MAX_AST_DEPTH, ValueError } from './limits.js'

/** Boxed Python float so canonicalization can emit CPython float repr. */
export class PyFloat {
  readonly value: number

  constructor(value: number) {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new ValueError('PyFloat requires a finite number (no NaN/Infinity).')
    }
    // Normalize -0.0 to 0.0 at boxing time.
    this.value = value === 0 ? 0 : value
  }
}

export const pyFloat = (value: number): PyFloat => new PyFloat(value)

export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | PyFloat
  | CanonicalValue[]
  | { [key: string]: CanonicalValue }

/** Extract shortest round-trip digits and decimal point position. */
function shortestDigits(x: number): { digits: string; decpt: number } {
  const s = x.toString()
  let mant = s
  let e = 0
  const ei = s.indexOf('e')
  if (ei >= 0) {
    e = Number(s.slice(ei + 1))
    mant = s.slice(0, ei)
  }
  const dot = mant.indexOf('.')
  const intPart = dot < 0 ? mant : mant.slice(0, dot)
  const fracPart = dot < 0 ? '' : mant.slice(dot + 1)
  let digits = intPart + fracPart
  let decpt = e + intPart.length
  let leading = 0
  while (leading < digits.length && digits[leading] === '0') leading++
  digits = digits.slice(leading)
  decpt -= leading
  digits = digits.replace(/0+$/, '')
  return { digits, decpt }
}

/**
 * CPython repr() for a finite float. Matches Python's shortest-round-trip
 * formatting exactly, including ".0" on integral floats and the zero-padded
 * two-digit exponent.
 */
export function reprFloat(x: number): string {
  if (Number.isNaN(x)) {
    throw new ValueError('non-finite float (NaN) cannot be canonically serialized.')
  }
  if (!Number.isFinite(x)) {
    throw new ValueError('non-finite float (Infinity) cannot be canonically serialized.')
  }
  if (x === 0) return '0.0' // normalizes -0.0
  const negative = x < 0
  const { digits, decpt } = shortestDigits(Math.abs(x))
  let body: string
  if (decpt <= -4 || decpt > 16) {
    const exponent = decpt - 1
    const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits
    const sign = exponent < 0 ? '-' : '+'
    body = `${mantissa}e${sign}${String(Math.abs(exponent)).padStart(2, '0')}`
  } else if (decpt <= 0) {
    body = `0.${'0'.repeat(-decpt)}${digits}`
  } else if (decpt >= digits.length) {
    body = `${digits}${'0'.repeat(decpt - digits.length)}.0`
  } else {
    body = `${digits.slice(0, decpt)}.${digits.slice(decpt)}`
  }
  return negative ? `-${body}` : body
}

/** JSON string escaping identical to Python json with ensure_ascii=False. */
export function escapeJsonString(value: string): string {
  let out = '"'
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    switch (ch) {
      case '"':
        out += '\\"'
        break
      case '\\':
        out += '\\\\'
        break
      case '\b':
        out += '\\b'
        break
      case '\f':
        out += '\\f'
        break
      case '\n':
        out += '\\n'
        break
      case '\r':
        out += '\\r'
        break
      case '\t':
        out += '\\t'
        break
      default:
        if (code < 0x20) {
          out += `\\u${code.toString(16).padStart(4, '0')}`
        } else {
          out += ch
        }
    }
  }
  return out + '"'
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Compare two strings by Unicode code point (Python's sort order). */
function codePointCompare(a: string, b: string): number {
  const ai = Array.from(a)
  const bi = Array.from(b)
  const n = Math.min(ai.length, bi.length)
  for (let i = 0; i < n; i++) {
    const ac = ai[i]!.codePointAt(0)!
    const bc = bi[i]!.codePointAt(0)!
    if (ac !== bc) return ac - bc
  }
  return ai.length - bi.length
}

/** Serialize a CanonicalValue to canonical JSON (SPEC section 3.10). */
export function canonicalJson(value: CanonicalValue): string {
  if (value === null) return 'null'
  if (value instanceof PyFloat) return reprFloat(value.value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new ValueError(
        `plain number ${value} is not a safe integer; box floats with PyFloat before canonicalizing.`,
      )
    }
    return String(value)
  }
  if (typeof value === 'string') return escapeJsonString(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort(codePointCompare)
    const entries = keys.map((key) => `${escapeJsonString(key)}:${canonicalJson(value[key]!)}`)
    return `{${entries.join(',')}}`
  }
  throw new ValueError(`unsupported value for canonical JSON: ${String(value)}`)
}

/** UTF-8 byte length of a string. */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

/**
 * Strict JSON parser for imported receipts/programs.
 *
 * Beyond RFC 8259 strictness it rejects duplicate object keys,
 * __proto__/constructor/prototype keys (prototype-pollution safe), nesting
 * deeper than maxDepth, non-safe integers, and non-finite literals. Numbers
 * written with float syntax (".", "e", "E") are boxed as PyFloat so that
 * re-canonicalization reproduces CPython float formatting byte-exactly.
 */
export function parseStrictJson(text: string, maxDepth: number = MAX_AST_DEPTH): CanonicalValue {
  let pos = 0

  const fail = (message: string): never => {
    throw new ValueError(`invalid JSON at offset ${pos}: ${message}`)
  }

  const peek = (): string => text[pos] ?? ''

  function skipWhitespace(): void {
    while (pos < text.length && (text[pos] === ' ' || text[pos] === '\t' || text[pos] === '\n' || text[pos] === '\r')) {
      pos++
    }
  }

  function parseValue(depth: number): CanonicalValue {
    if (depth > maxDepth) fail(`nesting depth exceeds ${maxDepth}`)
    skipWhitespace()
    const ch = peek()
    if (ch === '{') return parseObject(depth)
    if (ch === '[') return parseArray(depth)
    if (ch === '"') return parseString()
    if (ch === 't') {
      expectLiteral('true')
      return true
    }
    if (ch === 'f') {
      expectLiteral('false')
      return false
    }
    if (ch === 'n') {
      expectLiteral('null')
      return null
    }
    if (ch === 'N' || ch === 'I') fail('non-finite literals (NaN/Infinity) are not valid JSON')
    return parseNumber()
  }

  function expectLiteral(literal: string): void {
    if (text.slice(pos, pos + literal.length) !== literal) fail(`expected ${literal}`)
    pos += literal.length
  }

  function parseObject(depth: number): CanonicalValue {
    const obj: { [key: string]: CanonicalValue } = {}
    pos++ // consume '{'
    skipWhitespace()
    if (peek() === '}') {
      pos++
      return obj
    }
    for (;;) {
      skipWhitespace()
      if (peek() !== '"') fail('object keys must be strings')
      const key = parseString()
      if (FORBIDDEN_KEYS.has(key)) fail(`forbidden object key ${JSON.stringify(key)}`)
      if (Object.prototype.hasOwnProperty.call(obj, key)) fail(`duplicate object key ${JSON.stringify(key)}`)
      skipWhitespace()
      if (peek() !== ':') fail("expected ':'")
      pos++
      obj[key] = parseValue(depth + 1)
      skipWhitespace()
      const ch = peek()
      if (ch === ',') {
        pos++
        continue
      }
      if (ch === '}') {
        pos++
        return obj
      }
      fail("expected ',' or '}'")
    }
  }

  function parseArray(depth: number): CanonicalValue {
    const arr: CanonicalValue[] = []
    pos++ // consume '['
    skipWhitespace()
    if (peek() === ']') {
      pos++
      return arr
    }
    for (;;) {
      arr.push(parseValue(depth + 1))
      skipWhitespace()
      const ch = peek()
      if (ch === ',') {
        pos++
        continue
      }
      if (ch === ']') {
        pos++
        return arr
      }
      fail("expected ',' or ']'")
    }
  }

  function parseString(): string {
    pos++ // consume opening quote
    let out = ''
    for (;;) {
      if (pos >= text.length) fail('unterminated string')
      const ch = text[pos]!
      if (ch === '"') {
        pos++
        return out
      }
      if (ch === '\\') {
        pos++
        const esc = text[pos]
        switch (esc) {
          case '"':
            out += '"'
            break
          case '\\':
            out += '\\'
            break
          case '/':
            out += '/'
            break
          case 'b':
            out += '\b'
            break
          case 'f':
            out += '\f'
            break
          case 'n':
            out += '\n'
            break
          case 'r':
            out += '\r'
            break
          case 't':
            out += '\t'
            break
          case 'u': {
            const hex = text.slice(pos + 1, pos + 5)
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('invalid \\u escape')
            const first = parseInt(hex, 16)
            pos += 5
            if (first >= 0xd800 && first <= 0xdbff && text[pos] === '\\' && text[pos + 1] === 'u') {
              const hex2 = text.slice(pos + 2, pos + 6)
              if (/^[0-9a-fA-F]{4}$/.test(hex2)) {
                const second = parseInt(hex2, 16)
                if (second >= 0xdc00 && second <= 0xdfff) {
                  out += String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00))
                  pos += 6
                  break
                }
              }
            }
            out += String.fromCharCode(first)
            pos-- // compensate the pos++ below
            break
          }
          default:
            fail(`invalid escape '\\${esc ?? ''}'`)
        }
        pos++
        continue
      }
      const code = ch.codePointAt(0)!
      if (code < 0x20) fail('unescaped control character in string')
      out += ch
      pos++
    }
  }

  function parseNumber(): CanonicalValue {
    const start = pos
    if (peek() === '-') pos++
    if (peek() === '0') {
      pos++
    } else if (/[1-9]/.test(peek())) {
      while (/[0-9]/.test(peek())) pos++
    } else {
      fail('invalid number')
    }
    let isFloat = false
    if (peek() === '.') {
      isFloat = true
      pos++
      if (!/[0-9]/.test(peek())) fail('invalid number: missing digits after decimal point')
      while (/[0-9]/.test(peek())) pos++
    }
    if (peek() === 'e' || peek() === 'E') {
      isFloat = true
      pos++
      if (peek() === '+' || peek() === '-') pos++
      if (!/[0-9]/.test(peek())) fail('invalid number: missing exponent digits')
      while (/[0-9]/.test(peek())) pos++
    }
    const token = text.slice(start, pos)
    const value = Number(token)
    if (isFloat) {
      return new PyFloat(value)
    }
    if (!Number.isSafeInteger(value)) {
      fail(`integer ${token} is outside the safe integer range`)
    }
    return value
  }

  const result = parseValue(1)
  skipWhitespace()
  if (pos !== text.length) fail('trailing characters after JSON value')
  return result
}
