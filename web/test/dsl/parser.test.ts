import { describe, expect, it } from 'vitest'

import { MAX_AST_DEPTH, MAX_DSL_TOKENS, MAX_PROGRAM_STEPS } from '../../src/kernel/limits.js'
import type { ProgramAst } from '../../src/dsl/ast.js'
import { DslError } from '../../src/dsl/errors.js'
import { tokenize } from '../../src/dsl/lexer.js'
import { parseDsl } from '../../src/dsl/parser.js'
import { GOLDEN_PROGRAM } from './golden.js'

function expectDslError(source: string, code: string, line?: number, column?: number): DslError {
  try {
    parseDsl(source)
  } catch (exc) {
    expect(exc).toBeInstanceOf(DslError)
    const error = exc as DslError
    expect(error.code).toBe(code)
    if (line !== undefined) expect(error.line).toBe(line)
    if (column !== undefined) expect(error.column).toBe(column)
    expect(error.toJSON()).toMatchObject({ code, message: expect.any(String) })
    return error
  }
  throw new Error(`expected DslError ${code} for: ${source}`)
}

describe('DSL lexer', () => {
  it('tokenizes the golden program with line/column positions', () => {
    const tokens = tokenize(GOLDEN_PROGRAM)
    expect(tokens[tokens.length - 1]!.type).toBe('eof')
    const ident = tokens.find((token) => token.type === 'ident' && token.value === 'phase_shift')!
    expect(ident.line).toBe(2)
    expect(ident.column).toBe(5)
  })

  it('enforces MAX_DSL_TOKENS', () => {
    const source = `${'x = '.repeat(MAX_DSL_TOKENS)}`
    try {
      tokenize(source)
      throw new Error('expected token limit error')
    } catch (exc) {
      expect(exc).toBeInstanceOf(DslError)
      expect((exc as DslError).code).toBe('LIMIT_EXCEEDED')
      expect((exc as DslError).message).toContain(String(MAX_DSL_TOKENS))
    }
  })

  it('rejects unterminated strings with position', () => {
    expectDslError('A = state([[1,0]], label="abc', 'UNTERMINATED_STRING', 1, 26)
  })

  it('rejects unexpected characters', () => {
    expectDslError('A = state([[1,0]]) @', 'UNEXPECTED_TOKEN', 1, 20)
  })

  it('supports comments and blank lines', () => {
    const ast = parseDsl('# heading\n\nA = state([[1,0]]) # trailing\n')
    expect(ast.statements).toHaveLength(1)
  })
})

describe('DSL parser — golden program', () => {
  it('parses the SPEC section 5 example into a typed AST', () => {
    const ast: ProgramAst = parseDsl(GOLDEN_PROGRAM)
    expect(ast.statements).toHaveLength(5)
    const [a, b, c, d, e] = ast.statements
    expect(a).toMatchObject({ kind: 'assignment', id: 'A' })
    expect(a!.call.op).toBe('state')
    expect(a!.call.args[0]).toEqual({ kind: 'vector', value: [[3, 0], [6, 0], [9, 0]] })
    expect(a!.call.named.label).toEqual({ kind: 'string', value: 'A' })
    expect(b!.call.op).toBe('phase_shift')
    expect(b!.call.args[0]).toMatchObject({ kind: 'identifier', name: 'A', line: 2 })
    expect(b!.call.args[1]).toEqual({ kind: 'number', value: Math.PI / 3 })
    expect(c!.call.args[1]).toEqual({ kind: 'number', value: 2 })
    expect(d!.call.named.cost).toEqual({ kind: 'string', value: 'declared attenuation' })
    expect(e).toMatchObject({ kind: 'expression' })
    expect(e!.call.op).toBe('bridge')
    expect(e!.call.named.cost).toEqual({ kind: 'number', value: 0 })
  })

  it('constant-folds numeric expressions with usual precedence at parse time', () => {
    const ast = parseDsl('A = state([[1,0]])\nB = phase_shift(A, 2 + 3 * 4 - 8 / 2)\nC = phi_scale(B, -2)')
    expect(ast.statements[1]!.call.args[1]).toEqual({ kind: 'number', value: 10 })
    expect(ast.statements[2]!.call.args[1]).toEqual({ kind: 'number', value: -2 })
  })

  it('folds numeric expressions inside vector literals', () => {
    const ast = parseDsl('A = state([[1+2, pi*0], [4/2, -1]])')
    expect(ast.statements[0]!.call.args[0]).toEqual({ kind: 'vector', value: [[3, 0], [2, -1]] })
  })

  it('parses metadata object literals for state()', () => {
    const ast = parseDsl('A = state([[1,0]], metadata={"origin": "test", "k": 2, "flag": true})')
    const metadata = ast.statements[0]!.call.named.metadata
    expect(metadata).toMatchObject({ kind: 'metadata' })
    expect((metadata as { value: Record<string, unknown> }).value.origin).toBe('test')
  })
})

