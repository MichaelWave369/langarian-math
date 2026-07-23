/**
 * Executor for langarian-dsl:v0.3 (docs/DSL_SPEC.md §3).
 *
 * - SSA single assignment (enforced at parse time) plus topological
 *   execution: the dependency graph is checked to be a DAG (cycle
 *   rejection), then executed in stable topological order (source order where
 *   free), so JSON programs may list steps out of dependency order.
 * - Explicit step budget: min(program limits, MAX_PROGRAM_STEPS).
 * - Emits per-step states, receipts, and warnings, plus the final
 *   environment of SSA bindings.
 * - state() steps emit a state but NO receipt (kernel state construction is
 *   not an operation; documented deviation from "every step has a receipt").
 * - bridge steps emit a receipt over existing states; the step state is the
 *   bridge target (bridge creates no new state).
 * - Kernel typed errors become structured step errors, never tracebacks.
 *   Attenuation < 1 without a declared cost flows through the kernel's I3
 *   invariant and produces a FAIL receipt — the honest kernel path, not a
 *   UI-side bypass.
 */

import { PyFloat } from '../kernel/canonical.js'
import { LangarianError } from '../kernel/limits.js'
import {
  attenuatedPhaseShift,
  bridge,
  harmonicSum,
  phaseShift,
  phiScale,
} from '../kernel/operators.js'
import type { OperationReceipt } from '../kernel/receipts.js'
import { ResonantState } from '../kernel/state.js'
import type { ProgramAst, Statement } from './ast.js'
import { statementDependencies, statementId } from './ast.js'
import { DslError } from './errors.js'
import { DEFAULT_PROGRAM_LIMITS, type ProgramLimits } from './jsonProgram.js'

export interface StepResult {
  /** Topological execution index (0-based). */
  index: number
  /** SSA binding name, or null for bare expression statements. */
  id: string | null
  op: Statement['call']['op']
  /** Produced state. state() -> the new state; bridge -> the target state. */
  state: ResonantState | null
  /** Operation receipt; null for state() steps (no receipt is emitted). */
  receipt: OperationReceipt | null
  warnings: string[]
}

export interface StepError {
  /** Index into the original statement list of the failed step. */
  statementIndex: number
  id: string | null
  op: string
  code: string
  message: string
}

export interface ExecutionResult {
  ok: boolean
  steps: StepResult[]
  error: StepError | null
  /** Final SSA environment (bindings completed before any failure). */
  environment: ReadonlyMap<string, ResonantState>
  /** All step warnings, flattened in execution order. */
  warnings: string[]
}

export interface ExecuteOptions {
  limits?: ProgramLimits
  /** Deterministic clock override for receipt emission (tests/replay). */
  timestampUtc?: string
}

interface Node {
  statementIndex: number
  statement: Statement
  id: string | null
  deps: string[]
}

/** Stable topological order (Kahn); throws DslError CYCLE_DETECTED. */
export function topologicalOrder(ast: ProgramAst): Node[] {
  const nodes: Node[] = ast.statements.map((statement, statementIndex) => ({
    statementIndex,
    statement,
    id: statementId(statement),
    deps: statementDependencies(statement).map((ref) => ref.name),
  }))
  const producers = new Map<string, Node>()
  for (const node of nodes) {
    if (node.id !== null) producers.set(node.id, node)
  }
  const remaining = new Set(nodes)
  const ordered: Node[] = []
  for (;;) {
    const ready = nodes
      .filter((node) => remaining.has(node) && node.deps.every((dep) => {
        const producer = producers.get(dep)
        return producer === undefined || !remaining.has(producer)
      }))
      .sort((a, b) => a.statementIndex - b.statementIndex)
    if (ready.length === 0) {
      if (remaining.size === 0) return ordered
      const cyclic = [...remaining].map((node) => node.id ?? `step ${node.statementIndex + 1}`)
      throw new DslError(
        'CYCLE_DETECTED',
        `dependency cycle detected among step(s): ${cyclic.join(', ')}; the program graph must be a DAG.`,
      )
    }
    for (const node of ready) {
      remaining.delete(node)
      ordered.push(node)
    }
  }
}

function namedString(statement: Statement, name: string): string | null {
  const value = statement.call.named[name]
  return value !== undefined && value.kind === 'string' ? value.value : null
}

function namedNumber(statement: Statement, name: string): number | null {
  const value = statement.call.named[name]
  return value !== undefined && value.kind === 'number' ? value.value : null
}

function receiptWarnings(receipt: OperationReceipt, op: string): string[] {
  const warnings: string[] = []
  if (receipt.status === 'WARN') {
    warnings.push(`${op}: receipt status is WARN; inspect invariant_results before trusting this step.`)
  } else if (receipt.status === 'FAIL') {
    warnings.push(
      `${op}: receipt status is FAIL (for example, attenuation < 1 without a declared cost fails I3.accounted_change); ` +
        'this step is recorded as a failed operation, not a verified result.',
    )
  }
  if (typeof receipt.parameters.declared_cost === 'string' || receipt.parameters.cost instanceof PyFloat) {
    warnings.push(`${op}: cost is a caller-declared, unverified annotation; adequacy is not checked.`)
  }
  const attenuation = receipt.parameters.attenuation
  if (attenuation instanceof PyFloat && attenuation.value > 1) {
    warnings.push(`${op}: attenuation > 1 amplifies the state; increases are unaccounted by I3 (label-presence gate only).`)
  }
  return warnings
}

