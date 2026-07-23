/**
 * Proof Gate: claim governance over ledger receipts.
 *
 * Claims are collected from every receipt in the session ledger and split
 * into two physical columns: proof-eligible vs quarantined. Rules mirror
 * SPEC §3.7:
 * - only FORMAL and COMPUTED claims are eligible;
 * - MODEL, INTERPRETIVE, METAPHOR, OBSERVED, FAILED claims are blocked;
 * - any claim with metadata.promoted_from === "MODEL" is rejected unless it
 *   carries a formal_derivation_id (promotion laundering guard);
 * - claims from quarantined ledger entries are blocked with that reason.
 * A gate pass is a TAG FILTER PASS — never mathematical verification.
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
    reasons.push(`tag ${item.tag} is not admissible in formal proof contexts`)
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

export default function ProofGate() {
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
      <section className="panel panel-formal" aria-labelledby="gate-result-heading">
        <h2 id="gate-result-heading">Gate evaluation</h2>
        {eligible.length + blocked.length === 0 ? (
          <p className="dim-text">
            No claims yet. Claims are collected from every receipt in the session ledger — run operators,
            programs, or examples first.
          </p>
        ) : (
          <div className={`gate-result ${gatePass ? 'gate-pass' : 'gate-blocked'}`} role="status">
            {gatePass ? (
              <p>
                <strong>Gate result: tag filter pass — not mathematical verification.</strong>{' '}
                {eligible.length} claim(s) carry admissible tags. This only means the epistemic labels permit
                formal-context use; it verifies nothing about the mathematics itself.
              </p>
            ) : (
              <p>
                <strong>Gate result: blocked.</strong> {blocked.length} of {eligible.length + blocked.length} claim(s)
                are inadmissible. Blocked reasons are listed per claim in the quarantined column.
              </p>
            )}
          </div>
        )}
        {plainLanguage && (
          <p className="panel-sub" style={{ marginTop: 8 }}>
            The Proof Gate is a bouncer checking ID tags, not a judge checking truth. Only claims labeled
            FORMAL or COMPUTED may pass, and even then the pass means “allowed by label”, not “proven”.
          </p>
        )}
      </section>

      <div className="two-col">
        <section className="panel panel-formal" aria-labelledby="eligible-heading">
          <h2 id="eligible-heading">Proof-eligible ({eligible.length})</h2>
          <p className="panel-sub">FORMAL and COMPUTED claims, admissible by tag.</p>
          {eligible.length === 0 && <p className="dim-text">No eligible claims.</p>}
          <ul className="claim-list" aria-label="proof-eligible claims">
            {eligible.map(({ item, verdict }, i) => <ClaimCard key={i} item={item} verdict={verdict} />)}
          </ul>
        </section>

        <section className="panel panel-quarantined" aria-labelledby="quarantined-heading">
          <h2 id="quarantined-heading">Quarantined ({blocked.length})</h2>
          <p className="panel-sub">
            MODEL, INTERPRETIVE, METAPHOR, OBSERVED, and FAILED claims — plus any claim promoted from MODEL
            without a formal derivation id, and claims on quarantined receipts. These have no path into
            formal proof contexts.
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
