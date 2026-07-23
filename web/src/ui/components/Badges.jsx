/**
 * Fixed-chrome status and epistemic-tag badges (Lane H L-13).
 *
 * Badges are always icon + text at a fixed position, rendered from kernel
 * enums only — never from user-controlled strings — so hostile labels or
 * glyphs cannot spoof a PASS or FORMAL badge.
 */

const STATUS_ICON = { PASS: '\u2713', WARN: '\u26A0', FAIL: '\u2715' }

/** PASS/WARN/FAIL badge: icon + uppercase text + fixed styling, not color alone. */
export function StatusBadge({ status }) {
  const safe = Object.prototype.hasOwnProperty.call(STATUS_ICON, status) ? status : 'FAIL'
  return (
    <span className={`badge status status-${safe.toLowerCase()}`} role="status" aria-label={`status ${safe}`}>
      <span className="badge-icon" aria-hidden="true">{STATUS_ICON[safe]}</span>
      <span className="badge-text">{safe}</span>
    </span>
  )
}

const TAG_ICON = {
  FORMAL: '\u25C6',
  COMPUTED: '\u2211',
  MODEL: '\u25C7',
  INTERPRETIVE: '\u273B',
  METAPHOR: '\u2248',
  OBSERVED: '\u25C9',
  FAILED: '\u2715',
}

const TAG_DESCRIPTION = {
  FORMAL: 'formally derived claim',
  COMPUTED: 'finite computation under the v0.2 bounded model',
  MODEL: 'model-based claim, not formally derived',
  INTERPRETIVE: 'interpretive claim — quarantined from proof contexts',
  METAPHOR: 'metaphorical claim — quarantined from proof contexts',
  OBSERVED: 'empirical observation — quarantined from proof contexts',
  FAILED: 'failed check',
}

/** Epistemic tag badge: icon + tag text; solid for formal/computed, dashed for quarantined tags. */
export function TagBadge({ tag }) {
  const safe = Object.prototype.hasOwnProperty.call(TAG_ICON, tag) ? tag : 'FAILED'
  const quarantined = ['INTERPRETIVE', 'METAPHOR', 'OBSERVED'].includes(safe)
  return (
    <span
      className={`badge tag tag-${safe.toLowerCase()}${quarantined ? ' tag-quarantined' : ''}`}
      title={TAG_DESCRIPTION[safe]}
      aria-label={`epistemic tag ${safe}: ${TAG_DESCRIPTION[safe]}`}
    >
      <span className="badge-icon" aria-hidden="true">{TAG_ICON[safe]}</span>
      <span className="badge-text">{safe}</span>
    </span>
  )
}

/**
 * One of the four distinct receipt validation levels. Levels are always
 * shown separately — never collapsed into a single "verified" badge.
 */
export function LevelBadge({ label, ok, detail }) {
  return (
    <span
      className={`badge level ${ok ? 'level-pass' : 'level-fail'}`}
      title={detail || (ok ? `${label}: pass` : `${label}: FAIL`)}
      aria-label={`validation level ${label}: ${ok ? 'pass' : 'fail'}`}
    >
      <span className="badge-icon" aria-hidden="true">{ok ? '\u2713' : '\u2715'}</span>
      <span className="badge-text">{label}</span>
    </span>
  )
}

/** The four validation levels rendered distinctly, in canonical order. */
export function ValidationLevels({ summary }) {
  return (
    <span className="level-set" role="group" aria-label="four distinct receipt validation levels">
      <LevelBadge label="schema" ok={summary.schema_valid} detail="schema level: required fields and enums present (shape only — never verification by itself)" />
      <LevelBadge label="hash" ok={summary.hash_valid} detail="hash level: content_hash recomputed over the canonical body matches (body not tampered)" />
      <LevelBadge label="status" ok={summary.status_consistent} detail="status level: recorded status equals the collapse of the invariant results" />
      <LevelBadge label="version" ok={summary.version_allowed} detail="version level: kernel/metric/schema versions are on the allowlist" />
    </span>
  )
}