export function executeProgram(ast: ProgramAst, options: ExecuteOptions = {}): ExecutionResult {
  const limits = options.limits ?? DEFAULT_PROGRAM_LIMITS
  const environment = new Map<string, ResonantState>()
  const steps: StepResult[] = []
  const warnings: string[] = []

  let ordered: Node[]
  try {
    if (ast.statements.length > limits.maxSteps) {
      throw new DslError(
        'LIMIT_EXCEEDED',
        `program has ${ast.statements.length} steps; step budget is ${limits.maxSteps}.`,
      )
    }
    ordered = topologicalOrder(ast)
  } catch (exc) {
    if (exc instanceof DslError) {
      return {
        ok: false,
        steps,
        error: { statementIndex: -1, id: null, op: '<program>', code: exc.code, message: exc.message },
        environment,
        warnings,
      }
    }
    throw exc
  }

  const ts = options.timestampUtc
  const stamp = <T extends object>(opts: T): T & { timestampUtc?: string } =>
    ts !== undefined ? { ...opts, timestampUtc: ts } : opts

  for (const node of ordered) {
    const { statement } = node
    const call = statement.call
    const id = node.id
    const fail = (code: string, message: string): ExecutionResult => ({
      ok: false,
      steps,
      error: { statementIndex: node.statementIndex, id, op: call.op, code, message },
      environment,
      warnings,
    })
    const resolve = (index: number): ResonantState => {
      const arg = call.args[index]
      if (arg !== undefined && arg.kind === 'identifier') {
        const state = environment.get(arg.name)
        if (state !== undefined) return state
      }
      throw new DslError('UNKNOWN_IDENTIFIER', `step argument ${index + 1} is not a bound state identifier.`)
    }
    const num = (index: number): number => {
      const arg = call.args[index]
      if (arg !== undefined && arg.kind === 'number') return arg.value
      throw new DslError('INVALID_ARGUMENT', `step argument ${index + 1} is not a folded number.`)
    }

    try {
      if (call.op === 'state') {
        const vector = call.args[0]
        if (!vector || vector.kind !== 'vector') {
          return fail('INVALID_ARGUMENT', 'state step is missing its vector literal.')
        }
        const metadataArg = call.named.metadata
        // state() constructs a kernel state only; NO receipt is emitted for
        // state construction (documented semantics, docs/DSL_SPEC.md §3:
        // receipts record operations, and state() is not an operation).
        const state = ResonantState.fromPairs(vector.value, {
          label: namedString(statement, 'label'),
          glyph: namedString(statement, 'glyph'),
          ...(metadataArg !== undefined && metadataArg.kind === 'metadata'
            ? { metadata: metadataArg.value }
            : {}),
        })
        steps.push({ index: steps.length, id, op: call.op, state, receipt: null, warnings: [] })
        if (id !== null) environment.set(id, state)
        continue
      }

      let state: ResonantState
      let receipt: OperationReceipt
      if (call.op === 'harmonic_sum') {
        const result = harmonicSum(
          resolve(0),
          resolve(1),
          stamp({ label: namedString(statement, 'label'), glyph: namedString(statement, 'glyph') }),
        )
        state = result.output
        receipt = result.receipt
      } else if (call.op === 'phase_shift') {
        const result = phaseShift(resolve(0), num(1), stamp({ label: namedString(statement, 'label') }))
        state = result.output
        receipt = result.receipt
      } else if (call.op === 'attenuated_phase_shift') {
        const result = attenuatedPhaseShift(
          resolve(0),
          num(1),
          num(2),
          stamp({ label: namedString(statement, 'label'), costLabel: namedString(statement, 'cost') }),
        )
        state = result.output
        receipt = result.receipt
      } else if (call.op === 'phi_scale') {
        const result = phiScale(resolve(0), num(1), stamp({ label: namedString(statement, 'label') }))
        state = result.output
        receipt = result.receipt
      } else {
        // bridge: records a typed transition between two existing states;
        // creates no new state (the step state is the bridge target).
        const cost = namedNumber(statement, 'cost')
        const result = bridge(
          resolve(0),
          resolve(1),
          stamp({ label: namedString(statement, 'label'), ...(cost !== null ? { cost } : {}) }),
        )
        state = result.target
        receipt = result.receipt
      }
      const stepWarnings = receiptWarnings(receipt, call.op)
      steps.push({ index: steps.length, id, op: call.op, state, receipt, warnings: stepWarnings })
      warnings.push(...stepWarnings)
      if (id !== null) environment.set(id, state)
    } catch (exc) {
      if (exc instanceof DslError) {
        return fail(exc.code, exc.message)
      }
      if (exc instanceof LangarianError) {
        // Kernel typed error -> structured step error, never a traceback.
        return fail('KERNEL_ERROR', `${exc.name}: ${exc.message}`)
      }
      // Defense in depth: even an unexpected raw throw (native TypeError,
      // RangeError, non-Error value) becomes a structured step error; the
      // executor never lets an unhandled exception escape.
      const message = exc instanceof Error ? `${exc.name}: ${exc.message}` : `unexpected throw: ${String(exc)}`
      return fail('KERNEL_ERROR', message)
    }
  }

  return { ok: true, steps, error: null, environment, warnings }
}
