/**
 * Shared receipt validation levels for Langarian Math Workbench v0.3
 * (TS mirror of src/langarian/validation.py).
 *
 * Four distinct, separately reported levels:
 * - schema: required fields, types, known enum values, >= 1 invariant
 *   result. Passing this level alone is a shape-only check and must never
 *   be labeled "verified".
 * - hash: content_hash and receipt_id recomputed from the body must match
 *   the recorded values (tamper detection).
 * - status: recorded status must equal the status recomputed by collapsing
 *   invariant_results (empty invariants => FAIL; FAILED tag override).
 * - version: kernel/metric/receipt-schema versions must be in the current
 *   allowlists; older or unknown versions are rejected.
 *
 * Even full success is local consistency verification, not recomputation of
 * the underlying mathematical operation.
 */

import { canonicalJson, type CanonicalValue } from './canonical.js'
import { combineStatuses, type ResultStatus } from './contracts.js'
import { sha256Prefixed } from './sha256.js'
import {
  ALLOWED_KERNEL_VERSIONS,
  ALLOWED_METRIC_VERSIONS,
  ALLOWED_RECEIPT_SCHEMA_VERSIONS,
} from './version.js'

export const REQUIRED_RECEIPT_FIELDS: ReadonlySet<string> = new Set([
  'receipt_id',
  'content_hash',
  'kernel_version',
  'metric_version',
  'receipt_schema_version',
  'operator',
  'input_hashes',
  'output_hash',
  'invariant_results',
  'status',
  'epistemic_tag',
])
export const VALID_STATUSES: ReadonlySet<string> = new Set(['PASS', 'WARN', 'FAIL'])
export const VALID_TAGS: ReadonlySet<string> = new Set([
  'FORMAL',
  'COMPUTED',
  'MODEL',
  'INTERPRETIVE',
  'METAPHOR',
  'OBSERVED',
  'FAILED',
])

export const LEVEL_SCHEMA = 'schema'
export const LEVEL_HASH = 'hash'
export const LEVEL_STATUS = 'status'
export const LEVEL_VERSION = 'version'
export const LEVEL_ORDER = [LEVEL_SCHEMA, LEVEL_HASH, LEVEL_STATUS, LEVEL_VERSION] as const

const IDENTITY_FIELDS = new Set(['receipt_id', 'content_hash'])

export interface ValidationLevel {
  name: string
  ok: boolean
  errors: readonly string[]
}

export interface ValidationLevelSummary {
  schema_valid: boolean
  hash_valid: boolean
  status_consistent: boolean
  version_allowed: boolean
}

export class ReceiptValidation {
  readonly levels: readonly ValidationLevel[]

  constructor(levels: readonly ValidationLevel[]) {
    this.levels = levels
  }

  get ok(): boolean {
    return this.levels.every((level) => level.ok)
  }

  /** True when only the schema level passed — NOT verification. */
  get schemaOnlyOk(): boolean {
    return this.level(LEVEL_SCHEMA).ok && !this.ok
  }

  /** Named four-level summary used by the UI and conformance fixtures. */
  get summary(): ValidationLevelSummary {
    return {
      schema_valid: this.level(LEVEL_SCHEMA).ok,
      hash_valid: this.level(LEVEL_HASH).ok,
      status_consistent: this.level(LEVEL_STATUS).ok,
      version_allowed: this.level(LEVEL_VERSION).ok,
    }
  }

  level(name: string): ValidationLevel {
    const found = this.levels.find((level) => level.name === name)
    if (!found) throw new Error(`no such validation level: ${name}`)
    return found
  }

  errorsFlat(): string[] {
    return this.levels.flatMap((level) => level.errors.map((error) => `${level.name}: ${error}`))
  }

  toDict(): Record<string, CanonicalValue> {
    return {
      ok: this.ok,
      levels: this.levels.map((level) => ({
        name: level.name,
        ok: level.ok,
        errors: Array.from(level.errors),
      })),
    }
  }
}

type ReceiptData = Record<string, CanonicalValue>

function hashJson(data: ReceiptData): string {
  return sha256Prefixed(canonicalJson(data))
}

/** Recompute the deterministic content hash from a parsed receipt body. */
export function recomputeContentHash(data: ReceiptData): string {
  const body: ReceiptData = {}
  for (const key of Object.keys(data)) {
    if (!IDENTITY_FIELDS.has(key) && key !== 'timestamp_utc') body[key] = data[key]!
  }
  return hashJson(body)
}

/** Recompute the emission identity (includes timestamp_utc). */
export function recomputeReceiptId(data: ReceiptData): string {
  const body: ReceiptData = {}
  for (const key of Object.keys(data)) {
    if (!IDENTITY_FIELDS.has(key)) body[key] = data[key]!
  }
  return hashJson(body)
}

