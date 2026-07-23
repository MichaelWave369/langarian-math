/**
 * Lightweight UI smoke tests (no DOM, no new dependencies): the ingest
 * sanitizers, the pasted-array parser, and the two scripted example actions
 * (receipt tampering, Proof Gate rejection) exercised at the engine seam the
 * UI components call.
 */

import { describe, expect, it } from 'vitest'

import { canonicalJson } from '../../src/kernel/canonical.js'
import { wellTypedState } from '../../src/kernel/contracts.js'
import { OperationReceipt } from '../../src/kernel/receipts.js'
import { WorkbenchSession } from '../../src/engine.js'
import { parsePairsText } from '../../src/ui/modules/StateBuilder.jsx'
import { EXAMPLES } from '../../src/ui/data/examples.js'
import { sanitizeFilename, stripIngest } from '../../src/ui/util/sanitize.js'

describe('ingest sanitization', () => {
  it('strips bidi-override and control characters', () => {
    expect(stripIngest('AB‮C‬')).toBe('ABC')
    expect(stripIngest('FORMAL')).toBe('FORMAL')
    expect(stripIngest('ab')).toBe('ab')
    expect(stripIngest('keep\ttabs\nand\nnewlines')).toBe('keep\ttabs\nand\nnewlines')
  })

  it('a bidi homoglyph cannot masquerade as a status string', () => {
    expect(stripIngest('P‮SS‬A')).not.toBe('PASS')
    expect(stripIngest('P‮SS‬A')).toBe('PSSA')
  })

  it('sanitizes export filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('etc-passwd')
    expect(sanitizeFilename('receipt 4')).toBe('receipt 4')
    expect(sanitizeFilename('‮evil‬.json')).toBe('evil.json')
    expect(sanitizeFilename('')).toBe('export')
  })
})

describe('pasted array parser', () => {
  it('parses a valid pair array', () => {
    const result = parsePairsText('[[3,0],[6,0],[9,0]]')
    expect(result).toEqual({ pairs: [[3, 0], [6, 0], [9, 0]] })
  })

  it('rejects malformed input with helpful errors', () => {
    expect(parsePairsText('not json').error).toMatch(/Not valid JSON/)
    expect(parsePairsText('{"a":1}').error).toMatch(/array of \[real, imag\] pairs/)
    expect(parsePairsText('[]').error).toMatch(/at least 1/)
    expect(parsePairsText('[[1,2,3]]').error).toMatch(/Row 1 is not a \[real, imag\] pair/)
    expect(parsePairsText('[[1,"x"]]').error).toMatch(/Row 1/)
    expect(parsePairsText(`[${Array.from({ length: 65 }, () => '[0,0]').join(',')}]`).error).toMatch(/MAX_DIM/)
  })

  it('strips bidi characters before parsing', () => {
    const result = parsePairsText('[[3,0]‮,[6,0]]‬')
    expect(result.pairs).toEqual([[3, 0], [6, 0]])
  })
})

describe('example library data', () => {
  it('contains all twelve required examples with classifications', () => {
    expect(EXAMPLES).toHaveLength(12)
    const ids = EXAMPLES.map((example) => example.id)
    for (const required of [
      'basic-369', 'phase-invariance', 'attenuation-declared-cost', 'attenuation-no-cost-fails',
      'phi-scaling', 'identical-bridge', 'orthogonal-comparison', 'dimension-mismatch',
      'zero-vector-edge', 'receipt-tampering', 'proof-gate-rejection', 'multi-step-chain',
    ]) {
      expect(ids).toContain(required)
    }
    const allowed = new Set(['mathematical', 'computational', 'model', 'interpretive', 'metaphorical'])
    for (const example of EXAMPLES) {
      expect(allowed.has(example.classification)).toBe(true)
    }
  })

  it('every DSL example parses and executes', () => {
    for (const example of EXAMPLES) {
      const session = new WorkbenchSession()
      const run = session.runText(example.source)
      expect(run.execution.ok, `${example.id} should execute`).toBe(true)
      expect(run.execution.steps.length).toBeGreaterThan(0)
    }
  })
})

describe('scripted example actions (engine seam)', () => {
  it('tampered receipt import is quarantined on the hash level', () => {
    const tamper = EXAMPLES.find((example) => example.id === 'receipt-tampering')!
    const session = new WorkbenchSession()
    const run = session.runText(tamper.source)
    const seq = run.ledgerSeqs[run.ledgerSeqs.length - 1]!
    const original = session.ledger.inspect(seq)
    const tampered = { ...original, output_hash: `sha256:${'0'.repeat(64)}` }
    const { entry } = session.ledger.importReceipt(canonicalJson(tampered))
    expect(entry.quarantine.length).toBeGreaterThan(0)
    expect(entry.validation.hash_valid).toBe(false)
    expect(session.ledger.detectAltered().map((e) => e.seq)).toContain(entry.seq)
  })

  it('gate example receipt validates honestly but is gate-blocked', () => {
    const gateExample = EXAMPLES.find((example) => example.id === 'proof-gate-rejection')!
    const session = new WorkbenchSession()
    const run = session.runText(gateExample.source)
    const lastState = [...run.execution.steps].reverse().find((step) => step.state !== null)!.state!
    const hash = lastState.stateHash()
    const receipt = new OperationReceipt({
      operator: 'phase_shift',
      inputHashes: [hash],
      outputHash: hash,
      invariantResults: [wellTypedState(lastState)],
      epistemicTag: 'MODEL',
      claims: [
        { text: 'interpretive reading', tag: 'INTERPRETIVE', evidence: [], metadata: {} },
        { text: 'promoted model claim', tag: 'COMPUTED', evidence: [], metadata: { promoted_from: 'MODEL' } },
      ],
    })
    const { entry } = session.ledger.importReceipt(receipt.toCanonicalJson())
    // Honestly constructed: all four validation levels pass...
    expect(entry.validation).toEqual({
      schema_valid: true,
      hash_valid: true,
      status_consistent: true,
      version_allowed: true,
    })
    expect(entry.quarantine).toEqual([])
    // ...but the claims are still inadmissible at the Proof Gate by tag rules.
    const claims = (entry.receipt.claims as { tag: string; metadata?: Record<string, unknown> }[])
    expect(claims[0]!.tag).toBe('INTERPRETIVE')
    expect(claims[1]!.metadata!.promoted_from).toBe('MODEL')
  })
})
