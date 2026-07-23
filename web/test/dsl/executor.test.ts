import { describe, expect, it } from 'vitest'

import { MAX_PROGRAM_STEPS } from '../../src/kernel/limits.js'
import type { ProgramAst } from '../../src/dsl/ast.js'
import { executeProgram } from '../../src/dsl/executor.js'
import { parseDsl } from '../../src/dsl/parser.js'
import { parseJsonProgram } from '../../src/dsl/jsonProgram.js'
import { FIXED_TIMESTAMP as FIXED, GOLDEN_PROGRAM } from './golden.js'

describe('DSL executor — golden program', () => {
  it('executes topologically with per-step states, receipts, and warnings', () => {
    const result = executeProgram(parseDsl(GOLDEN_PROGRAM), { timestampUtc: FIXED })
    expect(result.ok).toBe(true)
    expect(result.error).toBeNull()
    expect(result.steps).toHaveLength(5)

    // state() emits a state but NO receipt (documented semantics).
    const [stateStep, ...opSteps] = result.steps
    expect(stateStep!.op).toBe('state')
    expect(stateStep!.state).not.toBeNull()
    expect(stateStep!.receipt).toBeNull()
    for (const step of opSteps) {
      expect(step.receipt).not.toBeNull()
      expect(step.state).not.toBeNull()
    }

    // Final SSA environment holds exactly the four bindings.
    expect([...result.environment.keys()].sort()).toEqual(['A', 'B', 'C', 'D'])

    // All receipts pass their invariant sets in the golden program.
    for (const step of opSteps) {
      expect(step.receipt!.status).toBe('PASS')
    }

    // bridge records the target as its step state (no new state is created).
    const bridgeStep = result.steps[4]!
    expect(bridgeStep.op).toBe('bridge')
    expect(bridgeStep.id).toBeNull()
    expect(bridgeStep.receipt!.outputHash).toBe(result.environment.get('D')!.stateHash())

    // Cost annotations surface the caller-declared/unverified warning.
    expect(result.warnings.some((w) => w.includes('caller-declared, unverified'))).toBe(true)
  })

  it('is deterministic under a fixed clock', () => {
    const a = executeProgram(parseDsl(GOLDEN_PROGRAM), { timestampUtc: FIXED })
    const b = executeProgram(parseDsl(GOLDEN_PROGRAM), { timestampUtc: FIXED })
    expect(a.steps.map((s) => s.receipt?.contentHash() ?? null)).toEqual(
      b.steps.map((s) => s.receipt?.contentHash() ?? null),
    )
    expect(a.steps.map((s) => s.receipt?.receiptId() ?? null)).toEqual(
      b.steps.map((s) => s.receipt?.receiptId() ?? null),
    )
  })
})

