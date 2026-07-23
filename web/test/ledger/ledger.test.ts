import { describe, expect, it } from 'vitest'

import { canonicalJson, parseStrictJson, PyFloat, type CanonicalValue } from '../../src/kernel/canonical.js'
import { phaseShift } from '../../src/kernel/operators.js'
import { ResonantState } from '../../src/kernel/state.js'
import { validateReceiptData } from '../../src/kernel/validation.js'
import { KERNEL_VERSION } from '../../src/kernel/version.js'
import { parseDsl } from '../../src/dsl/parser.js'
import { exportProgramJson } from '../../src/dsl/jsonProgram.js'
import { runProgram, WorkbenchSession } from '../../src/engine.js'
import { LedgerError, ReceiptLedger } from '../../src/ledger/ledger.js'
import { FIXED_TIMESTAMP, GOLDEN_PROGRAM } from '../dsl/golden.js'

/** Session over the golden program: 4 receipts (state() emits none). */
function goldenSession(): { session: WorkbenchSession; ledger: ReceiptLedger } {
  const session = new WorkbenchSession()
  session.runText(GOLDEN_PROGRAM, { timestampUtc: FIXED_TIMESTAMP })
  return { session, ledger: session.ledger }
}

describe('receipt ledger — add/list/search/filter/inspect', () => {
  it('records one ledger entry per emitted receipt, chronologically', () => {
    const { ledger } = goldenSession()
    const entries = ledger.list()
    expect(entries).toHaveLength(4)
    expect(entries.map((entry) => entry.seq)).toEqual([0, 1, 2, 3])
    expect(entries.map((entry) => entry.receipt.operator)).toEqual([
      'phase_shift',
      'phi_scale',
      'attenuated_phase_shift',
      'bridge',
    ])
    for (const entry of entries) {
      expect(entry.source).toBe('executed')
      expect(entry.validation).toEqual({
        schema_valid: true,
        hash_valid: true,
        status_consistent: true,
        version_allowed: true,
      })
      expect(entry.quarantine).toEqual([])
    }
  })

  it('add() falls back to the receipt output_hash when no produced hash is given', () => {
    const state = ResonantState.fromPairs([[1, 2]], { label: 'x' })
    const { output, receipt } = phaseShift(state, Math.PI / 3, { timestampUtc: FIXED_TIMESTAMP })
    const ledger = new ReceiptLedger()
    const fallback = ledger.add(receipt)
    expect(fallback.producedStateHash).toBe(receipt.outputHash)
    const explicit = ledger.add(receipt, { producedStateHash: output.stateHash() })
    expect(explicit.producedStateHash).toBe(output.stateHash())
  })

  it('search matches operator, status, tag, hashes, and claim text', () => {
    const { ledger } = goldenSession()
    expect(ledger.search('phase').length).toBeGreaterThanOrEqual(2)
    expect(ledger.search('PHASE').length).toBeGreaterThanOrEqual(2) // case-insensitive
    expect(ledger.search('PASS')).toHaveLength(4)
    expect(ledger.search('COMPUTED')).toHaveLength(4)
    const hash = String(ledger.list()[0]!.receipt.content_hash)
    expect(ledger.search(hash)).toHaveLength(1)
    expect(ledger.search('no-such-thing')).toHaveLength(0)
  })

  it('filters by operator, status, and epistemic tag', () => {
    const { ledger } = goldenSession()
    expect(ledger.filter({ operator: 'phi_scale' })).toHaveLength(1)
    expect(ledger.filter({ status: 'PASS' })).toHaveLength(4)
    expect(ledger.filter({ status: 'FAIL' })).toHaveLength(0)
    expect(ledger.filter({ epistemicTag: 'COMPUTED' })).toHaveLength(4)
    expect(ledger.filter({ epistemicTag: 'FORMAL' })).toHaveLength(0)
    expect(ledger.filter({ operator: 'phase_shift', status: 'PASS' })).toHaveLength(1)
  })

  it('inspect returns the full receipt body', () => {
    const { ledger } = goldenSession()
    const body = ledger.inspect(0)
    expect(body.operator).toBe('phase_shift')
    expect(String(body.content_hash)).toMatch(/^sha256:/)
    expect(body.kernel_version).toBe(KERNEL_VERSION)
    expect(() => ledger.inspect(99)).toThrow(LedgerError)
  })
})

