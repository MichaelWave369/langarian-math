/**
 * JSON program form for langarian-dsl:v0.3 (docs/DSL_SPEC.md §5).
 *
 * { "dsl_version": "langarian-dsl:v0.3", "limits": {...}, "steps": [...] }
 * parses to the same AST as the text form, with the same registry and
 * validation. Import safety is inherited from the kernel strict JSON parser
 * (parseStrictJson): __proto__/constructor/prototype keys, duplicate keys,
 * nesting beyond MAX_AST_DEPTH, and non-finite literals are rejected before
 * any program validation runs. Program export is deterministic canonical
 * JSON (SPEC §3.10).
 */

import { canonicalJson, PyFloat, parseStrictJson, type CanonicalValue } from '../kernel/canonical.js'
import { MAX_DIM, MAX_PROGRAM_STEPS } from '../kernel/limits.js'
import { DSL_VERSION } from '../kernel/version.js'
import {
  isOperatorName,
  type ArgValue,
  type CallExpr,
  type ProgramAst,
  type Statement,
} from './ast.js'
import { DslError } from './errors.js'
import { isReservedIdentifier, isValidIdentifier } from './parser.js'
import { OPERATOR_REGISTRY } from './registry.js'

export interface ProgramLimits {
  maxSteps: number
  maxDim: number
}

export const DEFAULT_PROGRAM_LIMITS: ProgramLimits = {
  maxSteps: MAX_PROGRAM_STEPS,
  maxDim: MAX_DIM,
}

export interface JsonProgram {
  ast: ProgramAst
  limits: ProgramLimits
}

function isPlainObject(value: CanonicalValue): value is { [key: string]: CanonicalValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof PyFloat)
}

function asNumber(value: CanonicalValue, what: string): number {
  if (value instanceof PyFloat) return value.value
  if (typeof value === 'number') return value
  throw new DslError('INVALID_PROGRAM', `${what} must be a number.`)
}

function parseLimits(value: CanonicalValue): ProgramLimits {
  if (!isPlainObject(value)) {
    throw new DslError('INVALID_PROGRAM', 'limits must be an object.')
  }
  const limits = { ...DEFAULT_PROGRAM_LIMITS }
  for (const key of Object.keys(value)) {
    const raw = value[key]!
    const num = asNumber(raw, `limits.${key}`)
    if (!Number.isSafeInteger(num) || num < 1) {
      throw new DslError('INVALID_PROGRAM', `limits.${key} must be a positive safe integer.`)
    }
    if (key === 'max_steps') {
      // User-declared limits can only tighten the kernel hard caps; values
      // above the kernel maximum are clamped to it (never raised).
      limits.maxSteps = Math.min(num, MAX_PROGRAM_STEPS)
    } else if (key === 'max_dim') {
      limits.maxDim = Math.min(num, MAX_DIM)
    } else {
      throw new DslError('INVALID_PROGRAM', `unknown limit ${JSON.stringify(key)}.`)
    }
  }
  return limits
}

function parseVectorField(value: CanonicalValue): [number, number][] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DslError('INVALID_PROGRAM', 'state step vector must be a non-empty array of [re, im] pairs.')
  }
  return value.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new DslError('INVALID_PROGRAM', 'state step vector entries must be [re, im] pairs.')
    }
    return [asNumber(pair[0]!, 'vector re'), asNumber(pair[1]!, 'vector im')]
  })
}

