import { useState } from 'react'
import {
  DEFAULT_PROMOTION_AUTHORITY_POLICY,
  emptyAuthorityBundle,
  generateLocalAuthority,
} from '../../theory/authority.js'
import { BUNDLED_THEORY_PACKAGES } from '../../theory/packages.js'
import { createSignedPromotionDecision } from '../../theory/signedDecision.js'
import {
  DEFAULT_PACKAGE_RELEASE_POLICY,
  buildControlledPackageReleaseProfile,
  createPackageReleaseProposal,
  createSignedPackageReleaseReceipt,
} from '../../theory/release.js'
import {
  createPackageReleaseArchive,
  parsePackageReleaseArchiveJson,
  verifyPackageReleaseArchive,
} from '../../theory/releaseArchive.js'
import { downloadText } from '../util/format.js'
import { stripIngest } from '../util/sanitize.js'
import './ReleaseGovernance.css'

function Badge({ children, tone = 'neutral' }) {
  return <span className={`package-badge package-badge-${tone}`}>{children}</span>
}

function short(value) {
  if (!value) return '—'
  return value.length > 42 ? `${value.slice(0, 25)}…${value.slice(-10)}` : value
}

function nextPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) return '0.1.0'
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

function blockedAuthorityProfile(theoryPackage) {
  return {
    policy: DEFAULT_PROMOTION_AUTHORITY_POLICY,
    assessment_id: 'assessment:current-langarian-strict-conformance-blocked',
    package_id: theoryPackage.theory.id,
    package_version: theoryPackage.theory.version,
    assessment_eligible: false,
    mandates: [],
    ballots: [],
    accepted_approvals: [],
    accepted_rejections: [],
    distinct_approval_authorities: [],
    distinct_independence_domains: [],
    covered_roles: [],
    quorum_satisfied: false,
    blockers: ['Current Langarian strict conformance evidence remains incomplete.'],
    warnings: ['No authority quorum may override a blocked prerequisite assessment.'],
    status: 'BLOCKED',
  }
}

