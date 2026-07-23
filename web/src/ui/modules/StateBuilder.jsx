/**
 * State Builder: editable complex-pair table with polar helper, pasted-array
 * parser, dimension control, glyph/label/metadata, presets, and live exact
 * readouts (dim, vector, resonance, phase, state hash) with explicit
 * validation. All ingested text is stripped of bidi/control characters.
 */

import { useMemo, useState } from 'react'
import { wellTypedState } from '../../kernel/contracts.js'
import { MAX_DIM, MAX_GLYPH_CHARS, MAX_LABEL_CHARS } from '../../kernel/limits.js'
import { ResonantState } from '../../kernel/state.js'
import { StatusBadge } from '../components/Badges.jsx'
import { stripIngest } from '../util/sanitize.js'
import { copyText, fmtCx, fmtExact } from '../util/format.js'
import { useWorkbench } from '../WorkbenchContext.jsx'

const PRESETS = {
  'basic 3-6-9': [[3, 0], [6, 0], [9, 0]],
  'zero vector (dim 3)': [[0, 0], [0, 0], [0, 0]],
  'basis e1 (dim 4)': [[1, 0], [0, 0], [0, 0], [0, 0]],
  'equal phasors (dim 4)': [[1, 0], [0, 1], [-1, 0], [0, -1]],
  'mixed pair': [[1, 1], [2, -1], [0, 3]],
}

function parseNumber(text) {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, error: 'empty' }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { ok: false, error: `"${trimmed}" is not a finite number` }
  return { ok: true, value }
}

/** Parse a pasted [[re, im], ...] array. Returns {pairs} or {error}. */
export function parsePairsText(text) {
  const cleaned = stripIngest(text).trim()
  if (cleaned === '') return { error: 'Nothing pasted. Expected JSON like [[3,0],[6,0],[9,0]].' }
  let data
  try {
    data = JSON.parse(cleaned)
  } catch (exc) {
    return { error: `Not valid JSON (${exc.message}). Expected an array of [real, imag] pairs.` }
  }
  if (!Array.isArray(data)) return { error: 'Pasted value must be an array of [real, imag] pairs.' }
  if (data.length < 1) return { error: 'Dimension must be at least 1; dim==0 states are not constructible.' }
  if (data.length > MAX_DIM) return { error: `Dimension ${data.length} exceeds MAX_DIM=${MAX_DIM}.` }
  const pairs = []
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (!Array.isArray(item) || item.length !== 2) {
      return { error: `Row ${i + 1} is not a [real, imag] pair.` }
    }
    const [re, im] = item
    if (typeof re !== 'number' || typeof im !== 'number' || !Number.isFinite(re) || !Number.isFinite(im)) {
      return { error: `Row ${i + 1} contains a non-finite or non-numeric component.` }
    }
    pairs.push([re, im])
  }
  return { pairs }
}

