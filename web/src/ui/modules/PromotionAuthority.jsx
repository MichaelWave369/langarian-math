import { useEffect, useMemo, useState } from 'react'
import { suiteForPackage } from '../../theory/conformance.js'
import { emptyCustodyBundle, generateLocalSigner, signEvidenceSubject } from '../../theory/custody.js'
import { BUNDLED_THEORY_PACKAGES } from '../../theory/packages.js'
import { buildPromotionGovernanceProfile, createPromotionAssessmentReceipt } from '../../theory/promotion.js'
import {
  DEFAULT_PROMOTION_AUTHORITY_POLICY,
  emptyAuthorityBundle,
  filePromotionAppeal,
  generateLocalAuthority,
  issuePromotionMandate,
  parseAuthorityBundleJson,
  signPromotionBallot,
} from '../../theory/authority.js'
import { buildRenewalAwarePromotionAuthorityProfile } from '../../theory/authorityGovernance.js'
import { createSignedPromotionDecision, evaluateSignedDecisionLifecycle } from '../../theory/signedDecision.js'
import { downloadText } from '../util/format.js'
import { stripIngest } from '../util/sanitize.js'
import './PromotionAuthority.css'

function Badge({ children, tone = 'neutral' }) {
  return <span className={`package-badge package-badge-${tone}`}>{children}</span>
}

function short(value) {
  if (!value) return '—'
  return value.length > 35 ? `${value.slice(0, 21)}…${value.slice(-9)}` : value
}