describe('DSL parser — structured errors with lines', () => {
  it('unknown operator is rejected at its line/column (registry is closed)', () => {
    expectDslError('A = state([[1,0]])\nB = frobnicate(A)', 'UNKNOWN_OPERATOR', 2, 5)
  })

  it('duplicate binding violates SSA with line/column', () => {
    expectDslError('A = state([[1,0]])\nA = phi_scale(A, 1)', 'DUPLICATE_BINDING', 2, 1)
  })

  it('unknown identifier reference with line/column', () => {
    // 'A' in phase_shift(A, ...) starts at column 16 on line 1.
    expectDslError('B = phase_shift(A, 1)', 'UNKNOWN_IDENTIFIER', 1, 17)
  })

  it('reserved names cannot be bound', () => {
    expectDslError('pi = state([[1,0]])', 'RESERVED_IDENTIFIER', 1, 1)
    expectDslError('bridge = state([[1,0]])', 'RESERVED_IDENTIFIER', 1, 1)
  })

  it('arity mismatch for wrong positional count', () => {
    expectDslError('A = state([[1,0]])\nB = phase_shift(A)', 'ARITY_MISMATCH', 2, 5)
    expectDslError('A = state([[1,0]], [[2,0]])', 'ARITY_MISMATCH', 1, 20)
  })

  it('wrong positional kinds are rejected', () => {
    expectDslError('A = state([[1,0]])\nB = phase_shift(A, A)', 'INVALID_ARGUMENT', 2, 5)
    expectDslError('A = state([[1,0]])\nB = phi_scale(1, 2)', 'INVALID_ARGUMENT', 2, 5)
  })

  it('invalid named arguments are rejected per operator', () => {
    expectDslError('A = state([[1,0]])\nB = phase_shift(A, 1, glyph="x")', 'INVALID_NAMED_ARG', 2, 23)
    expectDslError('A = state([[1,0]], label=3)', 'INVALID_NAMED_ARG', 1, 20)
    expectDslError('A = state([[1,0]], label="x", label="y")', 'INVALID_NAMED_ARG', 1, 31)
  })

  it('non-constant numeric expressions are rejected', () => {
    expectDslError('A = state([[1,0]])\nB = phase_shift(A, (A))', 'NON_CONSTANT_NUMERIC', 2, 21)
    expectDslError('A = state([[1,0]])\nB = phi_scale(A, A+1)', 'NON_CONSTANT_NUMERIC', 2, 18)
  })

  it('non-finite numeric results are rejected (no Infinity ever folds)', () => {
    expectDslError('A = state([[1,0]])\nB = phase_shift(A, 1/0)', 'INVALID_NUMBER', 2, 21)
    expectDslError('A = state([[1,0]])\nB = phase_shift(A, 1e400)', 'INVALID_NUMBER', 2, 20)
  })

  it('enforces MAX_AST_DEPTH on nested numeric expressions', () => {
    const depth = MAX_AST_DEPTH + 4
    const source = `A = state([[1,0]])\nB = phase_shift(A, ${'('.repeat(depth)}1${')'.repeat(depth)})`
    expectDslError(source, 'LIMIT_EXCEEDED', 2)
  })

  it('enforces MAX_PROGRAM_STEPS', () => {
    const lines = Array.from({ length: MAX_PROGRAM_STEPS + 1 }, (_, i) => `S${i} = state([[1,0]])`)
    expectDslError(lines.join('\n'), 'LIMIT_EXCEEDED', MAX_PROGRAM_STEPS + 1)
  })

  it('rejects trailing tokens after a statement', () => {
    expectDslError('A = state([[1,0]]) extra', 'UNEXPECTED_TOKEN', 1, 20)
  })

  it('rejects multi-line statements without brackets and allows bracket continuation', () => {
    const ast = parseDsl('A = state([\n  [1,0],\n  [2,0]\n])\nB = phi_scale(A, 1)')
    expect(ast.statements).toHaveLength(2)
    expect(ast.statements[1]!.line).toBe(5)
  })
})
