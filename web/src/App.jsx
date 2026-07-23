/**
 * Langarian Math Workbench v0.3 — application shell.
 *
 * Layout: left module rail, main workspace, persistent/collapsible
 * epistemic strip. All engine access goes through WorkbenchContext; the UI
 * never bypasses kernel validation.
 */

import EpistemicStrip from './ui/EpistemicStrip.jsx'
import { MODULES, useWorkbench, WorkbenchProvider } from './ui/WorkbenchContext.jsx'
import StateBuilder from './ui/modules/StateBuilder.jsx'
import OperatorLab from './ui/modules/OperatorLab.jsx'
import ProgramBuilder from './ui/modules/ProgramBuilder.jsx'
import ResultInspector from './ui/modules/ResultInspector.jsx'
import ReceiptLedgerModule from './ui/modules/ReceiptLedgerModule.jsx'
import FormalEligibilityGate from './ui/modules/ProofGate.jsx'
import Visualizations from './ui/modules/Visualizations.jsx'
import ExampleLibrary from './ui/modules/ExampleLibrary.jsx'

const MODULE_COMPONENTS = {
  state: StateBuilder,
  operators: OperatorLab,
  program: ProgramBuilder,
  result: ResultInspector,
  ledger: ReceiptLedgerModule,
  gate: FormalEligibilityGate,
  viz: Visualizations,
  examples: ExampleLibrary,
}

function LeftRail() {
  const { module, setModule } = useWorkbench()
  return (
    <nav className="left-rail" aria-label="Workbench modules">
      <div className="rail-brand">
        <span className="rail-logo" aria-hidden="true">ℒ</span>
        <span className="rail-title">Langarian<br />Math Workbench</span>
      </div>
      <ul className="rail-list" role="list">
        {MODULES.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`rail-item${module === item.id ? ' rail-item-active' : ''}`}
              onClick={() => setModule(item.id)}
              aria-current={module === item.id ? 'page' : undefined}
            >
              <span className="rail-icon" aria-hidden="true">{item.icon}</span>
              <span className="rail-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Workspace() {
  const { module, notice, setNotice, plainLanguage } = useWorkbench()
  const Active = MODULE_COMPONENTS[module] ?? StateBuilder
  const activeMeta = MODULES.find((item) => item.id === module)
  return (
    <main className="workspace" id="main-content" aria-label={activeMeta?.label ?? 'Workbench'}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {notice !== null && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            ✕
          </button>
        </div>
      )}
      <header className="module-head">
        <h1>{activeMeta?.label}</h1>
        {plainLanguage && <p className="module-plain">{PLAIN_BY_MODULE[module]}</p>}
      </header>
      <Active />
    </main>
  )
}

const PLAIN_BY_MODULE = {
  state: 'Build a finite list of complex numbers (a “state”). You get its size, length (resonance), angle (phase), and fingerprint (hash).',
  operators: 'Apply one of the five checked transformations to your states. Every run writes a receipt describing what was checked.',
  program: 'Write a short program in the workbench language and run it step by step, with receipts.',
  result: 'Look closely at the last result: exact numbers, checks that passed or failed, and where it came from.',
  ledger: 'The audit trail of every operation. You can check whether a receipt was altered, and export or import records.',
  gate: 'Checks whether claims are allowed to enter formal mathematical review. Passing means eligible for review — never “proved”, and never evidence that the model describes nature.',
  viz: 'Pictures of your states and receipts. Every picture also has an exact table.',
  examples: 'Ready-made demonstrations, including deliberate failures, so you can see how the workbench reports problems honestly.',
}

export default function App() {
  return (
    <WorkbenchProvider>
      <div className="app-shell">
        <LeftRail />
        <Workspace />
        <EpistemicStrip />
      </div>
    </WorkbenchProvider>
  )
}
