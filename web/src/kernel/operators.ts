/**
 * Executable operators for the v0.3 finite-dimensional kernel (TS mirror).
 *
 * Mirrors src/langarian/operators.py: harmonic_sum, phase_shift,
 * attenuated_phase_shift, phi_scale, bridge. Receipts, invariants, and
 * claim texts match the Python kernel byte-for-byte.
 */

import { PyFloat } from './canonical.js'
import { padToCommonDim, scaleVectorCx, scaleVectorReal, type Cx } from './complex.js'
import {
  accountedChange,
  coherenceBound,
  interpretationQuarantine,
  phaseEquivariance,
  traceInputsRecorded,
  wellTypedState,
  type InvariantResult,
} from './contracts.js'
import { MAX_PHI_SCALE_POWER, LangarianTypeError, LimitError, ValueError } from './limits.js'
import { normalizedComplexSimilarity, systemCoherence } from './metrics.js'
import { claim, OperationReceipt } from './receipts.js'
import { ResonantState } from './state.js'

export const PHI = (1 + Math.sqrt(5)) / 2
/** Golden-angle increment: 2*pi/phi (reflex of 2*pi/phi^2). */
export const GOLDEN_ANGLE = (2 * Math.PI) / PHI

function finiteParameter(name: string, value: number): number {
  if (typeof value !== 'number') {
    throw new LangarianTypeError(`${name} must be a real number; got ${String(value)}.`)
  }
  if (!Number.isFinite(value)) {
    throw new ValueError(`${name} must be finite (no NaN/Infinity); got ${value}.`)
  }
  return value
}

function integerParameter(name: string, value: number | boolean): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ValueError(`${name} must be finite (no NaN/Infinity); got ${value}.`)
    }
    if (!Number.isInteger(value)) {
      throw new LangarianTypeError(`${name} must be an integer; got non-integral value ${value}.`)
    }
    return value
  }
  throw new LangarianTypeError(`${name} must be an integer; got ${typeof value}.`)
}

export interface OperationResult {
  output: ResonantState
  receipt: OperationReceipt
}

export interface BridgeResult {
  source: ResonantState
  target: ResonantState
  coherence: number
  cost: number
  receipt: OperationReceipt
}

interface OperatorOptions {
  glyph?: string | null
  label?: string | null
  timestampUtc?: string
}

/** Python `a or b` semantics for nullable strings (None/empty -> fallback). */
function pyOr(a: string | null, b: string | null): string | null {
  return a !== null && a !== '' ? a : b
}

/** Python str() of a nullable string. */
function pyStr(value: string | null): string {
  return value === null ? 'None' : value
}

function finalizeOutput(output: ResonantState, receipt: OperationReceipt): ResonantState {
  return output.withHistory(receipt.receiptId())
}

export function harmonicSum(a: ResonantState, b: ResonantState, options: OperatorOptions = {}): OperationResult {
  const [av, bv] = padToCommonDim(a.vector, b.vector)
  const vector: Cx[] = av.map((z, i) => ({ re: z.re + bv[i]!.re, im: z.im + bv[i]!.im }))
  const outputGlyph =
    options.glyph || `(${a.glyph ?? '∅'}⊕${b.glyph ?? '∅'})`
  const outputLabel =
    options.label || `harmonic_sum(${pyStr(pyOr(a.label, a.glyph))},${pyStr(pyOr(b.label, b.glyph))})`
  const output = new ResonantState(vector, {
    glyph: outputGlyph,
    label: outputLabel,
    metadata: { operator: 'harmonic_sum', source_hashes: [a.stateHash(), b.stateHash()] },
  })
  const before = normalizedComplexSimilarity(a, b)
  // NOTE: delta compares pairwise similarity of the inputs (before) to the
  // average pairwise similarity of the augmented 3-state system (after).
  const after = systemCoherence([a, b, output])
  const invariants: InvariantResult[] = [
    wellTypedState(a),
    wellTypedState(b),
    wellTypedState(output),
    coherenceBound(before),
    coherenceBound(after),
    accountedChange(
      output.resonance - Math.max(a.resonance, b.resonance),
      after - before,
      'harmonic recomposition may reduce pairwise similarity',
    ),
    traceInputsRecorded([a.stateHash(), b.stateHash()], output.history, output.metadata.source_hashes as string[]),
    interpretationQuarantine(['COMPUTED']),
  ]
  const receipt = new OperationReceipt({
    operator: 'harmonic_sum',
    inputHashes: [a.stateHash(), b.stateHash()],
    outputHash: output.stateHash(),
    parameters: { glyph: output.glyph },
    coherenceBefore: before,
    coherenceAfter: after,
    invariantResults: invariants,
    epistemicTag: 'COMPUTED',
    claims: [claim('Harmonic sum computed by finite complex vector addition.', 'COMPUTED')],
    ...(options.timestampUtc !== undefined ? { timestampUtc: options.timestampUtc } : {}),
  })
  return { output: finalizeOutput(output, receipt), receipt }
}

