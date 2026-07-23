/**
 * Operator Lab: five operator cards with formulas, domains, parameters,
 * assumptions, and expected invariants. Runs go through the kernel directly
 * and are recorded into the session ledger with produced-state lineage.
 *
 * UI rules mirrored from the kernel contracts:
 * - attenuation < 1 requires a declared cost label before run (I3);
 * - amplification (> 1) is explicitly noted as unaccounted increase;
 * - bridge cost is a caller-declared, unverified annotation.
 */

import { useState } from 'react'
import { GOLDEN_ANGLE, PHI, attenuatedPhaseShift, bridge, harmonicSum, phaseShift, phiScale } from '../../kernel/operators.js'
import { StatusBadge, TagBadge } from '../components/Badges.jsx'
import { fmtExact, fmtShort } from '../util/format.js'
import { stripIngest } from '../util/sanitize.js'
import { useWorkbench } from '../WorkbenchContext.jsx'

const OP_DEFS = [
  {
    id: 'harmonic_sum',
    name: 'Harmonic Sum',
    formula: 'z = a + b  (componentwise addition, zero-padded to common dim)',
    domain: 'two states (any dims 1..64; shorter input is zero-padded)',
    assumptions: 'Finite complex vectors. Recomposition may reduce pairwise similarity; the change must be accounted.',
    invariants: ['I1 well-typed states', 'I2 coherence in [0,1]', 'I3 accounted change', 'I4 trace inputs recorded', 'I8 interpretation quarantine'],
  },
  {
    id: 'phase_shift',
    name: 'Phase Shift',
    formula: "z' = z · e^{iθ}",
    domain: 'one state; θ any finite angle in radians',
    assumptions: 'Pure rotation: resonance must be preserved within 1e-9 (checked per instance, not a group-theoretic proof).',
    invariants: ['I1 well-typed states', 'I2 coherence in [0,1]', 'I5 phase equivariance (resonance preserved)', 'I4 trace inputs recorded', 'I8 interpretation quarantine'],
  },
  {
    id: 'attenuated_phase_shift',
    name: 'Attenuated Phase Shift',
    formula: "z' = α · z · e^{iθ},  α ≥ 0",
    domain: 'one state; θ finite; α finite and non-negative',
    assumptions: 'Decrease (α < 1) requires a declared cost (label-presence gate only — adequacy is not verified). Amplification (α > 1) passes but increases are unaccounted.',
    invariants: ['I1 well-typed states', 'I2 coherence in [0,1]', 'I3 accounted change', 'I4 trace inputs recorded', 'I8 interpretation quarantine'],
  },
  {
    id: 'phi_scale',
    name: 'Phi Scale',
    formula: `z' = Φⁿ · z · e^{i·n·(2π/Φ)}  — dilation by Φⁿ plus n golden-angle (2π/Φ) phase advances`,
    domain: 'one state; n integer with |n| ≤ 64 (non-integral n is a typed error, never truncated)',
    assumptions: `Φ = ${fmtShort(PHI, 12)}…; golden angle 2π/Φ = ${fmtShort(GOLDEN_ANGLE, 12)}… rad.`,
    invariants: ['I1 well-typed states', 'I2 coherence in [0,1]', 'I3 accounted change', 'I4 trace inputs recorded', 'I8 interpretation quarantine'],
  },
  {
    id: 'bridge',
    name: 'Bridge',
    formula: 'B(x, y): typed transition candidate with coherence C(x,y) and caller-declared cost',
    domain: 'two states; cost any finite number (caller-declared, unverified)',
    assumptions: 'A bridge receipt records a transition/path candidate. It is NOT a category-theoretic naturality proof.',
    invariants: ['I1 well-typed states', 'I2 coherence in [0,1]', 'I4 trace inputs recorded', 'I8 interpretation quarantine'],
  },
]

function StatePicker({ value, onChange, label, states }) {
  return (
    <label className="field" style={{ minWidth: 220 }}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        <option value="">select a session state…</option>
        {states.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {(entry.state.label ?? entry.state.glyph ?? 'state') + ` · dim ${entry.state.dim} · ${entry.state.stateHash().slice(0, 20)}… · ${entry.origin}`}
          </option>
        ))}
      </select>
    </label>
  )
}

function findState(states, key) {
  return states.find((entry) => entry.key === key)?.state ?? null
}