describe('DSL executor — failure paths', () => {
  it('attenuation < 1 without a declared cost produces a FAIL receipt (kernel path)', () => {
    const source = 'A = state([[3,0],[6,0]])\nB = attenuated_phase_shift(A, pi/9, 0.75)'
    const result = executeProgram(parseDsl(source), { timestampUtc: FIXED })
    // The operation completes; the receipt honestly records FAIL via I3.
    expect(result.ok).toBe(true)
    const step = result.steps[1]!
    expect(step.receipt!.status).toBe('FAIL')
    const i3 = step.receipt!.invariantResults.find((invariant) => invariant.name === 'I3.accounted_change')!
    expect(i3.status).toBe('FAIL')
    expect(step.warnings.some((warning) => warning.includes('FAIL'))).toBe(true)
  })

  it('declared cost on attenuation < 1 passes I3', () => {
    const source = 'A = state([[3,0]])\nB = attenuated_phase_shift(A, pi/9, 0.75, cost="declared")'
    const result = executeProgram(parseDsl(source), { timestampUtc: FIXED })
    expect(result.steps[1]!.receipt!.status).toBe('PASS')
  })

  it('kernel typed errors become structured step errors, never tracebacks', () => {
    const source = 'A = state([[3,0]])\nB = phi_scale(A, 65)\nC = phi_scale(B, 1)'
    const result = executeProgram(parseDsl(source), { timestampUtc: FIXED })
    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({ op: 'phi_scale', code: 'KERNEL_ERROR', id: 'B' })
    expect(result.error!.message).toContain('MAX_PHI_SCALE_POWER')
    // Completed bindings survive; dependent steps did not run.
    expect([...result.environment.keys()]).toEqual(['A'])
    expect(result.steps).toHaveLength(1)
  })

  it('enforces MAX_DIM via the kernel during state construction', () => {
    const pairs = Array.from({ length: 65 }, () => '[1,0]').join(',')
    const result = executeProgram(parseDsl(`A = state([${pairs}])`), { timestampUtc: FIXED })
    expect(result.ok).toBe(false)
    expect(result.error!.code).toBe('KERNEL_ERROR')
    expect(result.error!.message).toContain('MAX_DIM')
  })

  it('enforces the explicit step budget', () => {
    const ast = parseDsl('A = state([[1,0]])\nB = phi_scale(A, 1)')
    const result = executeProgram(ast, { limits: { maxSteps: 1, maxDim: 64 }, timestampUtc: FIXED })
    expect(result.ok).toBe(false)
    expect(result.error!.code).toBe('LIMIT_EXCEEDED')
    expect(ast.statements.length).toBeLessThanOrEqual(MAX_PROGRAM_STEPS)
  })

  it('warns when attenuation > 1 amplifies (unaccounted increase)', () => {
    const source = 'A = state([[3,0]])\nB = attenuated_phase_shift(A, pi/9, 2)'
    const result = executeProgram(parseDsl(source), { timestampUtc: FIXED })
    expect(result.ok).toBe(true)
    expect(result.warnings.some((w) => w.includes('amplifies'))).toBe(true)
  })
})

