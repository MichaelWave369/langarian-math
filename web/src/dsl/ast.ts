/**
 * Typed AST for langarian-dsl:v0.3 (docs/DSL_SPEC.md §2).
 *
 * The text syntax and the JSON program form compile to the same AST.
 * Numeric expressions are constant-folded at parse time, so a NumberValue in
 * the AST always carries its folded IEEE-754 double. No eval, no new
 * Function, no dynamic import anywhere in this module tree.
 */

import type { CanonicalValue } from '../kernel/canonical.js'

export const OPERATOR_NAMES = [
  'state',
  'harmonic_sum',
  'phase_shift',
  'attenuated_phase_shift',
  'phi_scale',
  'bridge',
] as const

export type OperatorName = (typeof OPERATOR_NAMES)[number]

export function isOperatorName(name: string): name is OperatorName {
  return (OPERATOR_NAMES as readonly string[]).includes(name)
}

export interface SourcePos {
  line: number
  column: number
}

/** Numeric expression, constant-folded at parse time. */
export interface NumberValue {
  kind: 'number'
  value: number
}

export interface StringValue {
  kind: 'string'
  value: string
}

/** Reference to an SSA binding introduced by an earlier assignment. */
export interface IdentifierRef extends SourcePos {
  kind: 'identifier'
  name: string
}

/** Complex pair literal [re, im]. */
export interface PairLiteral {
  kind: 'pair'
  value: [number, number]
}

/** Vector literal [[re, im], ...] — a non-empty list of complex pairs. */
export interface VectorLiteral {
  kind: 'vector'
  value: [number, number][]
}

/** Metadata object literal; values are kernel JSON-safe canonical values. */
export interface MetadataLiteral {
  kind: 'metadata'
  value: Record<string, CanonicalValue>
}

export type ArgValue = NumberValue | StringValue | IdentifierRef | PairLiteral | VectorLiteral | MetadataLiteral

export interface CallExpr extends SourcePos {
  op: OperatorName
  /** Positional arguments in registry-signature order. */
  args: ArgValue[]
  /** Named arguments (label/glyph/cost/metadata) by name. */
  named: Record<string, ArgValue>
}

export type Statement =
  | ({ kind: 'assignment'; id: string; call: CallExpr } & SourcePos)
  | ({ kind: 'expression'; call: CallExpr } & SourcePos)

export interface ProgramAst {
  statements: Statement[]
}

/** Statement identifier: the SSA binding name, or null for bare calls. */
export function statementId(statement: Statement): string | null {
  return statement.kind === 'assignment' ? statement.id : null
}

/** Identifier references a statement depends on (positional args only). */
export function statementDependencies(statement: Statement): IdentifierRef[] {
  return statement.call.args.filter((arg): arg is IdentifierRef => arg.kind === 'identifier')
}
