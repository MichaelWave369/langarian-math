import { useMemo, useState } from 'react'
import {
  buildGovernedRollbackProfile,
  parseGovernedRollbackRequestJson,
} from '../../theory/incidentRollback.js'
import './IncidentRollback.css'

function Status({ ok, children }) {
  return <span className={`incident-status ${ok ? 'incident-status-ok' : 'incident-status-blocked'}`}>{children}</span>
}

function downloadJson(name, value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function IncidentRollback() {
  const [source, setSource] = useState('')
  const [request, setRequest] = useState(null)
  const [profile, setProfile] = useState(null)
  const [issues, setIssues] = useState([])
  const [busy, setBusy] = useState(false)

  const chain = useMemo(() => request ? [
    ['Incident', request.incident.incident_id],
    ['Containment', request.containment_plan.containment_plan_id],
    ['Rollback anchor', request.rollback_anchor.rollback_anchor_id],
    ['Release receipt', request.release_archive.release_bundle.receipt.receipt_id],
    ['Next gate', 'controlled-release-writer'],
  ] : [], [request])

  async function evaluate() {
    setBusy(true)
    try {
      const parsed = parseGovernedRollbackRequestJson(source)
      setIssues(parsed.issues)
      setRequest(parsed.request)
      if (!parsed.request) {
        setProfile(null)
        return
      }
      setProfile(await buildGovernedRollbackProfile(parsed.request))
    } finally {
      setBusy(false)
    }
  }

  function loadFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setSource(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const template = {
    request_schema_version: 'governed-rollback-request:v0.1',
    incident: { schema_version: 'incident-response-record:v0.1' },
    containment_plan: { schema_version: 'rollback-containment-plan:v0.1' },
    merge_observation: { schema_version: 'repository-merge-observation:v0.1' },
    rollback_anchor: { schema_version: 'repository-rollback-anchor:v0.1' },
    current_manifest: { schema_version: 'theory-package:v0.2' },
    restore_manifest: { schema_version: 'theory-package:v0.2' },
    release_archive: { archive_schema_version: 'package-release-archive:v0.1' },
    metadata: { template_only: true },
  }

  return (
    <section className="incident-rollback">
      <div className="incident-callout">
        <strong>Rollback is a new governed release, not history deletion.</strong>
        <p>This room evaluates imported public records only. It cannot sign an incident, dispatch GitHub Actions, apply a manifest, or authorize rollback.</p>
      </div>

      <div className="incident-grid">
        <div className="incident-panel">
          <h2>Import governed rollback request</h2>
          <input type="file" accept="application/json,.json" onChange={loadFile} />
          <textarea
            aria-label="Governed rollback request JSON"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Paste governed-rollback-request:v0.1 JSON"
            rows={16}
          />
          <div className="incident-actions">
            <button type="button" className="btn btn-primary" onClick={evaluate} disabled={busy || source.trim().length === 0}>
              {busy ? 'Evaluating…' : 'Evaluate request'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => downloadJson('governed-rollback-request-template.json', template)}>Export template</button>
          </div>
          {issues.length > 0 && (
            <div className="incident-blockers">
              <h3>Structural blockers</h3>
              <ul>{issues.map((item, index) => <li key={`${item.code}-${index}`}><code>{item.code}</code> {item.message}</li>)}</ul>
            </div>
          )}
        </div>

        <div className="incident-panel">
          <h2>Governed response status</h2>
          {!profile && <p className="muted">Import a complete request to evaluate incident custody, containment, rollback quorum, anchor binding, restore integrity, and release readiness.</p>}
          {profile && (
            <>
              <div className="incident-summary">
                <Status ok={profile.incident_valid}>Incident {profile.incident_valid ? 'verified' : 'blocked'}</Status>
                <Status ok={profile.containment_valid}>Containment {profile.containment_valid ? 'verified' : 'blocked'}</Status>
                <Status ok={profile.anchor_valid}>Anchor {profile.anchor_valid ? 'verified' : 'blocked'}</Status>
                <Status ok={profile.rollback_quorum_valid}>Quorum {profile.rollback_quorum_valid ? 'verified' : 'blocked'}</Status>
                <Status ok={profile.release_archive_valid}>Release {profile.release_archive_valid ? 'verified' : 'blocked'}</Status>
                <Status ok={profile.status === 'READY_FOR_CONTROLLED_WRITER'}>{profile.status}</Status>
              </div>
              {profile.blockers.length > 0 && (
                <div className="incident-blockers">
                  <h3>Blocking findings</h3>
                  <ul>{profile.blockers.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                </div>
              )}
              <div className="incident-warnings">
                <h3>Claim boundary</h3>
                <ul>{profile.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </>
          )}
        </div>
      </div>

      {request && (
        <div className="incident-panel incident-chain">
          <h2>Append-only rollback chain</h2>
          {chain.map(([label, value], index) => (
            <div className="incident-chain-row" key={label}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
              <code>{value}</code>
            </div>
          ))}
          <p>The materialization workflow records the incident and release archive in a separate PR. Only after that record is reviewed does the standard controlled writer create the rollback application PR; a subsequent merge produces a new reconciliation observation and a fresh rollback anchor.</p>
        </div>
      )}
    </section>
  )
}
