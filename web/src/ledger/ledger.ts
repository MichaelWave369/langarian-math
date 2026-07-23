/**
 * Session receipt ledger for Langarian Math Workbench v0.3.
 *
 * The ledger is the local audit trail for operation receipts
 * (docs/RECEIPT_SCHEMA_vNEXT.md). Design rules:
 *
 * - Verification is never collapsed into one badge: every entry carries the
 *   four distinct kernel validation levels
 *   {schema_valid, hash_valid, status_consistent, version_allowed}, and
 *   `verify` recomputes them live via the kernel. Shape-only passes are
 *   never labeled "verified"; local recomputation of the mathematics is a
 *   separate, explicit operation that this engine does not perform.
 * - Tamper detection recomputes content_hash/receipt_id/status from the
 *   stored body; imported receipts are validated on entry and quarantined
 *   (with explicit reasons) when any level fails, instead of being silently
 *   trusted (Lane H finding H-1).
 * - Imported JSON goes through the kernel strict parser
 *   (parseStrictJson): __proto__/constructor/prototype keys, duplicate
 *   keys, deep nesting, and non-finite literals are rejected (L-14).
 * - Lineage (traceAncestry) is a ledger-level multi-hop check over recorded
 *   state hashes — where hashes allow; missing links are reported, never
 *   papered over. Cycles in the ancestry graph are detected and reported.
 *
 * Documented deviation (carried forward): `add` accepts an optional
 * producedStateHash and falls back to the receipt's output_hash when it is
 * not supplied, so locally executed steps record the exact produced state
 * hash while plain receipt-only callers still get a usable lineage key.
 */

import { canonicalJson, parseStrictJson, type CanonicalValue } from '../kernel/canonical.js'
import type { OperationReceipt } from '../kernel/receipts.js'
import {
  validateReceiptData,
  type ReceiptValidation,
  type ValidationLevelSummary,
} from '../kernel/validation.js'

export const RECEIPT_BUNDLE_VERSION = 'receipt-bundle:v0.3'

export type LedgerErrorCode =
  | 'INVALID_JSON'
  | 'SCHEMA_INVALID'
  | 'UNSUPPORTED_BUNDLE'
  | 'NOT_FOUND'
  | 'INVALID_ARGUMENT'

export class LedgerError extends Error {
  readonly code: LedgerErrorCode

  constructor(code: LedgerErrorCode, message: string) {
    super(message)
    this.name = 'LedgerError'
    this.code = code
  }
}

export type LedgerEntrySource = 'executed' | 'imported'

export interface LedgerEntry {
  /** Monotonic insertion index; defines chronological order. */
  seq: number
  /** Full receipt body including content_hash and receipt_id. */
  receipt: Record<string, CanonicalValue>
  /** State hash this receipt produced (fallback: receipt output_hash). */
  producedStateHash: string
  source: LedgerEntrySource
  /** Four-level validation summary captured at add/import time. */
  validation: ValidationLevelSummary
  /** Explicit quarantine reasons; empty means the entry is clean. */
  quarantine: string[]
}

export interface LedgerFilter {
  operator?: string
  status?: string
  epistemicTag?: string
}

export interface AncestryNode {
  hash: string
  /** Ledger seq of the entry that produced this hash, or null if unknown. */
  seq: number | null
  /** Input state hashes recorded on that receipt. */
  inputs: string[]
}

export interface AncestryResult {
  root: string
  /** Nodes in dependency order (ancestors before descendants). */
  nodes: AncestryNode[]
  /** Input hashes with no producing entry in this ledger. */
  missing: string[]
  /** True if a hash was its own ancestor (would break topological replay). */
  cyclic: boolean
  /** True when every input hash resolved to a ledger entry and acyclic. */
  complete: boolean
}

export interface FieldComparison {
  field: string
  equal: boolean
  a: CanonicalValue | undefined
  b: CanonicalValue | undefined
}

export interface ReceiptComparison {
  seqA: number
  seqB: number
  /** Same mathematical content (content_hash equality). */
  sameContent: boolean
  /** Same emission event (receipt_id equality). */
  sameEmission: boolean
  differingFields: string[]
  fields: FieldComparison[]
}

export interface BundleImportResult {
  imported: LedgerEntry[]
  errors: { index: number; message: string }[]
}

const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

