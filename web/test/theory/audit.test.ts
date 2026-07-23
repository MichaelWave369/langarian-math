import { describe, expect, it } from 'vitest'

import {
  buildAuditPacketMarkdown,
  buildDependencyGraph,
  buildPlanningReceipt,
  buildPythonScaffold,
  buildReadinessProfile,
  buildTypeScriptScaffold,
} from '../../src/theory/audit.js'
import { BUNDLED_THEORY_PACKAGES } from '../../src/theory/packages.js'

const langarian = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex')!
const saasy = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'saasy-reduced-hamiltonian')!

describe('readiness profile', () => {
  it('keeps maturity multidimensional instead of hiding semantic gaps behind executable code', () => {
    const profile = buildReadinessProfile(langarian)
    const execution = profile.axes.find((axis) => axis.id === 'execution')!
    const formalization = profile.axes.find((axis) => axis.id === 'formalization')!
    expect(execution.percent).toBeGreaterThan(0)
    expect(formalization.criteria.find((item) => item.id === 'operators-resolved')?.passed).toBe(false)
    expect(profile.warnings.some((warning) => warning.includes('Code exists'))).toBe(true)
  })

  it('shows why a formal documentary package cannot execute yet', () => {
    const profile = buildReadinessProfile(saasy)
    const execution = profile.axes.find((axis) => axis.id === 'execution')!
    expect(execution.criteria.find((item) => item.id === 'package-executable')?.passed).toBe(false)
    expect(execution.criteria.find((item) => item.id === 'reference-present')?.passed).toBe(false)
    expect(profile.blockers.length).toBeGreaterThan(0)
  })
})

describe('dependency recovery', () => {
  it('builds only manifest-supported object/operator edges and reports missing semantic links', () => {
    const graph = buildDependencyGraph(saasy)
    expect(graph.edges).toContainEqual({ from: 'object:parent-system', to: 'operator:reduce', relation: 'input-to' })
    expect(graph.edges).toContainEqual({ from: 'operator:reduce', to: 'object:reduced-system', relation: 'outputs' })
    expect(graph.open_linkages.some((item) => item.includes('assumption usage'))).toBe(true)
    expect(graph.open_linkages.some((item) => item.includes('invariant'))).toBe(true)
  })
})

describe('portable audit artifacts', () => {
  it('exports the complete H0-H6 packet without promoting candidates', () => {
    const packet = buildAuditPacketMarkdown(saasy)
    for (const heading of ['H0 — Scope and Evidence Freeze', 'H1 — Observable Object Inventory', 'H2 — Operation Catalog', 'H3 — Current Receipt Schema Specimen', 'H4 — Authority Map', 'H5 — Ambiguity Register', 'H6 — App-to-Concept Map']) {
      expect(packet).toContain(heading)
    }
    expect(packet).toContain('THEORY MAP OPEN')
    expect(packet).toContain('Generated from the package manifest')
  })

  it('generates non-executing Python and TypeScript scaffolds', () => {
    const python = buildPythonScaffold(saasy)
    const typescript = buildTypeScriptScaffold(saasy)
    expect(python).toContain('raise NotImplementedError')
    expect(python).toContain('must not emit PASS')
    expect(typescript).toContain("throw new Error('THEORY_MAP_OPEN")
    expect(typescript).toContain('Planning scaffold only')
  })
})

describe('planning receipts', () => {
  it('records intended work as NOT_RUN rather than simulated execution', () => {
    const receipt = buildPlanningReceipt(saasy, 'reduce', '1970-01-01T00:00:00Z')
    expect(receipt.status).toBe('NOT_RUN')
    expect(receipt.outputs).toEqual([])
    expect(receipt.claims_supported).toEqual([])
    expect(receipt.checks).toEqual([
      {
        predicate_id: 'execution-not-performed',
        status: 'NOT_RUN',
        expected: 'A package-specific implementation and reviewed execution contract.',
      },
    ])
  })
})