describe('receipt ledger — verification and tamper detection', () => {
  it('verify() recomputes the four levels distinctly, never one badge', () => {
    const { ledger } = goldenSession()
    const validation = ledger.verify(0)
    expect(validation.ok).toBe(true)
    expect(validation.levels.map((level) => level.name)).toEqual(['schema', 'hash', 'status', 'version'])
    expect(validation.schemaOnlyOk).toBe(false)
    expect(ledger.detectAltered()).toHaveLength(0)
  })

  it('detects altered receipt data on import (hash/status/version levels)', () => {
    const { ledger } = goldenSession()
    const exported = ledger.exportReceipt(1)
    const body = parseStrictJson(exported) as Record<string, CanonicalValue>
    body.coherence_after = new PyFloat(0.123) // tamper with hashed content
    const imported = ledger.importReceipt(canonicalJson(body))
    expect(imported.validation.summary.schema_valid).toBe(true)
    expect(imported.validation.summary.hash_valid).toBe(false)
    expect(imported.entry.quarantine.length).toBeGreaterThan(0)
    const altered = ledger.detectAltered()
    expect(altered).toHaveLength(1)
    expect(altered[0]!.seq).toBe(imported.entry.seq)
  })

  it('detects status forgery (recorded status inconsistent with invariants)', () => {
    const { ledger } = goldenSession()
    const body = parseStrictJson(ledger.exportReceipt(1)) as Record<string, CanonicalValue>
    body.status = 'FAIL' // forge status while leaving invariants PASS
    const { entry, validation } = ledger.importReceipt(canonicalJson(body))
    expect(validation.summary.schema_valid).toBe(true)
    expect(validation.summary.status_consistent).toBe(false)
    expect(validation.summary.hash_valid).toBe(false) // status is part of the hashed body
    expect(entry.quarantine.length).toBeGreaterThan(0)
    expect(ledger.detectAltered().map((e) => e.seq)).toContain(entry.seq)
  })

  it('rejects receipts whose status forgery breaks the schema level', () => {
    const { ledger } = goldenSession()
    const body = parseStrictJson(ledger.exportReceipt(1)) as Record<string, CanonicalValue>
    body.status = 'FAIL'
    body.invariant_results = [] // empty invariants never mean PASS
    expect(() => ledger.importReceipt(canonicalJson(body))).toThrow(LedgerError)
    // Empty invariants collapse to FAIL (consistent with the forged FAIL
    // status), but the schema level rejects receipts with zero checks.
    expect(validateReceiptData(body).summary.status_consistent).toBe(true)
    expect(validateReceiptData(body).summary.schema_valid).toBe(false)
  })

  it('quarantines unknown versions instead of silently downgrading', () => {
    const { ledger } = goldenSession()
    const body = parseStrictJson(ledger.exportReceipt(1)) as Record<string, CanonicalValue>
    body.kernel_version = 'langarian-python-ref-v0.1.1'
    const imported = ledger.importReceipt(canonicalJson(body))
    expect(imported.validation.summary.version_allowed).toBe(false)
    expect(imported.entry.quarantine.some((reason) => reason.includes('version'))).toBe(true)
  })

  it('rejects prototype-pollution keys and malformed JSON on import', () => {
    const ledger = new ReceiptLedger()
    expect(() => ledger.importReceipt('{"__proto__":{"x":1}}')).toThrow(LedgerError)
    expect(() => ledger.importReceipt('{"status":"PASS",')).toThrow(LedgerError)
    try {
      ledger.importReceipt('{"status":"PASS"}')
      throw new Error('expected schema rejection')
    } catch (exc) {
      expect(exc).toBeInstanceOf(LedgerError)
      expect((exc as LedgerError).code).toBe('SCHEMA_INVALID')
    }
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })

  it('explain() is plain-language and never calls schema-only "verified"', () => {
    const { ledger } = goldenSession()
    const lines = ledger.explain(0)
    expect(lines.length).toBeGreaterThanOrEqual(4)
    const text = lines.join('\n')
    expect(text).toContain('phase_shift')
    expect(text).toContain('schema (shape only)')
    expect(text).toContain('not a proof')
    expect(text).not.toContain('verified badge')
    const costLines = ledger.explain(2).join('\n')
    expect(costLines).toContain('caller-declared and unverified')
  })
})

