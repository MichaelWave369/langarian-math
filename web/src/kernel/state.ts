/**
 * Finite complex vector states for the v0.3 kernel mirror.
 *
 * Mirror of src/langarian/state.py: the vector is the formal object;
 * resonance, phase, and state_hash are derived from it. States are
 * immutable: construction takes defensive deep copies and all exposed
 * structures are frozen, so mutating a state after receipt emission throws
 * instead of silently invalidating recorded hashes.
 */

import { canonicalJson, PyFloat, utf8ByteLength, type CanonicalValue } from './canonical.js'
import { absCx, ddot, divVectorReal, type Cx } from './complex.js'
import { sha256Prefixed } from './sha256.js'
import {
  MAX_DIM,
  MAX_GLYPH_CHARS,
  MAX_LABEL_CHARS,
  MAX_METADATA_BYTES,
  LangarianTypeError,
  LimitError,
  ValueError,
} from './limits.js'
import { KERNEL_VERSION } from './version.js'

const TWO_PI = 2 * Math.PI

export interface ResonantStateInit {
  glyph?: string | null
  label?: string | null
  metadata?: Record<string, CanonicalValue>
  history?: readonly string[]
}

function typenameOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * Deep-copy metadata into a frozen JSON-safe structure. Plain numbers:
 * non-finite raises ValueError (mirrors the Python finite check); safe
 * integers stay integers; other finite numbers are boxed as PyFloat (mirrors
 * Python floats). Unsupported types raise TypeError.
 */
function normalizeMetadataValue(value: CanonicalValue, path: string): CanonicalValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof PyFloat) {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ValueError(`metadata value at ${path} must be finite (no NaN/Infinity).`)
    }
    if (Number.isSafeInteger(value)) {
      return value
    }
    return new PyFloat(value)
  }
  if (Array.isArray(value)) {
    const copy = value.map((item, index) => normalizeMetadataValue(item, `${path}[${index}]`))
    return Object.freeze(copy) as CanonicalValue[]
  }
  if (typeof value === 'object') {
    const proto: unknown = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) {
      throw new LangarianTypeError(
        `metadata value at ${path} has unsupported type ${typenameOf(value)}; ` +
          'metadata must be JSON-safe (str/int/float/bool/None/list/dict).',
      )
    }
    const out: { [key: string]: CanonicalValue } = {}
    for (const key of Object.keys(value)) {
      out[key] = normalizeMetadataValue(value[key]!, `${path}.${key}`)
    }
    return Object.freeze(out)
  }
  throw new LangarianTypeError(
    `metadata value at ${path} has unsupported type ${typenameOf(value)}; ` +
      'metadata must be JSON-safe (str/int/float/bool/None/list/dict).',
  )
}

function validateMetadata(metadata: Record<string, CanonicalValue>): Record<string, CanonicalValue> {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new LangarianTypeError('metadata must be a dict.')
  }
  const normalized: { [key: string]: CanonicalValue } = {}
  for (const key of Object.keys(metadata)) {
    normalized[key] = normalizeMetadataValue(metadata[key]!, key)
  }
  const size = utf8ByteLength(canonicalJson(normalized))
  if (size > MAX_METADATA_BYTES) {
    throw new LimitError(`metadata is ${size} bytes; limit is ${MAX_METADATA_BYTES}.`)
  }
  return Object.freeze(normalized)
}

export class ResonantState {
  readonly vector: readonly Cx[]
  readonly glyph: string | null
  readonly label: string | null
  readonly metadata: Readonly<Record<string, CanonicalValue>>
  readonly history: readonly string[]

  constructor(vector: readonly Cx[], init: ResonantStateInit = {}) {
    const copied = vector.map((z) => ({ re: z.re, im: z.im }))
    if (copied.length < 1) {
      throw new ValueError('State dimension must be >= 1; dim==0 states are not constructible.')
    }
    if (copied.length > MAX_DIM) {
      throw new LimitError(`State dimension ${copied.length} exceeds MAX_DIM=${MAX_DIM}.`)
    }
    for (const z of copied) {
      if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) {
        throw new ValueError('State vector must contain only finite complex values.')
      }
    }
    this.vector = Object.freeze(copied)

