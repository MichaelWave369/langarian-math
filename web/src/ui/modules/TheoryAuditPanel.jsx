import { useMemo, useState } from 'react'
import {
  buildAuditPacketMarkdown,
  buildDependencyGraph,
  buildPlanningReceipt,
  buildPythonScaffold,
  buildReadinessProfile,
  buildTypeScriptScaffold,
} from '../../theory/audit.js'
import { downloadText } from '../util/format.js'
import { sanitizeFilename } from '../util/sanitize.js'
import './TheoryAuditPanel.css'

function AuditBadge({ children, tone = 'neutral' }) {
  return <span className={`audit-badge audit-badge-${tone}`}>{children}</span>
}

function ReadinessAxisCard({ axis }) {
  const tone = axis.percent === 100 ? 'pass' : axis.percent >= 60 ? 'warn' : 'fail'
  return (
    <article className="audit-axis-card">
      <div className="audit-axis-head">
        <div>
          <h3>{axis.name}</h3>
          <p>{axis.summary}</p>
        </div>
        <AuditBadge tone={tone}>{axis.percent}%</AuditBadge>
      </div>
      <div className="audit-meter" aria-label={`${axis.name}: ${axis.percent}%`}>
        <span style={{ width: `${axis.percent}%` }} />
      </div>
      <ul className="audit-criteria-list">
        {axis.criteria.map((item) => (
          <li key={item.id} className={item.passed ? 'audit-criterion-pass' : 'audit-criterion-open'}>
            <span className="audit-criterion-icon" aria-hidden="true">{item.passed ? '✓' : '!'}</span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.evidence}</p>
              {!item.passed && <p className="audit-action">Next: {item.action}</p>}
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}

function DependencyGraphView({ graph }) {
  const kinds = ['object', 'operator', 'assumption', 'invariant', 'implementation', 'claim-boundary']
  return (
    <div>
      <div className="audit-graph-grid" aria-label="Package dependency graph">
        {kinds.map((kind) => {
          const nodes = graph.nodes.filter((node) => node.kind === kind)
          return (
            <section key={kind} className="audit-graph-column">
              <h3>{kind.replace('-', ' ')}</h3>
              {nodes.length === 0 ? <p className="dim-text">None declared.</p> : nodes.map((node) => (
                <article key={node.id} className="audit-node">
                  <strong>{node.label}</strong>
                  <span className="mono dim-text">{node.id}</span>
                  <AuditBadge tone={node.status === 'ACCEPTED' || node.status === 'reference' ? 'pass' : node.status === 'THEORY_MAP_OPEN' ? 'warn' : 'neutral'}>{node.status}</AuditBadge>
                </article>
              ))}
            </section>
          )
        })}
      </div>
      <details className="expander">
        <summary>Inspect typed graph edges ({graph.edges.length})</summary>
        <table className="data audit-edge-table">
          <thead><tr><th>from</th><th>relation</th><th>to</th></tr></thead>
          <tbody>
            {graph.edges.map((edge, index) => (
              <tr key={`${edge.from}:${edge.relation}:${edge.to}:${index}`}>
                <td className="mono">{edge.from}</td><td>{edge.relation}</td><td className="mono">{edge.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {graph.open_linkages.length > 0 && (
        <div className="audit-open-box">
          <strong>Open dependency linkages</strong>
          <ul>{graph.open_linkages.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

function OperatorContractTable({ theoryPackage }) {
  return (
    <div className="audit-table-wrap">
      <table className="data audit-contract-table">
        <thead>
          <tr><th>operator</th><th>typed map</th><th>implementation</th><th>assumption linkage</th><th>predicate linkage</th><th>disposition</th></tr>
        </thead>
        <tbody>
          {theoryPackage.operators.map((operator) => (
            <tr key={operator.id}>
              <td><strong>{operator.name}</strong><div className="mono dim-text">{operator.id}</div></td>
              <td><div className="mono">{operator.input_types.join(' × ') || '∅'} → {operator.output_types.join(' × ') || '∅'}</div><p>{operator.semantics}</p></td>
              <td className="mono">{operator.implementation ?? 'NOT IMPLEMENTED'}</td>
              <td><AuditBadge tone="warn">THEORY MAP OPEN</AuditBadge><p className="dim-text">v0.1 has package-level assumptions only.</p></td>
              <td><AuditBadge tone="warn">THEORY MAP OPEN</AuditBadge><p className="dim-text">Exact checks, tolerances, and falsifiers are not linked per operator.</p></td>
              <td><AuditBadge tone={operator.status === 'ACCEPTED' ? 'pass' : operator.status === 'THEORY_MAP_OPEN' ? 'warn' : 'neutral'}>{operator.status}</AuditBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TheoryAuditPanel({ theoryPackage }) {
  const profile = useMemo(() => buildReadinessProfile(theoryPackage), [theoryPackage])
  const graph = useMemo(() => buildDependencyGraph(theoryPackage), [theoryPackage])
  const auditPacket = useMemo(() => buildAuditPacketMarkdown(theoryPackage), [theoryPackage])
  const pythonScaffold = useMemo(() => buildPythonScaffold(theoryPackage), [theoryPackage])
  const typeScriptScaffold = useMemo(() => buildTypeScriptScaffold(theoryPackage), [theoryPackage])
  const [operationId, setOperationId] = useState(theoryPackage.operators[0]?.id ?? '')
  const [planningReceipts, setPlanningReceipts] = useState([])

  const baseName = sanitizeFilename(theoryPackage.theory.id)
  const makeReceipt = () => {
    if (!operationId) return
    const receipt = buildPlanningReceipt(theoryPackage, operationId)
    setPlanningReceipts((current) => [receipt, ...current].slice(0, 20))
  }

  return (
    <section className="theory-audit-workspace panel panel-formal" aria-labelledby="theory-audit-heading">
      <div className="package-title-row">
        <div>
          <AuditBadge tone="pass">FOUNDATION AUDIT PHASE v0.2</AuditBadge>
          <h2 id="theory-audit-heading">Execution readiness and H1–H6 recovery</h2>
          <p className="panel-sub">
            This workspace does not run a theory through the wrong kernel. It exposes semantic gaps, builds implementation scaffolds,
            maps declared dependencies, and exports the evidence packet needed before execution can be promoted.
          </p>
        </div>
        <AuditBadge>declared L{profile.declared_maturity}</AuditBadge>
      </div>

      {profile.warnings.length > 0 && (
        <div className="audit-warning-box" role="status">
          <strong>Audit warnings</strong>
          <ul>{profile.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}

      <div className="audit-axis-grid">
        {profile.axes.map((axis) => <ReadinessAxisCard key={axis.id} axis={axis} />)}
      </div>

      <section className="audit-subsection" aria-labelledby="operator-contract-heading">
        <div className="package-title-row">
          <div>
            <h2 id="operator-contract-heading">Operator execution-contract audit</h2>
            <p className="panel-sub">Code locations do not complete semantics. Every operator still needs explicit assumptions, predicates, failures, and receipt fields.</p>
          </div>
          <AuditBadge tone={theoryPackage.operators.every((item) => item.implementation) ? 'pass' : 'warn'}>
            {theoryPackage.operators.filter((item) => item.implementation).length}/{theoryPackage.operators.length} implementation locations
          </AuditBadge>
        </div>
        <OperatorContractTable theoryPackage={theoryPackage} />
      </section>

      <section className="audit-subsection" aria-labelledby="dependency-heading">
        <h2 id="dependency-heading">Typed dependency and provenance map</h2>
        <p className="panel-sub">Solid edges below come directly from the manifest. Missing assumption and invariant links remain visible rather than inferred.</p>
        <DependencyGraphView graph={graph} />
      </section>

      <div className="two-col theory-two-col audit-export-grid">
        <section className="audit-subsection" aria-labelledby="audit-packet-heading">
          <h2 id="audit-packet-heading">Portable recovery artifacts</h2>
          <p>Export the exact package state for Hughes recovery, Ori attack, and Emet formalization.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => downloadText(`${baseName}.H0-H6-audit.md`, auditPacket)}>Export H0–H6 packet</button>
            <button type="button" className="btn" onClick={() => downloadText(`${baseName}.scaffold.py`, pythonScaffold)}>Export Python scaffold</button>
            <button type="button" className="btn" onClick={() => downloadText(`${baseName}.scaffold.ts`, typeScriptScaffold)}>Export TypeScript scaffold</button>
          </div>
          <p className="dim-text">Generated scaffolds throw immediately. They cannot emit PASS or impersonate an implementation.</p>
        </section>

        <section className="audit-subsection" aria-labelledby="planning-receipt-heading">
          <h2 id="planning-receipt-heading">Planning receipt ledger</h2>
          <p>Create a package-bound <code>NOT_RUN</code> receipt before implementation. It records the intended operator without pretending execution occurred.</p>
          <div className="btn-row">
            <label className="field audit-operator-select"><span>declared operator</span>
              <select value={operationId} onChange={(event) => setOperationId(event.target.value)}>
                {theoryPackage.operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name} ({operator.id})</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={makeReceipt} disabled={!operationId}>Create NOT_RUN receipt</button>
            {planningReceipts.length > 0 && (
              <button type="button" className="btn" onClick={() => downloadText(`${baseName}.planning-receipts.json`, `${JSON.stringify(planningReceipts, null, 2)}\n`)}>Export ledger</button>
            )}
          </div>
          {planningReceipts.length === 0 ? <p className="dim-text">No planning receipts in this local session.</p> : (
            <ol className="audit-receipt-list">
              {planningReceipts.map((receipt, index) => (
                <li key={`${receipt.timestamp_utc}:${receipt.operation_id}:${index}`}>
                  <div className="definition-head"><strong>{receipt.operation_id}</strong><AuditBadge tone="warn">{receipt.status}</AuditBadge></div>
                  <span className="mono dim-text">{receipt.timestamp_utc}</span>
                  <details className="expander"><summary>Inspect envelope</summary><pre className="json theory-json">{JSON.stringify(receipt, null, 2)}</pre></details>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </section>
  )
}
