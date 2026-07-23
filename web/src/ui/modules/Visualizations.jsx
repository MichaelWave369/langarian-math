/**
 * Visualizations: static SVG/HTML views over session states and the ledger.
 *
 * Every view is a deterministic rendering of exact kernel values — no
 * animation, nothing that implies physical dynamics. Each view ships with
 * definition, scale, edge-case behavior, and an exact table alternative.
 */

import { useMemo, useState } from 'react'
import { absCx } from '../../kernel/complex.js'
import { normalizedComplexSimilarity } from '../../kernel/metrics.js'
import { StatusBadge } from '../components/Badges.jsx'
import { EmptyViz, StateSelect, VizFrame, findState } from '../components/Viz.jsx'
import { fmtExact, fmtShort } from '../util/format.js'
import { useWorkbench } from '../WorkbenchContext.jsx'

const TWO_PI = 2 * Math.PI

/* ---------- 1. complex-plane component plot (Argand plane) ---------- */

function ComplexPlane({ state }) {
  const size = 260
  const half = size / 2
  const mags = state.vector.map(absCx)
  const rmax = Math.max(...mags)
  const scale = rmax > 0 ? (half - 24) / rmax : 0
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={`Argand plane plot of ${state.dim} complex components`} style={{ width: '100%', maxWidth: 340 }}>
      <line x1={0} y1={half} x2={size} y2={half} stroke="#1b2940" />
      <line x1={half} y1={0} x2={half} y2={size} stroke="#1b2940" />
      {rmax > 0 && (
        <circle cx={half} cy={half} r={scale} fill="none" stroke="#155e6b" strokeDasharray="4 4" />
      )}
      {state.vector.map((z, i) => {
        const x = half + (scale > 0 ? z.re * scale : 0)
        const y = half - (scale > 0 ? z.im * scale : 0)
        return (
          <g key={i}>
            <line x1={half} y1={half} x2={x} y2={y} stroke="#155e6b" strokeWidth={1} />
            <circle cx={x} cy={y} r={4} fill="#67e8f9" />
            <text x={x + 7} y={y - 5} fill="#9fb2c8" fontSize={10} fontFamily="monospace">{i}</text>
          </g>
        )
      })}
      <text x={size - 12} y={half - 6} fill="#9fb2c8" fontSize={10} textAnchor="end">Re</text>
      <text x={half + 6} y={12} fill="#9fb2c8" fontSize={10}>Im</text>
    </svg>
  )
}

