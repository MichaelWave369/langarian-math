import { useMemo, useState } from 'react'
import {
  buildAuditPacketMarkdown,
  buildDependencyGraph,
  buildPlanningReceipt,
  buildPythonScaffold,
  buildReadinessProfile,
  buildTypeScriptScaffold,
} from '../../theory/audit.js'
import { operatorContractResolved } from '../../theory/packages.js'
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
        <div><h3>{axis.name}</h3><p>{axis.summary}</p></div>
        <AuditBadge tone={tone}>{axis.percent}%</AuditBadge>
      </div>
      <div className="audit-meter" aria-label={`${axis.name}: ${axis.percent}%`}><span style={{ width: `${axis.percent}%` }} /></div>
      <ul className="audit-criteria-list">
        {axis.criteria.map((item) => (
          <li key={item.id} className={item.passed ? 'audit-criterion-pass' : 'audit-criterion-open'}>
            <span className="audit-criterion-icon" aria-hidden="true">{item.passed ? '✓' : '!'}</span>
            <div><strong>{item.label}</strong><p>{item.evidence}</p>{!item.passed && <p className="audit-action">Next: {item.action}</p>}</div>
          </li>
        ))}
      </ul>
    </article>
  )
}

function DependencyGraphView({ graph }) {
  const kinds = ['object', 'operator', 'assumption', 'invariant', 'predicate', 'failure', 'implementation', 'claim-boundary']
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
                  <strong>{node.label}</strong><span className="mono dim-text">{node.id}</span>
                  <AuditBadge tone={node.status === 'ACCEPTED' || node.status === 'reference' || node.status === 'REQUIRED' ? 'pass' : node.status === 'THEORY_MAP_OPEN' ? 'warn' : 'neutral'}>{node.status}</AuditBadge>
                </article>
              ))}
            </section>
          )
        })}
      </div>
      <details className="expander">
        <summary>Inspect typed graph edges ({graph.edges.length})</summary>
        <table className="data audit-edge-table"><thead><tr><th>from</th><th>relation</th><th>to</th></tr></thead><tbody>
          {graph.edges.map((edge, index) => <tr key={`${edge.from}:${edge.relation}:${edge.to}:${index}`}><td className="mono">{edge.from}</td><td>{edge.relation}</td><td className="mono">{edge.to}</td></tr>)}
        </tbody></table>
      </details>
      {graph.open_linkages.length > 0 && <div className="audit-open-box"><strong>Open dependency or interpretation boundaries</strong><ul>{graph.open_linkages.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </div>
  )
}

