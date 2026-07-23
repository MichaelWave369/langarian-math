/**
 * Persistent epistemic context strip (right rail): tag legend, version
 * manifest (read live from the generated kernel/version.ts), and the current
 * claim boundary. Collapsible on small screens; never shows user text.
 */

import { useState } from 'react'
import { VERSION_MANIFEST, PYTHON_KERNEL_VERSION_MIRRORED } from '../kernel/version.js'
import { TagBadge } from './components/Badges.jsx'
import { useWorkbench } from './WorkbenchContext.jsx'

const TAG_ORDER = ['FORMAL', 'COMPUTED', 'MODEL', 'INTERPRETIVE', 'METAPHOR', 'OBSERVED', 'FAILED']

const TAG_HELP = {
  FORMAL: 'Formally derived; proof-eligible.',
  COMPUTED: 'Finite computation under the bounded v0.2 model; proof-eligible as a computation, not a proof.',
  MODEL: 'Model-based; blocked at the Proof Gate without a formal derivation id.',
  INTERPRETIVE: 'Interpretation only; quarantined, never proof-eligible.',
  METAPHOR: 'Metaphor only; quarantined, never proof-eligible.',
  OBSERVED: 'Empirical observation; quarantined, never proof-eligible.',
  FAILED: 'A failed check; never proof-eligible.',
}

export default function EpistemicStrip() {
  const { plainLanguage, setPlainLanguage, resetSession } = useWorkbench()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <button
        type="button"
        className="strip-toggle"
        onClick={() => setCollapsed(false)}
        aria-expanded="false"
        aria-label="Expand epistemic context strip"
      >
        ⓘ
      </button>
    )
  }

  return (
    <aside className="epistemic-strip" aria-label="Epistemic context">
      <div className="strip-head">
        <h2 className="strip-title">Epistemic context</h2>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => setCollapsed(true)}
          aria-expanded="true"
          aria-label="Collapse epistemic context strip"
        >
          ▸
        </button>
      </div>

      <section className="strip-section" aria-labelledby="tag-legend-heading">
        <h3 id="tag-legend-heading">Tag legend</h3>
        <ul className="tag-legend">
          {TAG_ORDER.map((tag) => (
            <li key={tag}>
              <TagBadge tag={tag} />
              <span className="tag-help">{plainLanguage ? TAG_HELP[tag] : TAG_HELP[tag]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="strip-section" aria-labelledby="claim-boundary-heading">
        <h3 id="claim-boundary-heading">Claim boundary</h3>
        <p className="strip-note">
          Only FORMAL and COMPUTED claims may pass the Proof Gate tag filter. A gate pass is a
          tag filter pass — <strong>not mathematical verification</strong>. Interpretive, metaphorical,
          and observed content stays quarantined and has no path into the gate.
        </p>
      </section>

      <section className="strip-section" aria-labelledby="version-manifest-heading">
        <h3 id="version-manifest-heading">Version manifest</h3>
        <dl className="version-manifest">
          {Object.entries(VERSION_MANIFEST).map(([key, value]) => (
            <div key={key} className="version-row">
              <dt>{key}</dt>
              <dd><code>{value}</code></dd>
            </div>
          ))}
        </dl>
        <p className="strip-note">
          python kernel mirrored: <code>{PYTHON_KERNEL_VERSION_MIRRORED}</code>
        </p>
      </section>

      <section className="strip-section" aria-labelledby="display-heading">
        <h3 id="display-heading">Display</h3>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={plainLanguage}
            onChange={(event) => setPlainLanguage(event.target.checked)}
          />
          <span>Plain-language explanations</span>
        </label>
        <button type="button" className="btn btn-ghost btn-small" onClick={resetSession}>
          Reset session
        </button>
      </section>
    </aside>
  )
}
