import { useState } from 'react'
import { BUNDLED_THEORY_PACKAGES, packageLevelName } from '../../theory/packages.js'
import TheoryAuditPanel from './TheoryAuditPanel.jsx'

export default function TheoryAudit() {
  const [activeId, setActiveId] = useState(BUNDLED_THEORY_PACKAGES[0]?.theory.id ?? '')
  const active = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === activeId) ?? BUNDLED_THEORY_PACKAGES[0]

  if (!active) {
    return <div className="notice">No bundled theory packages are available for audit.</div>
  }

  return (
    <div>
      <section className="panel panel-formal" aria-labelledby="audit-package-selection-heading">
        <div className="package-title-row">
          <div>
            <h2 id="audit-package-selection-heading">Select the organism to attack</h2>
            <p className="panel-sub">
              Audit reads only what the selected manifest declares. It does not fill missing links with intuition or execute documentary packages.
            </p>
          </div>
          <span className="package-badge">{BUNDLED_THEORY_PACKAGES.length} bundled package(s)</span>
        </div>
        <label className="field" style={{ maxWidth: 620 }}>
          <span>theory package</span>
          <select value={active.theory.id} onChange={(event) => setActiveId(event.target.value)}>
            {BUNDLED_THEORY_PACKAGES.map((item) => (
              <option key={item.theory.id} value={item.theory.id}>
                {item.theory.name} — L{item.maturity_level} {packageLevelName(item.maturity_level)}
              </option>
            ))}
          </select>
        </label>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>package</dt><dd>{active.theory.id}@{active.theory.version}</dd>
          <dt>motivation</dt><dd>{active.theory.motivation}</dd>
          <dt>declared maturity</dt><dd>Level {active.maturity_level} — {packageLevelName(active.maturity_level)}</dd>
          <dt>Reality Gate</dt><dd>{active.evidence.reality_gate}</dd>
        </dl>
      </section>

      <TheoryAuditPanel key={`${active.theory.id}:${active.theory.version}`} theoryPackage={active} />
    </div>
  )
}
