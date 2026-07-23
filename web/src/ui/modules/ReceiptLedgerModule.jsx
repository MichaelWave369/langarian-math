/**
 * Receipt Ledger: session audit trail over the ledger engine.
 *
 * Honesty contract (SPEC §3.6, Lane H H-1):
 * - the four validation levels (schema/hash/status/version) are always shown
 *   distinctly — a shape-only pass is never labeled "verified";
 * - the three actions keep their exact names: "Check shape",
 *   "Verify hash/status/version", "Recompute locally";
 * - altered data is detected by live recomputation and explained;
 * - imported receipts are validated on entry; failures are quarantined and
 *   visibly separated from clean entries.
 */

import { useMemo, useState } from 'react'
import { canonicalJson, PyFloat } from '../../kernel/canonical.js'
import {
  attenuatedPhaseShift,
  bridge,
  harmonicSum,
  phaseShift,
  phiScale,
} from '../../kernel/operators.js'
import { StatusBadge, TagBadge, ValidationLevels } from '../components/Badges.jsx'
import { copyText, downloadText, fmtExact } from '../util/format.js'
import { sanitizeFilename, stripIngest } from '../util/sanitize.js'
import { useWorkbench } from '../WorkbenchContext.jsx'

const STATUS_OPTIONS = ['PASS', 'WARN', 'FAIL']
const TAG_OPTIONS = ['FORMAL', 'COMPUTED', 'MODEL', 'INTERPRETIVE', 'METAPHOR', 'OBSERVED', 'FAILED']

function numOf(value) {
  if (value instanceof PyFloat) return value.value
  if (typeof value === 'number') return value
  return null
}

/** Attempt a local re-execution of the operation recorded in a receipt body. */
function recomputeLocally(body, sessionStates) {
  const byHash = new Map(sessionStates.map((entry) => [entry.state.stateHash(), entry.state]))
  const inputs = (Array.isArray(body.input_hashes) ? body.input_hashes : []).map((hash) => byHash.get(hash) ?? null)
  if (inputs.some((state) => state === null)) {
    return {
      ok: false,
      detail:
        'Input states for this receipt are not present in the session table, so the mathematics cannot be ' +
        're-executed locally. Hash/status/version recomputation (the other action) verifies the record itself.',
    }
  }
  const params = typeof body.parameters === 'object' && body.parameters !== null ? body.parameters : {}
  const declaredCost = typeof params.declared_cost === 'string' ? params.declared_cost : null
  let recomputed
  try {
    switch (body.operator) {
      case 'harmonic_sum':
        recomputed = harmonicSum(inputs[0], inputs[1])
        break
      case 'phase_shift':
        recomputed = phaseShift(inputs[0], numOf(params.angle_radians))
        break
      case 'attenuated_phase_shift':
        recomputed = attenuatedPhaseShift(inputs[0], numOf(params.angle_radians), numOf(params.attenuation), { costLabel: declaredCost })
        break
      case 'phi_scale':
        recomputed = phiScale(inputs[0], numOf(params.n))
        break
      case 'bridge': {
        const out = bridge(inputs[0], inputs[1], { cost: numOf(params.cost) ?? 0 })
        const match = out.receipt.outputHash === body.output_hash
        return {
          ok: match,
          detail: match
            ? `Locally re-executed bridge reproduces the recorded target hash and coherence ${fmtExact(out.coherence)}.`
            : `Local re-execution produced a different record (coherence ${fmtExact(out.coherence)}); the stored receipt does not reproduce from session states.`,
        }
      }
      default:
        return { ok: false, detail: `No local re-execution path for operator "${String(body.operator)}".` }
    }
  } catch (exc) {
    return { ok: false, detail: `Local re-execution raised ${exc.name}: ${exc.message}` }
  }
  const outputMatch = recomputed.output.stateHash() === body.output_hash
  const contentMatch = recomputed.receipt.contentHash() === body.content_hash
  return {
    ok: outputMatch && contentMatch,
    detail:
      `Recomputed output hash ${outputMatch ? 'matches' : 'DOES NOT match'} the recorded output_hash; ` +
      `recomputed content hash ${contentMatch ? 'matches' : 'DOES NOT match'} the recorded content_hash. ` +
      (outputMatch && contentMatch
        ? 'The mathematical record reproduces locally from session states.'
        : 'The stored record does not reproduce from session states — treat it as unverified.'),
  }
}

