/**
 * Invariant contracts for the Langarian v0.3 kernel (TS mirror).
 *
 * Mirrors src/langarian/contracts.py, including the exact invariant names,
 * statuses, and message strings that appear in hashed receipt bodies.
 */

import { PyFloat, type CanonicalValue } from './canonical.js'
import { ResonantState } from './state.js'

export type ResultStatus = 'PASS' | 'WARN' | 'FAIL'

export interface InvariantResult {
  name: string
  status: ResultStatus
  message: string
  value: CanonicalValue
  metadata: Record<string, CanonicalValue>
}

function invariant(
  name: string,
  status: ResultStatus,
  message: string,
  value: CanonicalValue = null,
  metadata: Record<string, CanonicalValue> = {},
): InvariantResult {
  return { name, status, message, value, metadata }
}

export function wellTypedState(state: ResonantState): InvariantResult {
  if (state.dim < 1) {
    return invariant('I1.well_typed_state', 'FAIL', 'State must have dimension >= 1.')
  }
  for (const z of state.vector) {
    if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) {
      return invariant('I1.well_typed_state', 'FAIL', 'State vector contains non-finite values.')
    }
  }
  return invariant('I1.well_typed_state', 'PASS', 'State is finite-dimensional and well typed.', state.dim)
}

export function coherenceBound(value: number): InvariantResult {
  if (0 <= value && value <= 1) {
    return invariant('I2.coherence_bound', 'PASS', 'Coherence is within [0, 1].', new PyFloat(value))
  }
  return invariant('I2.coherence_bound', 'FAIL', 'Coherence is outside [0, 1].', new PyFloat(value))
}

/**
 * Label-presence gate only: verifies that a decrease is accompanied by a
 * declared-cost string. It does NOT verify adequacy, magnitude, or kind of
 * the declared cost; increases are always free.
 */
export function accountedChange(
  deltaResonance: number,
  deltaCoherence: number,
  declaredCost?: string | null,
): InvariantResult {
  const value: Record<string, CanonicalValue> = {
    delta_resonance: new PyFloat(deltaResonance),
    delta_coherence: new PyFloat(deltaCoherence),
  }
  if (deltaResonance >= -1e-12 && deltaCoherence >= -1e-12) {
    return invariant('I3.accounted_change', 'PASS', 'No decrease requiring cost declaration.', value)
  }
  if (declaredCost) {
    return invariant(
      'I3.accounted_change',
      'PASS',
      'Decrease occurred with declared cost (label-presence gate only; adequacy of the cost is not verified).',
      value,
      { declared_cost: declaredCost },
    )
  }
  return invariant('I3.accounted_change', 'FAIL', 'Decrease occurred without declared cost.', value)
}

/**
 * Check that receipt input hashes exist and match recorded source hashes.
 * Emitted as I4.trace_inputs_recorded; the legacy name I4.trace_preservation
 * is kept as a compatibility alias in metadata.
 */
export function traceInputsRecorded(
  inputHashes: readonly string[],
  outputHistory?: readonly string[],
  recordedSourceHashes?: readonly string[] | null,
): InvariantResult {
  const metadata: Record<string, CanonicalValue> = {
    output_history_length: (outputHistory ?? []).length,
    legacy_name: 'I4.trace_preservation',
  }
  if (inputHashes.length === 0) {
    return invariant('I4.trace_inputs_recorded', 'FAIL', 'No input hashes recorded.', null, metadata)
  }
  if (recordedSourceHashes != null) {
    const recorded = new Set(recordedSourceHashes)
    const missing = inputHashes.filter((hash) => !recorded.has(hash))
    if (missing.length > 0) {
      return invariant(
        'I4.trace_inputs_recorded',
        'FAIL',
        'Receipt input hashes do not match the recorded source hashes.',
        Array.from(inputHashes),
        { ...metadata, mismatched_hashes: Array.from(missing) },
      )
    }
  }
  return invariant(
    'I4.trace_inputs_recorded',
    'PASS',
    'Input hashes are recorded in the operation receipt and match recorded source hashes.',
    Array.from(inputHashes),
    metadata,
  )
}

/**
 * Verifies |R_before - R_after| <= tolerance for one operation instance;
 * not a group-theoretic equivariance proof.
 */
export function phaseEquivariance(beforeResonance: number, afterResonance: number, tolerance = 1e-9): InvariantResult {
  const value: Record<string, CanonicalValue> = {
    before: new PyFloat(beforeResonance),
    after: new PyFloat(afterResonance),
  }
  if (Math.abs(beforeResonance - afterResonance) <= tolerance) {
    return invariant('I5.phase_equivariance', 'PASS', 'Pure phase rotation preserved resonance.', value)
  }
  return invariant('I5.phase_equivariance', 'FAIL', 'Pure phase rotation changed resonance.', value)
}

const FORBIDDEN_TAGS = new Set(['INTERPRETIVE', 'METAPHOR', 'OBSERVED'])

export function interpretationQuarantine(claimTags: readonly string[]): InvariantResult {
  const leaked = claimTags.filter((tag) => FORBIDDEN_TAGS.has(tag))
  if (leaked.length > 0) {
    return invariant(
      'I8.interpretation_quarantine',
      'WARN',
      'Interpretive/metaphorical/observed claims are present and must not be used as proof.',
      Array.from(leaked),
    )
  }
  return invariant(
    'I8.interpretation_quarantine',
    'PASS',
    'No interpretive/metaphorical claims used as formal proof inputs.',
    Array.from(claimTags),
  )
}

/**
 * Collapse invariant statuses into one receipt status. An empty invariant
 * list collapses to FAIL, not PASS.
 */
export function combineStatuses(statuses: readonly ResultStatus[]): ResultStatus {
  if (statuses.length === 0) return 'FAIL'
  if (statuses.includes('FAIL')) return 'FAIL'
  if (statuses.includes('WARN')) return 'WARN'
  return 'PASS'
}
