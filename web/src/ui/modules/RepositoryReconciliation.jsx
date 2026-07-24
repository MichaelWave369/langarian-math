import { useMemo, useState } from 'react'
import {
  parseMergeObservationJson,
  parseRollbackAnchorJson,
} from '../../theory/reconciliation.js'
import { stripIngest } from '../util/sanitize.js'
import './RepositoryReconciliation.css'

function Badge({ children, tone = 'neutral' }) {
  return <span className={`package-badge package-badge-${tone}`}>{children}</span>
}

function short(value) {
  if (!value) return '—'
  return value.length > 48 ? `${value.slice(0, 28)}…${value.slice(-12)}` : value
}

function IssueList({ issues }) {
  if (!issues.length) return null
  return (
    <div className="error-box">
      <ul>
        {issues.map((item, index) => (
          <li key={`${item.code}:${item.path}:${index}`}><code>{item.path}</code> [{item.code}] {item.message}</li>
        ))}
      </ul>
    </div>
  )
}

export default function RepositoryReconciliation() {
  const [observationText, setObservationText] = useState('')
  const [anchorText, setAnchorText] = useState('')
  const [observationResult, setObservationResult] = useState({ observation: null, issues: [] })
  const [anchorResult, setAnchorResult] = useState({ anchor: null, issues: [] })

  const observation = observationResult.observation
  const anchor = anchorResult.anchor
  const chainComplete = useMemo(() => Boolean(
    observation &&
    anchor &&
    observation.rollback_anchor_id === anchor.rollback_anchor_id &&
    observation.application.application_receipt_id === anchor.application_receipt_id &&
    observation.pull_request.merge_commit === anchor.merge_commit &&
    observation.integrity.merged_manifest_hash === anchor.merged_manifest_hash,
  ), [observation, anchor])

  const validateObservation = () => setObservationResult(parseMergeObservationJson(stripIngest(observationText)))
  const validateAnchor = () => setAnchorResult(parseRollbackAnchorJson(stripIngest(anchorText)))

  return (
    <div>
      <section className="reconcile-hero" aria-labelledby="reconciliation-heading">
        <div>
          <Badge tone="pass">MERGE RECONCILIATION v0.9</Badge>
          <h2 id="reconciliation-heading">Observe the merge without rewriting the past.</h2>
          <p>
            A controlled application receipt ends at <code>NOT_MERGED</code>. The reconciliation layer verifies the real pull-request merge,
            appends a separate <code>MERGED</code> observation, and freezes the exact rollback anchor.
          </p>
        </div>
        <div className="hero-answer">
          <strong>Three immutable records</strong>
          <p><b>Application receipt:</b> what reached the review branch.</p>
          <p><b>Merge observation:</b> what GitHub actually merged.</p>
          <p><b>Rollback anchor:</b> the exact before/after boundary—not rollback permission.</p>
        </div>
      </section>

      <section className="panel panel-formal">
        <div className="package-title-row">
          <div>
            <h2>Operational reconciliation gate</h2>
            <p className="panel-sub">The GitHub workflow performs this gate from trusted <code>main</code> code after a controlled application PR closes as merged.</p>
          </div>
          <Badge tone="warn">NO BROWSER WRITE ACCESS</Badge>
        </div>
        <div className="reconcile-gates">
          <div><span>1</span><strong>Attested application bundle</strong><b>VERIFY</b></div>
          <div><span>2</span><strong>Reviewed tree = merged tree</strong><b>VERIFY</b></div>
          <div><span>3</span><strong>Append observation PR</strong><b>REVIEW</b></div>
        </div>
        <p className="warn-text">⚠ The workflow opens a separate reconciliation pull request. It does not directly rewrite the package, application receipt, or merge history.</p>
      </section>

      <div className="reconcile-grid">
        <section className="panel panel-formal">
          <h2>Import merge observation</h2>
          <p className="panel-sub">Imported JSON is treated as data and validated locally. This does not query GitHub or verify Sigstore provenance.</p>
          <textarea
            className="code"
            rows={12}
            value={observationText}
            onChange={(event) => setObservationText(event.target.value)}
            placeholder='{"schema_version":"repository-merge-observation:v0.1", ...}'
          />
          <button type="button" className="btn btn-primary" onClick={validateObservation} disabled={!observationText.trim()}>Validate observation</button>
          <IssueList issues={observationResult.issues} />
        </section>

        <section className="panel panel-formal">
          <h2>Import rollback anchor</h2>
          <p className="panel-sub">The anchor identifies exact states and commits. It never authorizes a rollback by itself.</p>
          <textarea
            className="code"
            rows={12}
            value={anchorText}
            onChange={(event) => setAnchorText(event.target.value)}
            placeholder='{"schema_version":"repository-rollback-anchor:v0.1", ...}'
          />
          <button type="button" className="btn btn-primary" onClick={validateAnchor} disabled={!anchorText.trim()}>Validate anchor</button>
          <IssueList issues={anchorResult.issues} />
        </section>
      </div>

      <section className="panel panel-formal">
        <div className="package-title-row">
          <div>
            <h2>Reconciled chain</h2>
            <p className="panel-sub">Both records must bind the same application receipt, merge commit, manifest hash, and rollback anchor.</p>
          </div>
          <Badge tone={chainComplete ? 'pass' : 'neutral'}>{chainComplete ? 'CHAIN MATCHED' : 'IMPORT BOTH RECORDS'}</Badge>
        </div>
        <div className="reconcile-chain">
          <div>
            <span>APPLICATION</span>
            <strong>{short(observation?.application.application_receipt_id)}</strong>
            <small>Original receipt remains NOT_MERGED.</small>
          </div>
          <b>→</b>
          <div>
            <span>MERGE</span>
            <strong>{short(observation?.pull_request.merge_commit)}</strong>
            <small>{observation?.status ?? 'Awaiting observation'}</small>
          </div>
          <b>→</b>
          <div>
            <span>ROLLBACK ANCHOR</span>
            <strong>{short(anchor?.rollback_anchor_id)}</strong>
            <small>{anchor?.status ?? 'Awaiting anchor'}</small>
          </div>
        </div>
      </section>

      <div className="reconcile-grid">
        <section className="panel panel-formal">
          <h2>Merge facts</h2>
          <dl className="kv">
            <dt>application PR</dt><dd>{observation ? `#${observation.pull_request.number}` : '—'}</dd>
            <dt>merged by</dt><dd>{observation?.pull_request.merged_by ?? '—'}</dd>
            <dt>merge topology</dt><dd>{observation?.pull_request.merge_topology ?? '—'}</dd>
            <dt>merge commit</dt><dd className="reconcile-break">{short(observation?.pull_request.merge_commit)}</dd>
            <dt>target path</dt><dd className="reconcile-break">{observation?.application.target_path ?? '—'}</dd>
            <dt>tree equivalence</dt><dd>{observation?.integrity.reviewed_tree_matches_merge ? 'verified' : '—'}</dd>
            <dt>application attestation</dt><dd>{observation?.integrity.application_attestation_verified ? 'verified' : '—'}</dd>
            <dt>release chain replay</dt><dd>{observation?.integrity.release_chain_reverified ? 'verified' : '—'}</dd>
          </dl>
        </section>

        <section className="panel panel-formal">
          <h2>Rollback boundary</h2>
          <dl className="kv">
            <dt>merged state</dt><dd className="reconcile-break">{short(anchor?.merged_manifest_hash)}</dd>
            <dt>restore reference</dt><dd className="reconcile-break">{short(anchor?.restore_manifest_hash)}</dd>
            <dt>application base</dt><dd className="reconcile-break">{short(anchor?.application_base_commit)}</dd>
            <dt>mutation commit</dt><dd className="reconcile-break">{short(anchor?.mutation_commit)}</dd>
            <dt>merge commit</dt><dd className="reconcile-break">{short(anchor?.merge_commit)}</dd>
            <dt>rollback authority</dt><dd>still required</dd>
          </dl>
          <p className="warn-text">⚠ An anchor is a coordinate, not a command. Rollback still requires the independent mandate and quorum path.</p>
        </section>
      </div>

      {observation && (
        <section className="panel panel-formal">
          <h2>Append-only observation</h2>
          <pre className="json reconcile-json">{JSON.stringify(observation, null, 2)}</pre>
        </section>
      )}
    </div>
  )
}