function LedgerEntryRow({ entry, marked, onMark, states }) {
  const { session } = useWorkbench()
  const [open, setOpen] = useState(false)
  const [actionResult, setActionResult] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const [ancestry, setAncestry] = useState(null)
  const body = entry.receipt
  const quarantined = entry.quarantine.length > 0

  const doCheckShape = () => {
    const validation = session.ledger.verify(entry.seq)
    const level = validation.level('schema')
    setActionResult({
      ok: level.ok,
      title: 'Check shape (schema level only — not verification)',
      lines: level.ok
        ? ['Schema level passes: required fields, enums, and at least one invariant are present. This says nothing about integrity or truth.']
        : level.errors,
    })
  }

  const doVerify = () => {
    const validation = session.ledger.verify(entry.seq)
    setActionResult({
      ok: validation.level('hash').ok && validation.level('status').ok && validation.level('version').ok,
      title: 'Verify hash/status/version (live recomputation of three distinct levels)',
      lines: validation.levels
        .filter((level) => level.name !== 'schema')
        .map((level) => `${level.name}: ${level.ok ? 'pass' : `FAIL — ${level.errors.join('; ')}`}`),
    })
  }

  const doRecompute = () => {
    const outcome = recomputeLocally(body, states)
    setActionResult({ ok: outcome.ok, title: 'Recompute locally (re-execute the mathematics from session states)', lines: [outcome.detail] })
  }

  return (
    <li className={`ledger-entry${quarantined ? ' ledger-entry-quarantined' : ''}`}>
      <div className="btn-row">
        <span className="mono dim-text">#{entry.seq}</span>
        <strong className="mono">{String(body.operator ?? '?')}</strong>
        <StatusBadge status={Object.prototype.hasOwnProperty.call({ PASS: 1, WARN: 1, FAIL: 1 }, body.status) ? body.status : 'FAIL'} />
        <TagBadge tag={typeof body.epistemic_tag === 'string' ? body.epistemic_tag : 'FAILED'} />
        <span className={`badge ${entry.source === 'executed' ? 'tag-computed' : 'tag-interpretive'}`}>
          <span className="badge-text">{entry.source}</span>
        </span>
        {quarantined && <span className="badge status-fail"><span className="badge-icon" aria-hidden="true">⛔</span><span className="badge-text">quarantined</span></span>}
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'collapse' : 'inspect'}
        </button>
        <label className="switch-row" style={{ margin: 0 }}>
          <input type="checkbox" checked={marked} onChange={(event) => onMark(entry.seq, event.target.checked)} />
          <span>compare</span>
        </label>
      </div>
      <div className="mono dim-text" style={{ fontSize: 12, marginTop: 4 }}>
        content {String(body.content_hash ?? '—').slice(0, 32)}… · {String(body.timestamp_utc ?? 'no timestamp')}
      </div>
      {quarantined && (
        <div className="error-box" role="alert">
          <strong>Quarantine reasons:</strong>
          <ul style={{ margin: '4px 0 0' }}>
            {entry.quarantine.map((reason, i) => <li key={i}>{reason}</li>)}
          </ul>
        </div>
      )}
      {open && (
        <div style={{ marginTop: 10 }}>
          <ValidationLevels summary={entry.validation} />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-small" onClick={doCheckShape}>Check shape</button>
            <button type="button" className="btn btn-small" onClick={doVerify}>Verify hash/status/version</button>
            <button type="button" className="btn btn-small" onClick={doRecompute}>Recompute locally</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setExplanation(session.ledger.explain(entry.seq))}>Explain</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setAncestry(session.ledger.traceAncestry(entry.producedStateHash))}>Trace ancestry</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={async () => copyText(canonicalJson(body))}>⧉ copy canonical JSON</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => downloadText(`${sanitizeFilename(`receipt-${entry.seq}`)}.json`, canonicalJson(body) + '\n')}>export</button>
          </div>
          {actionResult !== null && (
            <div className={`action-result ${actionResult.ok ? 'action-ok' : 'action-bad'}`} role="status">
              <strong>{actionResult.title}</strong>
              <ul style={{ margin: '4px 0 0' }}>
                {actionResult.lines.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          )}
          {explanation !== null && (
            <div className="action-result" role="status">
              <strong>Plain-language explanation</strong>
              <ul style={{ margin: '4px 0 0' }}>
                {explanation.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setExplanation(null)}>hide</button>
            </div>
          )}
          {ancestry !== null && (
            <div className="action-result" role="status">
              <strong>
                Ancestry of {ancestry.root.slice(0, 24)}… — {ancestry.complete ? 'complete and acyclic' : 'INCOMPLETE'}
                {ancestry.cyclic ? ' (cycle detected — topological replay impossible)' : ''}
              </strong>
              <ul style={{ margin: '4px 0 0' }}>
                {ancestry.nodes.map((node) => (
                  <li key={node.hash} className="mono" style={{ fontSize: 12 }}>
                    {node.hash.slice(0, 24)}… ← produced by {node.seq !== null ? `entry #${node.seq}` : 'nothing in this ledger'}
                    {node.inputs.length > 0 ? ` · inputs: ${node.inputs.map((h) => h.slice(0, 12) + '…').join(', ')}` : ''}
                  </li>
                ))}
                {ancestry.missing.map((hash) => (
                  <li key={hash} className="warn-text">missing link: {hash.slice(0, 32)}… has no producing entry in this ledger</li>
                ))}
              </ul>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setAncestry(null)}>hide</button>
            </div>
          )}
          <h3 style={{ marginTop: 10 }}>Receipt body (canonical JSON)</h3>
          <pre className="json">{canonicalJson(body)}</pre>
        </div>
      )}
    </li>
  )
}