export function phaseShift(
  state: ResonantState,
  angleRadians: number,
  options: OperatorOptions = {},
): OperationResult {
  const angle = finiteParameter('angle_radians', angleRadians)
  const scalar = { re: Math.cos(angle), im: Math.sin(angle) }
  const output = new ResonantState(scaleVectorCx(state.vector, scalar), {
    glyph: state.glyph,
    label: options.label || `phase_shift(${pyStr(pyOr(state.label, state.glyph))})`,
    metadata: {
      operator: 'phase_shift',
      angle_radians: new PyFloat(angle),
      source_hashes: [state.stateHash()],
    },
  })
  const before = normalizedComplexSimilarity(state, state)
  const after = normalizedComplexSimilarity(state, output)
  const invariants: InvariantResult[] = [
    wellTypedState(state),
    wellTypedState(output),
    coherenceBound(before),
    coherenceBound(after),
    phaseEquivariance(state.resonance, output.resonance),
    traceInputsRecorded([state.stateHash()], output.history, output.metadata.source_hashes as string[]),
    interpretationQuarantine(['COMPUTED']),
  ]
  const receipt = new OperationReceipt({
    operator: 'phase_shift',
    inputHashes: [state.stateHash()],
    outputHash: output.stateHash(),
    parameters: { angle_radians: new PyFloat(angle) },
    coherenceBefore: before,
    coherenceAfter: after,
    invariantResults: invariants,
    epistemicTag: 'COMPUTED',
    claims: [
      claim(
        'Pure phase shift preserved resonance in this operation instance under the v0.2 finite vector model.',
        'COMPUTED',
      ),
    ],
    ...(options.timestampUtc !== undefined ? { timestampUtc: options.timestampUtc } : {}),
  })
  return { output: finalizeOutput(output, receipt), receipt }
}

export interface AttenuatedOptions extends OperatorOptions {
  costLabel: string | null
}

/**
 * Phase rotation with explicit attenuation and cost accounting.
 * `attenuation` is any finite non-negative scale; values > 1 amplify and
 * pass I3 without a cost declaration (I3 is a label-presence gate for
 * decreases only).
 */
export function attenuatedPhaseShift(
  state: ResonantState,
  angleRadians: number,
  attenuation: number,
  options: AttenuatedOptions,
): OperationResult {
  const angle = finiteParameter('angle_radians', angleRadians)
  const att = finiteParameter('attenuation', attenuation)
  if (att < 0) {
    throw new ValueError('attenuation must be non-negative.')
  }
  const scalar = { re: att * Math.cos(angle), im: att * Math.sin(angle) }
  const output = new ResonantState(scaleVectorCx(state.vector, scalar), {
    glyph: state.glyph,
    label: options.label || `attenuated_phase_shift(${pyStr(pyOr(state.label, state.glyph))})`,
    metadata: {
      operator: 'attenuated_phase_shift',
      angle_radians: new PyFloat(angle),
      attenuation: new PyFloat(att),
      declared_cost: options.costLabel,
      source_hashes: [state.stateHash()],
    },
  })
  const before = normalizedComplexSimilarity(state, state)
  const after = normalizedComplexSimilarity(state, output)
  const invariants: InvariantResult[] = [
    wellTypedState(state),
    wellTypedState(output),
    coherenceBound(before),
    coherenceBound(after),
    accountedChange(output.resonance - state.resonance, after - before, options.costLabel),
    traceInputsRecorded([state.stateHash()], output.history, output.metadata.source_hashes as string[]),
    interpretationQuarantine(['COMPUTED']),
  ]
  const receipt = new OperationReceipt({
    operator: 'attenuated_phase_shift',
    inputHashes: [state.stateHash()],
    outputHash: output.stateHash(),
    parameters: {
      angle_radians: new PyFloat(angle),
      attenuation: new PyFloat(att),
      declared_cost: options.costLabel,
    },
    coherenceBefore: before,
    coherenceAfter: after,
    invariantResults: invariants,
    epistemicTag: 'COMPUTED',
    claims: [claim('Attenuated phase shift computed with declared cost accounting.', 'COMPUTED')],
    ...(options.timestampUtc !== undefined ? { timestampUtc: options.timestampUtc } : {}),
  })
  return { output: finalizeOutput(output, receipt), receipt }
}