function asRecord(body: Record<string, CanonicalValue>): Record<string, CanonicalValue> {
  return body
}

function isSha256Prefixed(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('sha256:')
}

export class ReceiptLedger {
  private readonly entries: LedgerEntry[] = []

  get size(): number {
    return this.entries.length
  }

  /**
   * Add a locally executed receipt. producedStateHash falls back to the
   * receipt's output_hash when not supplied (documented deviation above).
   */
  add(receipt: OperationReceipt, options: { producedStateHash?: string } = {}): LedgerEntry {
    const body = asRecord(receipt.toBody())
    const fallback = isSha256Prefixed(body.output_hash) ? body.output_hash : String(body.output_hash)
    return this.addBody(body, 'executed', options.producedStateHash ?? fallback)
  }

  private addBody(
    body: Record<string, CanonicalValue>,
    source: LedgerEntrySource,
    producedStateHash: string,
    extraQuarantine: string[] = [],
  ): LedgerEntry {
    const validation = validateReceiptData(body).summary
    const quarantine = [...extraQuarantine]
    if (!validation.hash_valid) quarantine.push('hash level failed: body integrity not verified')
    if (!validation.status_consistent) quarantine.push('status level failed: recorded status inconsistent with invariants')
    if (!validation.version_allowed) quarantine.push('version level failed: unsupported kernel/metric/schema version')
    const entry: LedgerEntry = {
      seq: this.entries.length,
      receipt: body,
      producedStateHash,
      source,
      validation,
      quarantine,
    }
    this.entries.push(entry)
    return entry
  }

  /** Chronological list of all entries (insertion order). */
  list(): LedgerEntry[] {
    return [...this.entries]
  }

  /** Case-insensitive substring search across operator/status/tag/hashes/claims. */
  search(query: string): LedgerEntry[] {
    const needle = query.toLowerCase()
    if (needle === '') return this.list()
    return this.entries.filter((entry) => this.haystack(entry).includes(needle))
  }

