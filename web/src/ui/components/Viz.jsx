/**
 * Shared visualization chrome. Every visualization in the workbench:
 * - states its definition and what it does/doesn't establish;
 * - states its scale and edge-case behavior;
 * - offers an exact numeric table alternative (accessibility);
 * - is static SVG/HTML: no animation that could imply physical dynamics.
 */

import { useState } from 'react'

export function VizFrame({ title, definition, scale, edgeCases, table, children, wide }) {
  const [view, setView] = useState('chart')
  return (
    <section className={`viz-frame${wide ? ' viz-wide' : ''}`} aria-label={title}>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div className="btn-row" role="tablist" aria-label={`${title} view`}>
          <button type="button" role="tab" aria-selected={view === 'chart'}
            className={`btn btn-small ${view === 'chart' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView('chart')}>chart</button>
          <button type="button" role="tab" aria-selected={view === 'table'}
            className={`btn btn-small ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView('table')}>exact table</button>
        </div>
      </div>
      {view === 'chart' ? children : table}
      <p className="viz-caption">
        <strong>Definition:</strong> {definition}{' '}
        <strong>Scale:</strong> {scale}{' '}
        <strong>Edge cases:</strong> {edgeCases}
      </p>
    </section>
  )
}

export function StateSelect({ states, value, onChange, label }) {
  return (
    <label className="field" style={{ minWidth: 240 }}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        <option value="">select a session state…</option>
        {states.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {(entry.state.label ?? entry.state.glyph ?? 'state') + ` · dim ${entry.state.dim} · ${entry.origin}`}
          </option>
        ))}
      </select>
    </label>
  )
}

export function findState(states, key) {
  return states.find((entry) => entry.key === key)?.state ?? null
}

export function EmptyViz({ children }) {
  return <p className="dim-text" role="status">{children}</p>
}