export default function StateBuilder() {
  const { addStates, setModule, plainLanguage } = useWorkbench()
  const [rows, setRows] = useState([{ re: '3', im: '0' }, { re: '6', im: '0' }, { re: '9', im: '0' }])
  const [label, setLabel] = useState('A')
  const [glyph, setGlyph] = useState('')
  const [metadataText, setMetadataText] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [polarRow, setPolarRow] = useState(0)
  const [polarMag, setPolarMag] = useState('1')
  const [polarAngle, setPolarAngle] = useState('0')
  const [polarDegrees, setPolarDegrees] = useState(false)
  const [copyNote, setCopyNote] = useState('')
  const [rowsError, setRowsError] = useState(null)

  const setDim = (dim) => {
    setRows((current) => {
      if (dim < current.length) return current.slice(0, dim)
      const extra = Array.from({ length: dim - current.length }, () => ({ re: '0', im: '0' }))
      return [...current, ...extra]
    })
  }

  // --- live validation: build the state or collect every problem ---
  const preview = useMemo(() => {
    const problems = []
    if (rows.length < 1) problems.push('Dimension must be at least 1.')
    if (rows.length > MAX_DIM) problems.push(`Dimension ${rows.length} exceeds MAX_DIM=${MAX_DIM}.`)
    const pairs = []
    rows.forEach((row, i) => {
      const re = parseNumber(row.re)
      const im = parseNumber(row.im)
      if (!re.ok) problems.push(`Row ${i + 1} real part: ${re.error}.`)
      if (!im.ok) problems.push(`Row ${i + 1} imaginary part: ${im.error}.`)
      if (re.ok && im.ok) pairs.push([re.value, im.value])
    })
    let metadata = {}
    const metaClean = stripIngest(metadataText).trim()
    if (metaClean !== '') {
      try {
        const parsed = JSON.parse(metaClean)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          problems.push('Metadata must be a JSON object, e.g. {"source":"hand-entered"}.')
        } else {
          metadata = parsed
        }
      } catch (exc) {
        problems.push(`Metadata is not valid JSON: ${exc.message}.`)
      }
    }
    const cleanLabel = stripIngest(label).trim()
    const cleanGlyph = stripIngest(glyph).trim()
    if (cleanLabel.length > MAX_LABEL_CHARS) problems.push(`Label exceeds ${MAX_LABEL_CHARS} characters.`)
    if (cleanGlyph.length > MAX_GLYPH_CHARS) problems.push(`Glyph exceeds ${MAX_GLYPH_CHARS} characters.`)
    if (problems.length > 0 || pairs.length !== rows.length) {
      return { ok: false, problems }
    }
    try {
      const state = ResonantState.fromPairs(pairs, {
        label: cleanLabel === '' ? null : cleanLabel,
        glyph: cleanGlyph === '' ? null : cleanGlyph,
        metadata,
      })
      return { ok: true, state, problems: [] }
    } catch (exc) {
      return { ok: false, problems: [`${exc.name}: ${exc.message}`] }
    }
  }, [rows, label, glyph, metadataText])

  const zeroVector = preview.ok && preview.state.resonance === 0

  const applyPaste = () => {
    const result = parsePairsText(pasteText)
    if (result.error) {
      setCopyNote('')
      setRowsError(result.error)
      return
    }
    setRowsError(null)
    setRows(result.pairs.map(([re, im]) => ({ re: String(re), im: String(im) })))
  }

  const applyPolar = () => {
    const mag = parseNumber(polarMag)
    const ang = parseNumber(polarAngle)
    if (!mag.ok || !ang.ok) {
      setRowsError('Polar helper needs finite magnitude and angle numbers.')
      return
    }
    if (mag.value < 0) {
      setRowsError('Polar magnitude must be non-negative.')
      return
    }
    const radians = polarDegrees ? (ang.value * Math.PI) / 180 : ang.value
    const re = mag.value * Math.cos(radians)
    const im = mag.value * Math.sin(radians)
    setRows((current) =>
      current.map((row, i) => (i === polarRow ? { re: String(re), im: String(im) } : row)),
    )
    setRowsError(null)
  }

  const addToSession = () => {
    if (!preview.ok) return
    addStates([{ state: preview.state, origin: 'builder', note: preview.state.label ?? 'state' }])
    setCopyNote('State added to the session table (Operator Lab and Visualizations can use it).')
  }

  return (
    <div className="two-col">
      <div>
        <section className="panel panel-formal" aria-labelledby="vector-editor-heading">
          <h2 id="vector-editor-heading">Complex-pair editor</h2>
          <p className="panel-sub">
            A state is a finite vector z ∈ ℂⁿ, 1 ≤ n ≤ {MAX_DIM}. Each row is one component (real, imaginary).
          </p>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <label className="field" style={{ width: 120 }}>
              <span>Dimension (1..{MAX_DIM})</span>
              <input
                type="number"
                min={1}
                max={MAX_DIM}
                value={rows.length}
                onChange={(event) => {
                  const dim = Math.floor(Number(event.target.value))
                  if (Number.isInteger(dim) && dim >= 1 && dim <= MAX_DIM) setDim(dim)
                }}
                aria-label="state dimension"
              />
            </label>
            <label className="field" style={{ minWidth: 200 }}>
              <span>Load preset</span>
              <select
                defaultValue=""
                onChange={(event) => {
                  const preset = PRESETS[event.target.value]
                  if (preset) setRows(preset.map(([re, im]) => ({ re: String(re), im: String(im) })))
                  event.target.value = ''
                }}
                aria-label="load a preset vector"
              >
                <option value="" disabled>choose…</option>
                {Object.keys(PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <table className="data" aria-label="complex component editor">
            <thead>
              <tr><th className="num">i</th><th>real</th><th>imaginary</th><th><span className="sr-only">remove</span></th></tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="num dim-text">{i}</td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.re}
                      aria-label={`component ${i} real part`}
                      onChange={(event) =>
                        setRows((current) => current.map((r, j) => (j === i ? { ...r, re: event.target.value } : r)))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.im}
                      aria-label={`component ${i} imaginary part`}
                      onChange={(event) =>
                        setRows((current) => current.map((r, j) => (j === i ? { ...r, im: event.target.value } : r)))
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      disabled={rows.length <= 1}
                      aria-label={`remove component ${i}`}
                      onClick={() => setRows((current) => current.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={rows.length >= MAX_DIM}
              onClick={() => setRows((current) => [...current, { re: '0', im: '0' }])}
            >
              + add component
            </button>
          </div>

          <h3>Polar helper</h3>
          <p className="panel-sub">Set one component from magnitude r and angle θ (re = r·cos θ, im = r·sin θ).</p>
          <div className="btn-row">
            <label className="field" style={{ width: 90 }}>
              <span>row i</span>
              <input type="number" min={0} max={rows.length - 1} value={polarRow}
                onChange={(event) => setPolarRow(Math.min(rows.length - 1, Math.max(0, Math.floor(Number(event.target.value) || 0))))} />
            </label>
            <label className="field" style={{ width: 110 }}>
              <span>r ≥ 0</span>
              <input type="text" inputMode="decimal" value={polarMag} onChange={(event) => setPolarMag(event.target.value)} />
            </label>
            <label className="field" style={{ width: 110 }}>
              <span>θ</span>
              <input type="text" inputMode="decimal" value={polarAngle} onChange={(event) => setPolarAngle(event.target.value)} />
            </label>
            <label className="switch-row" style={{ margin: 0 }}>
              <input type="checkbox" checked={polarDegrees} onChange={(event) => setPolarDegrees(event.target.checked)} />
              <span>degrees</span>
            </label>
            <button type="button" className="btn btn-small" onClick={applyPolar}>apply</button>
          </div>

          <h3 style={{ marginTop: 14 }}>Paste an array</h3>
          <textarea
            rows={3}
            className="code"
            placeholder="[[3,0],[6,0],[9,0]]"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            aria-label="paste a JSON array of complex pairs"
          />
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button type="button" className="btn btn-small" onClick={applyPaste}>parse pasted array</button>
          </div>
          {rowsError !== null && <div className="error-box" role="alert">{rowsError}</div>}
        </section>

        <section className="panel panel-formal" aria-labelledby="identity-heading">
          <h2 id="identity-heading">Identity (optional)</h2>
          <div className="btn-row" style={{ alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 1 }}>
              <span>label (≤ {MAX_LABEL_CHARS} chars)</span>
              <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
            <label className="field" style={{ width: 120 }}>
              <span>glyph (≤ {MAX_GLYPH_CHARS})</span>
              <input type="text" value={glyph} onChange={(event) => setGlyph(event.target.value)} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>
            <span>metadata (JSON object, ≤ 4096 canonical bytes; JSON-safe values only)</span>
            <textarea rows={3} className="code" placeholder='{"origin":"state builder"}'
              value={metadataText} onChange={(event) => setMetadataText(event.target.value)} />
          </label>
          <p className="panel-sub" style={{ marginTop: 8 }}>
            Labels and glyphs are display conveniences, not formal objects; bidi/control characters are stripped at ingest.
          </p>
        </section>
      </div>

      <div>
        <section className="panel panel-formal" aria-labelledby="state-readout-heading">
          <h2 id="state-readout-heading">State readout</h2>
          {preview.ok ? (
            <>
              <dl className="kv">
                <dt>dim</dt><dd>{preview.state.dim}</dd>
                <dt>resonance R(z) = ‖z‖₂ (exact)</dt><dd>{fmtExact(preview.state.resonance)}</dd>
                <dt>phase φ (radians, exact)</dt><dd>{fmtExact(preview.state.phase)}</dd>
                <dt>state hash</dt><dd>{preview.state.stateHash()}</dd>
                <dt>epistemic status</dt>
                <dd><StatusBadge status={wellTypedState(preview.state).status} /> <span className="dim-text">formal object — states are data, not claims</span></dd>
              </dl>
              {zeroVector && (
                <div className="error-box" style={{ borderColor: 'var(--warn)', background: 'rgba(251,191,36,0.07)' }} role="status">
                  <span className="warn-text">Zero vector: resonance is 0 and phase is defined as 0 by convention
                  (C(0,0)=1, C(0,x)=0 in the similarity metric). Some operators degenerate on the zero state.</span>
                </div>
              )}
              <h3>Full vector (exact values)</h3>
              <table className="data" aria-label="exact vector components">
                <thead><tr><th className="num">i</th><th>re</th><th>im</th><th>component</th></tr></thead>
                <tbody>
                  {preview.state.vector.map((z, i) => (
                    <tr key={i}>
                      <td className="num dim-text">{i}</td>
                      <td className="mono">{fmtExact(z.re)}</td>
                      <td className="mono">{fmtExact(z.im)}</td>
                      <td className="mono">{fmtCx(z)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={addToSession}>Add to session</button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={async () => {
                    await copyText(JSON.stringify(preview.state.vector.map((z) => [z.re, z.im])))
                    setCopyNote('Exact vector copied as [[re,im],…].')
                  }}
                >
                  ⧉ copy vector
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={async () => {
                    await copyText(preview.state.stateHash())
                    setCopyNote('State hash copied.')
                  }}
                >
                  ⧉ copy hash
                </button>
              </div>
              {copyNote !== '' && <p className="dim-text" role="status">{copyNote}</p>}
              {plainLanguage && (
                <p className="panel-sub" style={{ marginTop: 10 }}>
                  Resonance is the length of the vector; phase is its overall angle; the hash is a tamper-evident
                  fingerprint of the vector, label, glyph, and metadata.
                </p>
              )}
            </>
          ) : (
            <div role="alert">
              <p className="fail-text">The state cannot be constructed yet:</p>
              <ul>
                {preview.problems.map((problem, i) => <li key={i} className="dim-text">{problem}</li>)}
              </ul>
            </div>
          )}
        </section>
        <section className="panel" aria-label="next steps">
          <p className="panel-sub" style={{ margin: 0 }}>
            Next: apply operators in the{' '}
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setModule('operators')}>Operator Lab</button>
            {' '}or build a program in the{' '}
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setModule('program')}>Program Builder</button>.
          </p>
        </section>
      </div>
    </div>
  )
}