export default function PromotionAuthority() {
  const theoryPackage = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex') ?? BUNDLED_THEORY_PACKAGES[0]
  const suite = theoryPackage ? suiteForPackage(theoryPackage) : null
  const [custodyBundle, setCustodyBundle] = useState(emptyCustodyBundle)
  const [assessment, setAssessment] = useState(null)
  const [authorityBundle, setAuthorityBundle] = useState(emptyAuthorityBundle)
  const [sessions, setSessions] = useState(null)
  const [profile, setProfile] = useState(null)
  const [decision, setDecision] = useState(null)
  const [lifecycle, setLifecycle] = useState(null)
  const [evaluationTime, setEvaluationTime] = useState('2026-07-24T00:02:00.000Z')
  const [importText, setImportText] = useState('')
  const [importIssues, setImportIssues] = useState([])
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const policy = useMemo(() => DEFAULT_PROMOTION_AUTHORITY_POLICY, [])

  useEffect(() => {
    let live = true
    if (!theoryPackage || !suite) return undefined
    buildPromotionGovernanceProfile(theoryPackage, suite, custodyBundle).then(async (promotionProfile) => {
      if (!live) return
      setAssessment(await createPromotionAssessmentReceipt(promotionProfile, theoryPackage.maturity_level, '2026-07-24T00:00:00.000Z'))
    })
    return () => { live = false }
  }, [custodyBundle, suite, theoryPackage])

  useEffect(() => {
    let live = true
    if (!assessment || !theoryPackage) return undefined
    buildRenewalAwarePromotionAuthorityProfile(assessment, authorityBundle, policy, evaluationTime).then(async (next) => {
      if (!live) return
      setProfile(next)
      if (!sessions?.issuer) {
        setDecision(null)
        setLifecycle(null)
        return
      }
      const signed = await createSignedPromotionDecision(next, theoryPackage.maturity_level, sessions.issuer, evaluationTime)
      setDecision(signed)
      setLifecycle(await evaluateSignedDecisionLifecycle(signed, authorityBundle, policy, evaluationTime))
    })
    return () => { live = false }
  }, [assessment, authorityBundle, evaluationTime, policy, sessions, theoryPackage])

  if (!theoryPackage || !suite) return <div className="notice">No public executable package and conformance suite are available.</div>

  const createSignedPrerequisite = async () => {
    setBusy(true)
    try {
      const signer = await generateLocalSigner('Authority-phase evidence custodian')
      const envelope = await signEvidenceSubject(
        suite,
        'contract-conformance-suite',
        `conformance-suite:${suite.package.id}@${suite.package.version}`,
        signer,
        {
          signed_at_utc: '2026-07-24T00:00:00.000Z',
          metadata: { package_id: suite.package.id, package_version: suite.package.version, purpose: 'authority prerequisite demonstration' },
        },
      )
      setCustodyBundle({
        bundle_schema_version: 'evidence-custody-bundle:v0.1',
        signers: [signer.identity],
        envelopes: [envelope],
        revocations: [],
        metadata: { planning_artifact: false, generated_in: 'promotion-authority:v0.6' },
      })
      setMessage('Signed custody prerequisite created. It cannot repair missing conformance evidence.')
    } catch (error) {
      setMessage(`Could not create prerequisite: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const formCouncil = async () => {
    if (!assessment) return
    setBusy(true)
    try {
      const issuer = await generateLocalAuthority(
        'Mandate issuer and decision recorder',
        ['mandate-issuer', 'decision-recorder'],
        ['governance-office'],
        ['issue:promotion-mandate', 'record:promotion-decision', 'appeal:promotion-decision'],
        '2026-07-24T00:00:00.000Z',
      )
      const mathematical = await generateLocalAuthority(
        'Mathematical reviewer',
        ['mathematical-review'],
        ['mathematical-analysis'],
        ['vote:promotion-level4', 'appeal:promotion-decision', 'rollback:promotion-decision'],
        '2026-07-24T00:00:00.000Z',
      )
      const implementation = await generateLocalAuthority(
        'Implementation auditor',
        ['implementation-audit'],
        ['runtime-conformance'],
        ['vote:promotion-level4', 'appeal:promotion-decision', 'rollback:promotion-decision'],
        '2026-07-24T00:00:00.000Z',
      )
      const mandateOptions = {
        valid_from_utc: '2026-07-24T00:00:00.000Z',
        expires_at_utc: '2026-08-23T00:00:00.000Z',
        issued_at_utc: '2026-07-24T00:00:00.000Z',
        max_decisions: 1,
      }
      const mathMandate = await issuePromotionMandate(issuer, mathematical.identity.id, 'mathematical-review', assessment, ['vote:promotion-level4', 'rollback:promotion-decision'], mandateOptions)
      const implementationMandate = await issuePromotionMandate(issuer, implementation.identity.id, 'implementation-audit', assessment, ['vote:promotion-level4', 'rollback:promotion-decision'], mandateOptions)
      const mathBallot = await signPromotionBallot(mathematical, assessment, mathMandate, 'APPROVE', 'Approve only when the prerequisite is eligible.', { issued_at_utc: '2026-07-24T00:01:00.000Z' })
      const implementationBallot = await signPromotionBallot(implementation, assessment, implementationMandate, 'APPROVE', 'Approve only the exact package and assessment.', { issued_at_utc: '2026-07-24T00:01:00.000Z' })
      setEvaluationTime('2026-07-24T00:02:00.000Z')
      setSessions({ issuer, mathematical, implementation })
      setAuthorityBundle({
        bundle_schema_version: 'promotion-authority-bundle:v0.1',
        authorities: [issuer.identity, mathematical.identity, implementation.identity],
        mandates: [mathMandate, implementationMandate],
        ballots: [mathBallot, implementationBallot],
        appeals: [],
        rollback_ballots: [],
        metadata: { planning_artifact: false, generated_in: 'promotion-authority:v0.6' },
      })
      setMessage('Created two signed approvals across two roles and two declared independence domains. The recorder also signs the aggregate decision.')
    } catch (error) {
      setMessage(`Could not form council: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const renewMandates = async () => {
    if (!assessment || !sessions) return
    const oldMath = [...authorityBundle.mandates].reverse().find((item) => item.role === 'mathematical-review')
    const oldImplementation = [...authorityBundle.mandates].reverse().find((item) => item.role === 'implementation-audit')
    if (!oldMath || !oldImplementation) return
    setBusy(true)
    try {
      const common = {
        valid_from_utc: '2026-08-23T00:00:00.000Z',
        expires_at_utc: '2026-09-22T00:00:00.000Z',
        issued_at_utc: '2026-08-22T00:00:00.000Z',
        max_decisions: 1,
      }
      const mathMandate = await issuePromotionMandate(sessions.issuer, sessions.mathematical.identity.id, 'mathematical-review', assessment, ['vote:promotion-level4', 'rollback:promotion-decision'], { ...common, supersedes: [oldMath.mandate_id] })
      const implementationMandate = await issuePromotionMandate(sessions.issuer, sessions.implementation.identity.id, 'implementation-audit', assessment, ['vote:promotion-level4', 'rollback:promotion-decision'], { ...common, supersedes: [oldImplementation.mandate_id] })
      const mathBallot = await signPromotionBallot(sessions.mathematical, assessment, mathMandate, 'APPROVE', 'Renewed approval.', { issued_at_utc: '2026-08-23T00:01:00.000Z' })
      const implementationBallot = await signPromotionBallot(sessions.implementation, assessment, implementationMandate, 'APPROVE', 'Renewed approval.', { issued_at_utc: '2026-08-23T00:01:00.000Z' })
      setEvaluationTime('2026-08-23T00:02:00.000Z')
      setAuthorityBundle((current) => ({ ...current, mandates: [...current.mandates, mathMandate, implementationMandate], ballots: [mathBallot, implementationBallot] }))
      setMessage('Renewal appended new mandates and preserved the superseded records as non-operative history.')
    } catch (error) {
      setMessage(`Could not renew mandates: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const appeal = async () => {
    if (!decision || !sessions) return
    const record = await filePromotionAppeal(sessions.mathematical, decision, 'Request independent re-review of this signed decision.', { issued_at_utc: evaluationTime })
    setAuthorityBundle((current) => ({ ...current, appeals: [...current.appeals, record] }))
    setMessage('Signed appeal filed. The decision remains in the ledger but becomes non-operative pending re-review.')
  }

  const importBundle = () => {
    const parsed = parseAuthorityBundleJson(stripIngest(importText))
    setImportIssues(parsed.issues)
    if (!parsed.bundle) return
    setAuthorityBundle(parsed.bundle)
    setSessions(null)
    setDecision(null)
    setLifecycle(null)
    setMessage('Imported public authority records only. No private keys or decision-recorder session were imported.')
  }

  const exportBundle = () => downloadText('langarian-promotion-authority-bundle.json', `${JSON.stringify(authorityBundle, null, 2)}\n`)
  const exportDecision = () => decision && downloadText('langarian-signed-promotion-decision.json', `${JSON.stringify(decision, null, 2)}\n`)

  return (
    <div>
      <section className="authority-hero" aria-labelledby="authority-heading">
        <div>
          <Badge tone="pass">PROMOTION AUTHORITY v0.6</Badge>
          <h2 id="authority-heading">No single reviewer may promote the package.</h2>
          <p>Temporary signed mandates, plural roles, declared independence domains, quorum, a recorder signature, expiry, appeal, renewal, and rollback govern the decision lifecycle.</p>
        </div>
        <div className="hero-answer">
          <strong>Four boundaries</strong>
          <p><b>Eligibility</b> cannot be created by a vote.</p>
          <p><b>Mandates</b> are scoped and expire.</p>
          <p><b>Quorum</b> requires plural roles and domains.</p>
          <p><b>Decisions</b> are signed, appealable, reversible, and never self-executing.</p>
        </div>
      </section>

      <section className="panel panel-formal">
        <div className="package-title-row">
          <div><h2>Signed authority decision</h2><p className="mono dim-text">{theoryPackage.theory.id}@{theoryPackage.theory.version} → Level 4</p></div>
          <Badge tone={lifecycle?.operative ? 'pass' : 'warn'}>{decision?.status ?? 'NO SIGNED DECISION'}</Badge>
        </div>
        <div className="authority-gates">
          <div><span>1</span><strong>Eligibility</strong><b>{assessment?.status ?? 'OPEN'}</b></div>
          <div><span>2</span><strong>Authority quorum</strong><b>{profile?.quorum_satisfied ? 'SATISFIED' : 'BLOCKED'}</b></div>
          <div><span>3</span><strong>Recorder signature</strong><b>{lifecycle?.verification.accepted ? 'VALID' : 'OPEN'}</b></div>
        </div>
        <dl className="kv" style={{ marginTop: 14 }}>
          <dt>assessment</dt><dd className="authority-break">{assessment?.assessment_id ?? '—'}</dd>
          <dt>approvals</dt><dd>{profile?.accepted_approvals.length ?? 0} / {policy.minimum_approvals}</dd>
          <dt>domains</dt><dd>{profile?.distinct_independence_domains.join(', ') || '—'}</dd>
          <dt>roles</dt><dd>{profile?.covered_roles.join(', ') || '—'}</dd>
          <dt>recorded by</dt><dd className="authority-break">{decision?.recorded_by ?? '—'}</dd>
          <dt>expires</dt><dd>{decision?.expires_at_utc ?? '—'}</dd>
          <dt>operative</dt><dd>{String(lifecycle?.operative ?? false)}</dd>
        </dl>
      </section>

      <div className="authority-grid">
        <section className="panel panel-formal">
          <h2>Exercise the protocol</h2>
          <div className="btn-row">
            <button type="button" className="btn" onClick={createSignedPrerequisite} disabled={busy}>1. Sign prerequisite</button>
            <button type="button" className="btn btn-primary" onClick={formCouncil} disabled={busy || !assessment}>2. Form council</button>
            <button type="button" className="btn" onClick={renewMandates} disabled={busy || !sessions}>Renew mandates</button>
            <button type="button" className="btn btn-ghost" onClick={appeal} disabled={busy || !decision || !sessions}>File appeal</button>
          </div>
          {message && <p className="panel-sub" role="status">{message}</p>}
          <div className="notice package-inline-notice">The current Langarian assessment remains blocked by missing strict conformance evidence. A unanimous council cannot vote missing tests into existence.</div>
        </section>
        <section className="panel panel-formal">
          <h2>Policy</h2>
          <dl className="kv">
            <dt>minimum approvals</dt><dd>{policy.minimum_approvals}</dd>
            <dt>minimum domains</dt><dd>{policy.minimum_distinct_independence_domains}</dd>
            <dt>required roles</dt><dd>{policy.required_roles.join(', ')}</dd>
            <dt>valid rejection blocks</dt><dd>{String(policy.require_no_reject_ballots)}</dd>
            <dt>decision validity</dt><dd>{policy.decision_validity_days} days</dd>
            <dt>evaluation time</dt><dd>{evaluationTime}</dd>
          </dl>
        </section>
      </div>

      <section className="panel panel-formal">
        <h2>Mandates and ballots</h2>
        <div className="authority-summary">
          <div><strong>{authorityBundle.authorities.length}</strong><span>authorities</span></div>
          <div><strong>{authorityBundle.mandates.length}</strong><span>mandates</span></div>
          <div><strong>{authorityBundle.ballots.length}</strong><span>ballots</span></div>
          <div><strong>{authorityBundle.appeals.length}</strong><span>appeals</span></div>
        </div>
        {profile?.ballots.length ? <div className="authority-table-wrap"><table className="authority-table">
          <thead><tr><th>Ballot</th><th>Authority</th><th>Role</th><th>Vote</th><th>Mandate</th><th>Accepted</th></tr></thead>
          <tbody>{profile.ballots.map((item) => <tr key={item.ballot_id}>
            <td className="mono">{short(item.ballot_id)}</td><td className="mono">{short(item.authority_id)}</td><td>{item.role ?? '—'}</td><td>{item.disposition}</td><td>{item.mandate_valid ? 'valid' : 'invalid'}</td><td><Badge tone={item.accepted ? 'pass' : 'warn'}>{item.accepted ? 'YES' : 'NO'}</Badge></td>
          </tr>)}</tbody>
        </table></div> : <p className="dim-text">No ballots have been created or imported.</p>}
      </section>

      <div className="authority-grid">
        <section className="panel panel-formal">
          <h2>Blockers and lifecycle</h2>
          {profile?.blockers.length ? <ol className="authority-blockers">{profile.blockers.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ol> : <div className="package-validation-pass">Authority quorum is satisfied.</div>}
          <dl className="kv">
            <dt>signature accepted</dt><dd>{String(lifecycle?.verification.accepted ?? false)}</dd>
            <dt>expired</dt><dd>{String(lifecycle?.expired ?? false)}</dd>
            <dt>appeal open</dt><dd>{String(lifecycle?.appeal.appeal_open ?? false)}</dd>
            <dt>rollback</dt><dd>{lifecycle?.rollback.status ?? '—'}</dd>
          </dl>
          {lifecycle?.blockers.map((item, index) => <p className="warn-text" key={`${item}:${index}`}>⚠ {item}</p>)}
        </section>
        <section className="panel panel-formal">
          <h2>Import and export</h2>
          <textarea className="code" rows={8} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"bundle_schema_version":"promotion-authority-bundle:v0.1", ...}' />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary" onClick={importBundle} disabled={!importText.trim()}>Validate &amp; import</button>
            <button type="button" className="btn" onClick={exportBundle}>Export bundle</button>
            <button type="button" className="btn" onClick={exportDecision} disabled={!decision}>Export signed decision</button>
          </div>
          {importIssues.length > 0 && <div className="error-box"><ul>{importIssues.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.path}</code> [{item.code}] {item.message}</li>)}</ul></div>}
          <p className="panel-sub">Imports contain public keys and signed records only. No private key or executable package code is imported.</p>
        </section>
      </div>

      <section className="panel panel-formal">
        <h2>Append-only signed decision receipt</h2>
        {decision ? <pre className="json authority-json">{JSON.stringify(decision, null, 2)}</pre> : <p className="dim-text">Form a local council to create an in-memory recorder signature.</p>}
      </section>
    </div>
  )
}
