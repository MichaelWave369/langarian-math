import { useMemo, useState } from 'react'
import {
  BUNDLED_CONFORMANCE_SUITES,
  buildConformanceProfile,
  buildConformanceSuiteScaffold,
  parseConformanceSuiteJson,
  suiteForPackage,
} from '../../theory/conformance.js'
import { BUNDLED_THEORY_PACKAGES, packageLevelName } from '../../theory/packages.js'
import { downloadText } from '../util/format.js'
import { sanitizeFilename, stripIngest } from '../util/sanitize.js'
import './ContractConformance.css'

function Badge({ children, tone = 'neutral' }) {
  return <span className={`conformance-badge conformance-badge-${tone}`}>{children}</span>
}

function GateSummary({ profile }) {
  return (
    <section className={`conformance-gate ${profile.promotion_eligible ? 'conformance-gate-pass' : 'conformance-gate-open'}`}>
      <div>
        <Badge tone={profile.promotion_eligible ? 'pass' : 'warn'}>{profile.promotion_eligible ? 'PROMOTION ELIGIBLE' : 'PROMOTION BLOCKED'}</Badge>
        <h2>Contract-conformance Level-4 gate</h2>
        <p>
          This gate asks whether every operator contract has nominal, boundary, adversarial, failure, and first-falsifier evidence from every executable implementation surface.
        </p>
      </div>
      <dl className="kv">
        <dt>suite schema</dt><dd>{profile.suite_schema_version}</dd>
        <dt>executable surfaces</dt><dd>{profile.executable_implementations.length}</dd>
        <dt>operators audited</dt><dd>{profile.operators.length}</dd>
        <dt>open blockers</dt><dd>{profile.blockers.length}</dd>
      </dl>
    </section>
  )
}

function CoverageMarks({ values }) {
  return (
    <div className="coverage-marks">
      {Object.entries(values).map(([name, covered]) => (
        <span key={name} className={covered ? 'coverage-mark-pass' : 'coverage-mark-open'}>{covered ? '✓' : '!'} {name}</span>
      ))}
    </div>
  )
}