function parseStep(raw: CanonicalValue, index: number): Statement {
  if (!isPlainObject(raw)) {
    throw new DslError('INVALID_PROGRAM', `steps[${index}] must be an object.`)
  }
  const allowed = new Set(['id', 'op', 'args', 'vector', 'label', 'glyph', 'cost', 'metadata'])
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) {
      throw new DslError('INVALID_PROGRAM', `steps[${index}] has unknown field ${JSON.stringify(key)}.`)
    }
  }
  const opRaw = raw.op
  if (typeof opRaw !== 'string' || !isOperatorName(opRaw)) {
    throw new DslError('UNKNOWN_OPERATOR', `steps[${index}] has unknown operator ${JSON.stringify(opRaw)}.`)
  }
  const signature = OPERATOR_REGISTRY[opRaw]

  let id: string | null = null
  if (raw.id !== undefined) {
    if (typeof raw.id !== 'string' || !isValidIdentifier(raw.id)) {
      throw new DslError('INVALID_PROGRAM', `steps[${index}].id must be an identifier string.`)
    }
    if (isReservedIdentifier(raw.id)) {
      throw new DslError('RESERVED_IDENTIFIER', `steps[${index}].id ${JSON.stringify(raw.id)} is reserved.`)
    }
    id = raw.id
  }

  const args: ArgValue[] = []
  if (opRaw === 'state') {
    if (raw.vector === undefined) {
      throw new DslError('INVALID_PROGRAM', `steps[${index}] (state) requires a vector field.`)
    }
    args.push({ kind: 'vector', value: parseVectorField(raw.vector) })
    if (raw.args !== undefined) {
      throw new DslError('INVALID_PROGRAM', `steps[${index}] (state) uses vector, not args.`)
    }
  } else {
    const argsRaw = raw.args
    if (!Array.isArray(argsRaw)) {
      throw new DslError('INVALID_PROGRAM', `steps[${index}] (${opRaw}) requires an args array.`)
    }
    if (argsRaw.length !== signature.positional.length) {
      throw new DslError(
        'ARITY_MISMATCH',
        `${opRaw} takes exactly ${signature.positional.length} positional argument(s); got ${argsRaw.length}.`,
      )
    }
    signature.positional.forEach((kind, argIndex) => {
      const rawArg = argsRaw[argIndex]!
      if (kind === 'reference') {
        if (typeof rawArg !== 'string' || !isValidIdentifier(rawArg)) {
          throw new DslError('INVALID_ARGUMENT', `steps[${index}] argument ${argIndex + 1} must be a step id string.`)
        }
        args.push({ kind: 'identifier', name: rawArg, line: 0, column: 0 })
      } else if (kind === 'number') {
        args.push({ kind: 'number', value: asNumber(rawArg, `steps[${index}] argument ${argIndex + 1}`) })
      } else {
        throw new DslError('INVALID_ARGUMENT', `steps[${index}] (${opRaw}) does not take an inline vector argument.`)
      }
    })
  }

  const named: Record<string, ArgValue> = {}
  for (const name of ['label', 'glyph', 'cost', 'metadata'] as const) {
    const rawNamed = raw[name]
    if (rawNamed === undefined) continue
    const expected = signature.named[name]
    if (expected === undefined) {
      throw new DslError('INVALID_NAMED_ARG', `${opRaw} does not accept named argument ${JSON.stringify(name)}.`)
    }
    if (expected === 'string') {
      if (typeof rawNamed !== 'string') {
        throw new DslError('INVALID_NAMED_ARG', `steps[${index}].${name} must be a string.`)
      }
      named[name] = { kind: 'string', value: rawNamed }
    } else if (expected === 'number') {
      named[name] = { kind: 'number', value: asNumber(rawNamed, `steps[${index}].${name}`) }
    } else {
      if (!isPlainObject(rawNamed)) {
        throw new DslError('INVALID_NAMED_ARG', `steps[${index}].${name} must be an object.`)
      }
      named[name] = { kind: 'metadata', value: rawNamed }
    }
  }

  const call: CallExpr = { op: signature.op, args, named, line: 0, column: 0 }
  if (id !== null) {
    return { kind: 'assignment', id, call, line: 0, column: 0 }
  }
  return { kind: 'expression', call, line: 0, column: 0 }
}

/**
 * Parse a JSON program document into the same AST the text parser produces.
 * Structural errors carry line/column 0 (JSON has no DSL source positions).
 */