/**
 * Scale resonance by Phi^n and advance phase by n golden angles. n must be
 * an integer with |n| <= MAX_PHI_SCALE_POWER; non-integral or out-of-range
 * exponents are typed errors, never silent truncation.
 */
export function phiScale(state: ResonantState, n: number | boolean = 1, options: OperatorOptions = {}): OperationResult {
  const power = integerParameter('n', n)
  if (Math.abs(power) > MAX_PHI_SCALE_POWER) {
    throw new LimitError(`|n|=${Math.abs(power)} exceeds MAX_PHI_SCALE_POWER=${MAX_PHI_SCALE_POWER}.`)
  }
  const scale = Math.pow(PHI, power)
  const angle = power * GOLDEN_ANGLE
  const scalar = { re: Math.cos(angle), im: Math.sin(angle) }
  const output = new ResonantState(scaleVectorCx(scaleVectorReal(state.vector, scale), scalar), {
    glyph: state.glyph,
    label: options.label || `phi_scale(${pyStr(pyOr(state.label, state.glyph))},${power})`,
    metadata: { operator: 'phi_scale', n: power, source_hashes: [state.stateHash()] },
  })
  const before = normalizedComplexSimilarity(state, state)
  const after = normalizedComplexSimilarity(state, output)
  const invariants: InvariantResult[] = [
    wellTypedState(state),
    wellTypedState(output),
    coherenceBound(before),
    coherenceBound(after),
    accountedChange(output.resonance - state.resonance, after - before),
    traceInputsRecorded([state.stateHash()], output.history, output.metadata.source_hashes as string[]),
    interpretationQuarantine(['COMPUTED']),
  ]
  const receipt = new OperationReceipt({
    operator: 'phi_scale',
    inputHashes: [state.stateHash()],
    outputHash: output.stateHash(),
    parameters: { n: power, phi: new PyFloat(PHI), golden_angle_radians: new PyFloat(GOLDEN_ANGLE) },
    coherenceBefore: before,
    coherenceAfter: after,
    invariantResults: invariants,
    epistemicTag: 'COMPUTED',
    claims: [claim('Phi scaling applied as scalar dilation plus golden-angle phase advance.', 'COMPUTED')],
    ...(options.timestampUtc !== undefined ? { timestampUtc: options.timestampUtc } : {}),
  })
  return { output: finalizeOutput(output, receipt), receipt }
}

export interface BridgeOptions {
  cost?: number
  label?: string | null
  timestampUtc?: string
}

/**
 * Create a typed bridge/path receipt from source to target. Records a
 * transition candidate with coherence, cost, and invariant status; not a
 * category-theoretic naturality claim.
 */
export function bridge(source: ResonantState, target: ResonantState, options: BridgeOptions = {}): BridgeResult {
  const declaredCost = finiteParameter('cost', options.cost ?? 0)
  const coh = normalizedComplexSimilarity(source, target)
  const inputHashes = [source.stateHash(), target.stateHash()]
  const invariants: InvariantResult[] = [
    wellTypedState(source),
    wellTypedState(target),
    coherenceBound(coh),
    traceInputsRecorded(inputHashes, target.history, inputHashes),
    interpretationQuarantine(['COMPUTED']),
  ]
  const receipt = new OperationReceipt({
    operator: 'bridge',
    inputHashes,
    outputHash: target.stateHash(),
    parameters: { cost: new PyFloat(declaredCost), label: options.label ?? null },
    coherenceBefore: null,
    coherenceAfter: coh,
    invariantResults: invariants,
    epistemicTag: 'COMPUTED',
    claims: [
      claim('Bridge candidate recorded as a typed transition/path, not a category-theoretic proof.', 'COMPUTED'),
    ],
    ...(options.timestampUtc !== undefined ? { timestampUtc: options.timestampUtc } : {}),
  })
  return { source, target, coherence: coh, cost: declaredCost, receipt }
}
