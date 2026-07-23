/**
 * Example Library: the twelve reproducible v0.3 demonstrations.
 *
 * Each example runs deterministic DSL in the current session (receipts land
 * in the ledger) and is labeled with an epistemic classification:
 * mathematical / computational / model / interpretive / metaphorical.
 * Two examples are scripted actions: receipt tampering (imports an altered
 * receipt into quarantine) and Proof Gate rejection (imports a receipt with
 * an INTERPRETIVE claim and a claim promoted from MODEL without derivation).
 */

import { useState } from 'react'
import { canonicalJson } from '../../kernel/canonical.js'
import { wellTypedState } from '../../kernel/contracts.js'
import { OperationReceipt } from '../../kernel/receipts.js'
import { EXAMPLES } from '../data/examples.js'
import { stripIngest } from '../util/sanitize.js'
import { useWorkbench } from '../WorkbenchContext.jsx'

const CLASS_STYLE = {
  mathematical: 'tag-formal',
  computational: 'tag-computed',
  model: 'tag-model',
  interpretive: 'tag-interpretive',
  metaphorical: 'tag-metaphor',
}

const CLASS_HELP = {
  mathematical: 'exact finite mathematics',
  computational: 'a computation/demonstration of engine behavior',
  model: 'model-level claim; blocked at the Proof Gate without formal derivation',
  interpretive: 'interpretation only; quarantined',
  metaphorical: 'metaphor only; quarantined',
}

function ClassificationBadge({ classification }) {
  return (
    <span className={`badge ${CLASS_STYLE[classification] ?? 'tag-interpretive'}`}
      title={CLASS_HELP[classification]}>
      <span className="badge-text">{classification}</span>
    </span>
  )
}

function ExampleCard({ example }) {
  const { runProgramText, session, bumpLedger, setModule, setNotice } = useWorkbench()
  const [resultNote, setResultNote] = useState(null)
  const [showSource, setShowSource] = useState(false)
  const [error, setError] = useState(null)

  const runStandard = () => {
    try {
      const run = runProgramText(example.source)
      const fails = run.execution.steps.filter((step) => step.receipt !== null && step.receipt.status === 'FAIL').length
      setResultNote(
        `Executed ${run.execution.steps.length} step(s); ${run.ledgerSeqs.length} receipt(s) recorded` +
          (fails > 0 ? ` — ${fails} FAIL receipt(s), as this example intends` : '') +
          '. See the Receipt Ledger and Proof Gate.',
      )
      setError(null)
    } catch (exc) {
      setError(`${exc.name}: ${exc.message}`)
      setResultNote(null)
    }
  }

  const runTamper = () => {
    try {
      const run = runProgramText(example.source)
      const seq = run.ledgerSeqs[run.ledgerSeqs.length - 1]
      const original = session.ledger.inspect(seq)
      const tampered = { ...original, output_hash: `sha256:${'0'.repeat(64)}` }
      const { entry } = session.ledger.importReceipt(canonicalJson(tampered))
      bumpLedger()
      setResultNote(
        `Ran the program (receipt #${seq}), then imported a copy with an altered output_hash. ` +
          `The import landed as quarantined entry #${entry.seq}: ${entry.quarantine.join('; ')}. ` +
          'Open the Receipt Ledger to see clean vs quarantined entries and the alteration banner.',
      )
      setError(null)
      setNotice('Tampered receipt imported — see the Receipt Ledger quarantine section.')
    } catch (exc) {
      setError(`${exc.name}: ${exc.message}`)
    }
  }

  const runGate = () => {
    try {
      const run = runProgramText(example.source)
      const lastState = [...run.execution.steps].reverse().find((step) => step.state !== null)?.state
      if (!lastState) throw new Error('program produced no state')
      const hash = lastState.stateHash()
      const receipt = new OperationReceipt({
        operator: 'phase_shift',
        inputHashes: [hash],
        outputHash: hash,
        invariantResults: [wellTypedState(lastState)],
        epistemicTag: 'MODEL',
        claims: [
          { text: 'Phase rotation reveals the resonant meaning of the state.', tag: 'INTERPRETIVE', evidence: [], metadata: {} },
          {
            text: 'A model suggests this phase shift generalizes to all dimensions.',
            tag: 'COMPUTED',
            evidence: [],
            metadata: { promoted_from: 'MODEL' },
          },
        ],
      })
      const { entry } = session.ledger.importReceipt(stripIngest(receipt.toCanonicalJson()))
      bumpLedger()
      setResultNote(
        `Imported an honestly-hashed receipt (#${entry.seq}) carrying an INTERPRETIVE claim and a claim ` +
          'promoted from MODEL without a formal_derivation_id. Open the Proof Gate: both land in the ' +
          'quarantined column with explicit blocked reasons; the promoted claim is flagged distinctly.',
      )
      setError(null)
      setNotice('MODEL/INTERPRETIVE claims imported — see the Proof Gate quarantined column.')
    } catch (exc) {
      setError(`${exc.name}: ${exc.message}`)
    }
  }

  const onRun = example.action === 'tamper' ? runTamper : example.action === 'gate' ? runGate : runStandard

  return (
    <article className={`panel ${['interpretive', 'metaphorical'].includes(example.classification) ? 'panel-quarantined' : 'panel-formal'}`}
      aria-labelledby={`example-${example.id}`}>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 id={`example-${example.id}`} style={{ margin: 0 }}>{example.title}</h2>
        <ClassificationBadge classification={example.classification} />
      </div>
      <p style={{ fontSize: 13.5 }}>{example.summary}</p>
      <p className="panel-sub"><strong>Claim boundary:</strong> {example.boundary}</p>
      {example.metaphorNote && (
        <div className="panel panel-quarantined" style={{ padding: '10px 12px', marginBottom: 10 }} role="note"
          aria-label="quarantined metaphorical reading">
          <ClassificationBadge classification="metaphorical" />
          <span style={{ marginLeft: 8, fontSize: 13 }}>{example.metaphorNote}</span>
        </div>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-small" onClick={onRun}>
          {example.action === 'tamper' ? 'Run + import tampered receipt' : example.action === 'gate' ? 'Run + import gated claims' : 'Run in this session'}
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowSource((v) => !v)} aria-expanded={showSource}>
          {showSource ? 'hide source' : 'show source'}
        </button>
        {(example.action === 'tamper') && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setModule('ledger')}>open ledger →</button>
        )}
        {(example.action === 'gate') && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setModule('gate')}>open proof gate →</button>
        )}
      </div>
      {showSource && <pre className="json" style={{ marginTop: 8 }} aria-label={`${example.title} DSL source`}>{example.source}</pre>}
      {resultNote !== null && <p className="dim-text" role="status" style={{ marginTop: 8 }}>{resultNote}</p>}
      {error !== null && <div className="error-box" role="alert">{error}</div>}
    </article>
  )
}

export default function ExampleLibrary() {
  const { plainLanguage } = useWorkbench()
  return (
    <div>
      {plainLanguage && (
        <p className="panel-sub">
          Each card is a ready-made demonstration. Running one adds real states and receipts to your session —
          including two deliberate failures so you can see the workbench report problems honestly.
        </p>
      )}
      {EXAMPLES.map((example) => <ExampleCard key={example.id} example={example} />)}
    </div>
  )
}