    const glyph = init.glyph ?? null
    if (glyph !== null) {
      if (typeof glyph !== 'string') {
        throw new LangarianTypeError('glyph must be a string or None.')
      }
      if (glyph.length > MAX_GLYPH_CHARS) {
        throw new LimitError(`glyph length ${glyph.length} exceeds MAX_GLYPH_CHARS=${MAX_GLYPH_CHARS}.`)
      }
    }
    this.glyph = glyph

    const label = init.label ?? null
    if (label !== null) {
      if (typeof label !== 'string') {
        throw new LangarianTypeError('label must be a string or None.')
      }
      if (label.length > MAX_LABEL_CHARS) {
        throw new LimitError(`label length ${label.length} exceeds MAX_LABEL_CHARS=${MAX_LABEL_CHARS}.`)
      }
    }
    this.label = label

    this.metadata = validateMetadata(init.metadata ?? {})
    this.history = Object.freeze((init.history ?? []).slice())
    Object.freeze(this)
  }

  /** Build from [[real, imag], ...] pairs (defensively copied). */
  static fromPairs(pairs: readonly (readonly [number, number])[], init: ResonantStateInit = {}): ResonantState {
    return new ResonantState(
      pairs.map(([re, im]) => ({ re, im })),
      init,
    )
  }

  get dim(): number {
    return this.vector.length
  }

  /**
   * Euclidean (l2) norm, computed scale-safely: the vector is normalized by
   * its max component magnitude (via the reference reciprocal-multiply) and
   * the norm of the scaled vector is computed with FMA-chained real dots.
   */
  get resonance(): number {
    let maxabs = 0
    for (const z of this.vector) {
      const m = absCx(z)
      if (m > maxabs) maxabs = m
    }
    if (maxabs === 0) return 0
    const scaled = divVectorReal(this.vector, maxabs)
    const reParts = scaled.map((z) => z.re)
    const imParts = scaled.map((z) => z.im)
    return maxabs * Math.sqrt(ddot(reParts, reParts) + ddot(imParts, imParts))
  }

  /**
   * Global phase convention in radians. For the zero vector, phase is
   * defined as 0. Deterministic statistic of the chosen representative, not
   * an invariant of the projective class.
   */
  get phase(): number {
    if (this.resonance === 0) return 0
    let totalRe = 0
    let totalIm = 0
    for (const z of this.vector) {
      totalRe += z.re
      totalIm += z.im
    }
    if (absCx({ re: totalRe, im: totalIm }) > 0) {
      return pythonMod(Math.atan2(totalIm, totalRe), TWO_PI)
    }
    let maxIndex = 0
    let maxValue = 0
    this.vector.forEach((z, index) => {
      const m = absCx(z)
      if (m > maxValue) {
        maxValue = m
        maxIndex = index
      }
    })
    const z = this.vector[maxIndex]!
    return pythonMod(Math.atan2(z.im, z.re), TWO_PI)
  }

  canonicalPayload(): Record<string, CanonicalValue> {
    return {
      kernel_version: KERNEL_VERSION,
      label: this.label,
      glyph: this.glyph,
      vector: this.vector.map((z) => [new PyFloat(z.re), new PyFloat(z.im)] as CanonicalValue[]),
      metadata: this.metadata as CanonicalValue,
      history: Array.from(this.history),
    }
  }

  stateHash(): string {
    return sha256Prefixed(canonicalJson(this.canonicalPayload()))
  }

  withHistory(receiptId: string): ResonantState {
    return new ResonantState(this.vector, {
      glyph: this.glyph,
      label: this.label,
      metadata: this.metadata as Record<string, CanonicalValue>,
      history: [...this.history, receiptId],
    })
  }
}

/** Python float modulo: result has the sign of the divisor. */
export function pythonMod(x: number, divisor: number): number {
  const r = x % divisor
  if (r !== 0 && Math.sign(r) !== Math.sign(divisor)) {
    return r + divisor
  }
  return r === 0 ? 0 : r
}
