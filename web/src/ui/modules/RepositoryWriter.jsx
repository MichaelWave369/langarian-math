import { useMemo, useState } from 'react'
import { BUNDLED_THEORY_PACKAGES } from '../../theory/packages.js'
import {
  buildRepositoryWriterPreflight,
  PUBLIC_REPOSITORY_WRITER_POLICY,
} from '../../theory/repositoryWriter.js'
import { parsePackageReleaseArchiveJson } from '../../theory/releaseArchive.js'
import { downloadText } from '../util/format.js'
import { stripIngest } from '../util/sanitize.js'
import './RepositoryWriter.css'

function Badge({ children, tone = 'neutral' }) {
  return <span className={`package-badge package-badge-${tone}`}>{children}</span>
}

function short(value) {
  if (!value) return '—'
  return value.length > 44 ? `${value.slice(0, 27)}…${value.slice(-10)}` : value
}

export default function RepositoryWriter() {
  const publicPackages = useMemo(() => BUNDLED_THEORY_PACKAGES.filter((item) => PUBLIC_REPOSITORY_WRITER_POLICY.allowed_targets.some((target) => target.package_id === item.theory.id)), [])
  const [packageId, setPackageId] = useState(publicPackages[0]?.theory.id ?? '')
  const [archiveText, setArchiveText] = useState('')
  const [preflight, setPreflight] = useState(null)
  const [issues, setIssues] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const theoryPackage = publicPackages.find((item) => item.theory.id === packageId) ?? publicPackages[0]
  const target = PUBLIC_REPOSITORY_WRITER_POLICY.allowed_targets.find((item) => item.package_id === theoryPackage?.theory.id)

  if (!theoryPackage) return <div className="notice">No public repository-writer target is registered.</div>

  const evaluateArchive = async () => {
    setBusy(true)
    try {
      const parsed = parsePackageReleaseArchiveJson(stripIngest(archiveText))
      setIssues(parsed.issues)
      if (!parsed.archive) {
        setPreflight(null)
        return
      }
      const next = await buildRepositoryWriterPreflight(theoryPackage, parsed.archive)
      setPreflight(next)
      setMessage(next.status === 'READY_FOR_CONTROLLED_WORKFLOW'
        ? 'Archive passed browser preflight. GitHub Actions must still verify the live repository state and create the review branch.'
        : 'Archive remains blocked. No repository workflow request should be applied.')
    } finally {
      setBusy(false)
    }
  }

  const exportRequest = () => {
    if (!preflight || preflight.status !== 'READY_FOR_CONTROLLED_WORKFLOW') return
    const request = {
      schema_version: 'repository-writer-request:v0.1',
      workflow: 'controlled-release-writer',
      inputs: {
        request_ref: '<branch-tag-or-commit-containing-archive>',
        archive_path: '<path-to-package-release-archive.json>',
        target_manifest_path: preflight.target_path,
        base_ref: 'main',
        mode: 'apply',
        expected_release_receipt_id: preflight.release_receipt_id,
      },
      expected_live_manifest_hash: preflight.live_manifest_hash,
      replay_key: preflight.replay_key,
      boundary: 'The workflow creates a controlled review branch and pull request. It does not push directly to main.',
    }
    downloadText('controlled-repository-writer-request.json', `${JSON.stringify(request, null, 2)}\n`)
  }

  const statusTone = preflight?.status === 'READY_FOR_CONTROLLED_WORKFLOW' ? 'pass' : preflight ? 'warn' : 'neutral'

  return (
    <div>
      <section className="writer-hero" aria-labelledby="writer-heading">
        <div>
          <Badge tone="pass">REPOSITORY WRITER v0.8</Badge>
          <h2 id="writer-heading">Commit the exact artifact—never an interpretation of it.</h2>
          <p>
            Browser preflight checks a public release archive against the selected manifest. The trusted GitHub workflow
            repeats every check, consumes replay state, creates a review branch, and records commit provenance.
          </p>
        </div>
        <div className="hero-answer">
          <strong>Four separate states</strong>
          <p><b>Authorized:</b> the release archive earned a repository-write review.</p>
          <p><b>Applied:</b> the exact target exists on a named review branch.</p>
          <p><b>Attested:</b> GitHub binds the application bundle to its workflow identity.</p>
          <p><b>Merged:</b> remains a separate pull-request decision.</p>
        </div>
      </section>

      <section className="panel panel-formal">
        <div className="package-title-row">
          <div>
            <h2>Writer preflight</h2>
            <p className="mono dim-text">{theoryPackage.theory.id}@{theoryPackage.theory.version}</p>
          </div>
          <Badge tone={statusTone}>{preflight?.status ?? 'NOT EVALUATED'}</Badge>
        </div>
        <div className="writer-gates">
          <div><span>1</span><strong>Archive verification</strong><b>{preflight?.archive_verification?.accepted ? 'ACCEPTED' : 'OPEN'}</b></div>
          <div><span>2</span><strong>Live source hash</strong><b>{preflight?.archived_before_hash === preflight?.live_manifest_hash && preflight ? 'MATCH' : 'OPEN'}</b></div>
          <div><span>3</span><strong>Replay ledger</strong><b>{preflight?.status === 'READY_FOR_CONTROLLED_WORKFLOW' ? 'UNUSED' : 'OPEN'}</b></div>
          <div><span>4</span><strong>Main-branch write</strong><b>PROHIBITED</b></div>
        </div>
      </section>

      <div className="writer-grid">
        <section className="panel panel-formal">
          <h2>Registered target</h2>
          <label className="field-label" htmlFor="writer-package">Public package</label>
          <select id="writer-package" className="select" value={theoryPackage.theory.id} onChange={(event) => { setPackageId(event.target.value); setPreflight(null) }}>
            {publicPackages.map((item) => <option key={item.theory.id} value={item.theory.id}>{item.theory.name}</option>)}
          </select>
          <dl className="kv" style={{ marginTop: 14 }}>
            <dt>target path</dt><dd className="writer-break">{target?.path ?? 'unregistered'}</dd>
            <dt>actions</dt><dd>{target?.allowed_actions.join(', ') ?? '—'}</dd>
            <dt>replay ledger</dt><dd>{PUBLIC_REPOSITORY_WRITER_POLICY.replay_ledger_path}</dd>
            <dt>application receipts</dt><dd>{PUBLIC_REPOSITORY_WRITER_POLICY.application_receipt_directory}</dd>
            <dt>review branch prefix</dt><dd>{PUBLIC_REPOSITORY_WRITER_POLICY.release_branch_prefix}</dd>
          </dl>
        </section>

        <section className="panel panel-formal">
          <h2>Import public release archive</h2>
          <p className="panel-sub">Paste an exported `package-release-archive:v0.1`. Imported content remains data-only.</p>
          <textarea className="code" rows={10} value={archiveText} onChange={(event) => setArchiveText(event.target.value)} placeholder='{"archive_schema_version":"package-release-archive:v0.1", ...}' />
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={evaluateArchive} disabled={!archiveText.trim() || busy}>Run browser preflight</button>
            <button type="button" className="btn" onClick={exportRequest} disabled={preflight?.status !== 'READY_FOR_CONTROLLED_WORKFLOW'}>Export workflow request</button>
          </div>
          {issues.length > 0 && <div className="error-box"><ul>{issues.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.path}</code> [{item.code}] {item.message}</li>)}</ul></div>}
          {message && <p className="panel-sub" role="status">{message}</p>}
        </section>
      </div>

      <div className="writer-grid">
        <section className="panel panel-formal">
          <h2>Integrity record</h2>
          <dl className="kv">
            <dt>live manifest hash</dt><dd className="writer-break">{short(preflight?.live_manifest_hash)}</dd>
            <dt>archive before hash</dt><dd className="writer-break">{short(preflight?.archived_before_hash)}</dd>
            <dt>release receipt</dt><dd className="writer-break">{short(preflight?.release_receipt_id)}</dd>
            <dt>replay key</dt><dd className="writer-break">{short(preflight?.replay_key)}</dd>
            <dt>target</dt><dd className="writer-break">{preflight?.target_path ?? target?.path ?? '—'}</dd>
          </dl>
        </section>

        <section className="panel panel-formal">
          <h2>Current blockers</h2>
          {preflight?.blockers.length ? <ol className="writer-blockers">{preflight.blockers.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ol> : preflight?.status === 'READY_FOR_CONTROLLED_WORKFLOW' ? <div className="package-validation-pass">Browser preflight passed. The controlled workflow must still re-verify against an exact base commit.</div> : <p className="dim-text">No archive has been evaluated.</p>}
          {preflight?.warnings.map((item, index) => <p className="warn-text" key={`${item}:${index}`}>⚠ {item}</p>)}
        </section>
      </div>

      <section className="panel panel-formal">
        <h2>Controlled application sequence</h2>
        <ol className="writer-sequence">
          <li><b>Validate:</b> trusted base-branch code extracts the archive and exact live manifest from named Git refs.</li>
          <li><b>Authorize:</b> apply mode requires the exact release-receipt id and the `controlled-release` environment.</li>
          <li><b>Apply:</b> only the archived target manifest is committed on a dedicated review branch.</li>
          <li><b>Record:</b> a second commit appends the replay ledger and commit-bound application receipt.</li>
          <li><b>Attest:</b> GitHub Actions OIDC/Sigstore attests the application bundle.</li>
          <li><b>Review:</b> merging the generated pull request remains the atomic repository decision.</li>
        </ol>
      </section>
    </div>
  )
}
