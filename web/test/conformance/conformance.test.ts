/**
 * Conformance replay of the Python-generated fixture corpus
 * (fixtures/conformance/*.json) against the TypeScript kernel.
 *
 * Contract (SPEC section 4):
 * - vector/metric values within abs 1e-12 (they are in fact bit-exact),
 * - state_hash, output hashes, receipt content_hash, receipt_id, and
 *   full-body canonical JSON byte-exact with the Python fixtures,
 * - tampered receipts produce the expected validation levels.
 *
 * Any hash mismatch is a conformance build failure, never a tolerated pass.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { canonicalJson, parseStrictJson, PyFloat, type CanonicalValue } from '../../src/kernel/canonical.js'
import {
  attenuatedPhaseShift,
  bridge,
  harmonicSum,
  phaseShift,
  phiScale,
} from '../../src/kernel/operators.js'
import { normalizedComplexSimilarity, systemCoherence } from '../../src/kernel/metrics.js'
import { OperationReceipt } from '../../src/kernel/receipts.js'
import { ResonantState } from '../../src/kernel/state.js'
import { validateReceiptData } from '../../src/kernel/validation.js'
import {
  FIXTURE_VERSION,
  KERNEL_VERSION,
  METRIC_VERSION,
  PYTHON_KERNEL_VERSION_MIRRORED,
  RECEIPT_SCHEMA_VERSION,
  TS_PORT_VERSION,
} from '../../src/kernel/version.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures', 'conformance')

type Json = Record<string, CanonicalValue>

function loadFixture(name: string): Json {
  return parseStrictJson(readFileSync(join(fixturesDir, name), 'utf8')) as Json
}

function numOf(value: CanonicalValue): number {
  if (value instanceof PyFloat) return value.value
  if (typeof value === 'number') return value
  throw new Error(`expected a numeric fixture value, got ${String(value)}`)
}

function pairsOf(value: CanonicalValue): [number, number][] {
  if (!Array.isArray(value)) throw new Error('expected a vector fixture value')
  return value.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error('expected [re, im] pairs')
    return [numOf(pair[0]!), numOf(pair[1]!)]
  })
}

function strOf(value: CanonicalValue): string {
  if (typeof value !== 'string') throw new Error(`expected a string fixture value, got ${String(value)}`)
  return value
}

function casesOf(fixture: Json): Json[] {
  return fixture.cases as Json[]
}

const TOL = 1e-12

function expectVectorClose(actual: readonly { re: number; im: number }[], expected: [number, number][]): void {
  expect(actual.length).toBe(expected.length)
  actual.forEach((z, i) => {
    expect(Math.abs(z.re - expected[i]![0])).toBeLessThanOrEqual(TOL)
    expect(Math.abs(z.im - expected[i]![1])).toBeLessThanOrEqual(TOL)
  })
}

// Input-state labels used by the Python fixture generator
// (src/langarian/fixtures.py). The op fixture inputs only carry vectors, so
// the labels that feed input state hashes are mirrored here by case name.
const CASE_INPUT_LABELS: Record<string, Record<string, string>> = {
  'op_harmonic_sum.json:basic_same_dim': { a: 'hs_a', b: 'hs_b' },
  'op_harmonic_sum.json:cross_dim_zero_padded': { a: 'cross_a', b: 'cross_b' },
  'op_phase_shift.json:rotate_pi_over_3': { state: 'mixed_2' },
  'op_phase_shift.json:zero_state': { state: 'zero_1' },
  'op_attenuated_phase_shift.json:attenuate_075_with_cost': { state: 'mixed_2' },
  'op_phi_scale.json:n_equals_2': { state: 'mixed_2' },
  'op_phi_scale.json:n_equals_0_identity': { state: 'one_1' },
  'op_bridge.json:cross_dim_bridge': { source: 'cross_a', target: 'cross_b' },
}

const CASE_OP_LABELS: Record<string, string> = {
  'op_harmonic_sum.json:basic_same_dim': 'hs_basic',
  'op_harmonic_sum.json:cross_dim_zero_padded': 'hs_cross_dim',
}

describe('version manifest mirror', () => {
  it('matches the fixture manifest and fails on divergence', () => {
    const manifest = loadFixture('manifest.json')
    expect(FIXTURE_VERSION).toBe(strOf(manifest.fixture_version!))
    expect(KERNEL_VERSION).toBe(strOf(manifest.kernel_version!))
    expect(METRIC_VERSION).toBe(strOf(manifest.metric_version!))
    expect(RECEIPT_SCHEMA_VERSION).toBe(strOf(manifest.receipt_schema_version!))
    expect(PYTHON_KERNEL_VERSION_MIRRORED).toBe(KERNEL_VERSION)
    expect(TS_PORT_VERSION).toBe('langarian-ts-port-v0.3.0')
  })
})

describe('states.json', () => {
  const fixture = loadFixture('states.json')
  for (const entry of fixture.states as Json[]) {
    const name = strOf(entry.name!)
    it(`state ${name}: dim/resonance/phase within 1e-12, state_hash byte-exact`, () => {
      const state = ResonantState.fromPairs(pairsOf(entry.vector!), { label: name })
      expect(state.dim).toBe(numOf(entry.dim!))
      expect(Math.abs(state.resonance - numOf(entry.resonance!))).toBeLessThanOrEqual(TOL)
      expect(Math.abs(state.phase - numOf(entry.phase!))).toBeLessThanOrEqual(TOL)
      expect(state.stateHash()).toBe(strOf(entry.state_hash!))
    })
  }
})

interface OpRun {
  outputVector: readonly { re: number; im: number }[]
  outputResonance: number
  outputHash: string
  finalizedHash: string
  coherenceBefore: number | null
  coherenceAfter: number | null
  status: string
  receipt: OperationReceipt
}

function runOperationCase(fixtureName: string, operator: string, testCase: Json, timestampUtc: string): OpRun {
  const caseName = strOf(testCase.name!)
  const inputs = testCase.inputs as Json
  const labels = CASE_INPUT_LABELS[`${fixtureName}:${caseName}`]
  if (!labels) throw new Error(`no input-label mapping for ${fixtureName}:${caseName}`)
  const opLabel = CASE_OP_LABELS[`${fixtureName}:${caseName}`]
  const state = (key: string): ResonantState =>
    ResonantState.fromPairs(pairsOf(inputs[key]!), { label: labels[key] ?? null })

  let result: OpRun
  if (operator === 'harmonic_sum') {
    const a = state('a')
    const b = state('b')
    const r = harmonicSum(a, b, { label: opLabel ?? null, timestampUtc })
    result = {
      outputVector: r.output.vector,
      outputResonance: r.output.resonance,
      outputHash: '',
      finalizedHash: r.output.stateHash(),
      coherenceBefore: r.receipt.coherenceBefore,
      coherenceAfter: r.receipt.coherenceAfter,
      status: r.receipt.status,
      receipt: r.receipt,
    }
    result.outputHash = r.receipt.outputHash
    return result
  }
  if (operator === 'phase_shift') {
    const r = phaseShift(state('state'), numOf(inputs.angle_radians!), { timestampUtc })
    return {
      outputVector: r.output.vector,
      outputResonance: r.output.resonance,
      outputHash: r.receipt.outputHash,
      finalizedHash: r.output.stateHash(),
      coherenceBefore: r.receipt.coherenceBefore,
      coherenceAfter: r.receipt.coherenceAfter,
      status: r.receipt.status,
      receipt: r.receipt,
    }
  }
  if (operator === 'attenuated_phase_shift') {
    const r = attenuatedPhaseShift(
      state('state'),
      numOf(inputs.angle_radians!),
      numOf(inputs.attenuation!),
      { costLabel: strOf(inputs.cost_label!), timestampUtc },
    )
    return {
      outputVector: r.output.vector,
      outputResonance: r.output.resonance,
      outputHash: r.receipt.outputHash,
      finalizedHash: r.output.stateHash(),
      coherenceBefore: r.receipt.coherenceBefore,
      coherenceAfter: r.receipt.coherenceAfter,
      status: r.receipt.status,
      receipt: r.receipt,
    }
  }
  if (operator === 'phi_scale') {
    const r = phiScale(state('state'), numOf(inputs.n!), { timestampUtc })
    return {
      outputVector: r.output.vector,
      outputResonance: r.output.resonance,
      outputHash: r.receipt.outputHash,
      finalizedHash: r.output.stateHash(),
      coherenceBefore: r.receipt.coherenceBefore,
      coherenceAfter: r.receipt.coherenceAfter,
      status: r.receipt.status,
      receipt: r.receipt,
    }
  }
  if (operator === 'bridge') {
    const source = state('source')
    const target = state('target')
    const r = bridge(source, target, { cost: numOf(inputs.cost!), timestampUtc })
    // The bridge fixture records the target as the output state, finalized
    // with the deterministic-clock receipt id in its history.
    const finalized = target.withHistory(r.receipt.receiptId())
    return {
      outputVector: r.target.vector,
      outputResonance: r.target.resonance,
      outputHash: r.receipt.outputHash,
      finalizedHash: finalized.stateHash(),
      coherenceBefore: r.receipt.coherenceBefore,
      coherenceAfter: r.receipt.coherenceAfter,
      status: r.receipt.status,
      receipt: r.receipt,
    }
  }
  throw new Error(`unknown operator ${operator}`)
}

const OP_FIXTURES = [
  'op_harmonic_sum.json',
  'op_phase_shift.json',
  'op_attenuated_phase_shift.json',
  'op_phi_scale.json',
  'op_bridge.json',
]

describe('operation fixtures', () => {
  for (const fixtureName of OP_FIXTURES) {
    const fixture = loadFixture(fixtureName)
    const operator = strOf(fixture.operator!)
    const timestampUtc = strOf(fixture.timestamp_utc!)
    for (const testCase of casesOf(fixture)) {
      const caseName = strOf(testCase.name!)
      it(`${operator}/${caseName}: vectors within 1e-12, hashes and receipt byte-exact`, () => {
        const expected = testCase.expected as Json
        const run = runOperationCase(fixtureName, operator, testCase, timestampUtc)

        // (a) vector/metric values within abs 1e-12
        expectVectorClose(run.outputVector, pairsOf(expected.output_vector!))
        expect(Math.abs(run.outputResonance - numOf(expected.output_resonance!))).toBeLessThanOrEqual(TOL)
        if (expected.coherence_before === null) {
          expect(run.coherenceBefore).toBeNull()
        } else {
          expect(Math.abs(run.coherenceBefore! - numOf(expected.coherence_before!))).toBeLessThanOrEqual(TOL)
        }
        if (expected.coherence_after === null) {
          expect(run.coherenceAfter).toBeNull()
        } else {
          expect(Math.abs(run.coherenceAfter! - numOf(expected.coherence_after!))).toBeLessThanOrEqual(TOL)
        }

        // (b) byte-exact hash equality
        expect(run.outputHash).toBe(strOf(expected.output_hash!))
        expect(run.finalizedHash).toBe(strOf(expected.finalized_output_hash!))
        expect(run.status).toBe(strOf(expected.status!))
        expect(run.receipt.contentHash()).toBe(strOf(expected.receipt_content_hash!))
        expect(run.receipt.receiptId()).toBe(strOf(expected.receipt_id!))

        // (c) full-body canonical JSON equality, byte-exact
        const expectedCanonical = canonicalJson(expected.receipt!)
        expect(run.receipt.toCanonicalJson()).toBe(expectedCanonical)
      })
    }
  }
})

describe('edge_cases.json', () => {
  const fixture = loadFixture('edge_cases.json')
  const statesFixture = loadFixture('states.json')
  const statesByName = new Map<string, ResonantState>()
  for (const entry of statesFixture.states as Json[]) {
    const name = strOf(entry.name!)
    statesByName.set(name, ResonantState.fromPairs(pairsOf(entry.vector!), { label: name }))
  }

  describe('similarity cases', () => {
    for (const rawCase of fixture.similarity_cases as Json[]) {
      const name = strOf(rawCase.name!)
      it(`similarity ${name}`, () => {
        const a = statesByName.get(strOf(rawCase.a!))!
        const b = statesByName.get(strOf(rawCase.b!))!
        if ('expected' in rawCase) {
          const got = normalizedComplexSimilarity(a, b)
          expect(Math.abs(got - numOf(rawCase.expected!))).toBeLessThanOrEqual(TOL)
        } else {
          expect(Math.abs(a.resonance - numOf(rawCase.expected_resonance!))).toBeLessThanOrEqual(TOL)
        }
      })
    }
  })

  describe('error cases', () => {
    const one = ResonantState.fromPairs([[1, 0]])
    const basisA = ResonantState.fromPairs([
      [1, 0],
      [0, 0],
    ])
    const thunks: Record<string, () => unknown> = {
      dim_zero_rejected: () => new ResonantState([]),
      dim_above_max_rejected: () =>
        new ResonantState(Array.from({ length: 65 }, () => ({ re: 0, im: 0 }))),
      nan_vector_rejected: () => new ResonantState([{ re: NaN, im: 0 }]),
      phase_shift_nan_angle: () => phaseShift(one, NaN),
      phase_shift_inf_angle: () => phaseShift(one, Infinity),
      attenuation_nan: () => attenuatedPhaseShift(one, 0.1, NaN, { costLabel: 'x' }),
      attenuation_negative: () => attenuatedPhaseShift(one, 0.1, -0.5, { costLabel: 'x' }),
      bridge_cost_inf: () => bridge(one, one, { cost: Infinity }),
      phi_scale_overflow_n: () => phiScale(one, 2000),
      phi_scale_non_integer_n: () => phiScale(one, 2.7),
      phi_scale_nan_n: () => phiScale(one, NaN),
      negative_weights_rejected: () =>
        systemCoherence([one, basisA], [
          [1, -0.5],
          [-0.5, 1],
        ]),
      non_json_metadata_rejected: () =>
        new ResonantState([{ re: 1, im: 0 }], { metadata: { arr: new Date() as unknown as CanonicalValue } }),
      non_finite_metadata_rejected: () => new ResonantState([{ re: 1, im: 0 }], { metadata: { x: NaN } }),
    }
    for (const rawCase of fixture.error_cases as Json[]) {
      const name = strOf(rawCase.name!)
      it(`error case ${name} raises ${strOf(rawCase.expected_error_type!)}`, () => {
        expect(rawCase.observed_error_type).toBe(rawCase.expected_error_type)
        const thunk = thunks[name]
        if (!thunk) throw new Error(`no TS thunk mapped for error case ${name}`)
        let thrown: Error | null = null
        try {
          thunk()
        } catch (exc) {
          thrown = exc as Error
        }
        expect(thrown).not.toBeNull()
        expect(thrown!.name).toBe(strOf(rawCase.expected_error_type!))
      })
    }
  })
})

describe('tampered_receipt.json', () => {
  const fixture = loadFixture('tampered_receipt.json')

  function expectLevels(receipt: CanonicalValue, expected: Json): void {
    const validation = validateReceiptData(receipt)
    const summary = validation.summary
    expect(summary.schema_valid).toBe(expected.schema)
    expect(summary.hash_valid).toBe(expected.hash)
    expect(summary.status_consistent).toBe(expected.status)
    expect(summary.version_allowed).toBe(expected.version)
  }

  it('valid receipt passes all four levels', () => {
    expectLevels(fixture.valid_receipt!, fixture.expected_valid_levels as Json)
    const validation = validateReceiptData(fixture.valid_receipt!)
    expect(validation.ok).toBe(true)
    expect(validation.schemaOnlyOk).toBe(false)
  })

  for (const rawCase of fixture.tampered_cases as Json[]) {
    it(`tampered case ${strOf(rawCase.name!)} matches expected levels`, () => {
      expectLevels(rawCase.receipt!, rawCase.expected_levels as Json)
      const validation = validateReceiptData(rawCase.receipt!)
      expect(validation.ok).toBe(false)
    })
  }
})
