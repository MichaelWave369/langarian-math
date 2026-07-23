/**
 * Complex number helpers for the v0.3 kernel mirror.
 *
 * Representation: { re: number, im: number }. The arithmetic replicates the
 * exact floating-point behavior of the NumPy reference kernel:
 *
 * - Complex multiplication uses the FMA-contracted form emitted by the
 *   reference build: re = fma(ar, br, -(ai*bi)), im = fma(ar, bi, ai*br).
 * - Division of a vector by a real scalar uses the reference reciprocal
 *   optimization: each part is multiplied by fl(1/s).
 * - Complex dot products accumulate with chained FMAs, matching the
 *   reference dot kernels on the conformance fixture corpus.
 */

import { fma, npyHypot } from './fma.js'

export interface Cx {
  re: number
  im: number
}

export const cx = (re: number, im: number): Cx => ({ re, im })

/** FMA-contracted complex multiply (matches the NumPy array-path kernel). */
export function mulCx(a: Cx, b: Cx): Cx {
  return {
    re: fma(a.re, b.re, -(a.im * b.im)),
    im: fma(a.re, b.im, a.im * b.re),
  }
}

export function addCx(a: Cx, b: Cx): Cx {
  return { re: a.re + b.re, im: a.im + b.im }
}

/** Multiply each component by a real scalar (plain per-part multiply). */
export function scaleVectorReal(v: readonly Cx[], s: number): Cx[] {
  return v.map((z) => ({ re: z.re * s, im: z.im * s }))
}

/**
 * Divide a vector by a real scalar. The reference kernel multiplies by the
 * reciprocal fl(1/s) rather than performing per-part division.
 */
export function divVectorReal(v: readonly Cx[], s: number): Cx[] {
  const r = 1 / s
  return v.map((z) => ({ re: z.re * r, im: z.im * r }))
}

/** Multiply every component by a complex scalar (FMA-contracted). */
export function scaleVectorCx(v: readonly Cx[], s: Cx): Cx[] {
  return v.map((z) => mulCx(z, s))
}

/** |z| exactly as np.abs computes it (npy_hypot). */
export function absCx(z: Cx): number {
  return npyHypot(z.re, z.im)
}

/** Complex inner product <a, b> = sum(conj(a_i) * b_i), FMA-chained. */
export function vdot(a: readonly Cx[], b: readonly Cx[]): Cx {
  let re = 0
  let im = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    re = fma(x.re, y.re, re)
    re = fma(x.im, y.im, re)
    im = fma(x.re, y.im, im)
    im = fma(-x.im, y.re, im)
  }
  return { re, im }
}

/** Real dot product, FMA-chained (matches the reference ddot kernel). */
export function ddot(x: readonly number[], y: readonly number[]): number {
  let acc = 0
  for (let i = 0; i < x.length; i++) {
    acc = fma(x[i]!, y[i]!, acc)
  }
  return acc
}

/** Pad two vectors to a common dimension with trailing zeros. */
export function padToCommonDim(a: readonly Cx[], b: readonly Cx[]): [Cx[], Cx[]] {
  const dim = Math.max(a.length, b.length)
  const pad = (v: readonly Cx[]): Cx[] => {
    const out = v.slice()
    while (out.length < dim) out.push({ re: 0, im: 0 })
    return out
  }
  return [pad(a), pad(b)]
}
