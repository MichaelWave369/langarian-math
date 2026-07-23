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
const generic = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'generic-provenance-workflow')!

describe('readiness profile', () => {
  it('keeps operational contracts separate from unresolved interpretation semantics', () => {
    const profile = buildReadinessProfile(langarian)
    const execution = profile.axes.find((axis) => axis.id === 'execution')!
    const formalization = profile.axes.find((axis) => axis.id === 'formalization')!
    expect(execution.percent).toBe(100)
    expect(formalization.criteria.find((item) => item.id === 'contracts-resolved')?.passed).toBe(true)
    expect(formalization.criteria.find((item) => item.id === 'operators-resolved')?.passed).toBe(false)
    expect(profile.warnings.some((warning) => warning.includes('interpretation semantics'))).toBe(true)
  })

  it('shows why a formal package cannot execute yet even with complete contracts', () => {
    const profile = buildReadinessProfile(generic)
    const formalization = profile.axes.find((axis) => axis.id === 'formalization')!
    const execution = profile.axes.find((axis) => axis.id === 'execution')!
    expect(formalization.criteria.find((item) => item.id === 'contracts-resolved')?.passed).toBe(true)
    expect(execution.criteria.find((item) => item.id === 'package-executable')?.passed).toBe(false)
    expect(execution.criteria.find((item) => item.id === 'reference-present')?.passed).toBe(false)
  })
})

describe('dependency recovery', () => {
  it('builds assumption, invariant, predicate, and failure edges from contracts', () => {
    const graph = buildDependencyGraph(generic)
    expect(graph.edges).toContainEqual({ from: 'object:claim', to: 'operator:attach-source', relation: 'input-to' })
    expect(graph.edges).toContainEqual({ from: 'assumption:a1', to: 'operator:attach-source', relation: 'uses-assumption' })
    expect(graph.edges).toContainEqual({ from: 'operator:attach-source', to: 'invariant:i1', relation: 'checks-invariant' })
    expect(graph.edges).toContainEqual({ from: 'operator:attach-source', to: 'predicate:attach-source:ancestry-preserved', relation: 'checks-predicate' })
    expect(graph.edges).toContainEqual({ from: 'operator:attach-source', to: 'failure:attach-source:ancestry-loss', relation: 'fails-on' })
    expect(graph.open_linkages).toEqual([])
  })
})

describe('portable audit artifacts', () => {
  it('exports H0-H6 plus exact execution contracts and first falsifiers', () => {
    const packet = buildAuditPacketMarkdown(generic)
    for (const heading of ['H0 — Scope and Evidence Freeze', 'H1 — Observable Object Inventory', 'H2 — Operation Catalog', 'Per-operator execution contracts', 'H3 — Current Receipt Schema Specimen', 'H4 — Authority Map', 'H5 — Ambiguity Register', 'H6 — App-to-Concept Map']) {
      expect(packet).toContain(heading)
    }
    expect(packet).toContain('First Falsifiers')
    expect(packet).toContain('ancestry-preserved')
  })

  it('generates non-executing scaffolds carrying contract obligations', () => {
    const python = buildPythonScaffold(generic)
    const typescript = buildTypeScriptScaffold(generic)
    expect(python).toContain('raise NotImplementedError')
    expect(python).toContain('First falsifier')
    expect(python).toContain('operator-contract:v0.2')
    expect(typescript).toContain("throw new Error('THEORY_MAP_OPEN")
    expect(typescript).toContain('Predicates: ancestry-preserved')
  })
})

describe('planning receipts', () => {
  it('records intended work and every contract predicate as NOT_RUN', () => {
    const receipt = buildPlanningReceipt(generic, 'attach-source', '1970-01-01T00:00:00Z')
    expect(receipt.status).toBe('NOT_RUN')
    expect(receipt.outputs).toEqual([])
    expect(receipt.claims_supported).toEqual([])
    expect(receipt.operator_contract.assumption_ids).toEqual(['a1', 'a2'])
    expect(receipt.operator_contract.predicate_ids).toEqual(['ancestry-preserved', 'source-attached-once'])
    expect(receipt.checks.map((item) => item.predicate_id)).toEqual(['execution-not-performed', 'ancestry-preserved', 'source-attached-once'])
    expect(receipt.checks.every((item) => item.status === 'NOT_RUN')).toBe(true)
  })
})