export default function ReceiptLedgerModule() {
  const { session, ledgerTick, states, plainLanguage } = useWorkbench()
  const [query, setQuery] = useState('')
  const [opFilter, setOpFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [marked, setMarked] = useState([])
  const [comparison, setComparison] = useState(null)

  // ledgerTick pins the memo to ledger mutations.
  const ledger = session.ledger
  const all = useMemo(() => ledger.list(), [ledger, ledgerTick])
  const altered = useMemo(() => ledger.detectAltered(), [ledger, ledgerTick])

  const visible = useMemo(() => {
    const searched = query.trim() === '' ? ledger.search(stripIngest(query)) : all
    const criteria = {}
    if (opFilter !== '') criteria.operator = opFilter
    if (statusFilter !== '') criteria.status = statusFilter
    if (tagFilter !== '') criteria.epistemicTag = tagFilter
    const filtered = Object.keys(criteria).length > 0 ? ledger.filter(criteria) : searched
    const set = new Set(filtered.map((entry) => entry.seq))
    return searched.filter((entry) => set.has(entry.seq))
  }, [ledger, all, query, opFilter, statusFilter, tagFilter])

  const clean = visible.filter((entry) => entry.quarantine.length === 0)
  const quarantined = visible.filter((entry) => entry.quarantine.length > 0)
  const operators = [...new Set(all.map((entry) => String(entry.receipt.operator ?? '')))].sort()

  const onMark = (seq, on) => {
    setMarked((current) => (on ? [...new Set([...current, seq])].slice(-2) : current.filter((s) => s !== seq)))
    setComparison(null)
  }

  const doImport = (kind) => {
    try {
      if (kind === 'bundle') {
        const result = ledger.importBundle(stripIngest(importText))
        setImportResult({
          ok: result.errors.length === 0,
          lines: [
            `${result.imported.length} receipt(s) imported (${result.imported.filter((e) => e.quarantine.length > 0).length} quarantined).`,
            ...result.errors.map((err) => `index ${err.index}: ${err.message}`),
          ],
        })
      } else {
        const { entry, validation } = ledger.importReceipt(stripIngest(importText))
        setImportResult({
          ok: entry.quarantine.length === 0,
          lines: [
            `Imported as entry #${entry.seq}.`,
            ...(entry.quarantine.length > 0 ? [`Quarantined: ${entry.quarantine.join('; ')}`] : []),
            `levels: schema=${validation.summary.schema_valid} hash=${validation.summary.hash_valid} status=${validation.summary.status_consistent} version=${validation.summary.version_allowed}`,
          ],
        })
      }
      setImportText('')
    } catch (exc) {
      setImportResult({ ok: false, lines: [`${exc.name}: ${exc.message}`] })
    }
  }

  return (
    <div>
      <section className="panel panel-formal" aria-labelledby="ledger-toolbar-heading">
        <h2 id="ledger-toolbar-heading">Session ledger ({all.length} entries)</h2>
        <div className="btn-row">
          <label className="field" style={{ minWidth: 200 }}>
            <span>search</span>
            <input type="text" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="operator, hash, claim text…" aria-label="search receipts" />
          </label>
          <label className="field">
            <span>operator</span>
            <select value={opFilter} onChange={(event) => setOpFilter(event.target.value)} aria-label="filter by operator">
              <option value="">all</option>
              {operators.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </label>
          <label className="field">
            <span>status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="filter by status">
              <option value="">all</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>epistemic tag</span>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="filter by epistemic tag">
              <option value="">all</option>
              {TAG_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={all.length === 0}
            onClick={() => downloadText(`${sanitizeFilename('langarian-receipts')}.json`, ledger.exportBundle() + '\n')}
          >
            Export bundle
          </button>
        </div>
        {altered.length > 0 && (
          <div className="error-box" role="alert">
            <strong>Altered data detected:</strong> {altered.length} entr{altered.length === 1 ? 'y' : 'ies'} fail live
            recomputation of hash/status/version: seq {altered.map((entry) => `#${entry.seq}`).join(', ')}.
            The stored bytes no longer match their own fingerprints — do not trust these records.
          </div>
        )}
        {plainLanguage && (
          <p className="panel-sub" style={{ marginTop: 8 }}>
            The ledger is the audit trail. "Check shape" only confirms a document looks like a receipt;
            "Verify hash/status/version" recomputes its fingerprints; "Recompute locally" re-runs the math from
            states still present in this session. Passing shape alone is never verification.
          </p>
        )}
      </section>

      {marked.length === 2 && (
        <section className="panel panel-formal" aria-labelledby="compare-heading">
          <h2 id="compare-heading">Compare entries #{marked[0]} and #{marked[1]}</h2>
          <div className="btn-row">
            <button type="button" className="btn btn-small" onClick={() => setComparison(ledger.compare(marked[0], marked[1]))}>
              Run field-by-field comparison
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => { setMarked([]); setComparison(null) }}>clear</button>
          </div>
          {comparison !== null && (
            <div style={{ marginTop: 8 }}>
              <p>
                same mathematical content (content_hash equal): <strong>{comparison.sameContent ? 'yes' : 'no'}</strong>
                {' · '}same emission event (receipt_id equal): <strong>{comparison.sameEmission ? 'yes' : 'no'}</strong>
              </p>
              <table className="data" aria-label="receipt field comparison">
                <thead><tr><th>field</th><th>equal</th><th>entry #{comparison.seqA}</th><th>entry #{comparison.seqB}</th></tr></thead>
                <tbody>
                  {comparison.fields.map((field) => (
                    <tr key={field.field} className={field.equal ? '' : 'compare-diff'}>
                      <td className="mono">{field.field}</td>
                      <td>{field.equal ? '✓' : '✕'}</td>
                      <td className="mono">{field.a === undefined ? '—' : fieldValue(field.a)}</td>
                      <td className="mono">{field.b === undefined ? '—' : fieldValue(field.b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel panel-formal" aria-labelledby="ledger-list-heading">
        <h2 id="ledger-list-heading">Chronological entries ({clean.length})</h2>
        {clean.length === 0 && <p className="dim-text">No matching clean entries. Run operators or programs to record receipts.</p>}
        <ol className="ledger-list" aria-label="clean ledger entries">
          {clean.map((entry) => (
            <LedgerEntryRow key={entry.seq} entry={entry} states={states}
              marked={marked.includes(entry.seq)} onMark={onMark} />
          ))}
        </ol>
      </section>

      <section className="panel panel-quarantined" aria-labelledby="quarantine-heading">
        <h2 id="quarantine-heading">Quarantined ({quarantined.length})</h2>
        <p className="panel-sub">
          Entries that failed a validation level or carry a non-ISO timestamp. They are kept for audit but
          visibly separated and never trusted.
        </p>
        {quarantined.length === 0 && <p className="dim-text">Nothing quarantined.</p>}
        <ol className="ledger-list" aria-label="quarantined ledger entries">
          {quarantined.map((entry) => (
            <LedgerEntryRow key={entry.seq} entry={entry} states={states}
              marked={marked.includes(entry.seq)} onMark={onMark} />
          ))}
        </ol>
      </section>

      <section className="panel panel-formal" aria-labelledby="import-heading">
        <h2 id="import-heading">Import receipts</h2>
        <p className="panel-sub">
          Paste one receipt (canonical JSON) or a whole bundle. Imports are strictly parsed (prototype-pollution
          keys, duplicate keys, deep nesting, and non-finite literals are rejected), validated on entry, and
          quarantined when any level fails.
        </p>
        <textarea rows={5} className="code" value={importText} onChange={(event) => setImportText(event.target.value)}
          aria-label="paste receipt or bundle JSON" spellCheck={false} />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button type="button" className="btn" disabled={importText.trim() === ''} onClick={() => doImport('receipt')}>Import receipt</button>
          <button type="button" className="btn" disabled={importText.trim() === ''} onClick={() => doImport('bundle')}>Import bundle</button>
        </div>
        {importResult !== null && (
          <div className={`action-result ${importResult.ok ? 'action-ok' : 'action-bad'}`} role="status" style={{ marginTop: 8 }}>
            <ul style={{ margin: 0 }}>
              {importResult.lines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

function fieldValue(value) {
  try {
    const text = canonicalJson(value)
    return text.length > 80 ? text.slice(0, 80) + '…' : text
  } catch {
    return String(value)
  }
}
