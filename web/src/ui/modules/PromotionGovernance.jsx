import { useEffect, useMemo, useState } from 'react'
import { suiteForPackage } from '../../theory/conformance.js'
import {
  emptyCustodyBundle,
  generateLocalSigner,
  parseCustodyBundleJson,
  signEvidenceSubject,
} from '../../theory/custody.js'
import { BUNDLED_THEORY_PACKAGES } from '../../theory/packages.js'
import {
  DEFAULT_LEVEL4_PROMOTION_POLICY,
  buildPromotionGovernanceProfile,
  createPromotionAssessmentReceipt,
} from '../../theory/promotion.js'
import { downloadText } from '../util/format.js'
import { stripIngest } from '../util/sanitize.js'
import './PromotionGovernance.css'

function Badge({ children, tone = 'neutral' }) {
  return <span className={`package-badge package-badge-${tone}`}>{children}</span>
}

function short(value) {
  if (!value) return '—'
  return value.length > 34 ? `${value.slice(0, 20)}…${value.slice(-9)}` : value
}

export default function PromotionGovernance() {
  const theoryPackage = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex') ?? BUNDLED_THEORY_PACKAGES[0]
  const suite = theoryPackage ? suiteForPackage(theoryPackage) : null
  const [bundle, setBundle] = useState(emptyCustodyBundle)
  const [signer, setSigner] = useState(null)
  const [profile, setProfile] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [importText, setImportText] = useState('')
  const [importIssues, setImportIssues] = useState([])
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const policy = useMemo(() => DEFAULT_LEVEL4_PROMOTION_POLICY, [])

  useEffect(() => {
    let live = true
    if (!theoryPackage || !suite) return undefined
    buildPromotionGovernanceProfile(theoryPackage, suite, bundle, policy).then(async (next) => {
      if (!live) return
      setProfile(next)
      setAssessment(await createPromotionAssessmentReceipt(next, theoryPackage.maturity_level))
    })
    return () => { live = false }
  }, [bundle, policy, suite, theoryPackage])

  if (!theoryPackage || !suite) return <div className="notice">No public executable package and conformance suite are available.</div>

  const createDemonstrationCustody = async () => {
    setBusy(true)
    try {
      const nextSigner = await generateLocalSigner('Promotion evidence custodian')
      const envelope = await signEvidenceSubject(
        suite,
        'contract-conformance-suite',
        `conformance-suite:${suite.package.id}@${suite.package.version}`,
        nextSigner,
        {
          metadata: {
            package_id: suite.package.id,
            package_version: suite.package.version,
            purpose: 'custody-aware promotion evidence admission demonstration',
          },
        },
      )
      setSigner(nextSigner)
      setBundle({
        bundle_schema_version: 'evidence-custody-bundle:v0.1',
        signers: [nextSigner.identity],
        envelopes: [envelope],
        revocations: [],
        metadata: { planning_artifact: false, generated_in: 'promotion-governance:v0.1' },
      })
      setMessage('Created a locally signed custody bundle. The conformance gate remains independent and may still block promotion.')
    } catch (error) {
      setMessage(`Could not create demonstration custody: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const importBundle = () => {
    const parsed = parseCustodyBundleJson(stripIngest(importText))
    setImportIssues(parsed.issues)
    if (!parsed.bundle) return
    setBundle(parsed.bundle)
    setSigner(null)
    setMessage('Imported public custody records. No private key or package code was imported.')
  }

  const exportAssessment = () => {
    if (!assessment) return
    downloadText('langarian-promotion-assessment.json', `${JSON.stringify(assessment, null, 2)}\n`)
  }

  const exportBundle = () => downloadText('langarian-promotion-custody.json', `${JSON.stringify(bundle, null, 2)}\n`)

  const gateTone = (pass) => pass ? 'pass' : 'warn'

  return (
    <div>
      <section className="promotion-hero" aria-labelledby="promotion-heading">
        <div>
          <Badge tone="pass">PROMOTION GOVERNANCE v0.5</Badge>
          <h2 id="promotion-heading">Admit the evidence before judging the promotion.</h2>
          <p>
            This workspace combines package validity, contract conformance, and signed evidence custody. It emits an
            eligibility assessment only. It never edits the package maturity level and never treats signatures as proof.
          </p>
        </div>
        <div className="hero-answer">
          <strong>Three separate questions</strong>
          <p><b>Conformance:</b> does the evidence satisfy every operator contract?</p>
          <p><b>Custody:</b> is that exact evidence active, scoped, signed, and lifecycle-clean?</p>
          <p><b>Promotion:</b> may the package enter a separate governance review?</p>
        </div>
      </section>

      <section className="panel panel-formal">
        <div className="package-title-row">
          <div><h2>Gate summary</h2><p className="mono dim-text">{theoryPackage.theory.id}@{theoryPackage.theory.version} → Level 4</p></div>
          <Badge tone={profile?.status === 'ELIGIBLE_FOR_REVIEW' ? 'pass' : 'warn'}>{profile?.status ?? 'EVALUATING'}</Badge>
        </div>
        <div className="promotion-gates">
          <div className={`promotion-gate promotion-gate-${gateTone(profile?.conformance.promotion_eligible)}`}>
            <span>1</span><strong>Contract conformance</strong><b>{profile?.conformance.promotion_eligible ? 'ELIGIBLE' : 'BLOCKED'}</b>
          </div>
          <div className={`promotion-gate promotion-gate-${gateTone(profile?.admissible_evidence_ids.length >= policy.minimum_active_evidence_envelopes)}`}>
            <span>2</span><strong>Custody admission</strong><b>{profile?.admissible_evidence_ids.length ?? 0} ADMITTED</b>
          </div>
          <div className={`promotion-gate promotion-gate-${gateTone(profile?.status === 'ELIGIBLE_FOR_REVIEW')}`}>
            <span>3</span><strong>Governance review</strong><b>{profile?.status === 'ELIGIBLE_FOR_REVIEW' ? 'MAY ENTER' : 'MAY NOT ENTER'}</b>
          </div>
        </div>
        <dl className="kv" style={{ marginTop: 14 }}>
          <dt>suite locator</dt><dd>{profile?.suite_locator ?? '—'}</dd>
          <dt>suite digest</dt><dd className="promotion-break">{profile?.suite_digest ?? '—'}</dd>
          <dt>active admissible evidence</dt><dd>{profile?.admissible_evidence_ids.length ?? 0}</dd>
          <dt>distinct admitted signers</dt><dd>{profile?.distinct_admissible_signers.length ?? 0}</dd>
          <dt>package mutation</dt><dd>never automatic</dd>
        </dl>
      </section>

      <div className="promotion-grid">
        <section className="panel panel-formal">
          <h2>Policy</h2>
          <dl className="kv">
            <dt>policy</dt><dd>{policy.id}@{policy.version}</dd>
            <dt>minimum envelopes</dt><dd>{policy.minimum_active_evidence_envelopes}</dd>
            <dt>minimum signers</dt><dd>{policy.minimum_distinct_evidence_signers}</dd>
            <dt>required scope</dt><dd>{policy.required_signer_scopes.join(', ')}</dd>
            <dt>required subject</dt><dd>{policy.required_subject_kind}</dd>
            <dt>exact package metadata</dt><dd>{String(policy.require_exact_package_metadata)}</dd>
            <dt>authorized lifecycle</dt><dd>{String(policy.require_authorized_revocations && policy.require_lifecycle_consistency)}</dd>
          </dl>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={createDemonstrationCustody} disabled={busy}>Create local signed evidence</button>
            <button type="button" className="btn" onClick={exportBundle}>Export custody bundle</button>
            <button type="button" className="btn" onClick={exportAssessment} disabled={!assessment}>Export assessment</button>
          </div>
          {signer && <p className="panel-sub">Temporary signer: <code>{short(signer.identity.id)}</code>. Its private key remains in memory only.</p>}
          {message && <p className="panel-sub" role="status">{message}</p>}
        </section>

        <section className="panel panel-formal">
          <h2>Current blockers</h2>
          {profile?.blockers.length ? <ol className="promotion-blockers">{profile.blockers.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ol> : <div className="package-validation-pass">No policy blockers. The package may enter a separate governance review.</div>}
          {profile?.warnings.map((item, index) => <p className="warn-text" key={`${item}:${index}`}>⚠ {item}</p>)}
        </section>
      </div>

      <section className="panel panel-formal">
        <h2>Evidence admission ledger</h2>
        {profile?.admissible_evidence.length ? (
          <div className="promotion-table-wrap"><table className="promotion-table">
            <thead><tr><th>Evidence</th><th>Signer</th><th>Fingerprint</th><th>Scope</th><th>Binding</th><th>Lifecycle</th><th>Admitted</th></tr></thead>
            <tbody>{profile.admissible_evidence.map((item) => <tr key={item.evidence_id}>
              <td className="mono">{short(item.evidence_id)}</td><td className="mono">{short(item.signer_id)}</td>
              <td>{item.signer_fingerprint_valid ? 'valid' : 'invalid'}</td><td>{item.signer_scope_valid ? 'valid' : 'missing'}</td>
              <td>{item.package_binding_valid ? 'exact' : 'mismatch'}</td><td>{item.lifecycle_valid ? 'clean' : 'blocked'}</td>
              <td><Badge tone={item.admissible ? 'pass' : 'warn'}>{item.admissible ? 'YES' : 'NO'}</Badge></td>
            </tr>)}</tbody>
          </table></div>
        ) : <p className="dim-text">No active signed custody envelope has been admitted for the exact suite.</p>}
        {profile?.lifecycle_issues.length > 0 && <details><summary>{profile.lifecycle_issues.length} lifecycle or policy issue(s)</summary><ul>{profile.lifecycle_issues.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.code}</code> {item.message}</li>)}</ul></details>}
      </section>

      <div className="promotion-grid">
        <section className="panel panel-formal">
          <h2>Import public custody bundle</h2>
          <p className="panel-sub">The import is verified locally against the exact bundled suite. It contains public keys and signed records only.</p>
          <textarea className="code" rows={9} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"bundle_schema_version":"evidence-custody-bundle:v0.1", ...}' />
          <button type="button" className="btn btn-primary" onClick={importBundle} disabled={!importText.trim()}>Validate &amp; evaluate</button>
          {importIssues.length > 0 && <div className="error-box"><ul>{importIssues.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.path}</code> [{item.code}] {item.message}</li>)}</ul></div>}
        </section>

        <section className="panel panel-formal">
          <h2>Assessment receipt</h2>
          <p className="panel-sub">This append-only artifact records why review is allowed or blocked. It is not a promotion certificate.</p>
          {assessment && <pre className="json promotion-json">{JSON.stringify(assessment, null, 2)}</pre>}
        </section>
      </div>
    </div>
  )
}