function ContractDetails({ operator }) {
  const contract = operator.contract
  const resolved = operatorContractResolved(operator)
  return (
    <details className="expander audit-contract-expander">
      <summary><strong>{operator.name}</strong> <span className="mono dim-text">{operator.id}</span> <AuditBadge tone={resolved ? 'pass' : 'warn'}>{resolved ? 'CONTRACT RESOLVED' : 'CONTRACT OPEN'}</AuditBadge></summary>
      <dl className="kv audit-contract-kv">
        <dt>typed map</dt><dd>{operator.input_types.join(' × ') || '∅'} → {operator.output_types.join(' × ') || '∅'}</dd>
        <dt>semantics</dt><dd>{operator.semantics}</dd>
        <dt>implementation</dt><dd>{operator.implementation ?? 'NOT IMPLEMENTED'}</dd>
        <dt>contract version</dt><dd>{contract.contract_version}</dd>
        <dt>preconditions</dt><dd>{contract.preconditions.join('; ')}</dd>
        <dt>assumptions used</dt><dd>{contract.assumptions_used.join(', ') || 'NONE'}</dd>
        <dt>invariants checked</dt><dd>{contract.invariants_checked.join(', ') || 'NONE'}</dd>
        <dt>reversibility</dt><dd>{contract.reversibility.classification} — {contract.reversibility.condition}</dd>
        <dt>receipt fields</dt><dd>{contract.receipt_fields.join(', ')}</dd>
        <dt>first falsifier</dt><dd>{contract.first_falsifier}</dd>
      </dl>
      <div className="two-col theory-two-col" style={{ marginTop: 12 }}>
        <section><h3>Named predicates</h3><ul>{contract.predicates.map((predicate) => <li key={predicate.id}><code>{predicate.id}</code> — {predicate.statement}{predicate.tolerance ? ` [${predicate.tolerance}]` : ''}</li>)}</ul></section>
        <section><h3>Failure behavior</h3><ul>{contract.failure_conditions.map((failure) => <li key={failure.id}><code>{failure.id}</code> — {failure.condition} <AuditBadge tone={failure.outcome === 'WARN_RECEIPT' ? 'warn' : 'fail'}>{failure.outcome}</AuditBadge></li>)}</ul></section>
      </div>
    </details>
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
          <AuditBadge tone="pass">OPERATOR CONTRACT PHASE v0.2</AuditBadge>
          <h2 id="theory-audit-heading">Execution contracts and H1–H6 recovery</h2>
          <p className="panel-sub">Every operator now declares preconditions, parameter bounds, assumptions, invariants, named predicates, failure outcomes, reversibility, receipt fields, and a first falsifier. Contracted operation behavior does not automatically settle an open theoretical interpretation.</p>
        </div>
        <AuditBadge>declared L{profile.declared_maturity}</AuditBadge>
      </div>

      {profile.warnings.length > 0 && <div className="audit-warning-box" role="status"><strong>Audit warnings</strong><ul>{profile.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      <div className="audit-axis-grid">{profile.axes.map((axis) => <ReadinessAxisCard key={axis.id} axis={axis} />)}</div>

      <section className="audit-subsection" aria-labelledby="operator-contract-heading">
        <div className="package-title-row">
          <div><h2 id="operator-contract-heading">Per-operator execution contracts</h2><p className="panel-sub">These contracts are portable implementation obligations. A valid contract is not proof that an implementation satisfies it.</p></div>
          <AuditBadge tone={theoryPackage.operators.every(operatorContractResolved) ? 'pass' : 'warn'}>{theoryPackage.operators.filter(operatorContractResolved).length}/{theoryPackage.operators.length} resolved</AuditBadge>
        </div>
        {theoryPackage.operators.map((operator) => <ContractDetails key={operator.id} operator={operator} />)}
      </section>

      <section className="audit-subsection" aria-labelledby="dependency-heading">
        <h2 id="dependency-heading">Typed dependency and provenance map</h2>
        <p className="panel-sub">Assumption, invariant, predicate, and failure edges now come directly from each v0.2 contract.</p>
        <DependencyGraphView graph={graph} />
      </section>

      <div className="two-col theory-two-col audit-export-grid">
        <section className="audit-subsection" aria-labelledby="audit-packet-heading">
          <h2 id="audit-packet-heading">Portable recovery artifacts</h2>
          <p>Export the package state, exact contracts, and unresolved interpretation boundaries for independent audit.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => downloadText(`${baseName}.H0-H6-audit.md`, auditPacket)}>Export H0–H6 packet</button>
            <button type="button" className="btn" onClick={() => downloadText(`${baseName}.scaffold.py`, pythonScaffold)}>Export Python scaffold</button>
            <button type="button" className="btn" onClick={() => downloadText(`${baseName}.scaffold.ts`, typeScriptScaffold)}>Export TypeScript scaffold</button>
          </div>
          <p className="dim-text">Generated scaffolds throw immediately. They cannot emit PASS or impersonate an implementation.</p>
        </section>

        <section className="audit-subsection" aria-labelledby="planning-receipt-heading">
          <h2 id="planning-receipt-heading">Planning receipt ledger</h2>
          <p>Create a contract-bound <code>NOT_RUN</code> receipt. Every declared predicate remains NOT_RUN until a package-specific implementation supplies observations.</p>
          <div className="btn-row">
            <label className="field audit-operator-select"><span>declared operator</span><select value={operationId} onChange={(event) => setOperationId(event.target.value)}>{theoryPackage.operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name} ({operator.id})</option>)}</select></label>
            <button type="button" className="btn btn-primary" onClick={makeReceipt} disabled={!operationId}>Create NOT_RUN receipt</button>
            {planningReceipts.length > 0 && <button type="button" className="btn" onClick={() => downloadText(`${baseName}.planning-receipts.json`, `${JSON.stringify(planningReceipts, null, 2)}\n`)}>Export ledger</button>}
          </div>
          {planningReceipts.length === 0 ? <p className="dim-text">No planning receipts in this local session.</p> : (
            <ol className="audit-receipt-list">{planningReceipts.map((receipt, index) => (
              <li key={`${receipt.timestamp_utc}:${receipt.operation_id}:${index}`}><div className="definition-head"><strong>{receipt.operation_id}</strong><AuditBadge tone="warn">{receipt.status}</AuditBadge></div><span className="mono dim-text">{receipt.timestamp_utc}</span><details className="expander"><summary>Inspect envelope</summary><pre className="json theory-json">{JSON.stringify(receipt, null, 2)}</pre></details></li>
            ))}</ol>
          )}
        </section>
      </div>
    </section>
  )
}
