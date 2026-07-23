import { describe, expect, it } from 'vitest'

import { DSL_VERSION } from '../../src/kernel/version.js'
import type { ArgValue, ProgramAst, Statement } from '../../src/dsl/ast.js'
import { DslError } from '../../src/dsl/errors.js'
import { executeProgram } from '../../src/dsl/executor.js'
import { exportProgramJson, parseJsonProgram } from '../../src/dsl/jsonProgram.js'
import { parseDsl } from '../../src/dsl/parser.js'
import { FIXED_TIMESTAMP, GOLDEN_PROGRAM } from './golden.js'

/** Semantic projection of an AST (positions stripped) for cross-form equality. */
function astSemantics(ast: ProgramAst): unknown {
  const arg = (value: ArgValue): unknown => {
    switch (value.kind) {
      case 'identifier':
        return { kind: 'identifier', name: value.name }
      case 'metadata':
        return { kind: 'metadata', value: value.value }
      default:
        return value
    }
  }
  const statement = (s: Statement): unknown => ({
    kind: s.kind,
    id: s.kind === 'assignment' ? s.id : null,
    op: s.call.op,
    args: s.call.args.map(arg),
    named: Object.fromEntries(Object.entries(s.call.named).map(([k, v]) => [k, arg(v)])),
  })
  return ast.statements.map(statement)
}

function expectProgramError(json: string, code: string): void {
  try {
    parseJsonProgram(json)
  } catch (exc) {
    expect(exc).toBeInstanceOf(DslError)
    expect((exc as DslError).code).toBe(code)
    return
  }
  throw new Error(`expected DslError ${code}`)
}