  private haystack(entry: LedgerEntry): string {
    const body = entry.receipt
    const claims = Array.isArray(body.claims) ? body.claims : []
    const claimText = claims
      .map((item) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) return ''
        const text = (item as Record<string, CanonicalValue>).text
        return typeof text === 'string' ? text : ''
      })
      .join(' ')
    const inputs = Array.isArray(body.input_hashes) ? body.input_hashes.join(' ') : ''
    return [
      String(body.operator ?? ''),
      String(body.status ?? ''),
      String(body.epistemic_tag ?? ''),
      String(body.content_hash ?? ''),
      String(body.receipt_id ?? ''),
      String(body.output_hash ?? ''),
      entry.producedStateHash,
      inputs,
      claimText,
    ]
      .join('\n')
      .toLowerCase()
  }

  /** Exact-match filter by operator, status, and/or epistemic tag. */
  filter(criteria: LedgerFilter): LedgerEntry[] {
    return this.entries.filter((entry) => {
      if (criteria.operator !== undefined && entry.receipt.operator !== criteria.operator) return false
      if (criteria.status !== undefined && entry.receipt.status !== criteria.status) return false
      if (criteria.epistemicTag !== undefined && entry.receipt.epistemic_tag !== criteria.epistemicTag) return false
      return true
    })
  }

  private entryAt(seq: number): LedgerEntry {
    const entry = this.entries[seq]
    if (entry === undefined) {
      throw new LedgerError('NOT_FOUND', `no ledger entry with seq=${seq}.`)
    }
    return entry
  }

  /** Full receipt body of an entry (inspect before trusting). */
  inspect(seq: number): Record<string, CanonicalValue> {
    return this.entryAt(seq).receipt
  }

  /**
   * Recompute all four kernel validation levels live for an entry. The four
   * levels are reported distinctly — never collapsed into one badge.
   */
  verify(seq: number): ReceiptValidation {
    return validateReceiptData(this.entryAt(seq).receipt)
  }

  /**
   * Entries whose stored receipt data fails live recomputation of the
   * hash, status, or version levels (altered or forged receipt data).
   */
  detectAltered(): LedgerEntry[] {
    return this.entries.filter((entry) => {
      const validation = validateReceiptData(entry.receipt)
      return (
        validation.summary.schema_valid &&
        (!validation.summary.hash_valid || !validation.summary.status_consistent || !validation.summary.version_allowed)
      )
    })
  }

  /** Plain-language explanation of one entry; suitable for non-experts. */
  explain(seq: number): string[] {
    const entry = this.entryAt(seq)
    const body = entry.receipt
    const lines: string[] = []
    lines.push(
      `Entry ${entry.seq}: a receipt recording one ${String(body.operator ?? 'unknown')} operation ` +
        `(${entry.source === 'executed' ? 'produced by this session' : 'imported from outside'}).`,
    )
    lines.push(
      `Recorded status: ${String(body.status ?? '?')} with epistemic tag ${String(body.epistemic_tag ?? '?')}. ` +
        'The status is the collapse of the listed invariant checks; it is not a proof.',
    )
    const v = entry.validation
    lines.push(
      `Integrity checks — schema (shape only): ${v.schema_valid ? 'pass' : 'FAIL'}; ` +
        `hash (body not tampered): ${v.hash_valid ? 'pass' : 'FAIL'}; ` +
        `status consistency: ${v.status_consistent ? 'pass' : 'FAIL'}; ` +
        `version allowlist: ${v.version_allowed ? 'pass' : 'FAIL'}.`,
    )
    lines.push(
      'A schema pass alone only means the document is receipt-shaped — it is never "verification". ' +
        'Even all four levels passing means local consistency, not recomputation of the mathematics.',
    )
    lines.push(
      `Content hash ${String(body.content_hash ?? '?')} identifies the mathematical record (stable across identical re-runs); ` +
        `receipt id ${String(body.receipt_id ?? '?')} identifies this single emission event.`,
    )
    const params = body.parameters
    if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
      if ('cost' in params || 'declared_cost' in params) {
        lines.push('This receipt carries a cost annotation. Cost is caller-declared and unverified; adequacy is not checked.')
      }
    }
    if (entry.quarantine.length > 0) {
      lines.push(`Quarantined: ${entry.quarantine.join('; ')}. Do not treat this receipt as trustworthy.`)
    }
    return lines
  }

  /** Deterministic canonical JSON export of one receipt body. */
  exportReceipt(seq: number): string {
    return canonicalJson(this.entryAt(seq).receipt)
  }

  /** Deterministic canonical JSON bundle of all receipts, chronological. */
  exportBundle(): string {
    const bundle: Record<string, CanonicalValue> = {
      bundle_version: RECEIPT_BUNDLE_VERSION,
      receipts: this.entries.map((entry) => entry.receipt),
    }
    return canonicalJson(bundle)
  }

  /**
   * Import one receipt from JSON text. Strict parsing and schema-level
   * validation are mandatory; receipts failing hash/status/version levels or
   * the ISO-8601 timestamp format check are imported but quarantined with
   * explicit reasons (never silently trusted).
   */
  importReceipt(json: string): { entry: LedgerEntry; validation: ReceiptValidation } {
    let data: CanonicalValue
    try {
      data = parseStrictJson(json)
    } catch (exc) {
      throw new LedgerError('INVALID_JSON', `invalid receipt JSON: ${(exc as Error).message}`)
    }
    return this.importReceiptData(data)
  }

  private importReceiptData(data: CanonicalValue): { entry: LedgerEntry; validation: ReceiptValidation } {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new LedgerError('SCHEMA_INVALID', 'imported receipt must be a JSON object.')
    }
    const body = data as Record<string, CanonicalValue>
    const validation = validateReceiptData(body)
    if (!validation.summary.schema_valid) {
      throw new LedgerError(
        'SCHEMA_INVALID',
        `imported receipt fails the schema level: ${validation.level('schema').errors.join('; ')}`,
      )
    }
    const quarantine: string[] = []
    const timestamp = body.timestamp_utc
    if (typeof timestamp !== 'string' || !ISO_8601_UTC.test(timestamp)) {
      quarantine.push('timestamp_utc is not ISO-8601 UTC format; ledger ordering by time is unverified')
    }
    const fallback = isSha256Prefixed(body.output_hash) ? body.output_hash : String(body.output_hash)
    const entry = this.addBody(body, 'imported', fallback, quarantine)
    return { entry, validation }
  }

  /**
   * Import a bundle produced by exportBundle. Valid receipts are imported;
   * invalid ones are reported per index and do not abort the rest.
   */
  importBundle(json: string): BundleImportResult {
    let data: CanonicalValue
    try {
      data = parseStrictJson(json)
    } catch (exc) {
      throw new LedgerError('INVALID_JSON', `invalid bundle JSON: ${(exc as Error).message}`)
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new LedgerError('UNSUPPORTED_BUNDLE', 'bundle must be a JSON object.')
    }
    const bundle = data as Record<string, CanonicalValue>
    if (bundle.bundle_version !== RECEIPT_BUNDLE_VERSION) {
      throw new LedgerError(
        'UNSUPPORTED_BUNDLE',
        `bundle_version ${JSON.stringify(bundle.bundle_version)} is not supported; expected ${JSON.stringify(RECEIPT_BUNDLE_VERSION)}.`,
      )
    }
    if (!Array.isArray(bundle.receipts)) {
      throw new LedgerError('UNSUPPORTED_BUNDLE', 'bundle requires a receipts array.')
    }
    const result: BundleImportResult = { imported: [], errors: [] }
    bundle.receipts.forEach((item, index) => {
      try {
        result.imported.push(this.importReceiptData(item).entry)
      } catch (exc) {
        result.errors.push({ index, message: (exc as Error).message })
      }
    })
    return result
  }

  /**
   * Multi-hop state ancestry over recorded hashes (ledger-level check).
   * Missing links and cycles are reported explicitly; absence of a link is
   * not treated as a failure of the kernel one-hop I4 invariant.
   */
  traceAncestry(stateHash: string): AncestryResult {
    const nodes = new Map<string, AncestryNode>()
    const missing = new Set<string>()
    let cyclic = false
    const inStack = new Set<string>()
    const done = new Set<string>()

    // First producer wins: several receipts can reference the same state
    // hash (for example bridge records the target without creating a new
    // state), and the earliest entry is the operation that created it.
    const producerOf = (hash: string): LedgerEntry | null => {
      for (let i = 0; i < this.entries.length; i++) {
        if (this.entries[i]!.producedStateHash === hash) return this.entries[i]!
      }
      return null
    }

    const visit = (hash: string): void => {
      if (done.has(hash)) return
      if (inStack.has(hash)) {
        cyclic = true
        return
      }
      inStack.add(hash)
      const entry = producerOf(hash)
      if (entry === null) {
        missing.add(hash)
      }
      const inputs =
        entry !== null && Array.isArray(entry.receipt.input_hashes)
          ? entry.receipt.input_hashes.filter((h): h is string => typeof h === 'string')
          : []
      for (const input of inputs) {
        if (producerOf(input) === null && !done.has(input)) {
          missing.add(input)
          continue
        }
        visit(input)
      }
      inStack.delete(hash)
      done.add(hash)
      nodes.set(hash, { hash, seq: entry !== null ? entry.seq : null, inputs })
    }

    visit(stateHash)
    if (producerOf(stateHash) === null && !nodes.has(stateHash)) {
      nodes.set(stateHash, { hash: stateHash, seq: null, inputs: [] })
      missing.add(stateHash)
    }
    return {
      root: stateHash,
      nodes: [...nodes.values()],
      missing: [...missing],
      cyclic,
      complete: missing.size === 0 && !cyclic,
    }
  }

  /**
   * Field-by-field comparison of two receipts. content_hash equality means
   * the same mathematical record; receipt_id equality means the same
   * emission event. Fields are never reduced to a single verdict.
   */
  compare(seqA: number, seqB: number): ReceiptComparison {
    const a = this.entryAt(seqA).receipt
    const b = this.entryAt(seqB).receipt
    const fieldNames = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
    const fields: FieldComparison[] = fieldNames.map((field) => {
      const va = a[field]
      const vb = b[field]
      let equal: boolean
      if (va === undefined || vb === undefined) {
        equal = va === vb
      } else {
        try {
          equal = canonicalJson(va) === canonicalJson(vb)
        } catch {
          equal = false
        }
      }
      return { field, equal, a: va, b: vb }
    })
    return {
      seqA,
      seqB,
      sameContent: a.content_hash !== undefined && a.content_hash === b.content_hash,
      sameEmission: a.receipt_id !== undefined && a.receipt_id === b.receipt_id,
      differingFields: fields.filter((field) => !field.equal).map((field) => field.field),
      fields,
    }
  }
}
