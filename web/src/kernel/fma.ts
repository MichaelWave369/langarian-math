/**
 * Exact-arithmetic floating-point helpers (BigInt backed).
 *
 * JavaScript lacks Math.fma and its Math.hypot is engine-dependent, so the
 * conformance kernel implements both deterministically:
 *
 * - fma(a, b, c): IEEE-754 fused multiply-add, computed exactly with BigInt
 *   and rounded once. This reproduces the FMA-contracted arithmetic of the
 *   NumPy/OpenBLAS reference kernel bit-for-bit.
 * - npyHypot(a, b): the reference kernel's component magnitude algorithm,
 *   mx * sqrt(fma(mn/mx, mn/mx, 1)) with mx = max(|a|, |b|), which is what
 *   np.abs uses for complex values. Bit-exact with the reference on the
 *   conformance fixture corpus.
 */

const FLOAT_BITS = new DataView(new ArrayBuffer(8))

interface Decomposed {
  /** sign multiplier: +1n or -1n */
  sign: bigint
  /** positive integer mantissa; value = sign * mant * 2^exp */
  mant: bigint
  exp: number
}

/** Decompose a finite double into sign * mant * 2^exp with integer mant. */
function decompose(x: number): Decomposed {
  FLOAT_BITS.setFloat64(0, x, true)
  const bits = FLOAT_BITS.getBigUint64(0, true)
  const sign = bits >> 63n === 0n ? 1n : -1n
  const expField = Number((bits >> 52n) & 0x7ffn)
  const frac = bits & 0xfffffffffffffn
  if (expField === 0) {
    // subnormal (or zero): value = frac * 2^-1074
    return { sign, mant: frac, exp: -1074 }
  }
  return { sign, mant: frac | 0x10000000000000n, exp: expField - 1075 }
}

function bitLength(x: bigint): number {
  return x.toString(2).length
}

/** Construct a double from its raw bit pattern. */
function fromBits(bits: bigint): number {
  FLOAT_BITS.setBigUint64(0, bits, true)
  return FLOAT_BITS.getFloat64(0, true)
}

/**
 * Round sign * mag * 2^exp (mag a positive BigInt) to the nearest double,
 * ties to even, with correct subnormal/overflow behavior.
 */
function roundMantExp(negative: boolean, mag: bigint, exp: number): number {
  if (mag === 0n) return negative ? -0 : 0
  let bl = bitLength(mag)
  if (bl > 53) {
    const drop = bl - 53
    const restMask = (1n << BigInt(drop)) - 1n
    const half = 1n << BigInt(drop - 1)
    const rest = mag & restMask
    mag >>= BigInt(drop)
    if (rest > half || (rest === half && (mag & 1n) === 1n)) mag += 1n
    exp += drop
    if (bitLength(mag) === 54) {
      mag >>= 1n
      exp += 1
    }
    bl = 53
  }
  // value = mag * 2^exp with mag having bl <= 53 bits.
  const shift = 53 - bl
  const normalized = mag << BigInt(shift)
  const expField = exp - shift + 1075
  const signBit = negative ? 1n << 63n : 0n
  if (expField >= 2047) {
    return negative ? -Infinity : Infinity
  }
  if (expField >= 1) {
    return fromBits(signBit | (BigInt(expField) << 52n) | (normalized & 0xfffffffffffffn))
  }
  // Subnormal or underflow: value = mag * 2^exp; quantum is 2^-1074.
  const up = exp + 1074
  let q: bigint
  if (up >= 0) {
    q = mag << BigInt(up)
  } else {
    const drop = -up
    const restMask = (1n << BigInt(drop)) - 1n
    const half = 1n << BigInt(drop - 1)
    const rest = mag & restMask
    q = mag >> BigInt(drop)
    if (rest > half || (rest === half && (q & 1n) === 1n)) q += 1n
  }
  if (q === 0n) return negative ? -0 : 0
  if (q >= 0x10000000000000n) {
    // Rounded up into the normal range.
    return fromBits(signBit | (q & 0xfffffffffffffn) | (1n << 52n))
  }
  return fromBits(signBit | q)
}

/**
 * IEEE-754 fused multiply-add: round(a * b + c) with a single rounding.
 * Bit-exact for all finite inputs; falls back to IEEE arithmetic when any
 * input is non-finite.
 */
export function fma(a: number, b: number, c: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
    return a * b + c
  }
  const da = decompose(a)
  const db = decompose(b)
  const dc = decompose(c)
  const productMant = da.mant * db.mant
  const productExp = da.exp + db.exp
  const productSign = da.sign * db.sign
  const e0 = Math.min(productExp, dc.exp)
  const sum =
    productSign * (productMant << BigInt(productExp - e0)) + dc.sign * (dc.mant << BigInt(dc.exp - e0))
  if (sum === 0n) return 0
  return roundMantExp(sum < 0n, sum < 0n ? -sum : sum, e0)
}

/**
 * Component magnitude |a + bi| exactly as the reference kernel computes it
 * (numpy's npy_hypot): mx * sqrt(fma(yx, yx, 1)) with yx = mn/mx. Bit-exact
 * with np.abs on complex values.
 */
export function npyHypot(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  if (a === 0 && b === 0) return 0
  const mx = a >= b ? a : b
  const mn = a >= b ? b : a
  const yx = mn / mx
  return mx * Math.sqrt(fma(yx, yx, 1))
}