describe('DSL executor — kernel error structuring (regression)', () => {
  it('non-integral phi_scale exponent becomes a structured KERNEL_ERROR, never a raw TypeError', () => {
    const source = 'A = state([[1,0]])\nB = phi_scale(A, 2.5)'
    let result: ReturnType<typeof executeProgram> | null = null
    expect(() => {
      result = executeProgram(parseDsl(source), { timestampUtc: FIXED })
    }).not.toThrow()
    expect(result!.ok).toBe(false)
    expect(result!.error).toMatchObject({ op: 'phi_scale', id: 'B', code: 'KERNEL_ERROR' })
    expect(result!.error!.message).toContain('TypeError')
    expect(result!.error!.message).toContain('integer')
    expect(result!.steps).toHaveLength(1)
  })

  it('|n| > MAX_PHI_SCALE_POWER reports the LimitError name in the step error', () => {
    const source = 'A = state([[1,0]])\nB = phi_scale(A, 65)'
    const result = executeProgram(parseDsl(source), { timestampUtc: FIXED })
    expect(result.ok).toBe(false)
    expect(result.error!.code).toBe('KERNEL_ERROR')
    expect(result.error!.message).toContain('LimitError')
    expect(result.error!.message).toContain('MAX_PHI_SCALE_POWER=64')
  })

  it('dim > MAX_DIM reports the LimitError name in the step error', () => {
    const pairs = Array.from({ length: 65 }, () => '[1,0]').join(',')
    const result = executeProgram(parseDsl(`A = state([${pairs}])`), { timestampUtc: FIXED })
    expect(result.ok).toBe(false)
    expect(result.error!.code).toBe('KERNEL_ERROR')
    expect(result.error!.message).toContain('LimitError')
    expect(result.error!.message).toContain('MAX_DIM=64')
  })

  it('NaN angle becomes a structured KERNEL_ERROR (AST-level; text/JSON forms reject non-finite at parse)', () => {
    // The text parser and the strict JSON importer both reject non-finite
    // numbers, so the only way a NaN reaches the executor is a hand-built
    // AST. The kernel must still answer with a typed ValueError and the
    // executor must structure it.
    const ast: ProgramAst = {
      statements: [
        { kind: 'assignment', id: 'A', line: 1, column: 1, call: { op: 'state', args: [{ kind: 'vector', value: [[1, 0]] }], named: {}, line: 1, column: 3 } },
        { kind: 'assignment', id: 'B', line: 2, column: 1, call: { op: 'phase_shift', args: [{ kind: 'identifier', name: 'A', line: 2, column: 16 }, { kind: 'number', value: NaN }], named: {}, line: 2, column: 3 } },
      ],
    }
    let result: ReturnType<typeof executeProgram> | null = null
    expect(() => {
      result = executeProgram(ast, { timestampUtc: FIXED })
    }).not.toThrow()
    expect(result!.ok).toBe(false)
    expect(result!.error).toMatchObject({ op: 'phase_shift', id: 'B', code: 'KERNEL_ERROR' })
    expect(result!.error!.message).toContain('ValueError')
    expect(result!.error!.message).toContain('finite')
  })

  it('even a raw native throw inside the kernel is contained as a structured step error', () => {
    // A malformed (parser-inaccessible) AST whose state vector holds a null
    // pair makes ResonantState.fromPairs throw a native TypeError while
    // destructuring. The executor must never let it escape raw.
    const ast: ProgramAst = {
      statements: [
        {
          kind: 'assignment',
          id: 'A',
          line: 1,
          column: 1,
          call: {
            op: 'state',
            args: [{ kind: 'vector', value: [[1, 0], null] as unknown as [number, number][] }],
            named: {},
            line: 1,
            column: 3,
          },
        },
      ],
    }
    let result: ReturnType<typeof executeProgram> | null = null
    expect(() => {
      result = executeProgram(ast, { timestampUtc: FIXED })
    }).not.toThrow()
    expect(result!.ok).toBe(false)
    expect(result!.error!.code).toBe('KERNEL_ERROR')
    expect(result!.error!.message).toContain('TypeError')
  })
})

describe('JSON program execution', () => {
  it('executes steps in topological order even when listed out of order', () => {
    const json = JSON.stringify({
      dsl_version: 'langarian-dsl:v0.3',
      steps: [
        { id: 'B', op: 'phase_shift', args: ['A', 1.0] },
        { id: 'A', op: 'state', vector: [[1, 0]] },
      ],
    })
    const program = parseJsonProgram(json)
    const result = executeProgram(program.ast, { limits: program.limits, timestampUtc: FIXED })
    expect(result.ok).toBe(true)
    expect(result.steps[0]!.op).toBe('state')
    expect(result.steps[1]!.op).toBe('phase_shift')
    expect(result.environment.get('B')).toBeDefined()
  })

  it('rejects dependency cycles', () => {
    const json = JSON.stringify({
      dsl_version: 'langarian-dsl:v0.3',
      steps: [
        { id: 'A', op: 'phase_shift', args: ['B', 1.0] },
        { id: 'B', op: 'phase_shift', args: ['A', 1.0] },
      ],
    })
    const program = parseJsonProgram(json)
    const result = executeProgram(program.ast, { timestampUtc: FIXED })
    expect(result.ok).toBe(false)
    expect(result.error!.code).toBe('CYCLE_DETECTED')
  })

  it('rejects self-referential steps as cycles', () => {
    const json = JSON.stringify({
      dsl_version: 'langarian-dsl:v0.3',
      steps: [{ id: 'A', op: 'phase_shift', args: ['A', 1.0] }],
    })
    const result = executeProgram(parseJsonProgram(json).ast, { timestampUtc: FIXED })
    expect(result.ok).toBe(false)
    expect(result.error!.code).toBe('CYCLE_DETECTED')
  })
})
