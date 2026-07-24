/**
 * Parallax Theory Workbench — Langarian executable package shell.
 *
 * Layout: theory-package intake, independent theory audit, contract
 * conformance, signed evidence custody, custody-aware promotion admission,
 * promotion authority and mandate governance, controlled release governance,
 * controlled repository writing, merge reconciliation, governed incident
 * rollback, executable workbench modules, and a persistent epistemic strip.
 * Documentary packages cannot silently use the wrong kernel.
 */

import EpistemicStrip from './ui/EpistemicStrip.jsx'
import { MODULES, useWorkbench, WorkbenchProvider } from './ui/WorkbenchContext.jsx'
import TheoryPackages from './ui/modules/TheoryPackages.jsx'
import TheoryAudit from './ui/modules/TheoryAudit.jsx'
import ContractConformance from './ui/modules/ContractConformance.jsx'
import EvidenceCustody from './ui/modules/EvidenceCustody.jsx'
import PromotionGovernance from './ui/modules/PromotionGovernance.jsx'
import PromotionAuthority from './ui/modules/PromotionAuthority.jsx'
import ReleaseGovernance from './ui/modules/ReleaseGovernance.jsx'
import RepositoryWriter from './ui/modules/RepositoryWriter.jsx'
import RepositoryReconciliation from './ui/modules/RepositoryReconciliation.jsx'
import IncidentRollback from './ui/modules/IncidentRollback.jsx'
import StateBuilder from './ui/modules/StateBuilder.jsx'
import OperatorLab from './ui/modules/OperatorLab.jsx'
import ProgramBuilder from './ui/modules/ProgramBuilder.jsx'
import ResultInspector from './ui/modules/ResultInspector.jsx'
import ReceiptLedgerModule from './ui/modules/ReceiptLedgerModule.jsx'
import FormalEligibilityGate from './ui/modules/ProofGate.jsx'
import Visualizations from './ui/modules/Visualizations.jsx'
import ExampleLibrary from './ui/modules/ExampleLibrary.jsx'
import './theory.css'

const MODULE_COMPONENTS = {
  theories: TheoryPackages,
  audit: TheoryAudit,
  conformance: ContractConformance,
  custody: EvidenceCustody,
  promotion: PromotionGovernance,
  authority: PromotionAuthority,
  release: ReleaseGovernance,
  writer: RepositoryWriter,
  reconciliation: RepositoryReconciliation,
  incident: IncidentRollback,
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
        <span className="rail-logo" aria-hidden="true">℘</span>
        <span className="rail-title">Parallax Theory<br />Workbench</span>
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
  const Active = MODULE_COMPONENTS[module] ?? TheoryPackages
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
  theories: 'Start here. Describe or import a theory without pretending it is executable. Packages earn higher levels by adding exact operators, receipts, independent implementations, and Reality Gate evidence.',
  audit: 'Attack the selected package before formalization. See which definitions are mature, what blocks execution, which dependencies are actually declared, and export the H0–H6 recovery packet and safe implementation scaffolds.',
  conformance: 'Compare package-specific evidence against each operator contract. The gate checks case classes, required predicates, declared failures, first falsifiers, implementation coverage, and cross-surface agreement without executing imported code.',
  custody: 'Bind evidence to canonical hashes, signer identities, signatures, revocation records, supersession links, and CI provenance. Integrity and origin are not mathematical or empirical truth.',
  promotion: 'Admit only active, correctly scoped, lifecycle-clean evidence for one exact package and assessment. Eligibility permits a later governance review; it does not change package maturity.',
  authority: 'Define who may decide, under which signed mandate, role, scope, time window, quorum, and independence requirements. Decisions, appeals, renewals, and rollbacks remain append-only and never silently edit a package.',
  release: 'Materialize one exact, restricted before-to-after manifest patch from an operative signed decision. Release custody authorizes an artifact for a separate write; it never claims the repository was already changed.',
  writer: 'Re-verify an authorized release archive against the exact live manifest and replay ledger. The trusted workflow may create a review branch and attested application receipt, but it never pushes directly to main or claims the pull request was merged.',
  reconciliation: 'Verify that a controlled application pull request was actually merged, append a separate MERGED observation, attest the post-merge evidence, and freeze the exact rollback anchor without rewriting the original application receipt.',
  incident: 'Bind an incident declaration, evidence references, containment approval, rollback quorum, exact rollback anchor, restore manifest, and signed rollback release. A ready result enters the same controlled writer and merge chain; it does not erase history.',
  state: 'Build a finite list of complex numbers for the executable Langarian package. You get its dimension, norm, representative phase, and deterministic fingerprint.',
  operators: 'Apply one of the checked Langarian transformations. Every run writes a package-specific receipt describing what was checked.',
  program: 'Write a short program in the Langarian package language and run it step by step with receipts.',
  result: 'Inspect the last executable result: exact numbers, checks, claim boundaries, and provenance.',
  ledger: 'The audit trail of executable operations. Check whether a receipt was altered and export or import records.',
  gate: 'Checks whether claims may enter formal mathematical review. Passing means eligible for review, never proved and never empirically true.',
  viz: 'Pictures of Langarian states and receipts, always accompanied by exact values.',
  examples: 'Ready-made package demonstrations, including honest failures and non-foundational historical fixtures.',
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
