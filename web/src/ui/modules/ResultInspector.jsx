/**
 * Result Inspector: exact readout of the selected operation result or state.
 *
 * Shows output state, input lineage, metrics, invariant expanders,
 * parameters/costs, epistemic tag, claims, receipt id + content hash, all
 * relevant versions, timestamp (non-identity field), tolerance policy, and
 * copy-exact-value controls. WARN/FAIL are never styled as success.
 */

import { useState } from 'react'
import { StatusBadge, TagBadge } from '../components/Badges.jsx'
import { VERSION_MANIFEST } from '../../kernel/version.js'
import { copyText, fmtCx, fmtExact } from '../util/format.js'
import { useWorkbench } from '../WorkbenchContext.jsx'

function StateTable({ state, title }) {
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <dl className="kv">
        <dt>dim</dt><dd>{state.dim}</dd>
        <dt>resonance (exact)</dt><dd>{fmtExact(state.resonance)}</dd>
        <dt>phase rad (exact)</dt><dd>{fmtExact(state.phase)}</dd>
        <dt>state hash</dt><dd>{state.stateHash()}</dd>
        {state.label !== null && <><dt>label</dt><dd>{state.label}</dd></>}
        {state.glyph !== null && <><dt>glyph</dt><dd>{state.glyph}</dd></>}
      </dl>
      <table className="data" aria-label={`${title} exact components`}>
        <thead><tr><th className="num">i</th><th>re</th><th>im</th><th>component</th></tr></thead>
        <tbody>
          {state.vector.map((z, i) => (
            <tr key={i}>
              <td className="num dim-text">{i}</td>
              <td className="mono">{fmtExact(z.re)}</td>
              <td className="mono">{fmtExact(z.im)}</td>
              <td className="mono">{fmtCx(z)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ParamValue({ value }) {
  if (value !== null && typeof value === 'object' && typeof value.value === 'number' && value.constructor?.name === 'PyFloat') {
    return <>{fmtExact(value.value)}</>
  }
  if (typeof value === 'number') return <>{fmtExact(value)}</>
  return <>{String(value)}</>
}

export default function ResultInspector() {
  const { inspection, states, setModule, plainLanguage } = useWorkbench()
  const [copyNote, setCopyNote] = useState('')

  if (inspection === null) {
    return (
      <section className="panel">
        <p className="dim-text">
          Nothing selected yet. Run an operator, run a program, or pick a session state below.
        </p>
        {states.length > 0 && (
          <table className="data" aria-label="session states available for inspection">
            <thead><tr><th>state</th><th className="num">dim</th><th>origin</th><th>hash</th><th></th></tr></thead>
            <tbody>
              {states.map((entry) => (
                <tr key={entry.key}>
                  <td>{entry.state.label ?? entry.state.glyph ?? 'state'}</td>
                  <td className="num">{entry.state.dim}</td>
                  <td className="dim-text">{entry.origin}{entry.note ? ` · ${entry.note}` : ''}</td>
                  <td className="mono">{entry.state.stateHash().slice(0, 28)}…</td>
                  <td><InspectStateButton entry={entry} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    )
  }

  if (inspection.kind === 'state') {
    return (
      <section className="panel panel-formal" aria-labelledby="ri-state-heading">
        <h2 id="ri-state-heading">State inspection</h2>
        <StateTable state={inspection.state} title="Vector (exact values)" />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-ghost btn-small" onClick={async () => {
            await copyText(JSON.stringify(inspection.state.vector.map((z) => [z.re, z.im])))
            setCopyNote('Exact vector copied.')
          }}>⧉ copy exact vector</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={async () => {
            await copyText(inspection.state.stateHash())
            setCopyNote('State hash copied.')
          }}>⧉ copy state hash</button>
        </div>
        {copyNote !== '' && <p className="dim-text" role="status">{copyNote}</p>}
      </section>
    )
  }

  const { op, output, inputs = [], receipt, parameters = {}, stepId } = inspection
  const body = receipt.toBody()
  const knownHashes = new Map(states.map((entry) => [entry.state.stateHash(), entry]))

  return (
    <div>
      <section className="panel panel-formal" aria-labelledby="ri-heading">
        <h2 id="ri-heading">
          Operation: <span className="mono">{op}</span>{stepId ? <span className="dim-text"> (step {stepId})</span> : null}
        </h2>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <StatusBadge status={receipt.status} />
          <TagBadge tag={receipt.epistemicTag} />
        </div>
        <dl className="kv">
          <dt>receipt id (emission event)</dt><dd>{receipt.receiptId()}</dd>
          <dt>content hash (mathematical identity)</dt><dd>{receipt.contentHash()}</dd>
          <dt>timestamp (non-identity field)</dt>
          <dd>{receipt.timestampUtc} <span className="dim-text">— excluded from content_hash</span></dd>
          {receipt.coherenceBefore !== null && <><dt>coherence before (exact)</dt><dd>{fmtExact(receipt.coherenceBefore)}</dd></>}
          {receipt.coherenceAfter !== null && <><dt>coherence after (exact)</dt><dd>{fmtExact(receipt.coherenceAfter)}</dd></>}
          <dt>kernel version</dt><dd>{String(body.kernel_version)}</dd>
          <dt>metric version</dt><dd>{String(body.metric_version)}</dd>
          <dt>receipt schema</dt><dd>{String(body.receipt_schema_version)}</dd>
          <dt>dsl version</dt><dd>{VERSION_MANIFEST.dsl_version}</dd>
          <dt>ts port</dt><dd>{VERSION_MANIFEST.ts_port_version}</dd>
        </dl>

        <h3>Parameters &amp; costs</h3>
        <table className="data" aria-label="operation parameters">
          <thead><tr><th>name</th><th>value (exact)</th><th>note</th></tr></thead>
          <tbody>
            {Object.entries(receipt.parameters).map(([name, value]) => (
              <tr key={name}>
                <td className="mono">{name}</td>
                <td className="mono"><ParamValue value={value} /></td>
                <td className="dim-text">
                  {name === 'declared_cost' || name === 'cost' ? 'caller-declared, unverified' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Input lineage</h3>
        <table className="data" aria-label="input lineage by state hash">
          <thead><tr><th>#</th><th>input state hash</th><th>in session?</th></tr></thead>
          <tbody>
            {receipt.inputHashes.map((hash, i) => {
              const known = knownHashes.get(hash)
              const inputState = inputs[i] ?? known?.state ?? null
              return (
                <tr key={hash}>
                  <td className="num dim-text">{i}</td>
                  <td className="mono">{hash}</td>
                  <td>
                    {inputState !== null ? (
                      <InspectStateButton entry={{ key: hash, state: inputState }} />
                    ) : (
                      <span className="dim-text">not in session table</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {output !== null && output !== undefined && (
        <section className="panel panel-formal" aria-label="output state">
          <StateTable state={output} title="Output state (exact values)" />
        </section>
      )}

      <section className="panel panel-formal" aria-labelledby="ri-invariants-heading">
        <h2 id="ri-invariants-heading">Invariants ({receipt.invariantResults.length})</h2>
        {receipt.invariantResults.map((inv, i) => (
          <details key={`${inv.name}-${i}`} className="expander">
            <summary>
              <StatusBadge status={inv.status} />
              <span className="mono">{inv.name}</span>
            </summary>
            <p style={{ margin: '8px 0 4px' }}>{inv.message}</p>
            <pre className="json" aria-label={`${inv.name} value`}>{JSON.stringify(inv.value, null, 2)}</pre>
          </details>
        ))}
        <p className="panel-sub" style={{ marginTop: 8 }}>
          Receipt status is the collapse of these invariants (any FAIL → FAIL; else any WARN → WARN; empty list → FAIL).
        </p>
      </section>

      <section className="panel panel-formal" aria-labelledby="ri-claims-heading">
        <h2 id="ri-claims-heading">Claims</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {receipt.claims.map((c, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              <TagBadge tag={c.tag} /> {c.text}
            </li>
          ))}
        </ul>

        <h3>Tolerance policy</h3>
        <p className="panel-sub">
          TS/Python conformance: vector and metric values agree to abs ≤ 1e-12 across magnitudes 1e±{'{'}10,100,200{'}'};
          state_hash and content_hash are byte-exact. I5 phase-equivariance tolerance is 1e-9 per operation instance.
          Metric zero conventions: C(0,0)=1, C(0,x)=0. Phase convention: floor-mod 2π, zero vector → 0,
          dominant-component fallback. These are deterministic conventions, not measurements.
        </p>
        {plainLanguage && (
          <p className="panel-sub">
            In plain terms: every number above is exact as computed; checks marked WARN or FAIL mean something
            needs attention, and the receipt fingerprints let anyone detect later edits.
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-ghost btn-small" onClick={async () => {
            await copyText(receipt.toCanonicalJson())
            setCopyNote('Canonical receipt JSON copied (byte-exact).')
          }}>⧉ copy canonical receipt</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={async () => {
            await copyText(receipt.contentHash())
            setCopyNote('Content hash copied.')
          }}>⧉ copy content hash</button>
        </div>
        {copyNote !== '' && <p className="dim-text" role="status">{copyNote}</p>}
      </section>
    </div>
  )
}

function InspectStateButton({ entry }) {
  const { inspect } = useWorkbench()
  return (
    <button
      type="button"
      className="btn btn-ghost btn-small"
      onClick={() => inspect({ kind: 'state', state: entry.state }, false)}
    >
      inspect state
    </button>
  )
}