export function parseJsonProgram(text: string): JsonProgram {
  let data: CanonicalValue
  try {
    data = parseStrictJson(text)
  } catch (exc) {
    throw new DslError('INVALID_PROGRAM', `invalid program JSON: ${(exc as Error).message}`)
  }
  if (!isPlainObject(data)) {
    throw new DslError('INVALID_PROGRAM', 'program must be a JSON object.')
  }
  const allowed = new Set(['dsl_version', 'limits', 'steps'])
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) {
      throw new DslError('INVALID_PROGRAM', `program has unknown field ${JSON.stringify(key)}.`)
    }
  }
  const version = data.dsl_version
  if (typeof version !== 'string') {
    throw new DslError('INVALID_PROGRAM', 'program requires a dsl_version string.')
  }
  if (version !== DSL_VERSION) {
    throw new DslError(
      'DSL_VERSION_UNSUPPORTED',
      `dsl_version ${JSON.stringify(version)} is not supported; expected ${JSON.stringify(DSL_VERSION)} (no silent downgrade).`,
    )
  }
  const limits = data.limits === undefined ? { ...DEFAULT_PROGRAM_LIMITS } : parseLimits(data.limits)
  const stepsRaw = data.steps
  if (!Array.isArray(stepsRaw)) {
    throw new DslError('INVALID_PROGRAM', 'program requires a steps array.')
  }
  if (stepsRaw.length > limits.maxSteps) {
    throw new DslError('LIMIT_EXCEEDED', `program has ${stepsRaw.length} steps; limit is ${limits.maxSteps}.`)
  }
  const statements = stepsRaw.map((step, index) => parseStep(step, index))
  const seen = new Set<string>()
  for (const statement of statements) {
    if (statement.kind !== 'assignment') continue
    if (seen.has(statement.id)) {
      throw new DslError('DUPLICATE_BINDING', `duplicate step id ${JSON.stringify(statement.id)} (single assignment).`)
    }
    seen.add(statement.id)
  }
  for (const statement of statements) {
    for (const arg of statement.call.args) {
      if (arg.kind === 'identifier' && !seen.has(arg.name)) {
        throw new DslError('UNKNOWN_IDENTIFIER', `step references unknown id ${JSON.stringify(arg.name)}.`)
      }
    }
  }
  return { ast: { statements }, limits }
}

/** Serialize an AST to deterministic canonical program JSON. */
export function exportProgramJson(ast: ProgramAst, limits: ProgramLimits = DEFAULT_PROGRAM_LIMITS): string {
  const steps = ast.statements.map((statement) => {
    const call = statement.call
    const step: { [key: string]: CanonicalValue } = { op: call.op }
    if (statement.kind === 'assignment') step.id = statement.id
    if (call.op === 'state') {
      const vector = call.args[0]
      if (!vector || vector.kind !== 'vector') {
        throw new DslError('INVALID_PROGRAM', 'state step is missing its vector argument.')
      }
      step.vector = vector.value.map(([re, im]) => [new PyFloat(re), new PyFloat(im)] as CanonicalValue[])
    } else {
      step.args = call.args.map((arg): CanonicalValue => {
        if (arg.kind === 'identifier') return arg.name
        if (arg.kind === 'number') return new PyFloat(arg.value)
        throw new DslError('INVALID_PROGRAM', `cannot export positional argument of kind ${arg.kind}.`)
      })
    }
    for (const [name, value] of Object.entries(call.named)) {
      if (value.kind === 'string') step[name] = value.value
      else if (value.kind === 'number') step[name] = new PyFloat(value.value)
      else if (value.kind === 'metadata') step[name] = value.value as CanonicalValue
      else throw new DslError('INVALID_PROGRAM', `cannot export named argument ${name} of kind ${value.kind}.`)
    }
    return step
  })
  const program: { [key: string]: CanonicalValue } = {
    dsl_version: DSL_VERSION,
    limits: { max_dim: limits.maxDim, max_steps: limits.maxSteps },
    steps,
  }
  return canonicalJson(program)
}
