import { useMemo, useState } from 'react'
import {
  BUNDLED_THEORY_PACKAGES,
  MATURITY_LEVELS,
  buildReceiptEnvelope,
  canExecutePackage,
  makeDraftPackage,
  operatorContractResolved,
  packageLevelName,
  parseTheoryPackageJson,
  validateTheoryPackage,
} from '../../theory/packages.js'
import { downloadText } from '../util/format.js'
import { sanitizeFilename, stripIngest } from '../util/sanitize.js'
import { useWorkbench } from '../WorkbenchContext.jsx'

const EMPTY_FORM = {
  id: '',
  name: '',
  version: '0.1.0',
  summary: '',
  motivation: '',
  maturityLevel: 1,
  objects: 'State',
  operators: '',
  assumptions: '',
  invariants: '',
  allowedClaims: 'The package documents its declared objects and boundaries.',
  prohibitedClaims: 'The theory describes reality without Reality Gate evidence.',
}

function lines(value) {
  return stripIngest(value).split('\n').map((item) => item.trim()).filter(Boolean)
}

function PackageBadge({ children, tone = 'neutral' }) {
  return <span className={`package-badge package-badge-${tone}`}>{children}</span>
}

function DefinitionList({ title, items, empty = 'None declared.' }) {
  return (
    <section className="package-section">
      <h3>{title}</h3>
      {items.length === 0 ? <p className="dim-text">{empty}</p> : (
        <ul className="definition-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="definition-head">
                <strong>{item.name ?? item.id}</strong>
                <span className="mono dim-text">{item.id}</span>
                {'evidence_class' in item && <PackageBadge>{item.evidence_class}</PackageBadge>}
                {'status' in item && <PackageBadge tone={item.status === 'ACCEPTED' ? 'pass' : item.status === 'THEORY_MAP_OPEN' ? 'warn' : 'neutral'}>{item.status}</PackageBadge>}
              </div>
              <p>{item.definition ?? item.semantics ?? item.text}</p>
              {item.scope && <p className="dim-text">scope: {item.scope}</p>}
              {item.contract && (
                <details className="expander">
                  <summary>
                    Execution contract <PackageBadge tone={operatorContractResolved(item) ? 'pass' : 'warn'}>{operatorContractResolved(item) ? 'RESOLVED' : 'OPEN'}</PackageBadge>
                  </summary>
                  <dl className="kv">
                    <dt>version</dt><dd>{item.contract.contract_version}</dd>
                    <dt>preconditions</dt><dd>{item.contract.preconditions.join('; ')}</dd>
                    <dt>assumptions</dt><dd>{item.contract.assumptions_used.join(', ') || 'NONE'}</dd>
                    <dt>invariants</dt><dd>{item.contract.invariants_checked.join(', ') || 'NONE'}</dd>
                    <dt>predicates</dt><dd>{item.contract.predicates.map((predicate) => predicate.id).join(', ')}</dd>
                    <dt>failures</dt><dd>{item.contract.failure_conditions.map((failure) => `${failure.id}:${failure.outcome}`).join(', ')}</dd>
                    <dt>reversibility</dt><dd>{item.contract.reversibility.classification} — {item.contract.reversibility.condition}</dd>
                    <dt>first falsifier</dt><dd>{item.contract.first_falsifier}</dd>
                  </dl>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PackageCard({ item, active, onSelect }) {
  const executable = canExecutePackage(item)
  return (
    <button type="button" className={`theory-card${active ? ' theory-card-active' : ''}`} onClick={onSelect}>
      <span className="theory-card-top"><strong>{item.theory.name}</strong><PackageBadge tone={executable ? 'pass' : 'neutral'}>L{item.maturity_level}</PackageBadge></span>
      <span className="dim-text">{packageLevelName(item.maturity_level)}</span>
      <span>{item.theory.summary}</span>
      <span className="theory-card-foot"><PackageBadge>{item.theory.status}</PackageBadge><PackageBadge tone={executable ? 'pass' : 'warn'}>{executable ? 'executable' : 'not executable yet'}</PackageBadge></span>
    </button>
  )
}

function ManifestPreview({ value, validation }) {
  if (!value) return null
  return (
    <section className="panel panel-formal" aria-labelledby="manifest-preview-heading">
      <div className="package-title-row"><h2 id="manifest-preview-heading">Generated package manifest</h2><PackageBadge tone={validation.ok ? 'pass' : 'fail'}>{validation.ok ? 'VALID' : `${validation.issues.length} ISSUE(S)`}</PackageBadge></div>
      {!validation.ok && <ul className="issue-list" role="alert">{validation.issues.map((issue, index) => <li key={`${issue.path}:${issue.code}:${index}`}><code>{issue.path}</code> [{issue.code}] {issue.message}</li>)}</ul>}
      <pre className="json theory-json">{JSON.stringify(value, null, 2)}</pre>
    </section>
  )
}

export default function TheoryPackages() {
  const { setModule, setNotice } = useWorkbench()
  const [packages, setPackages] = useState(BUNDLED_THEORY_PACKAGES)
  const [activeId, setActiveId] = useState(BUNDLED_THEORY_PACKAGES[0].theory.id)
  const [form, setForm] = useState(EMPTY_FORM)
  const [draft, setDraft] = useState(null)
  const [draftValidation, setDraftValidation] = useState({ ok: false, issues: [] })
  const [importText, setImportText] = useState('')
  const [importValidation, setImportValidation] = useState(null)

  const active = packages.find((item) => item.theory.id === activeId) ?? packages[0]
  const activeValidation = useMemo(() => validateTheoryPackage(active), [active])
  const receiptTemplate = useMemo(() => {
    if (!active || active.operators.length === 0) return null
    return buildReceiptEnvelope(active, active.operators[0].id, { timestamp_utc: 'RUNTIME_TIMESTAMP', claims_supported: active.claim_boundaries.allowed.slice(0, 1), status: 'NOT_RUN' })
  }, [active])

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const buildDraft = () => {
    const next = makeDraftPackage({ ...form, maturityLevel: Number(form.maturityLevel), objects: lines(form.objects), operators: lines(form.operators), assumptions: lines(form.assumptions), invariants: lines(form.invariants), allowedClaims: lines(form.allowedClaims), prohibitedClaims: lines(form.prohibitedClaims) })
    const validation = validateTheoryPackage(next)
    setDraft(next)
    setDraftValidation(validation)
  }

  const useActiveAsTemplate = () => {
    setForm({
      id: `${active.theory.id}-fork`,
      name: `${active.theory.name} — candidate fork`,
      version: '0.1.0',
      summary: active.theory.summary,
      motivation: active.theory.motivation,
      maturityLevel: Math.min(active.maturity_level, 2),
      objects: active.objects.map((item) => item.name).join('\n'),
      operators: active.operators.map((item) => item.name).join('\n'),
      assumptions: active.assumptions.map((item) => item.text).join('\n'),
      invariants: active.invariants.map((item) => item.text).join('\n'),
      allowedClaims: active.claim_boundaries.allowed.join('\n'),
      prohibitedClaims: active.claim_boundaries.prohibited.join('\n'),
    })
    setDraft(null)
    setModule('theories')
    setNotice('The selected package was copied into the wizard as a non-authoritative candidate fork. Contract details remain open until explicitly recovered.')
  }

  const importPackage = () => {
    const parsed = parseTheoryPackageJson(stripIngest(importText))
    setImportValidation(parsed.validation)
    if (!parsed.package) return
    setPackages((current) => [...current.filter((item) => item.theory.id !== parsed.package.theory.id), parsed.package])
    setActiveId(parsed.package.theory.id)
    setNotice(`Imported theory package ${parsed.package.theory.id}@${parsed.package.theory.version} into this local session.`)
  }

  const exportPackage = (item) => downloadText(`${sanitizeFilename(item.theory.id)}.theory-package.json`, `${JSON.stringify(item, null, 2)}\n`)

  return (
    <div>
      <section className="theory-hero" aria-labelledby="theory-front-door-heading">
        <div>
          <PackageBadge tone="pass">THEORY PACKAGE ARCHITECTURE v0.2</PackageBadge>
          <h2 id="theory-front-door-heading">Where a theory enters Parallax</h2>
          <p>A theory enters as a package that names its objects, operations, exact execution contracts, assumptions, invariants, implementations, receipts, and claim boundaries.</p>
          <p className="dim-text">The governance shell is general. Execution is package-specific and must be earned through implementation and conformance.</p>
        </div>
        <div className="hero-answer">
          <strong>Can any theory be plugged in?</strong>
          <p>Any sufficiently explicit theory can enter at Level 1 as a documentary package.</p>
          <p>Level 2 requires exact operator contracts. Level 3 requires a package-specific implementation.</p>
          <p>No package reaches empirical confidence without a separate Reality Gate.</p>
        </div>
      </section>

      <section className="panel panel-formal" aria-labelledby="maturity-heading">
        <h2 id="maturity-heading">Five admission levels</h2>
        <div className="maturity-grid">{MATURITY_LEVELS.map((level) => <article key={level.level} className="maturity-card"><PackageBadge>L{level.level}</PackageBadge><h3>{level.name}</h3><p>{level.description}</p></article>)}</div>
      </section>

      <div className="two-col theory-two-col">
        <section className="panel panel-formal" aria-labelledby="package-library-heading">
          <div className="package-title-row"><h2 id="package-library-heading">Theory package library</h2><PackageBadge>{packages.length} package(s)</PackageBadge></div>
          <div className="theory-card-grid">{packages.map((item) => <PackageCard key={`${item.theory.id}:${item.theory.version}`} item={item} active={active.theory.id === item.theory.id} onSelect={() => setActiveId(item.theory.id)} />)}</div>
        </section>

        <section className="panel panel-formal" aria-labelledby="active-package-heading">
          <div className="package-title-row"><div><h2 id="active-package-heading">{active.theory.name}</h2><p className="mono dim-text">{active.theory.id}@{active.theory.version}</p></div><PackageBadge tone={activeValidation.ok ? 'pass' : 'fail'}>{activeValidation.ok ? 'MANIFEST VALID' : 'INVALID'}</PackageBadge></div>
          <p>{active.theory.summary}</p>
          <dl className="kv">
            <dt>why it exists</dt><dd>{active.theory.motivation}</dd>
            <dt>maturity</dt><dd>Level {active.maturity_level} — {packageLevelName(active.maturity_level)}</dd>
            <dt>Reality Gate</dt><dd>{active.evidence.reality_gate}</dd>
            <dt>implementation surfaces</dt><dd>{active.implementations.length}</dd>
            <dt>resolved contracts</dt><dd>{active.operators.filter(operatorContractResolved).length}/{active.operators.length}</dd>
          </dl>
          <div className="btn-row" style={{ marginTop: 12 }}>
            {canExecutePackage(active) && active.metadata.execution_route === 'program' && <button type="button" className="btn btn-primary" onClick={() => setModule('program')}>Open executable workbench</button>}
            <button type="button" className="btn" onClick={() => setModule('audit')}>Open Theory Audit</button>
            <button type="button" className="btn" onClick={() => exportPackage(active)}>Export manifest</button>
            <button type="button" className="btn btn-ghost" onClick={useActiveAsTemplate}>Use as candidate template</button>
          </div>
          {!canExecutePackage(active) && <div className="notice package-inline-notice" role="status">This package can be inspected and audited now, but it has not earned executable status. It will not be simulated by the wrong kernel.</div>}
        </section>
      </div>

      <div className="two-col theory-two-col">
        <section className="panel panel-formal" aria-labelledby="definitions-heading">
          <h2 id="definitions-heading">Recovered package definitions</h2>
          <DefinitionList title="Objects" items={active.objects} />
          <DefinitionList title="Operators and contracts" items={active.operators} />
          <DefinitionList title="Assumptions" items={active.assumptions} />
          <DefinitionList title="Invariant candidates" items={active.invariants} />
        </section>

        <section className="panel panel-formal" aria-labelledby="boundary-heading">
          <h2 id="boundary-heading">Claim boundary and receipt envelope</h2>
          <div className="claim-columns"><div><h3>Allowed</h3><ul>{active.claim_boundaries.allowed.map((claim) => <li key={claim}>{claim}</li>)}</ul></div><div><h3>Prohibited</h3><ul>{active.claim_boundaries.prohibited.map((claim) => <li key={claim}>{claim}</li>)}</ul></div></div>
          <p className="panel-sub">The v0.2 envelope binds a future execution to its package, exact operator contract, implementation, assumptions, predicates, parents, and bounded claims. NOT_RUN remains planning only.</p>
          {receiptTemplate && <pre className="json theory-json">{JSON.stringify(receiptTemplate, null, 2)}</pre>}
        </section>
      </div>

      <section className="panel panel-formal" aria-labelledby="wizard-heading">
        <div className="package-title-row"><div><h2 id="wizard-heading">Theory Definition Wizard</h2><p className="panel-sub">Create a documentary package first. The wizard generates valid v0.2 contract placeholders marked THEORY MAP OPEN rather than inventing semantics.</p></div><button type="button" className="btn btn-ghost" onClick={() => { setForm(EMPTY_FORM); setDraft(null) }}>Clear</button></div>
        <div className="theory-form-grid">
          <label className="field"><span>stable package id</span><input value={form.id} onChange={(event) => updateForm('id', event.target.value)} placeholder="my-theory" /></label>
          <label className="field"><span>theory name</span><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="My Theory" /></label>
          <label className="field"><span>version</span><input value={form.version} onChange={(event) => updateForm('version', event.target.value)} /></label>
          <label className="field"><span>maturity level</span><select value={form.maturityLevel} onChange={(event) => updateForm('maturityLevel', Number(event.target.value))}>{MATURITY_LEVELS.map((item) => <option key={item.level} value={item.level}>L{item.level} — {item.name}</option>)}</select></label>
          <label className="field theory-field-wide"><span>summary</span><textarea rows={2} value={form.summary} onChange={(event) => updateForm('summary', event.target.value)} placeholder="What the theory is about" /></label>
          <label className="field theory-field-wide"><span>what made you build it?</span><textarea rows={2} value={form.motivation} onChange={(event) => updateForm('motivation', event.target.value)} placeholder="The problem this theory or package is trying to solve" /></label>
          <label className="field"><span>objects — one per line</span><textarea rows={5} value={form.objects} onChange={(event) => updateForm('objects', event.target.value)} /></label>
          <label className="field"><span>operators — one per line</span><textarea rows={5} value={form.operators} onChange={(event) => updateForm('operators', event.target.value)} /></label>
          <label className="field"><span>assumptions — one per line</span><textarea rows={5} value={form.assumptions} onChange={(event) => updateForm('assumptions', event.target.value)} /></label>
          <label className="field"><span>invariants — one per line</span><textarea rows={5} value={form.invariants} onChange={(event) => updateForm('invariants', event.target.value)} /></label>
          <label className="field"><span>allowed claims — one per line</span><textarea rows={5} value={form.allowedClaims} onChange={(event) => updateForm('allowedClaims', event.target.value)} /></label>
          <label className="field"><span>prohibited claims — one per line</span><textarea rows={5} value={form.prohibitedClaims} onChange={(event) => updateForm('prohibitedClaims', event.target.value)} /></label>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}><button type="button" className="btn btn-primary" onClick={buildDraft}>Build &amp; validate manifest</button>{draft && <button type="button" className="btn" onClick={() => exportPackage(draft)}>Export draft</button>}</div>
      </section>

      <ManifestPreview value={draft} validation={draftValidation} />

      <section className="panel panel-formal" aria-labelledby="import-package-heading">
        <h2 id="import-package-heading">Import a theory package</h2>
        <p className="panel-sub">Import is local to this browser session. v0.2 schema and cross-reference validation happen before the package enters the library.</p>
        <textarea className="code" rows={8} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"schema_version":"theory-package:v0.2", ...}' aria-label="theory package JSON" />
        <div className="btn-row" style={{ marginTop: 10 }}><button type="button" className="btn btn-primary" onClick={importPackage} disabled={importText.trim() === ''}>Validate &amp; import</button></div>
        {importValidation && <div className={importValidation.ok ? 'package-validation-pass' : 'error-box'} role="status">{importValidation.ok ? 'Package manifest is valid and was imported into this session.' : <ul className="issue-list">{importValidation.issues.map((issue, index) => <li key={`${issue.path}:${index}`}><code>{issue.path}</code> [{issue.code}] {issue.message}</li>)}</ul>}</div>}
      </section>
    </div>
  )
}