describe('JSON program form', () => {
  it('parses the DSL_SPEC section 5 example', () => {
    const json = JSON.stringify({
      dsl_version: DSL_VERSION,
      limits: { max_steps: 64, max_dim: 64 },
      steps: [
        { id: 'A', op: 'state', vector: [[3, 0], [6, 0], [9, 0]], label: 'A' },
        { id: 'B', op: 'phase_shift', args: ['A', 1.0471975511965976] },
        { id: 'C', op: 'phi_scale', args: ['B', 2] },
      ],
    })
    const program = parseJsonProgram(json)
    expect(program.ast.statements).toHaveLength(3)
    expect(program.limits).toEqual({ maxSteps: 64, maxDim: 64 })
  })

  it('text and JSON forms compile to the same AST and the same execution', () => {
    const textAst = parseDsl(GOLDEN_PROGRAM)
    const json = exportProgramJson(textAst)
    const jsonProgram = parseJsonProgram(json)
    expect(astSemantics(jsonProgram.ast)).toEqual(astSemantics(textAst))

    const textRun = executeProgram(textAst, { timestampUtc: FIXED_TIMESTAMP })
    const jsonRun = executeProgram(jsonProgram.ast, { timestampUtc: FIXED_TIMESTAMP })
    expect(jsonRun.steps.map((s) => s.receipt?.contentHash() ?? null)).toEqual(
      textRun.steps.map((s) => s.receipt?.contentHash() ?? null),
    )
    expect(jsonRun.steps.map((s) => s.state?.stateHash() ?? null)).toEqual(
      textRun.steps.map((s) => s.state?.stateHash() ?? null),
    )
  })

  it('export is deterministic and re-parseable (round trip is a fixed point)', () => {
    const ast = parseDsl(GOLDEN_PROGRAM)
    const first = exportProgramJson(ast)
    const second = exportProgramJson(parseJsonProgram(first).ast)
    expect(second).toBe(first)
    expect(first).toContain(`"dsl_version":"${DSL_VERSION}"`)
  })

  it('rejects unknown dsl_version (no silent downgrade)', () => {
    expectProgramError(JSON.stringify({ dsl_version: 'langarian-dsl:v0.2', steps: [] }), 'DSL_VERSION_UNSUPPORTED')
    expectProgramError(JSON.stringify({ steps: [] }), 'INVALID_PROGRAM')
  })

  it('rejects prototype-pollution keys anywhere in the document', () => {
    // Raw strings: an object-literal "__proto__" key would set the prototype
    // instead of creating an own property and never reach the JSON text.
    expectProgramError(
      `{"dsl_version":${JSON.stringify(DSL_VERSION)},"steps":[],"__proto__":{"polluted":true}}`,
      'INVALID_PROGRAM',
    )
    const pollutedMetadata =
      `{"dsl_version":${JSON.stringify(DSL_VERSION)},"steps":[{"id":"A","op":"state","vector":[[1,0]],` +
      '"metadata":{"__proto__":{"polluted":true}}}]}'
    expectProgramError(pollutedMetadata, 'INVALID_PROGRAM')
    const pollutedConstructor = JSON.stringify({
      dsl_version: DSL_VERSION,
      steps: [{ id: 'A', op: 'state', vector: [[1, 0]], metadata: { constructor: 'x' } }],
    })
    expectProgramError(pollutedConstructor, 'INVALID_PROGRAM')
    // Confirm the global object was not polluted by the attempts.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('reuses kernel strict JSON guards: duplicates, depth, non-finite literals', () => {
    expectProgramError('{"dsl_version":"x","dsl_version":"y","steps":[]}', 'INVALID_PROGRAM')
    const deep = '{"dsl_version":"langarian-dsl:v0.3","limits":{},"steps":[],"extra":' + '['.repeat(40) + ']'.repeat(40) + '}'
    expectProgramError(deep, 'INVALID_PROGRAM')
    expectProgramError('{"dsl_version":"langarian-dsl:v0.3","steps":[],"limits":{"max_steps":NaN}}', 'INVALID_PROGRAM')
  })

  it('rejects unknown operators and malformed steps', () => {
    expectProgramError(
      JSON.stringify({ dsl_version: DSL_VERSION, steps: [{ id: 'A', op: 'eval', args: [] }] }),
      'UNKNOWN_OPERATOR',
    )
    expectProgramError(
      JSON.stringify({ dsl_version: DSL_VERSION, steps: [{ id: 'A', op: 'state' }] }),
      'INVALID_PROGRAM',
    )
    expectProgramError(
      JSON.stringify({ dsl_version: DSL_VERSION, steps: [{ id: 'A', op: 'state', vector: [] }] }),
      'INVALID_PROGRAM',
    )
    expectProgramError(
      JSON.stringify({ dsl_version: DSL_VERSION, steps: [{ id: 'A', op: 'phase_shift', args: ['A'] }] }),
      'ARITY_MISMATCH',
    )
  })

  it('rejects duplicate step ids, unknown references, and reserved ids', () => {
    const dup = JSON.stringify({
      dsl_version: DSL_VERSION,
      steps: [
        { id: 'A', op: 'state', vector: [[1, 0]] },
        { id: 'A', op: 'state', vector: [[2, 0]] },
      ],
    })
    expectProgramError(dup, 'DUPLICATE_BINDING')
    const unknown = JSON.stringify({
      dsl_version: DSL_VERSION,
      steps: [{ id: 'B', op: 'phase_shift', args: ['ZZZ', 1.0] }],
    })
    expectProgramError(unknown, 'UNKNOWN_IDENTIFIER')
    const reserved = JSON.stringify({
      dsl_version: DSL_VERSION,
      steps: [{ id: 'bridge', op: 'state', vector: [[1, 0]] }],
    })
    expectProgramError(reserved, 'RESERVED_IDENTIFIER')
  })

  it('rejects named arguments outside the registry allowlist', () => {
    const bad = JSON.stringify({
      dsl_version: DSL_VERSION,
      steps: [
        { id: 'A', op: 'state', vector: [[1, 0]] },
        { id: 'B', op: 'phi_scale', args: ['A', 1], cost: 0 },
      ],
    })
    expectProgramError(bad, 'INVALID_NAMED_ARG')
  })

  it('enforces declared step limits and clamps them to kernel caps', () => {
    const tight = JSON.stringify({
      dsl_version: DSL_VERSION,
      limits: { max_steps: 1 },
      steps: [
        { id: 'A', op: 'state', vector: [[1, 0]] },
        { id: 'B', op: 'state', vector: [[2, 0]] },
      ],
    })
    expectProgramError(tight, 'LIMIT_EXCEEDED')
    // Declared limits above kernel caps are clamped, never raised.
    const above = parseJsonProgram(
      JSON.stringify({ dsl_version: DSL_VERSION, limits: { max_steps: 10000, max_dim: 4096 }, steps: [] }),
    )
    expect(above.limits).toEqual({ maxSteps: 64, maxDim: 64 })
  })

  it('honors bridge cost and attenuation cost named args in JSON form', () => {
    const json = JSON.stringify({
      dsl_version: DSL_VERSION,
      steps: [
        { id: 'A', op: 'state', vector: [[3, 0]] },
        { id: 'B', op: 'attenuated_phase_shift', args: ['A', 0.5, 0.75], cost: 'declared' },
        { op: 'bridge', args: ['A', 'B'], cost: 0 },
      ],
    })
    const program = parseJsonProgram(json)
    const result = executeProgram(program.ast, { timestampUtc: FIXED_TIMESTAMP })
    expect(result.ok).toBe(true)
    expect(result.steps[1]!.receipt!.status).toBe('PASS')
    expect(result.steps[2]!.receipt!.operator).toBe('bridge')
  })
})
