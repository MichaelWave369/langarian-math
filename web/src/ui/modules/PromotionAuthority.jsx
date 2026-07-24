import { useEffect, useMemo, useState } from 'react'
import { suiteForPackage } from '../../theory/conformance.js'
import { emptyCustodyBundle, generateLocalSigner, signEvidenceSubject } from '../../theory/custody.js'
import { BUNDLED_THEORY_PACKAGES } from '../../theory/packages.js'
import { buildPromotionGovernanceProfile, createPromotionAssessmentReceipt } from '../../theory/promotion.js'
import {
  DEFAULT_PROMOTION_AUTHORITY_POLICY,
  buildPromotionAuthorityProfile,
  createPromotionAuthorityDecisionReceipt,
  emptyAuthorityBundle,
  evaluateAppeals,
  evaluateRollback,
  filePromotionAppeal,
  generateLocalAuthority,
  issuePromotionMandate,
  parseAuthorityBundleJson,
  signPromotionBallot,
} from '../../theory/authority.js'
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
  const [appealProfile, setAppealProfile] = useState(null)
  const [rollbackProfile, setRollbackProfile] = useState(null)
  const [importText, setImportText] = useState('')
  const [importIssues, setImportIssues] = useState([])
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const authorityPolicy = useMemo(() => DEFAULT_PROMOTION_AUTHORITY_POLICY, [])

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
    buildPromotionAuthorityProfile(assessment, authorityBundle, authorityPolicy).then(async (next) => {
      if (!live) return
      setProfile(next)
      const nextDecision = await createPromotionAuthorityDecisionReceipt(next, theoryPackage.maturity_level, '2026-07-24T00:05:00.000Z')
      setDecision(nextDecision)
      setAppealProfile(await evaluateAppeals(nextDecision, authorityBundle, authorityPolicy))
      setRollbackProfile(await evaluateRollback(nextDecision, authorityBundle, authorityPolicy))
    })
    return () => { live = false }
  }, [assessment, authorityBundle, authorityPolicy, theoryPackage])

  if (!theoryPackage || !suite) return <div className="notice">No public executable package and conformance suite are available.</div>

  const createSignedAssessmentInput = async () => {
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
          metadata: {
            package_id: suite.package.id,
            package_version: suite.package.version,
            purpose: 'promotion authority prerequisite demonstration',
          },
        },
      )
      setCustodyBundle({
        bundle_schema_version: 'evidence-custody-bundle:v0.1',
        signers: [signer.identity],
        envelopes: [envelope],
        revocations: [],
        metadata: { planning_artifact: false, generated_in: 'promotion-authority:v0.6' },
      })
      setMessage('Signed custody input created. The assessment remains independently controlled by conformance and may still be blocked.')
    } catch (error) {
      setMessage(`Could not create signed prerequisite: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const formCouncilAndVote = async () => {
    if (!assessment) return
    setBusy(true)
    try {
      const issuer = await generateLocalAuthority(
        'Mandate issuer',
        ['mandate-issuer'],
        ['governance-office'],
        ['issue:promotion-mandate', 'appeal:promotion-decision'],
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
      const common = {
        valid_from_utc: '2026-07-24T00:00:00.000Z',
        expires_at_utc: '2026-08-23T00:00:00.000Z',
        issued_at_utc: '2026-07-24T00:00:00.000Z',
        max_decisions: 1,
      }
      const mathMandate = await issuePromotionMandate(
        issuer,
        mathematical.identity.id,
        'mathematical-review',
        assessment,
        ['vote:promotion-level4', 'rollback:promotion-decision'],
        common,
      )
      const implementationMandate = await issuePromotionMandate(
        issuer,
        implementation.identity.id,
        'implementation-audit',
        assessment,
        ['vote:promotion-level4', 'rollback:promotion-decision'],
        common,
      )
      const mathBallot = await signPromotionBallot(
        mathematical,
        assessment,
        mathMandate,
        'APPROVE',
        'The authority role approves only if the prerequisite assessment is eligible.',
        { issued_at_utc: '2026-07-24T00:01:00.000Z' },
      )
      const implementationBallot = await signPromotionBallot(
        implementation,
        assessment,
        implementationMandate,
        'APPROVE',
        'The implementation role approves only the exact assessment and package binding.',
        { issued_at_utc: '2026-07-24T00:01:00.000Z' },
      )
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
      setMessage('Created a two-role, two-domain signed council. Quorum still cannot override a blocked prerequisite assessment.')
    } catch (error) {
      setMessage(`Could not form council: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const renewMandates = async () => {
    if (!assessment || !sessions || authorityBundle.mandates.length < 2) return
    setBusy(true)
    try {
      const oldMath = authorityBundle.mandates.find((item) => item.role === 'mathematical-review')
      const oldImplementation = authorityBundle.mandates.find((item) => item.role === 'implementation-audit')
      if (!oldMath || !oldImplementation) return
      const options = {
        valid_from_utc: '2026-08-23T00:00:00.000Z',
        expires_at_utc: '2026-09-22T00:00:00.000Z',
        issued_at_utc: '2026-08-22T00:00:00.000Z',
        max_decisions: 1,
      }
      const mathMandate = await issuePromotionMandate(
        sessions.issuer,
        sessions.mathematical.identity.id,
        'mathematical-review',
        assessment,
        ['vote:promotion-level4', 'rollback:promotion-decision'],
        { ...options, supersedes: [oldMath.mandate_id] },
      )
      const implementationMandate = await issuePromotionMandate(
        sessions.issuer,
        sessions.implementation.identity.id,
        'implementation-audit',
        assessment,
        ['vote:promotion-level4', 'rollback:promotion-decision'],
        { ...options, supersedes: [oldImplementation.mandate_id] },
      )
      const mathBallot = await signPromotionBallot(sessions.mathematical, assessment, mathMandate, 'APPROVE', 'Renewed mandate approval.', { issued_at_utc: '2026-08-23T00:01:00.000Z' })
      const implementationBallot = await signPromotionBallot(sessions.implementation, assessment, implementationMandate, 'APPROVE', 'Renewed mandate approval.', { issued_at_utc: '2026-08-23T00:01:00.000Z' })
      setAuthorityBundle((current) => ({
        ...current,
        mandates: [...current.mandates, mathMandate, implementationMandate],
        ballots: [mathBallot, implementationBallot],
        metadata: { ...current.metadata, renewed_at_utc: '2026-08-22T00:00:00.000Z' },
      }))
      setMessage('Issued append-only renewal mandates that supersede, but do not delete, the earlier mandates.')
    } catch (error) {
      setMessage(`Could not renew mandates: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const fileAppeal = async () => {
    if (!decision || !sessions) return
    const appeal = await filePromotionAppeal(
      sessions.mathematical,
      decision,
      'Request independent re-review of the recorded authority decision and its blockers.',
      { issued_at_utc: '2026-07-24T00:06:00.000Z' },
    )
    setAuthorityBundle((current) => ({ ...current, appeals: [...current.appeals, appeal] }))
    setMessage('Filed a signed appeal. An appeal opens review; it does not silently reverse the decision.')
  }

  const importBundle = () => {
    const parsed = parseAuthorityBundleJson(stripIngest(importText))
    setImportIssues(parsed.issues)
    if (!parsed.bundle) return
    setAuthorityBundle(parsed.bundle)
    setSessions(null)
    setMessage('Imported public authority identities and signed governance records. No private key was imported.')
  }

  const exportBundle = () => downloadText('langarian-promotion-authority-bundle.json', `${JSON.stringify(authorityBundle, null, 2)}\n`)
  const exportDecision = () => decision && downloadText('langarian-promotion-authority-decision.json', `${JSON.stringify(decision, null, 2)}\n`)

  return (
    <div>
      <section className="authority-hero" aria-labelledby="authority-heading">
        <div>
          <Badge tone="pass">PROMOTION AUTHORITY v0.6</Badge>
          <h2 id="authority-heading">No single reviewer may promote the package.</h2>
          <p>
            Signed mandates establish temporary authority. Independent roles cast signed ballots against one exact
            eligibility assessment. Quorum may authorize a later package update, but this room never performs that update.
          </p>
        </div>
        <div className="hero-answer">
          <strong>Authority is bounded</strong>
          <p><b>Mandate:</b> who may decide, for which package, role, scope, and time window?</p>
          <p><b>Quorum:</b> are enough distinct authorities, roles, and independence domains represented?</p>
          <p><b>Lifecycle:</b> is the decision unexpired, unappealed, and not rollback-authorized?</p>
        </div>
      </section>

      <section className="panel panel-formal">
        <div className="package-title-row">
          <div><h2>Authority decision</h2><p className="mono dim-text">{theoryPackage.theory.id}@{theoryPackage.theory.version} → Level 4</p></div>
          <Badge tone={decision?.status === 'APPROVED_PENDING_PACKAGE_UPDATE' ? 'pass' : 'warn'}>{decision?.status ?? 'EVALUATING'}</Badge>
        </div>
        <div className="authority-gates">
          <div><span>1</span><strong>Eligibility assessment</strong><b>{assessment?.status ?? 'OPEN'}</b></div>
          <div><span>2</span><strong>Mandate quorum</strong><b>{profile?.quorum_satisfied ? 'SATISFIED' : 'BLOCKED'}</b></div>
          <div><span>3</span><strong>Decision lifecycle</strong><b>{appealProfile?.appeal_open ? 'APPEAL OPEN' : rollbackProfile?.status ?? 'CURRENT'}</b></div>
        </div>
        <dl className="kv" style={{ marginTop: 14 }}>
          <dt>assessment</dt><dd className="authority-break">{assessment?.assessment_id ?? '—'}</dd>
          <dt>approvals</dt><dd>{profile?.accepted_approvals.length ?? 0} / {authorityPolicy.minimum_approvals}</dd>
          <dt>independence domains</dt><dd>{profile?.distinct_independence_domains.join(', ') || '—'}</dd>
          <dt>covered roles</dt><dd>{profile?.covered_roles.join(', ') || '—'}</dd>
          <dt>decision expiry</dt><dd>{decision?.expires_at_utc ?? '—'}</dd>
          <dt>package mutation</dt><dd>never automatic</dd>
        </dl>
      </section>

      <div className="authority-grid">
        <section className="panel panel-formal">
          <h2>Build the governed path</h2>
          <div className="btn-row">
            <button type="button" className="btn" onClick={createSignedAssessmentInput} disabled={busy}>1. Sign prerequisite evidence</button>
            <button type="button" className="btn btn-primary" onClick={formCouncilAndVote} disabled={busy || !assessment}>2. Form council &amp; vote</button>
            <button type="button" className="btn" onClick={renewMandates} disabled={busy || !sessions}>Renew mandates</button>
            <button type="button" className="btn btn-ghost" onClick={fileAppeal} disabled={busy || !sessions || !decision}>File appeal</button>
          </div>
          {message && <p className="panel-sub" role="status">{message}</p>}
          <div className="notice package-inline-notice">
            The current Langarian assessment remains blocked by incomplete conformance evidence. A unanimous council cannot vote missing tests into existence.
          </div>
        </section>

        <section className="panel panel-formal">
          <h2>Authority policy</h2>
          <dl className="kv">
            <dt>policy</dt><dd>{authorityPolicy.id}@{authorityPolicy.version}</dd>
            <dt>minimum approvals</dt><dd>{authorityPolicy.minimum_approvals}</dd>
            <dt>minimum domains</dt><dd>{authorityPolicy.minimum_distinct_independence_domains}</dd>
            <dt>required roles</dt><dd>{authorityPolicy.required_roles.join(', ')}</dd>
            <dt>reject blocks</dt><dd>{String(authorityPolicy.require_no_reject_ballots)}</dd>
            <dt>decision validity</dt><dd>{authorityPolicy.decision_validity_days} days</dd>
          </dl>
        </section>
      </div>

      <section className="panel panel-formal">
        <h2>Mandates and ballots</h2>
        <div className="authority-summary">
          <div><strong>{authorityBundle.authorities.length}</strong><span>public authorities</span></div>
          <div><strong>{authorityBundle.mandates.length}</strong><span>signed mandates</span></div>
          <div><strong>{authorityBundle.ballots.length}</strong><span>signed ballots</span></div>
          <div><strong>{authorityBundle.appeals.length}</strong><span>appeals</span></div>
        </div>
        {profile?.ballots.length ? <div className="authority-table-wrap"><table className="authority-table">
          <thead><tr><th>Ballot</th><th>Authority</th><th>Role</th><th>Disposition</th><th>Mandate</th><th>Accepted</th></tr></thead>
          <tbody>{profile.ballots.map((item) => <tr key={item.ballot_id}>
            <td className="mono">{short(item.ballot_id)}</td><td className="mono">{short(item.authority_id)}</td><td>{item.role ?? '—'}</td>
            <td>{item.disposition}</td><td>{item.mandate_valid ? 'valid' : 'invalid'}</td><td><Badge tone={item.accepted ? 'pass' : 'warn'}>{item.accepted ? 'YES' : 'NO'}</Badge></td>
          </tr>)}</tbody>
        </table></div> : <p className="dim-text">No authority ballots have been created or imported.</p>}
      </section>

      <div className="authority-grid">
        <section className="panel panel-formal">
          <h2>Current blockers</h2>
          {profile?.blockers.length ? <ol className="authority-blockers">{profile.blockers.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ol> : <div className="package-validation-pass">Quorum is satisfied for a later controlled package-update step.</div>}
          {profile?.warnings.map((item, index) => <p className="warn-text" key={`${item}:${index}`}>⚠ {item}</p>)}
        </section>
        <section className="panel panel-formal">
          <h2>Decision lifecycle</h2>
          <dl className="kv">
            <dt>appeal open</dt><dd>{String(appealProfile?.appeal_open ?? false)}</dd>
            <dt>valid appeals</dt><dd>{appealProfile?.valid_appeal_ids.length ?? 0}</dd>
            <dt>rollback status</dt><dd>{rollbackProfile?.status ?? '—'}</dd>
            <dt>rollback ballots</dt><dd>{rollbackProfile?.valid_ballot_ids.length ?? 0}</dd>
          </dl>
          <p className="panel-sub">Appeal and rollback records are append-only. Neither rewrites the original decision receipt.</p>
        </section>
      </div>

      <div className="authority-grid">
        <section className="panel panel-formal">
          <h2>Import authority bundle</h2>
          <p className="panel-sub">Imports contain public keys, mandates, ballots, appeals, and rollback records only. They cannot execute code or import a private key.</p>
          <textarea className="code" rows={9} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"bundle_schema_version":"promotion-authority-bundle:v0.1", ...}' />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary" onClick={importBundle} disabled={!importText.trim()}>Validate &amp; evaluate</button>
            <button type="button" className="btn" onClick={exportBundle}>Export bundle</button>
            <button type="button" className="btn" onClick={exportDecision} disabled={!decision}>Export decision</button>
          </div>
          {importIssues.length > 0 && <div className="error-box"><ul>{importIssues.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.path}</code> [{item.code}] {item.message}</li>)}</ul></div>}
        </section>
        <section className="panel panel-formal">
          <h2>Append-only decision receipt</h2>
          <p className="panel-sub">The receipt authorizes or blocks a later package-update step. It is not itself the package update.</p>
          {decision && <pre className="json authority-json">{JSON.stringify(decision, null, 2)}</pre>}
        </section>
      </div>
    </div>
  )
}