function componentTable(state) {
  return (
    <table className="data" aria-label="exact components with magnitude and argument">
      <thead><tr><th className="num">i</th><th>re</th><th>im</th><th>|zᵢ|</th><th>arg zᵢ (rad)</th></tr></thead>
      <tbody>
        {state.vector.map((z, i) => (
          <tr key={i}>
            <td className="num dim-text">{i}</td>
            <td className="mono">{fmtExact(z.re)}</td>
            <td className="mono">{fmtExact(z.im)}</td>
            <td className="mono">{fmtExact(absCx(z))}</td>
            <td className="mono">{fmtExact(Math.atan2(z.im, z.re) < 0 ? Math.atan2(z.im, z.re) + TWO_PI : Math.atan2(z.im, z.re))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------- 2. amplitude/phase bars ---------- */

function Bars({ values, max, color, format, ariaLabel }) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {values.map((value, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span className="mono dim-text" style={{ width: 18, textAlign: 'right' }}>{i}</span>
          <div style={{ flex: 1, background: '#070d17', borderRadius: 3, height: 14 }}>
            <div style={{
              width: `${max > 0 ? Math.max(1, (value / max) * 100) : 0}%`,
              height: '100%', background: color, borderRadius: 3,
            }} />
          </div>
          <span className="mono" style={{ minWidth: 130 }}>{format(value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- main module ---------- */

export default function Visualizations() {
  const { states, inspection, session, ledgerTick } = useWorkbench()
  const [singleKey, setSingleKey] = useState('')
  const [cmpAKey, setCmpAKey] = useState('')
  const [cmpBKey, setCmpBKey] = useState('')

  const single = findState(states, singleKey) ?? states[states.length - 1]?.state ?? null
  const cmpA = findState(states, cmpAKey)
  const cmpB = findState(states, cmpBKey)

  const ledgerEntries = useMemo(() => {
    void ledgerTick
    return session.ledger.list()
  }, [session, ledgerTick])

  const coherence = useMemo(() => {
    if (states.length === 0) return null
    return states.map((row) => states.map((col) => normalizedComplexSimilarity(row.state, col.state)))
  }, [states])

  return (
    <div>
      {states.length === 0 && (
        <div className="notice" role="status">
          <span>No session states yet — build states, run operators, or load an example; visualizations render whatever is in the session table.</span>
        </div>
      )}

      <section className="panel" aria-label="visualization state selector">
        <div className="btn-row">
          <StateSelect states={states} value={singleKey} onChange={setSingleKey}
            label="state for plane / bars / distributions (default: latest)" />
        </div>
      </section>

      <div className="two-col">
        <VizFrame
          title="Complex-plane components"
          definition="Each component zᵢ is a point (re, im) on the Argand plane; spokes join the origin to each point. This is a static display of the vector, not a trajectory or dynamics."
          scale="points are scaled so the largest |zᵢ| fits the plot radius; the dashed circle marks that maximum magnitude. A zero vector collapses all points to the origin and the circle is omitted."
          edgeCases="zero components sit at the origin; negative values mirror across axes; nothing is normalized away — the plot uses raw component values."
          table={single ? componentTable(single) : <EmptyViz>No state selected.</EmptyViz>}
        >
          {single ? <ComplexPlane state={single} /> : <EmptyViz>No state selected.</EmptyViz>}
        </VizFrame>

        <VizFrame
          title="Amplitude & phase bars"
          definition="Per-component magnitude |zᵢ| and argument arg(zᵢ) ∈ [0, 2π). Bars are a reading aid only."
          scale="magnitude bars scale to the largest component magnitude; phase bars span [0, 2π)."
          edgeCases="a zero-magnitude component has argument atan2(0,0) = 0 shown as 0; an all-zero state shows empty magnitude bars."
          table={single ? componentTable(single) : <EmptyViz>No state selected.</EmptyViz>}
        >
          {single ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Bars values={single.vector.map(absCx)} max={Math.max(...single.vector.map(absCx))}
                color="#67e8f9" format={(v) => `|z|=${fmtShort(v)}`} ariaLabel="component magnitudes" />
              <Bars
                values={single.vector.map((z) => {
                  const a = Math.atan2(z.im, z.re)
                  return a < 0 ? a + TWO_PI : a
                })}
                max={TWO_PI} color="#34d399" format={(v) => `arg=${fmtShort(v)}`} ariaLabel="component arguments" />
            </div>
          ) : <EmptyViz>No state selected.</EmptyViz>}
        </VizFrame>
      </div>

      <section className="panel" aria-label="state comparison controls">
        <div className="btn-row">
          <StateSelect states={states} value={cmpAKey} onChange={setCmpAKey} label="comparison state A" />
          <StateSelect states={states} value={cmpBKey} onChange={setCmpBKey} label="comparison state B" />
        </div>
      </section>

      <div className="two-col">
        <VizFrame
          title="State comparison"
          definition="Magnitude profiles of A and B on a common scale, zero-padded to the common dimension, plus the exact similarity C(A,B) = |⟨A,B⟩|² / (‖A‖²‖B‖²)."
          scale="bars scale to the largest magnitude across both states."
          edgeCases="different dims are zero-padded (documented convention); C(0,0)=1 and C(0,x)=0 by metric:v0.3."
          table={
            cmpA && cmpB ? (
              <table className="data" aria-label="comparison exact values">
                <thead><tr><th className="num">i</th><th>|Aᵢ|</th><th>|Bᵢ|</th></tr></thead>
                <tbody>
                  {Array.from({ length: Math.max(cmpA.dim, cmpB.dim) }, (_, i) => (
                    <tr key={i}>
                      <td className="num dim-text">{i}</td>
                      <td className="mono">{i < cmpA.dim ? fmtExact(absCx(cmpA.vector[i])) : '(pad) 0'}</td>
                      <td className="mono">{i < cmpB.dim ? fmtExact(absCx(cmpB.vector[i])) : '(pad) 0'}</td>
                    </tr>
                  ))}
                  <tr><td className="dim-text">C(A,B)</td><td className="mono" colSpan={2}>{fmtExact(normalizedComplexSimilarity(cmpA, cmpB))}</td></tr>
                </tbody>
              </table>
            ) : <EmptyViz>Select two states to compare.</EmptyViz>
          }
        >
          {cmpA && cmpB ? (
            <div>
              <p className="mono" style={{ fontSize: 13 }}>C(A,B) = {fmtExact(normalizedComplexSimilarity(cmpA, cmpB))}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <p className="dim-text" style={{ fontSize: 12 }}>A magnitudes</p>
                  <Bars values={Array.from({ length: Math.max(cmpA.dim, cmpB.dim) }, (_, i) => (i < cmpA.dim ? absCx(cmpA.vector[i]) : 0))}
                    max={Math.max(1e-300, ...cmpA.vector.map(absCx), ...cmpB.vector.map(absCx))}
                    color="#67e8f9" format={(v) => fmtShort(v)} ariaLabel="state A magnitudes" />
                </div>
                <div>
                  <p className="dim-text" style={{ fontSize: 12 }}>B magnitudes</p>
                  <Bars values={Array.from({ length: Math.max(cmpA.dim, cmpB.dim) }, (_, i) => (i < cmpB.dim ? absCx(cmpB.vector[i]) : 0))}
                    max={Math.max(1e-300, ...cmpA.vector.map(absCx), ...cmpB.vector.map(absCx))}
                    color="#c4b5fd" format={(v) => fmtShort(v)} ariaLabel="state B magnitudes" />
                </div>
              </div>
            </div>
          ) : <EmptyViz>Select two states to compare.</EmptyViz>}
        </VizFrame>

        <VizFrame
          title="Before/after (last result)"
          definition="Magnitude profile of the last inspected operation's first input vs its output state, on a common scale. Shows what the operator did to component magnitudes — a static diff, not a motion."
          scale="bars scale to the largest magnitude across input and output."
          edgeCases="bridge records no new state (before/after is source vs target); state() steps have no receipt and do not appear here."
          table={<BeforeAfterTable inspection={inspection} />}
        >
          <BeforeAfterChart inspection={inspection} />
        </VizFrame>
      </div>

      <VizFrame
        wide
        title="Coherence matrix (all session states)"
        definition="C(i,j) = normalized complex similarity between session states i and j. The matrix is symmetric; diagonal self-similarities are included (documented metric behavior). Color encodes value, and every cell also prints its value so the reading never depends on color alone."
        scale="cells interpolate panel-ink (#0b101b) at 0 to cyan (#67e8f9) at 1."
        edgeCases="one state yields a 1×1 matrix; zero states follow C(0,0)=1, C(0,x)=0; capped at MAX_STATES=32 session states."
        table={
          coherence ? (
            <table className="data" aria-label="exact coherence matrix">
              <thead>
                <tr><th></th>{states.map((entry, j) => <th key={j} className="num">{entry.state.label ?? `s${j}`}</th>)}</tr>
              </thead>
              <tbody>
                {coherence.map((row, i) => (
                  <tr key={i}>
                    <th>{states[i].state.label ?? `s${i}`}</th>
                    {row.map((value, j) => <td key={j} className="mono num">{fmtExact(value)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyViz>No session states yet.</EmptyViz>
        }
      >
        {coherence ? <CoherenceGrid states={states} coherence={coherence} /> : <EmptyViz>No session states yet.</EmptyViz>}
      </VizFrame>

      <div className="two-col">
        <VizFrame
          title="Magnitude & phase distributions"
          definition="Histogram of component magnitudes (10 equal bins over [0, max |zᵢ|]) and component arguments (12 equal bins over [0, 2π)). Counts of components per bin."
          scale="bar heights are component counts; bins are equal-width."
          edgeCases="an all-zero state puts every component in the first magnitude bin; arguments of zero components are 0."
          table={single ? componentTable(single) : <EmptyViz>No state selected.</EmptyViz>}
        >
          {single ? <Distributions state={single} /> : <EmptyViz>No state selected.</EmptyViz>}
        </VizFrame>

        <VizFrame
          title="Receipt status timeline"
          definition="Ledger entries in chronological (seq) order; marker shape + label encode status (● PASS, ▲ WARN, ✕ FAIL) so the reading never depends on color alone. This is an audit ordering, not a physical time series."
          scale="horizontal axis is ledger seq (insertion order); timestamps are shown in the exact table."
          edgeCases="quarantined entries render with dashed outline; an empty ledger shows nothing."
          table={
            ledgerEntries.length > 0 ? (
              <table className="data" aria-label="ledger entries exact">
                <thead><tr><th className="num">seq</th><th>operator</th><th>status</th><th>tag</th><th>timestamp</th><th>source</th></tr></thead>
                <tbody>
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.seq}>
                      <td className="num">{entry.seq}</td>
                      <td className="mono">{String(entry.receipt.operator)}</td>
                      <td><StatusBadge status={entry.receipt.status} /></td>
                      <td className="mono">{String(entry.receipt.epistemic_tag)}</td>
                      <td className="mono">{String(entry.receipt.timestamp_utc)}</td>
                      <td>{entry.source}{entry.quarantine.length > 0 ? ' (quarantined)' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyViz>No receipts yet.</EmptyViz>
          }
        >
          {ledgerEntries.length > 0 ? <Timeline entries={ledgerEntries} /> : <EmptyViz>No receipts yet.</EmptyViz>}
        </VizFrame>
      </div>

      <LineageViz states={states} />
    </div>
  )
}


/* ---------- coherence heat grid ---------- */

function cellColor(value) {
  // interpolate #0b101b -> #67e8f9
  const c0 = [11, 16, 27]
  const c1 = [103, 232, 249]
  const t = Math.min(1, Math.max(0, value))
  const mix = c0.map((a, i) => Math.round(a + (c1[i] - a) * t))
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`
}

function CoherenceGrid({ states, coherence }) {
  const n = states.length
  const cell = Math.min(64, Math.floor(560 / Math.max(1, n)))
  const pad = 90
  const size = pad + n * cell
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`coherence matrix heatmap for ${n} session states`}
      style={{ width: '100%', maxWidth: size }}>
      {states.map((entry, i) => (
        <text key={`r${i}`} x={pad - 6} y={pad + i * cell + cell / 2 + 4} fill="#9fb2c8" fontSize={11}
          textAnchor="end" fontFamily="monospace">
          {(entry.state.label ?? `s${i}`).slice(0, 12)}
        </text>
      ))}
      {states.map((entry, j) => (
        <text key={`c${j}`} x={pad + j * cell + cell / 2} y={pad - 8} fill="#9fb2c8" fontSize={11}
          textAnchor="middle" fontFamily="monospace">
          {(entry.state.label ?? `s${j}`).slice(0, 12)}
        </text>
      ))}
      {coherence.map((row, i) =>
        row.map((value, j) => (
          <g key={`${i}-${j}`}>
            <rect x={pad + j * cell} y={pad + i * cell} width={cell - 2} height={cell - 2} rx={3}
              fill={cellColor(value)} stroke="#1b2940" />
            <text x={pad + j * cell + (cell - 2) / 2} y={pad + i * cell + (cell - 2) / 2 + 4}
              fontSize={cell > 40 ? 11 : 8} textAnchor="middle" fontFamily="monospace"
              fill={value > 0.55 ? '#04222b' : '#e2ecf7'}>
              {fmtShort(value, 3)}
            </text>
          </g>
        )),
      )}
    </svg>
  )
}

/* ---------- distributions ---------- */

function Histogram({ bins, color, labelFormat, ariaLabel }) {
  const max = Math.max(1, ...bins.map((bin) => bin.count))
  return (
    <div role="img" aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
      {bins.map((bin, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span className="mono" style={{ fontSize: 11 }}>{bin.count}</span>
          <div style={{
            width: '100%', height: `${(bin.count / max) * 80}px`, minHeight: bin.count > 0 ? 3 : 0,
            background: color, borderRadius: 3,
          }} />
          <span className="mono dim-text" style={{ fontSize: 9.5, textAlign: 'center' }}>{labelFormat(bin, i)}</span>
        </div>
      ))}
    </div>
  )
}

function Distributions({ state }) {
  const mags = state.vector.map(absCx)
  const maxMag = Math.max(...mags)
  const magBins = Array.from({ length: 10 }, (_, i) => ({
    lo: (maxMag * i) / 10, hi: (maxMag * (i + 1)) / 10, count: 0,
  }))
  for (const m of mags) {
    const idx = maxMag > 0 ? Math.min(9, Math.floor((m / maxMag) * 10)) : 0
    magBins[idx].count += 1
  }
  const phaseBins = Array.from({ length: 12 }, (_, i) => ({ lo: (TWO_PI * i) / 12, count: 0 }))
  for (const z of state.vector) {
    let a = Math.atan2(z.im, z.re)
    if (a < 0) a += TWO_PI
    phaseBins[Math.min(11, Math.floor((a / TWO_PI) * 12))].count += 1
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p className="dim-text" style={{ fontSize: 12, margin: '0 0 6px' }}>magnitude histogram (bin width {fmtShort(maxMag / 10)})</p>
        <Histogram bins={magBins} color="#67e8f9" ariaLabel="magnitude histogram"
          labelFormat={(bin) => `${fmtShort(bin.lo, 3)}`} />
      </div>
      <div>
        <p className="dim-text" style={{ fontSize: 12, margin: '0 0 6px' }}>phase histogram (bin width π/6)</p>
        <Histogram bins={phaseBins} color="#34d399" ariaLabel="phase histogram"
          labelFormat={(bin, i) => `${i * 30}°`} />
      </div>
    </div>
  )
}

/* ---------- receipt timeline ---------- */

const STATUS_COLOR = { PASS: '#34d399', WARN: '#fbbf24', FAIL: '#f87171' }
const STATUS_MARK = { PASS: '●', WARN: '▲', FAIL: '✕' }

function Timeline({ entries }) {
  const width = 640
  const height = 90
  const span = Math.max(1, entries.length - 1)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="receipt status timeline" style={{ width: '100%' }}>
      <line x1={20} y1={50} x2={width - 20} y2={50} stroke="#1b2940" />
      {entries.map((entry, i) => {
        const x = 20 + ((width - 40) * i) / span
        const status = Object.prototype.hasOwnProperty.call(STATUS_COLOR, entry.receipt.status) ? entry.receipt.status : 'FAIL'
        return (
          <g key={entry.seq}>
            <text x={x} y={i % 2 === 0 ? 34 : 74} textAnchor="middle" fontSize={11} fontFamily="monospace"
              fill={STATUS_COLOR[status]}
              stroke={entry.quarantine.length > 0 ? '#94a3b8' : 'none'} strokeDasharray="2 2">
              {STATUS_MARK[status]}
            </text>
            <text x={x} y={i % 2 === 0 ? 20 : 88} textAnchor="middle" fontSize={9} fill="#9fb2c8" fontFamily="monospace">
              #{entry.seq}
            </text>
            <line x1={x} y1={i % 2 === 0 ? 38 : 66} x2={x} y2={50} stroke="#1b2940" />
          </g>
        )
      })}
    </svg>
  )
}

/* ---------- before/after ---------- */

function beforeAfterData(inspection) {
  if (!inspection || inspection.kind !== 'operation') return null
  const inputs = Array.isArray(inspection.inputs) ? inspection.inputs : []
  const first = inputs[0] ?? null
  const out = inspection.output ?? null
  if (first === null || out === null) return null
  return { first, out }
}

function BeforeAfterChart({ inspection }) {
  const data = beforeAfterData(inspection)
  if (data === null) {
    return <EmptyViz>Run an operator with a recorded input and output (Operator Lab runs keep both) to see the before/after diff.</EmptyViz>
  }
  const dim = Math.max(data.first.dim, data.out.dim)
  const max = Math.max(1e-300, ...data.first.vector.map(absCx), ...data.out.vector.map(absCx))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <p className="dim-text" style={{ fontSize: 12 }}>before (input)</p>
        <Bars values={Array.from({ length: dim }, (_, i) => (i < data.first.dim ? absCx(data.first.vector[i]) : 0))}
          max={max} color="#9fb2c8" format={(v) => fmtShort(v)} ariaLabel="input magnitudes" />
      </div>
      <div>
        <p className="dim-text" style={{ fontSize: 12 }}>after (output)</p>
        <Bars values={Array.from({ length: dim }, (_, i) => (i < data.out.dim ? absCx(data.out.vector[i]) : 0))}
          max={max} color="#67e8f9" format={(v) => fmtShort(v)} ariaLabel="output magnitudes" />
      </div>
    </div>
  )
}

function BeforeAfterTable({ inspection }) {
  const data = beforeAfterData(inspection)
  if (data === null) return <EmptyViz>No operation result with input and output selected yet.</EmptyViz>
  const dim = Math.max(data.first.dim, data.out.dim)
  return (
    <table className="data" aria-label="before/after exact magnitudes">
      <thead><tr><th className="num">i</th><th>|beforeᵢ|</th><th>|afterᵢ|</th></tr></thead>
      <tbody>
        {Array.from({ length: dim }, (_, i) => (
          <tr key={i}>
            <td className="num dim-text">{i}</td>
            <td className="mono">{i < data.first.dim ? fmtExact(absCx(data.first.vector[i])) : '(pad) 0'}</td>
            <td className="mono">{i < data.out.dim ? fmtExact(absCx(data.out.vector[i])) : '(pad) 0'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------- operation lineage ---------- */

function LineageViz({ states }) {
  const { session, ledgerTick } = useWorkbench()
  const [hash, setHash] = useState('')
  const target = hash || states[states.length - 1]?.state.stateHash() || ''
  const ancestry = useMemo(() => {
    void ledgerTick
    if (target === '') return null
    return session.ledger.traceAncestry(target)
  }, [session, ledgerTick, target])

  return (
    <VizFrame
      wide
      title="Operation lineage"
      definition="Multi-hop ancestry over ledger-recorded state hashes: which receipts produced this state's inputs, recursively. A ledger-level audit view — missing links are reported, never papered over."
      scale="nodes are listed in dependency order (ancestors before descendants); indentation shows depth."
      edgeCases="states built by hand have no producing receipt (shown as roots); cycles are detected and flagged; bridge targets alias the target state hash."
      table={
        ancestry ? (
          <table className="data" aria-label="lineage exact nodes">
            <thead><tr><th>state hash</th><th>produced by</th><th>inputs</th></tr></thead>
            <tbody>
              {ancestry.nodes.map((node) => (
                <tr key={node.hash}>
                  <td className="mono">{node.hash}</td>
                  <td>{node.seq !== null ? `entry #${node.seq}` : 'no producing entry (root/external)'}</td>
                  <td className="mono">{node.inputs.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyViz>No session states yet.</EmptyViz>
      }
    >
      <div style={{ marginBottom: 10 }}>
        <label className="field" style={{ minWidth: 260 }}>
          <span>trace ancestry of</span>
          <select value={hash} onChange={(event) => setHash(event.target.value)} aria-label="select state hash to trace">
            <option value="">latest session state (default)</option>
            {states.map((entry) => (
              <option key={entry.key} value={entry.state.stateHash()}>
                {(entry.state.label ?? 'state') + ` · ${entry.state.stateHash().slice(0, 20)}…`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {ancestry ? (
        <div>
          <p role="status" className={ancestry.complete ? 'dim-text' : 'warn-text'} style={{ fontSize: 13 }}>
            {ancestry.complete
              ? 'Lineage complete and acyclic: every input hash resolves to a ledger entry.'
              : `Lineage incomplete: ${ancestry.missing.length} missing link(s)${ancestry.cyclic ? ', cycle detected' : ''}.`}
          </p>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5 }} aria-label="lineage nodes">
            {ancestry.nodes.map((node) => (
              <li key={node.hash} className="mono" style={{ marginBottom: 4 }}>
                {node.hash.slice(0, 28)}…
                {node.seq !== null ? ` ← entry #${node.seq}` : ' ← (no producing entry)'}
                {node.inputs.length > 0 && (
                  <span className="dim-text"> ⇐ {node.inputs.map((h) => h.slice(0, 14) + '…').join(', ')}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : <EmptyViz>No session states yet.</EmptyViz>}
    </VizFrame>
  )
}