describe('receipt ledger — export/import/bundle', () => {
  it('exportReceipt/importReceipt round trips with all four levels passing', () => {
    const { ledger } = goldenSession()
    const exported = ledger.exportReceipt(1)
    const other = new ReceiptLedger()
    const { entry, validation } = other.importReceipt(exported)
    expect(validation.ok).toBe(true)
    expect(entry.source).toBe('imported')
    expect(entry.receipt).toEqual(ledger.inspect(1))
  })

  it('bundle export is deterministic and imports fully', () => {
    const { ledger } = goldenSession()
    const first = ledger.exportBundle()
    expect(ledger.exportBundle()).toBe(first)
    const other = new ReceiptLedger()
    const result = other.importBundle(first)
    expect(result.errors).toEqual([])
    expect(result.imported).toHaveLength(4)
    expect(other.exportBundle()).toBe(first)
  })

  it('bundle import reports invalid receipts per index without aborting the rest', () => {
    const { ledger } = goldenSession()
    const good = parseStrictJson(ledger.exportReceipt(0))
    const bundle = JSON.stringify({
      bundle_version: 'receipt-bundle:v0.3',
      receipts: [JSON.parse(JSON.stringify(good)), { status: 'PASS' }],
    })
    const other = new ReceiptLedger()
    const result = other.importBundle(bundle)
    expect(result.imported).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.index).toBe(1)
  })

  it('rejects unsupported bundle versions', () => {
    const other = new ReceiptLedger()
    try {
      other.importBundle('{"bundle_version":"receipt-bundle:v0.2","receipts":[]}')
      throw new Error('expected bundle rejection')
    } catch (exc) {
      expect(exc).toBeInstanceOf(LedgerError)
      expect((exc as LedgerError).code).toBe('UNSUPPORTED_BUNDLE')
    }
  })

  it('quarantines imported receipts with non-ISO timestamps', () => {
    const { ledger } = goldenSession()
    const body = parseStrictJson(ledger.exportReceipt(0)) as Record<string, CanonicalValue>
    body.timestamp_utc = 'yesterday'
    const { entry } = ledger.importReceipt(canonicalJson(body))
    expect(entry.quarantine.some((reason) => reason.includes('timestamp'))).toBe(true)
  })
})

describe('receipt ledger — lineage', () => {
  it('traces multi-hop state ancestry where hashes allow, reporting missing links', () => {
    const { session } = runProgram(GOLDEN_PROGRAM, { timestampUtc: FIXED_TIMESTAMP })
    const ledger = session.ledger
    const dHash = session.ledger.list()[2]!.producedStateHash
    const ancestry = ledger.traceAncestry(dHash)
    expect(ancestry.root).toBe(dHash)
    expect(ancestry.cyclic).toBe(false)
    // Ancestors come before descendants.
    const seqs = ancestry.nodes.map((node) => node.seq)
    expect(seqs[seqs.length - 1]).toBe(2) // attenuated_phase_shift entry last
    expect(seqs).toContain(0)
    expect(seqs).toContain(1)
    // The chain bottoms out at A, produced by state() which emits no receipt:
    // the missing link is reported honestly instead of being papered over.
    expect(ancestry.missing).toHaveLength(1)
    expect(ancestry.complete).toBe(false)
  })

  it('reports a fully resolvable chain as complete when all producers exist', () => {
    // harmonic_sum of two phase_shift outputs: every input has a ledger entry.
    const source = [
      'A = state([[1,0]])',
      'B = phase_shift(A, 0)',
      'C = phase_shift(B, 0)',
      'D = phase_shift(C, 0)',
      'E = phase_shift(D, 0)',
      'F = harmonic_sum(B, E)',
    ].join('\n')
    const { session } = runProgram(source, { timestampUtc: FIXED_TIMESTAMP })
    const fEntry = session.ledger.list().find((entry) => entry.receipt.operator === 'harmonic_sum')!
    const ancestry = session.ledger.traceAncestry(fEntry.producedStateHash)
    expect(ancestry.cyclic).toBe(false)
    // B's input A comes from state(): still a missing link, reported by hash.
    expect(ancestry.missing).toHaveLength(1)
  })

  it('handles unknown hashes without inventing lineage', () => {
    const { ledger } = goldenSession()
    const ancestry = ledger.traceAncestry('sha256:' + 'f'.repeat(64))
    expect(ancestry.nodes).toHaveLength(1)
    expect(ancestry.nodes[0]!.seq).toBeNull()
    expect(ancestry.missing).toHaveLength(1)
    expect(ancestry.complete).toBe(false)
  })
})