export default function ReleaseGovernance() {
  const theoryPackage = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex') ?? BUNDLED_THEORY_PACKAGES[0]
  const [archive, setArchive] = useState(null)
  const [profile, setProfile] = useState(null)
  const [archiveVerification, setArchiveVerification] = useState(null)
  const [importText, setImportText] = useState('')
  const [importIssues, setImportIssues] = useState([])
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!theoryPackage) return <div className="notice">No public theory package is available.</div>

  const createBlockedDemonstration = async () => {
    setBusy(true)
    try {
      const issuedAt = new Date().toISOString()
      const recorder = await generateLocalAuthority(
        'Release-phase decision recorder',
        ['decision-recorder'],
        ['governance-records'],
        ['record:promotion-decision'],
        issuedAt,
      )
      const releaser = await generateLocalAuthority(
        'Independent package release custodian',
        ['release-custodian'],
        ['release-operations'],
        ['release:package-mutation', 'release:package-rollback'],
        issuedAt,
      )
      const decision = await createSignedPromotionDecision(
        blockedAuthorityProfile(theoryPackage),
        theoryPackage.maturity_level,
        recorder,
        issuedAt,
      )
      const authorityBundle = {
        ...emptyAuthorityBundle(),
        authorities: [recorder.identity, releaser.identity],
        metadata: { planning_artifact: false, generated_in: 'controlled-package-release:v0.7' },
      }
      const { proposal, after } = await createPackageReleaseProposal(
        theoryPackage,
        decision,
        'PROMOTION',
        nextPatchVersion(theoryPackage.theory.version),
        releaser,
        DEFAULT_PACKAGE_RELEASE_POLICY,
        issuedAt,
      )
      const releaseProfile = await buildControlledPackageReleaseProfile(
        theoryPackage,
        decision,
        authorityBundle,
        proposal,
        DEFAULT_PACKAGE_RELEASE_POLICY,
        issuedAt,
      )
      const receipt = await createSignedPackageReleaseReceipt(theoryPackage, releaseProfile, proposal, releaser, issuedAt)
      const nextArchive = createPackageReleaseArchive(theoryPackage, after, proposal, receipt, decision, authorityBundle)
      const verification = await verifyPackageReleaseArchive(nextArchive, DEFAULT_PACKAGE_RELEASE_POLICY, issuedAt)
      setArchive(nextArchive)
      setProfile(releaseProfile)
      setArchiveVerification(verification)
      setMessage('Created a valid signed release archive that remains BLOCKED because its prerequisite authority decision is blocked. No package source was changed.')
    } catch (error) {
      setMessage(`Could not create release demonstration: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const importArchive = async () => {
    const parsed = parsePackageReleaseArchiveJson(stripIngest(importText))
    setImportIssues(parsed.issues)
    if (!parsed.archive) return
    const verification = await verifyPackageReleaseArchive(parsed.archive)
    setArchive(parsed.archive)
    setArchiveVerification(verification)
    setProfile(null)
    setMessage('Imported a public release archive as data. No code, private key, or repository write capability was imported.')
  }

  const exportArchive = () => archive && downloadText('langarian-package-release-archive.json', `${JSON.stringify(archive, null, 2)}\n`)
  const exportAfterManifest = () => archive && downloadText(`langarian-package-${archive.release_bundle.after_manifest.theory.version}.json`, `${JSON.stringify(archive.release_bundle.after_manifest, null, 2)}\n`)
  const exportReceipt = () => archive && downloadText('langarian-package-release-receipt.json', `${JSON.stringify(archive.release_bundle.receipt, null, 2)}\n`)

  const receipt = archive?.release_bundle.receipt
  const proposal = archive?.release_bundle.proposal
  const after = archive?.release_bundle.after_manifest
  const tone = receipt?.status === 'AUTHORIZED_NOT_COMMITTED' ? 'pass' : 'warn'

  return (
    <div>
      <section className="release-hero" aria-labelledby="release-heading">
        <div>
          <Badge tone="pass">CONTROLLED RELEASE v0.7</Badge>
          <h2 id="release-heading">Bind the exact change before anyone writes it.</h2>
          <p>
            A release archive binds one signed authority decision to one source-manifest hash, one restricted patch,
            one target-manifest hash, and one independent release custodian. This browser materializes artifacts only.
          </p>
        </div>
        <div className="hero-answer">
          <strong>Atomic release boundary</strong>
          <p><b>Before:</b> the live writer must match the exact signed source hash.</p>
          <p><b>After:</b> only version, maturity, and release-governance metadata may change.</p>
          <p><b>Commit:</b> remains a separate controlled operation with replay protection.</p>
        </div>
      </section>

      <section className="panel panel-formal">
        <div className="package-title-row">
          <div>
            <h2>Release ruling</h2>
            <p className="mono dim-text">{theoryPackage.theory.id}@{theoryPackage.theory.version}</p>
          </div>
          <Badge tone={tone}>{receipt?.status ?? 'NOT EVALUATED'}</Badge>
        </div>
        <div className="release-gates">
          <div><span>1</span><strong>Signed authority decision</strong><b>{profile?.decision_gate_open ? 'OPERATIVE' : 'BLOCKED'}</b></div>
          <div><span>2</span><strong>Exact patch custody</strong><b>{profile?.proposal_verification.accepted ? 'VALID' : 'OPEN'}</b></div>
          <div><span>3</span><strong>Repository write</strong><b>NOT COMMITTED</b></div>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-primary" onClick={createBlockedDemonstration} disabled={busy}>Create honest blocked release</button>
          <button type="button" className="btn" onClick={exportArchive} disabled={!archive}>Export release archive</button>
          <button type="button" className="btn" onClick={exportAfterManifest} disabled={!after}>Export target manifest</button>
          <button type="button" className="btn" onClick={exportReceipt} disabled={!receipt}>Export receipt</button>
        </div>
        {message && <p className="panel-sub" role="status">{message}</p>}
      </section>

      <div className="release-grid">
        <section className="panel panel-formal">
          <h2>Integrity binding</h2>
          <dl className="kv">
            <dt>action</dt><dd>{proposal?.action ?? '—'}</dd>
            <dt>source version</dt><dd>{proposal?.before_version ?? theoryPackage.theory.version}</dd>
            <dt>target version</dt><dd>{proposal?.target_version ?? '—'}</dd>
            <dt>before hash</dt><dd className="release-break">{short(proposal?.before_manifest_hash)}</dd>
            <dt>patch digest</dt><dd className="release-break">{short(proposal?.patch_digest)}</dd>
            <dt>after hash</dt><dd className="release-break">{short(proposal?.after_manifest_hash)}</dd>
            <dt>release authority</dt><dd className="release-break">{short(proposal?.release_authority_id)}</dd>
            <dt>archive integrity</dt><dd>{archiveVerification?.accepted ? 'verified' : archive ? 'blocked or invalid' : '—'}</dd>
          </dl>
        </section>

        <section className="panel panel-formal">
          <h2>Current blockers</h2>
          {profile?.blockers.length ? (
            <ol className="release-blockers">{profile.blockers.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ol>
          ) : receipt?.status === 'AUTHORIZED_NOT_COMMITTED' ? (
            <div className="package-validation-pass">Artifact authorized. A separate writer must still verify the live before hash and unused replay key.</div>
          ) : <p className="dim-text">Create or import a release archive to evaluate it.</p>}
          {profile?.warnings.map((item, index) => <p className="warn-text" key={`${item}:${index}`}>⚠ {item}</p>)}
        </section>
      </div>

      <section className="panel panel-formal">
        <h2>Restricted manifest patch</h2>
        <p className="panel-sub">The v0.1 release policy permits exactly three paths and rejects every other package change.</p>
        {proposal ? <pre className="json release-json">{JSON.stringify(proposal.patch, null, 2)}</pre> : <p className="dim-text">No patch has been materialized.</p>}
      </section>

      <div className="release-grid">
        <section className="panel panel-formal">
          <h2>Import public release archive</h2>
          <p className="panel-sub">Imported records are locally re-hashed and re-evaluated. They never gain repository write access.</p>
          <textarea className="code" rows={10} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"archive_schema_version":"package-release-archive:v0.1", ...}' />
          <button type="button" className="btn btn-primary" onClick={importArchive} disabled={!importText.trim()}>Validate &amp; re-evaluate</button>
          {importIssues.length > 0 && <div className="error-box"><ul>{importIssues.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.path}</code> [{item.code}] {item.message}</li>)}</ul></div>}
        </section>

        <section className="panel panel-formal">
          <h2>Atomic release receipt</h2>
          <p className="panel-sub">The receipt says whether the exact artifact may enter a controlled write. It never claims the write already happened.</p>
          {receipt ? <pre className="json release-json">{JSON.stringify(receipt, null, 2)}</pre> : <p className="dim-text">No release receipt is available.</p>}
        </section>
      </div>
    </div>
  )
}
