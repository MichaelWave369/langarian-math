/**
 * Structured DSL errors for langarian-dsl:v0.3.
 *
 * Every parse/validation failure is a structured {line, column, code, message}
 * error (docs/DSL_SPEC.md §4), never an unhandled exception. JSON-program
 * structural errors use line/column 0 (no source positions exist in JSON).
 */

export const DSL_ERROR_CODES = [
  'UNEXPECTED_TOKEN',
  'UNTERMINATED_STRING',
  'UNKNOWN_IDENTIFIER',
  'UNKNOWN_OPERATOR',
  'DUPLICATE_BINDING',
  'RESERVED_IDENTIFIER',
  'ARITY_MISMATCH',
  'INVALID_ARGUMENT',
  'INVALID_NAMED_ARG',
  'NON_CONSTANT_NUMERIC',
  'INVALID_NUMBER',
  'LIMIT_EXCEEDED',
  'CYCLE_DETECTED',
  'DSL_VERSION_UNSUPPORTED',
  'INVALID_PROGRAM',
] as const

export type DslErrorCode = (typeof DSL_ERROR_CODES)[number]

export class DslError extends Error {
  readonly line: number
  readonly column: number
  readonly code: DslErrorCode

  constructor(code: DslErrorCode, message: string, line = 0, column = 0) {
    super(message)
    this.name = 'DslError'
    this.code = code
    this.line = line
    this.column = column
  }

  toJSON(): { line: number; column: number; code: DslErrorCode; message: string } {
    return { line: this.line, column: this.column, code: this.code, message: this.message }
  }
}
