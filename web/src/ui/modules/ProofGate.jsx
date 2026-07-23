/**
 * Formal Eligibility Gate: claim governance over ledger receipts.
 *
 * The historical module/file name remains ProofGate for API compatibility,
 * but the public concept is narrower and more precise: this gate decides
 * whether a claim may enter formal mathematical review. It does not prove the
 * claim, and it says nothing about whether the formal system describes nature.
 *
 * Claims are collected from every receipt in the session ledger and split
 * into two physical columns: formally eligible vs quarantined. Rules mirror
 * SPEC §3.7:
 * - only FORMAL and COMPUTED claims are eligible;
 * - MODEL, INTERPRETIVE, METAPHOR, OBSERVED, FAILED claims are blocked;
 * - any claim with metadata.promoted_from === "MODEL" is rejected unless it
 *   carries a formal_derivation_id (promotion laundering guard);
 * - claims from quarantined ledger entries are blocked with that reason.
 * A gate pass is an ELIGIBILITY FILTER PASS — never proof or reality validation.
 */

import { useMemo } from 'react'
import { TagBadge } from '../components/Badges.jsx'
import { useWorkbench } from '../WorkbenchContext.jsx'

const BLOCKED_TAGS = new Set(['MODEL', 'INTERPRETIVE', 'METAPHOR', 'OBSERVED', 'FAILED'])

function claimVerdict(item) {
  const reasons = []
  if (item.entryQuarantined) {
    reasons.push('the receipt carrying this claim is quarantined in the ledger')
  }
  if (BLOCKED_TAGS.has(item.tag)) {
    reasons.push(`tag ${item.tag} is not admissible in formal mathematical review`)
  }
  const promotedFrom = item.metadata?.promoted_from
  const hasDerivation = typeof item.metadata?.formal_derivation_id === 'string'
  if (promotedFrom === 'MODEL' && !hasDerivation) {
    reasons.push('promoted from MODEL without a formal_derivation_id (promotion laundering guard)')
  }
  return { eligible: reasons.length === 0, reasons, promoted: typeof promotedFrom === 'string' }
}

function ClaimCard({ item, verdict }) {
  return (
    <li className={`claim-card ${verdict.eligible ? 'claim-eligible' : 'claim-blocked'}`}>
      <div className="btn-row">
        <TagBadge tag={item.tag} />
        <span className="mono dim-text" style={{ fontSize: 12 }}>receipt #{item.seq}</span>
        {verdict.promoted && (
          <span className="badge tag-model" title={`metadata.promoted_from = ${String(item.metadata.promoted_from)}`}>
            <span className="badge-icon" aria-hidden="true">⇧</span>
            <span className="badge-text">promoted from {String(item.metadata.promoted_from)}</span>
          </span>
        )}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13.5 }}>{item.text}</p>
      {!verdict.eligible && (
        <ul className="fail-text" style={{ margin: '6px 0 0', fontSize: 12.5 }}>
          {verdict.reasons.map((reason, i) => <li key={i}>blocked: {reason}</li>)}
        </ul>
      )}
    </li>
  )
}

function ThreeGateArchitecture() {
  const cardStyle = { minWidth: 0 }
  return (
    <section className="panel" aria-labelledby="three-gate-heading">
      <h2 id="three-gate-heading">Three-gate research architecture</h2>
      <p className="panel-sub">
        Internal validity, formal eligibility, and contact with reality are separate questions. No gate may borrow authority from a later gate.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        <article className="panel panel-formal" style={cardStyle}>
          <h3>1. Syntax / Integrity Gate</h3>
          <p>
            Asks whether the artifact is well formed, finite, version-compatible, internally consistent, and untampered.
          </p>
          <p className="dim-text">
            Implemented through typed validation, canonical hashes, invariant status, receipt schema checks, and local recomputation.
          </p>
        </article>
        <article className="panel panel-formal" style={cardStyle}>
          <h3>2. Formal Eligibility Gate</h3>
          <p>
            Asks whether a claim is permitted to enter formal mathematical review under the declared model and epistemic rules.
          </p>
          <p className="dim-text">
            This module performs that filter. A pass means eligible for review — not proved.
          </p>
        </article>
        <article className="panel panel-quarantined" style={cardStyle}>
          <h3>3. Reality Gate</h3>
          <p>
            Would ask whether a formally valid model is scientifically persuasive: literature comparison, empirical consistency, prediction, and independent replication.
          </p>
          <p className="dim-text">
            Future evidence framework only. The current workbench does not run or pass a Reality Gate and does not certify a physics claim.
          </p>
        </article>
      </div>
      <p style={{ marginTop: 12 }}><strong>The ledger serves reality, not the author.</strong></p>
    </section>
  )
}

