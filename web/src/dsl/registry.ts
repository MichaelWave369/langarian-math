/**
 * Closed operator registry for langarian-dsl:v0.3 (docs/DSL_SPEC.md §2).
 *
 * The registry is an allowlist: unknown callable names are parse errors,
 * never dynamic lookups. Positional argument shapes mirror the kernel
 * signatures; named arguments are restricted per operator.
 */

import type { OperatorName } from './ast.js'

/** Expected shape of one positional argument. */
export type PositionalKind = 'vector' | 'reference' | 'number'

export type NamedArgKind = 'string' | 'number' | 'metadata'

export interface OperatorSignature {
  readonly op: OperatorName
  readonly positional: readonly PositionalKind[]
  readonly named: Readonly<Record<string, NamedArgKind>>
}

export const OPERATOR_REGISTRY: Readonly<Record<OperatorName, OperatorSignature>> = {
  state: {
    op: 'state',
    positional: ['vector'],
    named: { label: 'string', glyph: 'string', metadata: 'metadata' },
  },
  harmonic_sum: {
    op: 'harmonic_sum',
    positional: ['reference', 'reference'],
    named: { label: 'string', glyph: 'string' },
  },
  phase_shift: {
    op: 'phase_shift',
    positional: ['reference', 'number'],
    named: { label: 'string' },
  },
  attenuated_phase_shift: {
    op: 'attenuated_phase_shift',
    positional: ['reference', 'number', 'number'],
    named: { cost: 'string', label: 'string' },
  },
  phi_scale: {
    op: 'phi_scale',
    positional: ['reference', 'number'],
    named: { label: 'string' },
  },
  bridge: {
    op: 'bridge',
    positional: ['reference', 'reference'],
    named: { cost: 'number', label: 'string' },
  },
}