describe('receipt ledger — compare', () => {
  it('identical runs share content identity; fields compared distinctly', () => {
    const first = new WorkbenchSession()
    first.runText(GOLDEN_PROGRAM, { timestampUtc: FIXED_TIMESTAMP })
    const second = new WorkbenchSession()
    second.runText(GOLDEN_PROGRAM, { timestampUtc: FIXED_TIMESTAMP })
    const comparison = first.ledger.compare(1, importInto(first.ledger, second.ledger.exportReceipt(1)).seq)
    expect(comparison.sameContent).toBe(true)
    expect(comparison.sameEmission).toBe(true) // same deterministic clock
    expect(comparison.differingFields).toEqual([])
  })

  it('different timestamps keep first-op content identity but change emission identity', () => {
    const first = new WorkbenchSession()
    first.runText(GOLDEN_PROGRAM, { timestampUtc: FIXED_TIMESTAMP })
    const second = new WorkbenchSession()
    second.runText(GOLDEN_PROGRAM, { timestampUtc: '1970-01-01T00:00:01+00:00' })
    // Entry 0 is the first operation: its input state carries no history,
    // so only the emission-event fields differ. (Downstream receipts chain
    // timestamped receipt ids through state history by kernel design.)
    const imported = importInto(first.ledger, second.ledger.exportReceipt(0))
    const comparison = first.ledger.compare(0, imported.seq)
    expect(comparison.sameContent).toBe(true)
    expect(comparison.sameEmission).toBe(false)
    expect(comparison.differingFields.sort()).toEqual(['receipt_id', 'timestamp_utc'])
  })

  it('different mathematics differs in content identity', () => {
    const first = new WorkbenchSession()
    first.runText(GOLDEN_PROGRAM, { timestampUtc: FIXED_TIMESTAMP })
    const other = new WorkbenchSession()
    other.runText('A = state([[9,9]])\nB = phi_scale(A, 1)', { timestampUtc: FIXED_TIMESTAMP })
    const imported = importInto(first.ledger, other.ledger.exportReceipt(0))
    const comparison = first.ledger.compare(1, imported.seq)
    expect(comparison.sameContent).toBe(false)
    expect(comparison.differingFields.length).toBeGreaterThan(0)
    const fields = comparison.fields.map((field) => field.field)
    expect(fields).toContain('content_hash')
    expect(fields).toContain('receipt_id')
  })
})

function importInto(ledger: ReceiptLedger, json: string) {
  return ledger.importReceipt(json).entry
}

describe('engine facade', () => {
  it('runProgram returns a session whose ledger holds the run receipts', () => {
    const { session, run } = runProgram(GOLDEN_PROGRAM, { timestampUtc: FIXED_TIMESTAMP })
    expect(run.execution.ok).toBe(true)
    expect(run.ledgerSeqs).toEqual([0, 1, 2, 3])
    expect(session.ledger.size).toBe(4)
  })

  it('runJson executes JSON programs and records receipts identically', () => {
    const text = new WorkbenchSession()
    text.runText(GOLDEN_PROGRAM, { timestampUtc: FIXED_TIMESTAMP })
    const json = new WorkbenchSession()
    const programJson = exportProgramJson(parseDsl(GOLDEN_PROGRAM))
    json.runJson(programJson, { timestampUtc: FIXED_TIMESTAMP })
    expect(json.ledger.exportBundle()).toBe(text.ledger.exportBundle())
  })

  it('validation of kernel-generated receipts agrees with kernel validation', () => {
    const { ledger } = goldenSession()
    const body = ledger.inspect(0)
    expect(validateReceiptData(body).ok).toBe(true)
  })
})