function OpCard({ def, children, onRun, result, error, runDisabled, runHint }) {
  return (
    <section className="panel panel-formal op-card" aria-labelledby={`op-${def.id}`}>
      <h2 id={`op-${def.id}`}>{def.name}</h2>
      <p className="op-formula code">{def.formula}</p>
      <dl className="kv">
        <dt>domain</dt><dd>{def.domain}</dd>
        <dt>assumptions</dt><dd style={{ fontFamily: 'inherit' }}>{def.assumptions}</dd>
        <dt>expected invariants</dt>
        <dd style={{ fontFamily: 'inherit' }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {def.invariants.map((inv) => <li key={inv}>{inv}</li>)}
          </ul>
        </dd>
        <dt>claim classification</dt>
        <dd><TagBadge tag="COMPUTED" /> <span className="dim-text">claims are emitted by the kernel verbatim</span></dd>
      </dl>
      <div className="op-controls">{children}</div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-primary" onClick={onRun} disabled={Boolean(runDisabled)}>
          Run {def.name}
        </button>
        {runHint && <span className="warn-text" role="status">{runHint}</span>}
      </div>
      {error !== null && <div className="error-box" role="alert">{error}</div>}
      {result !== null && <OpResult result={result} />}
    </section>
  )
}

function OpResult({ result }) {
  const { inspect } = useWorkbench()
  const { receipt } = result
  return (
    <div className="op-result" aria-live="polite">
      <div className="btn-row" style={{ marginTop: 12 }}>
        <StatusBadge status={receipt.status} />
        <TagBadge tag={receipt.epistemicTag} />
        <button type="button" className="btn btn-ghost btn-small" onClick={() => inspect({ kind: 'operation', ...result })}>
          Inspect in Result Inspector →
        </button>
      </div>
      <dl className="kv" style={{ marginTop: 8 }}>
        {receipt.coherenceBefore !== null && <><dt>coherence before</dt><dd>{fmtExact(receipt.coherenceBefore)}</dd></>}
        {receipt.coherenceAfter !== null && <><dt>coherence after</dt><dd>{fmtExact(receipt.coherenceAfter)}</dd></>}
        <dt>receipt id</dt><dd>{receipt.receiptId()}</dd>
        <dt>content hash</dt><dd>{receipt.contentHash()}</dd>
      </dl>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        {receipt.claims.map((c, i) => (
          <li key={i} style={{ fontSize: 13 }}>
            <TagBadge tag={c.tag} /> {c.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function useOpRun() {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const { recordOperation } = useWorkbench()
  const run = (fn) => {
    try {
      const payload = fn()
      recordOperation(payload)
      setResult(payload)
      setError(null)
    } catch (exc) {
      setResult(null)
      setError(`${exc.name ?? 'Error'}: ${exc.message}`)
    }
  }
  return { result, error, run }
}

function HarmonicSumCard({ def, states }) {
  const [aKey, setAKey] = useState('')
  const [bKey, setBKey] = useState('')
  const { result, error, run } = useOpRun()
  const a = findState(states, aKey)
  const b = findState(states, bKey)
  return (
    <OpCard def={def} result={result} error={error}
      runDisabled={!a || !b}
      runHint={!a || !b ? 'select two session states' : null}
      onRun={() => run(() => {
        const out = harmonicSum(a, b)
        return { op: def.id, inputs: [a, b], output: out.output, receipt: out.receipt, parameters: {} }
      })}>
      <div className="btn-row">
        <StatePicker value={aKey} onChange={setAKey} label="input a" states={states} />
        <StatePicker value={bKey} onChange={setBKey} label="input b" states={states} />
      </div>
    </OpCard>
  )
}

function PhaseShiftCard({ def, states }) {
  const [key, setKey] = useState('')
  const [angle, setAngle] = useState('1.0471975511965976')
  const { result, error, run } = useOpRun()
  const state = findState(states, key)
  return (
    <OpCard def={def} result={result} error={error}
      runDisabled={!state}
      runHint={!state ? 'select a session state' : null}
      onRun={() => run(() => {
        const theta = Number(angle)
        const out = phaseShift(state, theta)
        return { op: def.id, inputs: [state], output: out.output, receipt: out.receipt, parameters: { angle_radians: theta } }
      })}>
      <div className="btn-row">
        <StatePicker value={key} onChange={setKey} label="input state" states={states} />
        <label className="field" style={{ width: 200 }}>
          <span>θ (radians; π/3 ≈ 1.0471975511965976)</span>
          <input type="text" inputMode="decimal" value={angle} onChange={(event) => setAngle(event.target.value)} />
        </label>
      </div>
    </OpCard>
  )
}

function AttenuatedCard({ def, states }) {
  const [key, setKey] = useState('')
  const [angle, setAngle] = useState('0.3490658503988659')
  const [att, setAtt] = useState('0.75')
  const [cost, setCost] = useState('')
  const { result, error, run } = useOpRun()
  const state = findState(states, key)
  const attValue = Number(att)
  const attParsed = att.trim() !== '' && Number.isFinite(attValue)
  const needsCost = attParsed && attValue < 1
  const costMissing = needsCost && stripIngest(cost).trim() === ''
  const amplifies = attParsed && attValue > 1
  return (
    <OpCard def={def} result={result} error={error}
      runDisabled={!state || costMissing}
      runHint={
        !state
          ? 'select a session state'
          : costMissing
            ? 'attenuation < 1 requires a declared cost label before run (mirrors invariant I3)'
            : null
      }
      onRun={() => run(() => {
        const theta = Number(angle)
        const out = attenuatedPhaseShift(state, theta, attValue, { costLabel: stripIngest(cost).trim() || null })
        return {
          op: def.id,
          inputs: [state],
          output: out.output,
          receipt: out.receipt,
          parameters: { angle_radians: theta, attenuation: attValue, declared_cost: stripIngest(cost).trim() || null },
        }
      })}>
      <div className="btn-row">
        <StatePicker value={key} onChange={setKey} label="input state" states={states} />
        <label className="field" style={{ width: 190 }}>
          <span>θ (radians)</span>
          <input type="text" inputMode="decimal" value={angle} onChange={(event) => setAngle(event.target.value)} />
        </label>
        <label className="field" style={{ width: 110 }}>
          <span>α ≥ 0</span>
          <input type="text" inputMode="decimal" value={att} onChange={(event) => setAtt(event.target.value)} />
        </label>
        <label className="field" style={{ minWidth: 220 }}>
          <span>declared cost label {needsCost ? '(required)' : '(optional)'}</span>
          <input type="text" value={cost} onChange={(event) => setCost(event.target.value)}
            placeholder="e.g. declared attenuation" />
        </label>
      </div>
      {amplifies && (
        <p className="warn-text" role="status">α &gt; 1 amplifies: I3 passes, but the increase is unaccounted (label-presence gate covers decreases only).</p>
      )}
    </OpCard>
  )
}

function PhiScaleCard({ def, states }) {
  const [key, setKey] = useState('')
  const [n, setN] = useState('2')
  const { result, error, run } = useOpRun()
  const state = findState(states, key)
  return (
    <OpCard def={def} result={result} error={error}
      runDisabled={!state}
      runHint={!state ? 'select a session state' : null}
      onRun={() => run(() => {
        const power = Number(n)
        const out = phiScale(state, power)
        return { op: def.id, inputs: [state], output: out.output, receipt: out.receipt, parameters: { n: power } }
      })}>
      <div className="btn-row">
        <StatePicker value={key} onChange={setKey} label="input state" states={states} />
        <label className="field" style={{ width: 140 }}>
          <span>n (integer, |n| ≤ 64)</span>
          <input type="text" inputMode="decimal" value={n} onChange={(event) => setN(event.target.value)} />
        </label>
      </div>
    </OpCard>
  )
}

function BridgeCard({ def, states }) {
  const [aKey, setAKey] = useState('')
  const [bKey, setBKey] = useState('')
  const [costValue, setCostValue] = useState('0')
  const { result, error, run } = useOpRun()
  const a = findState(states, aKey)
  const b = findState(states, bKey)
  return (
    <OpCard def={def} result={result} error={error}
      runDisabled={!a || !b}
      runHint={!a || !b ? 'select two session states' : null}
      onRun={() => run(() => {
        const declared = Number(costValue)
        const out = bridge(a, b, { cost: declared })
        return {
          op: def.id,
          inputs: [a, b],
          output: null,
          receipt: out.receipt,
          parameters: { cost: declared },
          coherence: out.coherence,
        }
      })}>
      <div className="btn-row">
        <StatePicker value={aKey} onChange={setAKey} label="source x" states={states} />
        <StatePicker value={bKey} onChange={setBKey} label="target y" states={states} />
        <label className="field" style={{ width: 140 }}>
          <span>cost (caller-declared, unverified)</span>
          <input type="text" inputMode="decimal" value={costValue} onChange={(event) => setCostValue(event.target.value)} />
        </label>
      </div>
      <p className="panel-sub" style={{ marginTop: 8 }}>
        The cost value is your annotation; the kernel records it but does not verify it.
      </p>
    </OpCard>
  )
}

const CARD_COMPONENTS = {
  harmonic_sum: HarmonicSumCard,
  phase_shift: PhaseShiftCard,
  attenuated_phase_shift: AttenuatedCard,
  phi_scale: PhiScaleCard,
  bridge: BridgeCard,
}

export default function OperatorLab() {
  const { states, setModule } = useWorkbench()
  return (
    <div>
      {states.length === 0 && (
        <div className="notice" role="status">
          <span>
            No session states yet. Build one in the{' '}
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setModule('state')}>State Builder</button>
            {' '}or run an example from the{' '}
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setModule('examples')}>Example Library</button>.
          </span>
        </div>
      )}
      {OP_DEFS.map((def) => {
        const Card = CARD_COMPONENTS[def.id]
        return <Card key={def.id} def={def} states={states} />
      })}
    </div>
  )
}
