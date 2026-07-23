/**
 * Operation receipts and stable hashing (TS mirror of src/langarian/receipts.py).
 *
 * Two distinct identities:
 * - contentHash(): deterministic mathematical identity of the operation
 *   record; excludes timestamp_utc and receipt_id.
 * - receiptId(): emission-event identity; includes timestamp_utc.
 */

import { canonicalJson, PyFloat, type CanonicalValue } from './canonical.js'
import { combineStatuses, type InvariantResult, type ResultStatus } from './contracts.js'
import { sha256Prefixed } from './sha256.js'
import { KERNEL_VERSION, METRIC_VERSION, RECEIPT_SCHEMA_VERSION } from './version.js'

export type EpistemicTag = 'FORMAL' | 'COMPUTED' | 'MODEL' | 'INTERPRETIVE' | 'METAPHOR' | 'OBSERVED' | 'FAILED'

export interface Claim {
  text: string
  tag: EpistemicTag
  evidence: readonly string[]
  metadata: Record<string, CanonicalValue>
}

export const claim = (text: string, tag: EpistemicTag): Claim => ({ text, tag, evidence: [], metadata: {} })

export interface OperationReceiptInit {
  operator: string
  inputHashes: readonly string[]
  outputHash: string
  parameters?: Record<string, CanonicalValue>
  coherenceBefore?: number | null
  coherenceAfter?: number | null
  invariantResults?: readonly InvariantResult[]
  epistemicTag?: EpistemicTag
  claims?: readonly Claim[]
  timestampUtc?: string
}

function invariantToDict(result: InvariantResult): Record<string, CanonicalValue> {
  return {
    name: result.name,
    status: result.status,
    message: result.message,
    value: result.value,
    metadata: result.metadata,
  }
}

function claimToDict(item: Claim): Record<string, CanonicalValue> {
  return {
    text: item.text,
    tag: item.tag,
    evidence: Array.from(item.evidence),
    metadata: item.metadata,
  }
}

export class OperationReceipt {
  readonly operator: string
  readonly inputHashes: readonly string[]
  readonly outputHash: string
  readonly parameters: Record<string, CanonicalValue>
  readonly coherenceBefore: number | null
  readonly coherenceAfter: number | null
  readonly invariantResults: readonly InvariantResult[]
  readonly epistemicTag: EpistemicTag
  readonly claims: readonly Claim[]
  readonly timestampUtc: string

  constructor(init: OperationReceiptInit) {
    this.operator = init.operator
    this.inputHashes = Object.freeze(init.inputHashes.slice())
    this.outputHash = init.outputHash
    this.parameters = Object.freeze({ ...(init.parameters ?? {}) })
    this.coherenceBefore = init.coherenceBefore ?? null
    this.coherenceAfter = init.coherenceAfter ?? null
    this.invariantResults = Object.freeze((init.invariantResults ?? []).slice())
    this.epistemicTag = init.epistemicTag ?? 'COMPUTED'
    this.claims = Object.freeze((init.claims ?? []).slice())
    this.timestampUtc = init.timestampUtc ?? new Date().toISOString()
    Object.freeze(this)
  }

  get status(): ResultStatus {
    if (this.epistemicTag === 'FAILED') return 'FAIL'
    return combineStatuses(this.invariantResults.map((result) => result.status))
  }

  body(includeReceiptId = false): Record<string, CanonicalValue> {
    const body: Record<string, CanonicalValue> = {
      kernel_version: KERNEL_VERSION,
      metric_version: METRIC_VERSION,
      receipt_schema_version: RECEIPT_SCHEMA_VERSION,
      timestamp_utc: this.timestampUtc,
      operator: this.operator,
      input_hashes: Array.from(this.inputHashes),
      output_hash: this.outputHash,
      parameters: this.parameters as CanonicalValue,
      coherence_before: this.coherenceBefore === null ? null : new PyFloat(this.coherenceBefore),
      coherence_after: this.coherenceAfter === null ? null : new PyFloat(this.coherenceAfter),
      invariant_results: this.invariantResults.map(invariantToDict),
      status: this.status,
      epistemic_tag: this.epistemicTag,
      claims: this.claims.map(claimToDict),
    }
    if (includeReceiptId) {
      body.content_hash = this.contentHash()
      body.receipt_id = this.receiptId()
    }
    return body
  }

  /** Deterministic content identity; excludes timestamp and receipt_id. */
  contentHash(): string {
    const body = this.body(false)
    delete body.timestamp_utc
    return sha256Prefixed(canonicalJson(body))
  }

  /** Emission-event identity; includes timestamp_utc (unique per emission). */
  receiptId(): string {
    return sha256Prefixed(canonicalJson(this.body(false)))
  }

  /** Full receipt body including content_hash and receipt_id. */
  toBody(): Record<string, CanonicalValue> {
    return this.body(true)
  }

  /** Canonical JSON of the full body (byte-exact with the Python kernel). */
  toCanonicalJson(): string {
    return canonicalJson(this.toBody())
  }
}
