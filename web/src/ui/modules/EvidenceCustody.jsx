import { useEffect, useMemo, useState } from 'react'
import { suiteForPackage } from '../../theory/conformance.js'
import {
  CUSTODY_BUNDLE_SCHEMA_VERSION,
  custodyLocatorForSuite,
  emptyCustodyBundle,
  generateLocalSigner,
  parseCustodyBundleJson,
  revokeEvidence,
  sha256EvidenceDigest,
  signEvidenceSubject,
  verifyCustodyBundle,
} from '../../theory/custody.js'
import { BUNDLED_THEORY_PACKAGES } from '../../theory/packages.js'
import { downloadText } from '../util/format.js'
import { stripIngest } from '../util/sanitize.js'
import './EvidenceCustody.css'

function Badge({ children, tone = 'neutral' }) {
  return <span className={`package-badge package-badge-${tone}`}>{children}</span>
}

function short(value) {
  if (!value) return '—'
  return value.length > 30 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value
}

export default function EvidenceCustody() {
  const theoryPackage = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex') ?? BUNDLED_THEORY_PACKAGES[0]
  const suite = theoryPackage ? suiteForPackage(theoryPackage) : null
  const locator = suite ? custodyLocatorForSuite(suite) : ''
  const [bundle, setBundle] = useState(emptyCustodyBundle)
  const [signer, setSigner] = useState(null)
  const [subjectDigest, setSubjectDigest] = useState('calculating…')
  const [profile, setProfile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [importText, setImportText] = useState('')
  const [importIssues, setImportIssues] = useState([])

  const subjects = useMemo(() => suite ? { [locator]: suite } : {}, [locator, suite])

  useEffect(() => {
    let live = true
    if (!suite) return undefined
    sha256EvidenceDigest(suite).then((digest) => { if (live) setSubjectDigest(digest) })
    return () => { live = false }
  }, [suite])

  useEffect(() => {
    let live = true
    if (!suite) return undefined
    verifyCustodyBundle(bundle, subjects).then((next) => { if (live) setProfile(next) })
    return () => { live = false }
  }, [bundle, subjects, suite])

  if (!theoryPackage || !suite) {
    return <div className="notice">No bundled public conformance suite is available for evidence custody.</div>
  }

  const generateSigner = async () => {
    setBusy(true)
    try {
      const next = await generateLocalSigner('Local browser custodian')
      setSigner(next)
      setBundle((current) => ({
        ...current,
        signers: [...current.signers.filter((item) => item.id !== next.identity.id), next.identity],
        metadata: { ...current.metadata, local_signing_demonstrated: true },
      }))
      setMessage('Generated an in-memory Ed25519 signer. Its private key is not exported or persisted.')
    } catch (error) {
      setMessage(`Signer generation failed: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const signCurrentSuite = async (supersedes = []) => {
    if (!signer) {
      setMessage('Generate a local signer first.')
      return
    }
    setBusy(true)
    try {
      const envelope = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, signer, {
        supersedes,
        metadata: {
          package_id: suite.package.id,
          package_version: suite.package.version,
          custody_scope: 'public conformance suite digest and signature only',
        },
      })
      setBundle((current) => ({
        ...current,
        envelopes: [...current.envelopes, envelope],
        metadata: { ...current.metadata, last_signed_at_utc: envelope.signed_at_utc },
      }))
      setMessage(supersedes.length > 0 ? 'Created a signed superseding envelope.' : 'Signed the current public conformance suite.')
    } catch (error) {
      setMessage(`Signing failed: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const revokeLatest = async () => {
    if (!signer) {
      setMessage('The in-memory signer that issued the evidence is required to demonstrate revocation.')
      return
    }
    const target = [...bundle.envelopes].reverse().find((item) => item.signer_id === signer.identity.id)
    if (!target) {
      setMessage('No locally issued evidence envelope exists to revoke.')
      return
    }
    setBusy(true)
    try {
      const record = await revokeEvidence(target.evidence_id, signer, 'Demonstration revocation issued by the same local custodian.')
      setBundle((current) => ({ ...current, revocations: [...current.revocations, record] }))
      setMessage(`Revoked ${short(target.evidence_id)}.`)
    } catch (error) {
      setMessage(`Revocation failed: ${error.message ?? String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const supersedeLatest = () => {
    const prior = [...bundle.envelopes].reverse().find((item) => item.signer_id === signer?.identity.id)
    signCurrentSuite(prior ? [prior.evidence_id] : [])
  }

  const importBundle = () => {
    const parsed = parseCustodyBundleJson(stripIngest(importText))
    setImportIssues(parsed.issues)
    if (!parsed.bundle) return
    setBundle(parsed.bundle)
    setSigner(null)
    setMessage('Imported public identities, envelopes, and revocations. No private signing key was imported.')
  }

  const exportBundle = () => {
    downloadText('langarian-evidence-custody.json', `${JSON.stringify(bundle, null, 2)}\n`)
  }

  return (
    <div>
      <section className="custody-hero" aria-labelledby="custody-heading">
        <div>
          <Badge tone="pass">EVIDENCE CUSTODY v0.4</Badge>
          <h2 id="custody-heading">Hash it. Sign it. Preserve its lifecycle.</h2>
          <p>
            Custody binds conformance evidence to a canonical digest, a declared signer identity, a signature,
            and an auditable lifecycle. A valid signature proves key control over a specific artifact; it does not
            prove the mathematical or empirical truth of the artifact.
          </p>
        </div>
        <div className="hero-answer">
          <strong>Two distinct trust lanes</strong>
          <p><b>Local Ed25519:</b> demonstrates portable signing, verification, supersession, and revocation without uploading a private key.</p>
          <p><b>GitHub Sigstore:</b> CI attests the released evidence bundle using GitHub Actions OIDC and repository workflow identity.</p>
        </div>
      </section>

      <div className="custody-grid">
        <section className="panel panel-formal">
          <div className="package-title-row">
            <h2>Custody subject</h2>
            <Badge>{suite.suite_schema_version}</Badge>
          </div>
          <dl className="kv">
            <dt>package</dt><dd>{suite.package.id}@{suite.package.version}</dd>
            <dt>locator</dt><dd>{locator}</dd>
            <dt>canonical digest</dt><dd className="custody-break">{subjectDigest}</dd>
            <dt>observations</dt><dd>{suite.observations.length}</dd>
            <dt>evidence scope</dt><dd>{String(suite.metadata.evidence_scope ?? 'not declared')}</dd>
          </dl>
          <div className="notice package-inline-notice">
            The bundled suite remains partial evidence. Signing it preserves identity and integrity; it does not fill missing adversarial, failure, or first-falsifier cases.
          </div>
        </section>

        <section className="panel panel-formal">
          <div className="package-title-row">
            <h2>Local signer session</h2>
            <Badge tone={signer ? 'pass' : 'warn'}>{signer ? 'KEY IN MEMORY' : 'NO KEY'}</Badge>
          </div>
          {signer ? (
            <dl className="kv">
              <dt>signer</dt><dd className="custody-break">{signer.identity.id}</dd>
              <dt>algorithm</dt><dd>{signer.identity.algorithm}</dd>
              <dt>custody class</dt><dd>{String(signer.identity.metadata.custody_class)}</dd>
              <dt>private key</dt><dd>in memory only; never included in exports</dd>
            </dl>
          ) : <p className="dim-text">Generate a temporary local identity to exercise the custody protocol.</p>}
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={generateSigner} disabled={busy}>Generate signer</button>
            <button type="button" className="btn" onClick={() => signCurrentSuite()} disabled={busy || !signer}>Sign suite</button>
            <button type="button" className="btn" onClick={supersedeLatest} disabled={busy || !signer}>Supersede latest</button>
            <button type="button" className="btn btn-ghost" onClick={revokeLatest} disabled={busy || !signer}>Revoke latest</button>
          </div>
          {message && <p className="panel-sub" role="status">{message}</p>}
        </section>
      </div>

      <section className="panel panel-formal" aria-labelledby="custody-status-heading">
        <div className="package-title-row">
          <div>
            <h2 id="custody-status-heading">Verification and lifecycle</h2>
            <p className="panel-sub">Verification recomputes the subject digest, signed body, evidence id, signer key, revocation signatures, and supersession graph.</p>
          </div>
          <Badge tone={profile?.custody_ready ? 'pass' : 'warn'}>{profile?.custody_ready ? 'ACTIVE SIGNED EVIDENCE' : 'CUSTODY OPEN'}</Badge>
        </div>
        <div className="custody-summary">
          <div><strong>{bundle.signers.length}</strong><span>public signer identities</span></div>
          <div><strong>{bundle.envelopes.length}</strong><span>signed envelopes</span></div>
          <div><strong>{bundle.revocations.length}</strong><span>revocations</span></div>
          <div><strong>{profile?.active_envelopes.length ?? 0}</strong><span>active accepted envelopes</span></div>
        </div>
        {bundle.envelopes.length === 0 ? <p className="dim-text">No custody envelopes have been signed or imported.</p> : (
          <div className="custody-table-wrap">
            <table className="custody-table">
              <thead><tr><th>Evidence</th><th>Signer</th><th>Digest</th><th>Signature</th><th>Lifecycle</th><th>Accepted</th></tr></thead>
              <tbody>{profile?.envelope_results.map((result) => (
                <tr key={result.evidence_id}>
                  <td className="mono">{short(result.evidence_id)}</td>
                  <td className="mono">{short(result.signer_id)}</td>
                  <td>{result.digest_valid ? 'match' : 'mismatch'}</td>
                  <td>{result.signature_valid ? 'valid' : 'invalid'}</td>
                  <td>{result.revoked ? 'revoked' : result.superseded ? 'superseded' : 'current'}</td>
                  <td><Badge tone={result.accepted ? 'pass' : 'warn'}>{result.accepted ? 'YES' : 'NO'}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {profile && profile.issues.length > 0 && (
          <details className="custody-issues"><summary>{profile.issues.length} verification notice(s)</summary><ul>{profile.issues.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.code}</code> {item.message}</li>)}</ul></details>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={exportBundle}>Export public custody bundle</button>
        </div>
      </section>

      <div className="custody-grid">
        <section className="panel panel-formal">
          <h2>Import custody bundle</h2>
          <p className="panel-sub">Imports contain public keys and signed records only. They never contain a private signing key or executable code.</p>
          <textarea className="code" rows={9} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={`{"bundle_schema_version":"${CUSTODY_BUNDLE_SCHEMA_VERSION}", ...}`} />
          <div className="btn-row" style={{ marginTop: 10 }}><button type="button" className="btn btn-primary" onClick={importBundle} disabled={!importText.trim()}>Validate &amp; import</button></div>
          {importIssues.length > 0 && <div className="error-box"><ul>{importIssues.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.path}</code> [{item.code}] {item.message}</li>)}</ul></div>}
        </section>

        <section className="panel panel-formal">
          <h2>CI-produced attestation</h2>
          <p>
            On pushes to <code>main</code>, GitHub Actions builds a public evidence-custody archive and submits a build-provenance attestation through GitHub’s Sigstore-backed attestation service.
          </p>
          <dl className="kv">
            <dt>identity source</dt><dd>GitHub Actions OIDC</dd>
            <dt>subject</dt><dd>versioned evidence-custody archive</dd>
            <dt>bound context</dt><dd>repository, commit, workflow, runner, artifact digest</dd>
            <dt>verification</dt><dd><code>gh attestation verify</code> against this repository owner</dd>
          </dl>
          <div className="notice package-inline-notice">
            CI provenance establishes where the artifact came from and whether its bytes changed. It does not certify that every evidence claim inside the archive is correct.
          </div>
        </section>
      </div>
    </div>
  )
}