function OperatorProfile({ operator }) {
  return (
    <article className="conformance-operator-card">
      <div className="conformance-operator-head">
        <div>
          <h3>{operator.operator_name}</h3>
          <span className="mono dim-text">{operator.operator_id}</span>
        </div>
        <Badge tone={operator.percent === 100 ? 'pass' : operator.percent >= 50 ? 'warn' : 'fail'}>{operator.percent}%</Badge>
      </div>
      <CoverageMarks values={operator.case_classes} />
      <dl className="kv conformance-operator-kv">
        <dt>required predicates</dt><dd>{operator.predicates_covered}/{operator.predicates_total}</dd>
        <dt>failure conditions</dt><dd>{operator.failures_covered}/{operator.failures_total}</dd>
        <dt>first falsifier</dt><dd>{operator.falsifier_exercised ? 'exercised' : 'OPEN'}</dd>
        <dt>all surfaces represented</dt><dd>{operator.implementation_coverage ? 'yes' : 'no'}</dd>
        <dt>cross-surface agreement</dt><dd>{operator.cross_surface_agreement ? 'yes' : 'no'}</dd>
      </dl>
      {operator.blockers.length > 0 && (
        <details className="expander">
          <summary>Open obligations ({operator.blockers.length})</summary>
          <ul className="issue-list">{operator.blockers.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      )}
      <div className="conformance-case-list">
        {operator.cases.map((testCase) => (
          <article key={testCase.case_id} className="conformance-case">
            <div className="definition-head">
              <strong>{testCase.case_id}</strong>
              <Badge>{testCase.class}</Badge>
              <Badge tone={testCase.agreement ? 'pass' : 'warn'}>{testCase.agreement ? 'AGREEMENT' : 'OPEN'}</Badge>
            </div>
            <p>Expected status: <code>{testCase.expected_status}</code></p>
            <p className="dim-text">observations: {testCase.observations.length}; missing surfaces: {testCase.missing_implementations.join(', ') || 'none'}</p>
            {testCase.mismatches.length > 0 && <ul className="issue-list">{testCase.mismatches.map((item) => <li key={item}>{item}</li>)}</ul>}
            {testCase.observations.length > 0 && (
              <details className="expander">
                <summary>Inspect evidence records</summary>
                {testCase.observations.map((observation) => (
                  <div key={`${observation.case_id}:${observation.implementation_id}`} className="conformance-observation">
                    <div className="definition-head"><strong>{observation.implementation_id}</strong><Badge tone="pass">{observation.status}</Badge></div>
                    <p className="mono dim-text">{observation.implementation_version}</p>
                    <p>{observation.evidence_ref}</p>
                    <p className="mono dim-text">signature: {observation.result_signature ?? 'none'}</p>
                  </div>
                ))}
              </details>
            )}
          </article>
        ))}
      </div>
    </article>
  )
}

export default function ContractConformance() {
  const [activeId, setActiveId] = useState(BUNDLED_THEORY_PACKAGES[0]?.theory.id ?? '')
  const activePackage = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === activeId) ?? BUNDLED_THEORY_PACKAGES[0]
  const initialSuite = activePackage ? suiteForPackage(activePackage) ?? buildConformanceSuiteScaffold(activePackage) : null
  const [suiteState, setSuiteState] = useState(() => ({ packageId: activePackage?.theory.id ?? '', suite: initialSuite }))
  const [importText, setImportText] = useState('')
  const [importValidation, setImportValidation] = useState(null)

  if (!activePackage) return <div className="notice">No bundled packages are available.</div>

  const suite = suiteState.packageId === activePackage.theory.id
    ? suiteState.suite
    : suiteForPackage(activePackage) ?? buildConformanceSuiteScaffold(activePackage)
  const profile = useMemo(() => buildConformanceProfile(activePackage, suite), [activePackage, suite])
  const baseName = sanitizeFilename(activePackage.theory.id)

  const selectPackage = (id) => {
    const nextPackage = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === id)
    setActiveId(id)
    if (nextPackage) setSuiteState({ packageId: id, suite: suiteForPackage(nextPackage) ?? buildConformanceSuiteScaffold(nextPackage) })
    setImportText('')
    setImportValidation(null)
  }

  const importSuite = () => {
    const parsed = parseConformanceSuiteJson(activePackage, stripIngest(importText))
    setImportValidation(parsed.validation)
    if (parsed.suite) setSuiteState({ packageId: activePackage.theory.id, suite: parsed.suite })
  }

  const resetSuite = () => {
    setSuiteState({ packageId: activePackage.theory.id, suite: suiteForPackage(activePackage) ?? buildConformanceSuiteScaffold(activePackage) })
    setImportValidation(null)
  }

  return (
    <div>
      <section className="panel panel-formal" aria-labelledby="conformance-selection-heading">
        <div className="package-title-row">
          <div>
            <Badge tone="pass">CONTRACT CONFORMANCE PHASE v0.3</Badge>
            <h2 id="conformance-selection-heading">Compare implementations against the contract</h2>
            <p className="panel-sub">
              The browser validates evidence records produced elsewhere. It does not execute imported code or manufacture missing observations.
            </p>
          </div>
          <Badge>{BUNDLED_CONFORMANCE_SUITES.length} bundled evidence suite(s)</Badge>
        </div>
        <label className="field" style={{ maxWidth: 680 }}>
          <span>theory package</span>
          <select value={activePackage.theory.id} onChange={(event) => selectPackage(event.target.value)}>
            {BUNDLED_THEORY_PACKAGES.map((item) => (
              <option key={item.theory.id} value={item.theory.id}>{item.theory.name} — declared L{item.maturity_level} {packageLevelName(item.maturity_level)}</option>
            ))}
          </select>
        </label>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>package</dt><dd>{activePackage.theory.id}@{activePackage.theory.version}</dd>
          <dt>suite cases</dt><dd>{suite.cases.length}</dd>
          <dt>observations</dt><dd>{suite.observations.length}</dd>
          <dt>evidence scope</dt><dd>{String(suite.metadata.evidence_scope ?? (suite.metadata.planning_artifact ? 'Planning scaffold only.' : 'Not stated.'))}</dd>
        </dl>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => downloadText(`${baseName}.conformance-suite.json`, `${JSON.stringify(suite, null, 2)}\n`)}>Export current suite</button>
          <button type="button" className="btn" onClick={() => downloadText(`${baseName}.conformance-scaffold.json`, `${JSON.stringify(buildConformanceSuiteScaffold(activePackage), null, 2)}\n`)}>Export blank scaffold</button>
          <button type="button" className="btn btn-ghost" onClick={resetSuite}>Reset bundled evidence</button>
        </div>
      </section>

      <GateSummary profile={profile} />

      {profile.warnings.length > 0 && (
        <div className="conformance-warning" role="status">
          <strong>Evidence warnings</strong>
          <ul>{profile.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}

      {!profile.validation.ok && (
        <section className="panel panel-formal">
          <h2>Suite validation issues</h2>
          <ul className="issue-list">{profile.validation.issues.map((issue, index) => <li key={`${issue.path}:${issue.code}:${index}`}><code>{issue.path}</code> [{issue.code}] {issue.message}</li>)}</ul>
        </section>
      )}

      <section className="panel panel-formal" aria-labelledby="operator-conformance-heading">
        <div className="package-title-row">
          <div>
            <h2 id="operator-conformance-heading">Per-operator coverage</h2>
            <p className="panel-sub">A green implementation replay is not enough. Every required predicate, failure condition, adversarial boundary, and first falsifier must be exercised.</p>
          </div>
          <Badge tone={profile.promotion_eligible ? 'pass' : 'warn'}>{profile.operators.filter((item) => item.percent === 100).length}/{profile.operators.length} complete</Badge>
        </div>
        <div className="conformance-operator-grid">
          {profile.operators.map((operator) => <OperatorProfile key={operator.operator_id} operator={operator} />)}
        </div>
      </section>

      <section className="panel panel-formal" aria-labelledby="conformance-import-heading">
        <h2 id="conformance-import-heading">Validate imported conformance evidence</h2>
        <p className="panel-sub">Imported JSON is data only. A valid suite means its identities and expectations are internally coherent; it does not prove the cited evidence is authentic.</p>
        <textarea className="code" rows={10} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"suite_schema_version":"contract-conformance-suite:v0.1", ...}' />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-primary" onClick={importSuite} disabled={importText.trim() === ''}>Validate &amp; load locally</button>
        </div>
        {importValidation && (
          <div className={importValidation.ok ? 'package-validation-pass' : 'error-box'} role="status">
            {importValidation.ok ? 'Conformance suite is structurally valid and loaded for this browser session.' : (
              <ul className="issue-list">{importValidation.issues.map((issue, index) => <li key={`${issue.path}:${index}`}><code>{issue.path}</code> [{issue.code}] {issue.message}</li>)}</ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
