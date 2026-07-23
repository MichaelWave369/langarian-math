/**
 * Hand-written recursive-descent parser for langarian-dsl:v0.3.
 *
 * Grammar (docs/DSL_SPEC.md §2):
 *   statement := assignment | call
 *   assignment := IDENT '=' call
 *   call := OP '(' [positional [',' positional]* [',' named]* | named [',' named]*] ')'
 *   positional := vector-literal | identifier | numeric-expr | string
 *   named := IDENT '=' value
 *   numeric-expr := decimal literals, 'pi', '+ - * /', parentheses, unary +/-,
 *                   constant-folded at parse time (identifiers forbidden)
 *
 * Enforces at parse time: SSA single assignment, closed operator registry,
 * arity, named-argument allowlists, MAX_AST_DEPTH, MAX_PROGRAM_STEPS.
 * Produces structured {line, column, code, message} errors only.
 */

import type { CanonicalValue } from '../kernel/canonical.js'
import { PyFloat } from '../kernel/canonical.js'
import { MAX_AST_DEPTH, MAX_PROGRAM_STEPS } from '../kernel/limits.js'
import {
  isOperatorName,
  OPERATOR_NAMES,
  type ArgValue,
  type CallExpr,
  type IdentifierRef,
  type ProgramAst,
  type Statement,
} from './ast.js'
import { DslError } from './errors.js'
import { tokenize, type Token } from './lexer.js'
import { OPERATOR_REGISTRY, type OperatorSignature } from './registry.js'

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const FORBIDDEN_METADATA_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function isValidIdentifier(name: string): boolean {
  return IDENT_RE.test(name)
}

export function isReservedIdentifier(name: string): boolean {
  return name === 'pi' || (OPERATOR_NAMES as readonly string[]).includes(name)
}

interface NamedSpec {
  name: string
  value: ArgValue
  line: number
  column: number
}