export default function FormalEligibilityGate() {
  const { session, ledgerTick, plainLanguage } = useWorkbench()

  const { eligible, blocked } = useMemo(() => {
    void ledgerTick
    const all = []
    for (const entry of session.ledger.list()) {
      const claims = Array.isArray(entry.receipt.claims) ? entry.receipt.claims : []
      for (const raw of claims) {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue
        const record = raw
        const metadata =
          typeof record.metadata === 'object' && record.metadata !== null && !Array.isArray(record.metadata)
            ? record.metadata
            : {}
        all.push({
          seq: entry.seq,
          text: typeof record.text === 'string' ? record.text : '(claim without text)',
          tag: typeof record.tag === 'string' ? record.tag : 'FAILED',
          metadata,
          entryQuarantined: entry.quarantine.length > 0,
        })
      }
    }
    const eligibleList = []
    const blockedList = []
    for (const item of all) {
      const verdict = claimVerdict(item)
      ;(verdict.eligible ? eligibleList : blockedList).push({ item, verdict })
    }
    return { eligible: eligibleList, blocked: blockedList }
  }, [session, ledgerTick])

  const gatePass = blocked.length === 0 && eligible.length > 0

  return (
    <div>
      <ThreeGateArchitecture />

      <section className="panel panel-formal" aria-labelledby="gate-result-heading">
        <h2 id="gate-result-heading">Formal eligibility evaluation</h2>
        {eligible.length + blocked.length === 0 ? (
          <p className="dim-text">
            No claims yet. Claims are collected from every receipt in the session ledger — run operators,
            programs, or examples first.
          </p>
        ) : (
          <div className={`gate-result ${gatePass ? 'gate-pass' : 'gate-blocked'}`} role="status">
            {gatePass ? (
              <p>
                <strong>Formal eligibility result: tag-filter pass — not proof.</strong>{' '}
                {eligible.length} claim(s) carry admissible tags. This only means the epistemic labels permit
                entry into formal mathematical review. It verifies neither the mathematics nor the model's relationship to nature.
              </p>
            ) : (
              <p>
                <strong>Formal eligibility result: blocked.</strong> {blocked.length} of {eligible.length + blocked.length} claim(s)
                are inadmissible. Blocked reasons are listed per claim in the quarantined column.
              </p>
            )}
          </div>
        )}
        {plainLanguage && (
          <p className="panel-sub" style={{ marginTop: 8 }}>
            This gate is a bouncer checking whether a claim may enter formal review. It is not the mathematician proving the claim,
            and it is not nature deciding whether the model is real.
          </p>
        )}
      </section>

      <div className="two-col">
        <section className="panel panel-formal" aria-labelledby="eligible-heading">
          <h2 id="eligible-heading">Formal-review eligible ({eligible.length})</h2>
          <p className="panel-sub">FORMAL and COMPUTED claims, admissible by tag for review.</p>
          {eligible.length === 0 && <p className="dim-text">No eligible claims.</p>}
          <ul className="claim-list" aria-label="formal-review eligible claims">
            {eligible.map(({ item, verdict }, i) => <ClaimCard key={i} item={item} verdict={verdict} />)}
          </ul>
        </section>

        <section className="panel panel-quarantined" aria-labelledby="quarantined-heading">
          <h2 id="quarantined-heading">Quarantined ({blocked.length})</h2>
          <p className="panel-sub">
            MODEL, INTERPRETIVE, METAPHOR, OBSERVED, and FAILED claims — plus any claim promoted from MODEL
            without a formal derivation id, and claims on quarantined receipts. These have no path into
            formal mathematical review.
          </p>
          {blocked.length === 0 && <p className="dim-text">Nothing quarantined.</p>}
          <ul className="claim-list" aria-label="quarantined claims">
            {blocked.map(({ item, verdict }, i) => <ClaimCard key={i} item={item} verdict={verdict} />)}
          </ul>
        </section>
      </div>
    </div>
  )
}
