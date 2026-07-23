/**
 * Metric functions for the finite-dimensional Langarian kernel (TS mirror).
 *
 * Mirrors src/langarian/metrics.py: scale-safe normalized similarity with
 * the zero conventions C(0,0)=1, C(0,x)=0, and system coherence with
 * non-negative finite weights and diagonal self-similarities included.
 */

import { absCx, ddot, divVectorReal, padToCommonDim, vdot } from './complex.js'
import { MAX_STATES, LimitError, MetricError, ValueError } from './limits.js'
import { ResonantState } from './state.js'

export function resonance(state: ResonantState): number {
  return state.resonance
}

export function phase(state: ResonantState): number {
  return state.phase
}

/**
 * Squared normalized inner-product similarity in [0, 1]:
 * C(a, b) = |<a, b>|^2 / (||a||^2 * ||b||^2).
 *
 * Zero-state convention: C(0, 0) = 1, C(0, x) = 0 for nonzero x.
 * Scale-safety (metric:v0.3): each vector is normalized by its max component
 * magnitude before the inner product. A non-finite intermediate is an
 * explicit MetricError, never a silently clamped NaN.
 */
export function normalizedComplexSimilarity(a: ResonantState, b: ResonantState): number {
  const [av, bv] = padToCommonDim(a.vector, b.vector)
  let maxabsA = 0
  let maxabsB = 0
  for (const z of av) {
    const m = absCx(z)
    if (m > maxabsA) maxabsA = m
  }
  for (const z of bv) {
    const m = absCx(z)
    if (m > maxabsB) maxabsB = m
  }
  const aIsZero = maxabsA === 0
  const bIsZero = maxabsB === 0
  if (aIsZero && bIsZero) return 1
  if (aIsZero || bIsZero) return 0
  const sa = divVectorReal(av, maxabsA)
  const sb = divVectorReal(bv, maxabsB)
  const inner = vdot(sa, sb)
  const saRe = sa.map((z) => z.re)
  const saIm = sa.map((z) => z.im)
  const sbRe = sb.map((z) => z.re)
  const sbIm = sb.map((z) => z.im)
  const na2 = ddot(saRe, saRe) + ddot(saIm, saIm)
  const nb2 = ddot(sbRe, sbRe) + ddot(sbIm, sbIm)
  if (na2 <= 0 || nb2 <= 0) {
    throw new MetricError('scaled squared norm is non-positive for a nonzero state; refusing to clamp.')
  }
  const magnitude = absCx(inner)
  const value = (magnitude * magnitude) / (na2 * nb2)
  if (!Number.isFinite(value)) {
    throw new MetricError(`similarity intermediate is non-finite (${value}); refusing to clamp NaN/inf.`)
  }
  return Math.min(1, Math.max(0, value))
}

/**
 * Average pairwise coherence for a finite state system. The diagonal
 * self-similarities ARE included in the weighted average. Weights must be
 * finite and non-negative.
 */
export function systemCoherence(states: readonly ResonantState[], weights?: readonly (readonly number[])[]): number {
  const n = states.length
  if (n === 0) {
    throw new ValueError('system_coherence requires at least one state.')
  }
  if (n > MAX_STATES) {
    throw new LimitError(`system_coherence received ${n} states; limit is MAX_STATES=${MAX_STATES}.`)
  }
  const w: number[][] =
    weights === undefined
      ? Array.from({ length: n }, () => Array.from({ length: n }, () => 1))
      : weights.map((row) => row.slice())
  if (w.length !== n || w.some((row) => row.length !== n)) {
    throw new ValueError('weights must have shape (n, n).')
  }
  for (const row of w) {
    for (const weight of row) {
      if (!Number.isFinite(weight)) {
        throw new ValueError('weights must be finite.')
      }
      if (weight < 0) {
        throw new ValueError(
          'weights must be non-negative; negative weights are not meaningful for coherence averaging.',
        )
      }
    }
  }
  let total = 0
  let weightTotal = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const weight = w[i]![j]!
      total += normalizedComplexSimilarity(states[i]!, states[j]!) * weight
      weightTotal += weight
    }
  }
  if (weightTotal === 0) {
    throw new ValueError('weights must not sum to zero.')
  }
  const result = total / weightTotal
  if (!Number.isFinite(result)) {
    throw new MetricError(`system_coherence produced a non-finite value (${result}).`)
  }
  return result
}