function isPlainObject(value: CanonicalValue): value is ReceiptData {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Recompute the collapsed status from invariant_results, or null if unshaped. */
export function recomputeStatus(data: ReceiptData): ResultStatus | null {
  const invariants = data.invariant_results
  if (!Array.isArray(invariants) || invariants.some((item) => !isPlainObject(item))) {
    return null
  }
  if (data.epistemic_tag === 'FAILED') {
    return 'FAIL'
  }
  const statuses: ResultStatus[] = []
  for (const item of invariants) {
    const raw = (item as ReceiptData).status
    if (typeof raw !== 'string' || !VALID_STATUSES.has(raw)) {
      return null
    }
    statuses.push(raw as ResultStatus)
  }
  return combineStatuses(statuses)
}

function schemaLevel(data: ReceiptData): ValidationLevel {
  const errors: string[] = []
  const missing = [...REQUIRED_RECEIPT_FIELDS].filter((field) => !(field in data)).sort()
  if (missing.length > 0) {
    errors.push(`missing required field(s): ${missing.join(', ')}`)
  }

  if ('receipt_id' in data && !String(data.receipt_id).startsWith('sha256:')) {
    errors.push('receipt_id must start with sha256:')
  }
  if ('content_hash' in data && !String(data.content_hash).startsWith('sha256:')) {
    errors.push('content_hash must start with sha256:')
  }

  if (typeof data.status !== 'string' || !VALID_STATUSES.has(data.status)) {
    errors.push(`status must be one of ${[...VALID_STATUSES].sort().join(', ')}`)
  }

  if (typeof data.epistemic_tag !== 'string' || !VALID_TAGS.has(data.epistemic_tag)) {
    errors.push(`epistemic_tag must be one of ${[...VALID_TAGS].sort().join(', ')}`)
  }

  if ('input_hashes' in data) {
    const inputHashes = data.input_hashes
    if (!Array.isArray(inputHashes)) {
      errors.push('input_hashes must be a list')
    } else if (inputHashes.length === 0) {
      errors.push('input_hashes must be non-empty')
    }
  }

  if ('invariant_results' in data) {
    const invariants = data.invariant_results
    if (!Array.isArray(invariants)) {
      errors.push('invariant_results must be a list')
    } else if (invariants.length === 0) {
      errors.push('invariant_results must contain at least one check; empty invariants never mean PASS')
    } else {
      invariants.forEach((invariant, index) => {
        if (!isPlainObject(invariant)) {
          errors.push(`invariant_results[${index}] must be an object`)
          return
        }
        const status = invariant.status
        if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
          errors.push(`invariant_results[${index}].status must be PASS, WARN, or FAIL`)
        }
        if (!invariant.name) {
          errors.push(`invariant_results[${index}].name is required`)
        }
      })
    }
  }

  return { name: LEVEL_SCHEMA, ok: errors.length === 0, errors }
}

function hashLevel(data: ReceiptData): ValidationLevel {
  const errors: string[] = []
  let expectedContent: string
  try {
    expectedContent = recomputeContentHash(data)
  } catch (exc) {
    errors.push(`body cannot be canonically hashed: ${(exc as Error).message}`)
    return { name: LEVEL_HASH, ok: false, errors }
  }
  const recordedContent = data.content_hash
  if (recordedContent === undefined || recordedContent === null) {
    errors.push('content_hash is missing; cannot verify body integrity')
  } else if (recordedContent !== expectedContent) {
    errors.push('content_hash mismatch: body was tampered with or not kernel-generated')
  }
  const recordedId = data.receipt_id
  if (recordedId === undefined || recordedId === null) {
    errors.push('receipt_id is missing')
  } else {
    const expectedId = recomputeReceiptId(data)
    if (recordedId !== expectedId) {
      errors.push('receipt_id mismatch: emission identity does not match body + timestamp')
    }
  }
  return { name: LEVEL_HASH, ok: errors.length === 0, errors }
}

function statusLevel(data: ReceiptData): ValidationLevel {
  const recomputed = recomputeStatus(data)
  if (recomputed === null) {
    return {
      name: LEVEL_STATUS,
      ok: false,
      errors: ['invariant_results are not shaped well enough to recompute status'],
    }
  }
  const recorded = data.status
  if (recorded !== recomputed) {
    return {
      name: LEVEL_STATUS,
      ok: false,
      errors: [`status mismatch: recorded ${JSON.stringify(recorded)} but invariant_results collapse to ${JSON.stringify(recomputed)}`],
    }
  }
  return { name: LEVEL_STATUS, ok: true, errors: [] }
}

function versionLevel(data: ReceiptData): ValidationLevel {
  const errors: string[] = []
  const kernelVersion = data.kernel_version
  if (typeof kernelVersion !== 'string' || !ALLOWED_KERNEL_VERSIONS.has(kernelVersion)) {
    errors.push(
      `kernel_version ${JSON.stringify(kernelVersion)} is not in the allowlist ${JSON.stringify([...ALLOWED_KERNEL_VERSIONS].sort())}`,
    )
  }
  const metricVersion = data.metric_version
  if (typeof metricVersion !== 'string' || !ALLOWED_METRIC_VERSIONS.has(metricVersion)) {
    errors.push(
      `metric_version ${JSON.stringify(metricVersion)} is not in the allowlist ${JSON.stringify([...ALLOWED_METRIC_VERSIONS].sort())}`,
    )
  }
  const schemaVersion = data.receipt_schema_version
  if (typeof schemaVersion !== 'string' || !ALLOWED_RECEIPT_SCHEMA_VERSIONS.has(schemaVersion)) {
    errors.push(
      `receipt_schema_version ${JSON.stringify(schemaVersion)} is not in the allowlist ${JSON.stringify([...ALLOWED_RECEIPT_SCHEMA_VERSIONS].sort())}`,
    )
  }
  return { name: LEVEL_VERSION, ok: errors.length === 0, errors }
}

/** Validate a parsed receipt at all four levels (schema/hash/status/version). */
export function validateReceiptData(data: CanonicalValue): ReceiptValidation {
  if (!isPlainObject(data)) {
    return new ReceiptValidation([{ name: LEVEL_SCHEMA, ok: false, errors: ['receipt must be a JSON object'] }])
  }
  return new ReceiptValidation([schemaLevel(data), hashLevel(data), statusLevel(data), versionLevel(data)])
}
