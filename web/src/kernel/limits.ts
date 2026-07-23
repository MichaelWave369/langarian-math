/**
 * Resource limits and typed kernel errors for Langarian Math Workbench v0.3.
 *
 * Mirror of src/langarian/limits.py. Exceeding a limit is always a typed
 * error, never an unhandled exception.
 */

export const MAX_DIM = 64
export const MAX_STATES = 32
export const MAX_PROGRAM_STEPS = 64
export const MAX_DSL_TOKENS = 4096
export const MAX_AST_DEPTH = 32
export const MAX_METADATA_BYTES = 4096
export const MAX_LABEL_CHARS = 120
export const MAX_GLYPH_CHARS = 16
export const MAX_PHI_SCALE_POWER = 64

/** Base class for typed kernel errors. */
export class LangarianError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LangarianError'
  }
}

/**
 * Mirror of Python's TypeError (error.name === 'TypeError'). Named
 * LangarianTypeError to avoid shadowing the native global, but it is a typed
 * kernel error (instanceof LangarianError), never a raw native TypeError.
 */
export class LangarianTypeError extends LangarianError {
  constructor(message: string) {
    super(message)
    this.name = 'TypeError'
  }
}

/** Mirror of Python's ValueError (error.name === 'ValueError'). */
export class ValueError extends LangarianError {
  constructor(message: string) {
    super(message)
    this.name = 'ValueError'
  }
}

/** A declared resource limit was exceeded. */
export class LimitError extends ValueError {
  constructor(message: string) {
    super(message)
    this.name = 'LimitError'
  }
}

/** A metric computation produced a non-finite or invalid intermediate. */
export class MetricError extends LangarianError {
  constructor(message: string) {
    super(message)
    this.name = 'MetricError'
  }
}