class Parser {
  private readonly tokens: Token[]
  private index = 0
  private readonly bound = new Set<string>()
  private stepCount = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)]!
  }

  private next(): Token {
    const token = this.peek()
    if (token.type !== 'eof') this.index++
    return token
  }

  private error(code: ConstructorParameters<typeof DslError>[0], message: string, token: Token): DslError {
    return new DslError(code, message, token.line, token.column)
  }

  private expectPunct(value: string): Token {
    const token = this.peek()
    if (token.type !== 'punct' || token.value !== value) {
      throw this.error('UNEXPECTED_TOKEN', `expected '${value}' but found ${describeToken(token)}.`, token)
    }
    return this.next()
  }

  private checkDepth(depth: number, token: Token): void {
    if (depth > MAX_AST_DEPTH) {
      throw this.error('LIMIT_EXCEEDED', `nesting depth exceeds MAX_AST_DEPTH=${MAX_AST_DEPTH}.`, token)
    }
  }

  parseProgram(): ProgramAst {
    const statements: Statement[] = []
    for (;;) {
      const token = this.peek()
      if (token.type === 'newline') {
        this.next()
        continue
      }
      if (token.type === 'eof') break
      this.stepCount++
      if (this.stepCount > MAX_PROGRAM_STEPS) {
        throw this.error('LIMIT_EXCEEDED', `program has more than MAX_PROGRAM_STEPS=${MAX_PROGRAM_STEPS} steps.`, token)
      }
      statements.push(this.parseStatement())
      const after = this.peek()
      if (after.type !== 'newline' && after.type !== 'eof') {
        throw this.error('UNEXPECTED_TOKEN', `expected end of line but found ${describeToken(after)}.`, after)
      }
    }
    return { statements }
  }

  private parseStatement(): Statement {
    const head = this.peek()
    if (head.type !== 'ident') {
      throw this.error('UNEXPECTED_TOKEN', `expected an identifier but found ${describeToken(head)}.`, head)
    }
    const second = this.peek(1)
    if (second.type === 'punct' && second.value === '=') {
      const nameToken = this.next()
      this.next() // consume '='
      if (isReservedIdentifier(nameToken.value)) {
        throw this.error('RESERVED_IDENTIFIER', `cannot bind reserved name ${JSON.stringify(nameToken.value)}.`, nameToken)
      }
      if (this.bound.has(nameToken.value)) {
        throw this.error(
          'DUPLICATE_BINDING',
          `identifier ${JSON.stringify(nameToken.value)} is already bound (single assignment).`,
          nameToken,
        )
      }
      const call = this.parseCall()
      this.bound.add(nameToken.value)
      return { kind: 'assignment', id: nameToken.value, call, line: nameToken.line, column: nameToken.column }
    }
    if (second.type === 'punct' && second.value === '(') {
      const call = this.parseCall()
      return { kind: 'expression', call, line: head.line, column: head.column }
    }
    throw this.error('UNEXPECTED_TOKEN', `expected '=' or a call after ${JSON.stringify(head.value)}.`, second)
  }

  private parseCall(): CallExpr {
    const nameToken = this.next()
    if (!isOperatorName(nameToken.value)) {
      throw this.error(
        'UNKNOWN_OPERATOR',
        `unknown operator ${JSON.stringify(nameToken.value)}; the registry is closed to: ${OPERATOR_NAMES.join(', ')}.`,
        nameToken,
      )
    }
    const signature = OPERATOR_REGISTRY[nameToken.value]
    this.expectPunct('(')
    const args: ArgValue[] = []
    const named: Record<string, ArgValue> = {}
    const namedSeen = new Set<string>()
    let sawNamed = false
    if (!(this.peek().type === 'punct' && this.peek().value === ')')) {
      for (;;) {
        const token = this.peek()
        if (
          token.type === 'ident' &&
          this.peek(1).type === 'punct' &&
          this.peek(1).value === '=' &&
          !isOperatorName(token.value)
        ) {
          // Named argument. (Operator names cannot be named-argument keys.)
          sawNamed = true
          const spec = this.parseNamedArg(signature)
          if (namedSeen.has(spec.name)) {
            throw this.error('INVALID_NAMED_ARG', `duplicate named argument ${JSON.stringify(spec.name)}.`, token)
          }
          namedSeen.add(spec.name)
          named[spec.name] = spec.value
        } else {
          if (sawNamed) {
            throw this.error('UNEXPECTED_TOKEN', 'positional arguments must precede named arguments.', token)
          }
          if (args.length >= signature.positional.length) {
            throw this.error(
              'ARITY_MISMATCH',
              `${signature.op} takes exactly ${signature.positional.length} positional argument(s).`,
              token,
            )
          }
          const value = this.parseValue(1)
          args.push(value)
        }
        const sep = this.peek()
        if (sep.type === 'punct' && sep.value === ',') {
          this.next()
          continue
        }
        break
      }
    }
    this.expectPunct(')')
    if (args.length !== signature.positional.length) {
      throw this.error(
        'ARITY_MISMATCH',
        `${signature.op} takes exactly ${signature.positional.length} positional argument(s); got ${args.length}.`,
        nameToken,
      )
    }
    args.forEach((value, index) => this.checkPositionalKind(signature, index, value, nameToken))
    return { op: signature.op, args, named, line: nameToken.line, column: nameToken.column }
  }

  private checkPositionalKind(
    signature: OperatorSignature,
    index: number,
    value: ArgValue,
    nameToken: Token,
  ): void {
    const expected = signature.positional[index]!
    const ok =
      (expected === 'vector' && value.kind === 'vector') ||
      (expected === 'reference' && value.kind === 'identifier') ||
      (expected === 'number' && value.kind === 'number')
    if (!ok) {
      throw this.error(
        'INVALID_ARGUMENT',
        `${signature.op} positional argument ${index + 1} must be ${describeKind(expected)}; got ${describeValue(value)}.`,
        nameToken,
      )
    }
    if (expected === 'reference') {
      const ref = value as IdentifierRef
      if (!this.bound.has(ref.name)) {
        throw new DslError('UNKNOWN_IDENTIFIER', `unknown identifier ${JSON.stringify(ref.name)}.`, ref.line, ref.column)
      }
    }
  }

  private parseNamedArg(signature: OperatorSignature): NamedSpec {
    const nameToken = this.next()
    this.next() // consume '='
    const allowed = signature.named[nameToken.value]
    if (allowed === undefined) {
      throw this.error(
        'INVALID_NAMED_ARG',
        `${signature.op} does not accept named argument ${JSON.stringify(nameToken.value)} ` +
          `(allowed: ${Object.keys(signature.named).join(', ')}).`,
        nameToken,
      )
    }
    const value = this.parseValue(1)
    const ok =
      (allowed === 'string' && value.kind === 'string') ||
      (allowed === 'number' && value.kind === 'number') ||
      (allowed === 'metadata' && value.kind === 'metadata')
    if (!ok) {
      throw this.error(
        'INVALID_NAMED_ARG',
        `named argument ${JSON.stringify(nameToken.value)} must be ${allowed === 'metadata' ? 'an object literal' : `a ${allowed}`}; got ${describeValue(value)}.`,
        nameToken,
      )
    }
    return { name: nameToken.value, value, line: nameToken.line, column: nameToken.column }
  }

  /** Parse any argument value. */
  private parseValue(depth: number): ArgValue {
    this.checkDepth(depth, this.peek())
    const token = this.peek()
    if (token.type === 'string') {
      this.next()
      return { kind: 'string', value: token.value }
    }
    if (token.type === 'punct' && token.value === '[') {
      return this.parseBracket(depth)
    }
    if (token.type === 'punct' && token.value === '{') {
      return { kind: 'metadata', value: this.parseMetadataObject(depth) }
    }
    if (
      token.type === 'number' ||
      (token.type === 'punct' && (token.value === '(' || token.value === '-' || token.value === '+')) ||
      (token.type === 'ident' && token.value === 'pi') ||
      // Identifier immediately followed by an arithmetic operator is a
      // (rejected) non-constant numeric expression, not a state reference.
      (token.type === 'ident' &&
        this.peek(1).type === 'punct' &&
        (this.peek(1).value === '+' || this.peek(1).value === '-' || this.peek(1).value === '*' || this.peek(1).value === '/'))
    ) {
      return { kind: 'number', value: this.parseNumExpr(depth) }
    }
    if (token.type === 'ident') {
      this.next()
      return { kind: 'identifier', name: token.value, line: token.line, column: token.column }
    }
    throw this.error('UNEXPECTED_TOKEN', `unexpected ${describeToken(token)} in argument position.`, token)
  }

  /** `[re, im]` pair or `[[re, im], ...]` vector literal. */
  private parseBracket(depth: number): ArgValue {
    const open = this.expectPunct('[')
    const second = this.peek()
    if (second.type === 'punct' && second.value === '[') {
      const pairs: [number, number][] = []
      for (;;) {
        pairs.push(this.parsePair(depth + 1))
        const sep = this.peek()
        if (sep.type === 'punct' && sep.value === ',') {
          this.next()
          continue
        }
        break
      }
      this.expectPunct(']')
      return { kind: 'vector', value: pairs }
    }
    if (second.type === 'punct' && second.value === ']') {
      throw this.error('INVALID_ARGUMENT', 'vector literal must contain at least one complex pair.', open)
    }
    // Single pair in bracket form.
    const re = this.parseNumExpr(depth + 1)
    this.expectPunct(',')
    const im = this.parseNumExpr(depth + 1)
    this.expectPunct(']')
    return { kind: 'pair', value: [re, im] }
  }

  private parsePair(depth: number): [number, number] {
    this.checkDepth(depth, this.peek())
    this.expectPunct('[')
    const re = this.parseNumExpr(depth)
    this.expectPunct(',')
    const im = this.parseNumExpr(depth)
    this.expectPunct(']')
    return [re, im]
  }

  /** Metadata object literal: JSON-safe values with duplicate/forbidden-key rejection. */
  private parseMetadataObject(depth: number): Record<string, CanonicalValue> {
    this.checkDepth(depth, this.peek())
    this.expectPunct('{')
    const out: { [key: string]: CanonicalValue } = {}
    if (this.peek().type === 'punct' && this.peek().value === '}') {
      this.next()
      return out
    }
    for (;;) {
      const keyToken = this.peek()
      if (keyToken.type !== 'string') {
        throw this.error('UNEXPECTED_TOKEN', 'metadata keys must be quoted strings.', keyToken)
      }
      this.next()
      if (FORBIDDEN_METADATA_KEYS.has(keyToken.value)) {
        throw this.error('INVALID_ARGUMENT', `forbidden metadata key ${JSON.stringify(keyToken.value)}.`, keyToken)
      }
      if (Object.prototype.hasOwnProperty.call(out, keyToken.value)) {
        throw this.error('INVALID_ARGUMENT', `duplicate metadata key ${JSON.stringify(keyToken.value)}.`, keyToken)
      }
      this.expectPunct(':')
      out[keyToken.value] = this.parseMetaValue(depth + 1)
      const sep = this.peek()
      if (sep.type === 'punct' && sep.value === ',') {
        this.next()
        continue
      }
      break
    }
    this.expectPunct('}')
    return out
  }

  private parseMetaValue(depth: number): CanonicalValue {
    this.checkDepth(depth, this.peek())
    const token = this.peek()
    if (token.type === 'string') {
      this.next()
      return token.value
    }
    if (token.type === 'punct' && token.value === '{') {
      return this.parseMetadataObject(depth)
    }
    if (token.type === 'punct' && token.value === '[') {
      this.next()
      const items: CanonicalValue[] = []
      if (this.peek().type === 'punct' && this.peek().value === ']') {
        this.next()
        return items
      }
      for (;;) {
        items.push(this.parseMetaValue(depth + 1))
        const sep = this.peek()
        if (sep.type === 'punct' && sep.value === ',') {
          this.next()
          continue
        }
        break
      }
      this.expectPunct(']')
      return items
    }
    if (token.type === 'ident') {
      if (token.value === 'true' || token.value === 'false') {
        this.next()
        return token.value === 'true'
      }
      if (token.value === 'null') {
        this.next()
        return null
      }
      if (token.value !== 'pi') {
        throw this.error('NON_CONSTANT_NUMERIC', `metadata values must be constant; got identifier ${JSON.stringify(token.value)}.`, token)
      }
    }
    if (
      token.type === 'number' ||
      (token.type === 'punct' && (token.value === '(' || token.value === '-' || token.value === '+')) ||
      (token.type === 'ident' && token.value === 'pi')
    ) {
      return new PyFloat(this.parseNumExpr(depth))
    }
    throw this.error('UNEXPECTED_TOKEN', `unexpected ${describeToken(token)} in metadata literal.`, token)
  }

  /** Numeric expression with usual precedence, constant-folded at parse time. */
  private parseNumExpr(depth: number): number {
    this.checkDepth(depth, this.peek())
    let value = this.parseTerm(depth)
    for (;;) {
      const token = this.peek()
      if (token.type === 'punct' && (token.value === '+' || token.value === '-')) {
        this.next()
        const rhs = this.parseTerm(depth)
        value = token.value === '+' ? value + rhs : value - rhs
        this.checkFinite(value, token)
        continue
      }
      return value
    }
  }

  private parseTerm(depth: number): number {
    let value = this.parseFactor(depth)
    for (;;) {
      const token = this.peek()
      if (token.type === 'punct' && (token.value === '*' || token.value === '/')) {
        this.next()
        const rhs = this.parseFactor(depth)
        if (token.value === '/' && rhs === 0) {
          throw this.error('INVALID_NUMBER', 'division by zero in numeric expression.', token)
        }
        value = token.value === '*' ? value * rhs : value / rhs
        this.checkFinite(value, token)
        continue
      }
      return value
    }
  }

  private parseFactor(depth: number): number {
    const token = this.peek()
    if (token.type === 'punct' && (token.value === '-' || token.value === '+')) {
      this.next()
      const value = this.parseFactor(depth + 1)
      return token.value === '-' ? -value : value
    }
    if (token.type === 'punct' && token.value === '(') {
      this.next()
      const value = this.parseNumExpr(depth + 1)
      this.expectPunct(')')
      return value
    }
    if (token.type === 'number') {
      this.next()
      const value = Number(token.value)
      this.checkFinite(value, token)
      return value
    }
    if (token.type === 'ident') {
      if (token.value === 'pi') {
        this.next()
        return Math.PI
      }
      throw this.error(
        'NON_CONSTANT_NUMERIC',
        `numeric expressions may not reference identifiers; got ${JSON.stringify(token.value)}.`,
        token,
      )
    }
    throw this.error('UNEXPECTED_TOKEN', `expected a number but found ${describeToken(token)}.`, token)
  }

  private checkFinite(value: number, token: Token): void {
    if (!Number.isFinite(value)) {
      throw this.error('INVALID_NUMBER', 'numeric expression evaluates to a non-finite value.', token)
    }
  }
}

function describeToken(token: Token): string {
  if (token.type === 'eof') return 'end of input'
  if (token.type === 'newline') return 'end of line'
  if (token.type === 'string') return `string ${JSON.stringify(token.value)}`
  return JSON.stringify(token.value)
}

function describeKind(kind: 'vector' | 'reference' | 'number'): string {
  switch (kind) {
    case 'vector':
      return 'a vector literal [[re, im], ...]'
    case 'reference':
      return 'a state identifier'
    case 'number':
      return 'a numeric expression'
  }
}

function describeValue(value: ArgValue): string {
  switch (value.kind) {
    case 'number':
      return `number ${value.value}`
    case 'string':
      return `string ${JSON.stringify(value.value)}`
    case 'identifier':
      return `identifier ${JSON.stringify(value.name)}`
    case 'pair':
      return 'a pair literal'
    case 'vector':
      return 'a vector literal'
    case 'metadata':
      return 'an object literal'
  }
}

/** Parse DSL text into a typed ProgramAst (throws DslError on failure). */
export function parseDsl(source: string): ProgramAst {
  return new Parser(tokenize(source)).parseProgram()
}
