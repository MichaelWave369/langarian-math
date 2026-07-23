import {
  buildReceiptEnvelope,
  canExecutePackage,
  packageLevelName,
  validateTheoryPackage,
  type ReceiptEnvelope,
  type TheoryPackage,
} from './packages.js'

export type ReadinessAxisId = 'documentation' | 'formalization' | 'execution' | 'conformance' | 'reality'

export interface ReadinessCriterion {
  id: string
  label: string
  passed: boolean
  evidence: string
  action: string
}

export interface ReadinessAxis {
  id: ReadinessAxisId
  name: string
  summary: string
  passed: number
  total: number
  percent: number
  criteria: ReadinessCriterion[]
}

export interface TheoryReadinessProfile {
  package_id: string
  package_version: string
  declared_maturity: number
  declared_maturity_name: string
  axes: ReadinessAxis[]
  blockers: ReadinessCriterion[]
  warnings: string[]
}

export interface DependencyNode {
  id: string
  kind: 'package' | 'object' | 'operator' | 'assumption' | 'invariant' | 'implementation' | 'claim-boundary'
  label: string
  status: string
}

export interface DependencyEdge {
  from: string
  to: string
  relation: 'declares' | 'input-to' | 'outputs' | 'implemented-by' | 'bounds'
}

export interface DependencyGraph {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
  open_linkages: string[]
}

function isResolved(text: string, status: string): boolean {
  const normalized = text.toUpperCase()
  return status !== 'THEORY_MAP_OPEN' && !normalized.includes('THEORY MAP OPEN') && !normalized.startsWith('CANDIDATE —')
}

function criterion(id: string, label: string, passed: boolean, evidence: string, action: string): ReadinessCriterion {
  return { id, label, passed, evidence, action }
}

function axis(id: ReadinessAxisId, name: string, summary: string, criteria: ReadinessCriterion[]): ReadinessAxis {
  const passed = criteria.filter((item) => item.passed).length
  return {
    id,
    name,
    summary,
    passed,
    total: criteria.length,
    percent: criteria.length === 0 ? 0 : Math.round((passed / criteria.length) * 100),
    criteria,
  }
}

export function buildReadinessProfile(theoryPackage: TheoryPackage): TheoryReadinessProfile {
  const validation = validateTheoryPackage(theoryPackage)
  const executableImplementations = theoryPackage.implementations.filter((item) => item.status === 'reference' || item.status === 'mirror')
  const referenceImplementations = executableImplementations.filter((item) => item.status === 'reference')
  const mirrors = executableImplementations.filter((item) => item.status === 'mirror')
  const openObjects = theoryPackage.objects.filter((item) => !isResolved(item.definition, item.status))
  const openOperators = theoryPackage.operators.filter((item) => !isResolved(item.semantics, item.status))
  const unimplementedOperators = theoryPackage.operators.filter((item) => !item.implementation)
  const unresolvedInvariants = theoryPackage.invariants.filter((item) => item.status === 'THEORY_MAP_OPEN')

  const documentation = axis(
    'documentation',
    'Documentary recovery',
    'Can another reader identify what the theory contains, why it exists, and what it may claim?',
    [
      criterion('manifest-valid', 'Manifest validates', validation.ok, validation.ok ? 'No schema or cross-reference issues.' : `${validation.issues.length} validation issue(s).`, 'Resolve every manifest validation issue.'),
      criterion('identity-complete', 'Identity and motivation are explicit', theoryPackage.theory.summary.trim() !== '' && theoryPackage.theory.motivation.trim() !== '', 'Summary and motivation are present.', 'State what the theory is and what problem caused it to be built.'),
      criterion('objects-declared', 'At least one object is declared', theoryPackage.objects.length > 0, `${theoryPackage.objects.length} object(s) declared.`, 'Declare the object kinds used by the theory.'),
      criterion('assumptions-declared', 'Assumptions are visible', theoryPackage.assumptions.length > 0, `${theoryPackage.assumptions.length} assumption(s) declared.`, 'List the assumptions that bound every derivation.'),
      criterion('claims-bounded', 'Allowed and prohibited claims are explicit', theoryPackage.claim_boundaries.allowed.length > 0 && theoryPackage.claim_boundaries.prohibited.length > 0, `${theoryPackage.claim_boundaries.allowed.length} allowed and ${theoryPackage.claim_boundaries.prohibited.length} prohibited claim(s).`, 'Declare both what the package may support and what it must never imply.'),
    ],
  )

  const formalization = axis(
    'formalization',
    'Formal semantics',
    'Are objects, operators, invariants, and failure boundaries precise enough for independent implementation?',
    [
      criterion('objects-resolved', 'Object definitions are resolved', openObjects.length === 0, openObjects.length === 0 ? 'No object definition is marked open.' : `${openObjects.length} object definition(s) remain open.`, 'Replace THEORY_MAP_OPEN or candidate placeholders with exact identity and admissibility rules.'),
      criterion('operators-declared', 'At least one operator is declared', theoryPackage.operators.length > 0, `${theoryPackage.operators.length} operator(s) declared.`, 'Declare the legal transformations or review operations.'),
      criterion('operators-resolved', 'Operator semantics are resolved', openOperators.length === 0, openOperators.length === 0 ? 'Every operator has bounded semantics.' : `${openOperators.length} operator semantic definition(s) remain open.`, 'Define each operator as an exact mathematical or computational map.'),
      criterion('invariants-declared', 'Invariant or proof obligations are registered', theoryPackage.invariants.length > 0, `${theoryPackage.invariants.length} invariant(s) registered.`, 'Register what must remain true and the scope of each obligation.'),
      criterion('invariants-resolved', 'Invariant identities are not THEORY_MAP_OPEN', unresolvedInvariants.length === 0, unresolvedInvariants.length === 0 ? 'No invariant is marked THEORY_MAP_OPEN.' : `${unresolvedInvariants.length} invariant(s) remain THEORY_MAP_OPEN.`, 'Give every invariant an exact predicate, domain, and falsifier.'),
    ],
  )

  const execution = axis(
    'execution',
    'Executable reference',
    'Can the declared maps run through a package-specific implementation and emit bounded receipts?',
    [
      criterion('package-executable', 'Package has earned executable status', canExecutePackage(theoryPackage), canExecutePackage(theoryPackage) ? 'Maturity and implementation requirements permit execution.' : 'Execution remains blocked.', 'Add a package-specific reference implementation; never route through an unrelated kernel.'),
      criterion('reference-present', 'A reference implementation is declared', referenceImplementations.length > 0, `${referenceImplementations.length} reference implementation(s).`, 'Declare one versioned reference implementation.'),
      criterion('operator-coverage', 'Every declared operator names an implementation location', theoryPackage.operators.length > 0 && unimplementedOperators.length === 0, unimplementedOperators.length === 0 ? 'Every operator has an implementation location.' : `${unimplementedOperators.length} operator(s) have no implementation.`, 'Implement each executable operator or classify it outside the executable surface.'),
      criterion('receipt-contract', 'Generic receipt envelope can bind every operator', theoryPackage.operators.every((operator) => {
        try {
          buildReceiptEnvelope(theoryPackage, operator.id, { timestamp_utc: '1970-01-01T00:00:00Z' })
          return true
        } catch {
          return false
        }
      }), `${theoryPackage.operators.length} operator envelope(s) evaluated.`, 'Repair operator ids and package bindings so every run can emit a package-bound receipt.'),
    ],
  )

  const conformance = axis(
    'conformance',
    'Conformance and independence',
    'Do multiple execution surfaces agree, and are the limits of their independence stated honestly?',
    [
      criterion('two-surfaces', 'At least two executable surfaces exist', executableImplementations.length >= 2, `${executableImplementations.length} executable surface(s).`, 'Add a second implementation or independent conformance harness.'),
      criterion('mirror-dependencies', 'Mirror dependence is disclosed', mirrors.length === 0 || mirrors.every((item) => (item.independent_from?.length ?? 0) > 0), mirrors.length === 0 ? 'No mirror is declared.' : `${mirrors.filter((item) => (item.independent_from?.length ?? 0) > 0).length}/${mirrors.length} mirror(s) disclose dependence.`, 'State which reference, algorithms, fixtures, prompts, or sources each mirror shares.'),
      criterion('conformance-claim-bounded', 'Conformance is not described as empirical independence', theoryPackage.claim_boundaries.prohibited.some((claim) => /independ|reality|nature|empirical/i.test(claim)), 'Prohibited claims include an empirical or independence boundary.', 'Explicitly prohibit treating implementation agreement as independent scientific confirmation.'),
    ],
  )

  const reality = axis(
    'reality',
    'Reality Gate',
    'Are empirical tests, evidence, prediction, and replication tracked separately from formal coherence?',
    [
      criterion('reality-classified', 'Reality Gate status is classified', theoryPackage.evidence.reality_gate !== 'not_evaluated', `Reality Gate: ${theoryPackage.evidence.reality_gate}.`, 'Register a planned evidence program without claiming it has passed.'),
      criterion('evidence-notes', 'Evidence notes describe the external test lane', theoryPackage.evidence.notes.trim().length >= 20, theoryPackage.evidence.notes || 'No evidence notes.', 'Describe datasets, literature comparisons, predictions, falsifiers, or replication needs.'),
      criterion('reality-not-laundered', 'Formal success is prohibited from implying reality', theoryPackage.claim_boundaries.prohibited.some((claim) => /reality|nature|physical|empirical/i.test(claim)), 'A Reality-Gate boundary appears in prohibited claims.', 'Add an explicit prohibition against treating formal validity as empirical truth.'),
    ],
  )

  const axes = [documentation, formalization, execution, conformance, reality]
  const blockers = axes.flatMap((item) => item.criteria.filter((entry) => !entry.passed))
  const warnings: string[] = []
  if (theoryPackage.maturity_level >= 3 && execution.percent < 100) warnings.push('Declared maturity includes execution, but the execution axis still has blockers.')
  if (theoryPackage.maturity_level >= 4 && conformance.percent < 100) warnings.push('Declared maturity includes conformance, but the conformance axis still has blockers.')
  if (theoryPackage.maturity_level >= 5 && reality.percent < 100) warnings.push('Declared maturity includes Reality-Gate candidacy, but the evidence axis still has blockers.')
  if (formalization.percent < 100 && execution.percent === 100) warnings.push('Code exists while some semantics remain open. Implementation behavior must not silently define the theory.')

  return {
    package_id: theoryPackage.theory.id,
    package_version: theoryPackage.theory.version,
    declared_maturity: theoryPackage.maturity_level,
    declared_maturity_name: packageLevelName(theoryPackage.maturity_level),
    axes,
    blockers,
    warnings,
  }
}

export function buildDependencyGraph(theoryPackage: TheoryPackage): DependencyGraph {
  const root = `package:${theoryPackage.theory.id}`
  const nodes: DependencyNode[] = [
    { id: root, kind: 'package', label: `${theoryPackage.theory.name} ${theoryPackage.theory.version}`, status: theoryPackage.theory.status },
  ]
  const edges: DependencyEdge[] = []

  for (const object of theoryPackage.objects) {
    const id = `object:${object.id}`
    nodes.push({ id, kind: 'object', label: object.name, status: object.status })
    edges.push({ from: root, to: id, relation: 'declares' })
  }
  for (const operator of theoryPackage.operators) {
    const id = `operator:${operator.id}`
    nodes.push({ id, kind: 'operator', label: operator.name, status: operator.status })
    edges.push({ from: root, to: id, relation: 'declares' })
    for (const input of operator.input_types) edges.push({ from: `object:${input}`, to: id, relation: 'input-to' })
    for (const output of operator.output_types) edges.push({ from: id, to: `object:${output}`, relation: 'outputs' })
    if (operator.implementation) {
      const implementationId = `implementation-location:${operator.id}`
      nodes.push({ id: implementationId, kind: 'implementation', label: operator.implementation, status: 'DECLARED' })
      edges.push({ from: id, to: implementationId, relation: 'implemented-by' })
    }
  }
  for (const assumption of theoryPackage.assumptions) {
    const id = `assumption:${assumption.id}`
    nodes.push({ id, kind: 'assumption', label: assumption.text, status: assumption.status })
    edges.push({ from: root, to: id, relation: 'declares' })
  }
  for (const invariant of theoryPackage.invariants) {
    const id = `invariant:${invariant.id}`
    nodes.push({ id, kind: 'invariant', label: invariant.text, status: invariant.status })
    edges.push({ from: root, to: id, relation: 'declares' })
  }
  for (const implementation of theoryPackage.implementations) {
    const id = `implementation:${implementation.id}`
    nodes.push({ id, kind: 'implementation', label: `${implementation.id} (${implementation.language})`, status: implementation.status })
    edges.push({ from: root, to: id, relation: 'implemented-by' })
  }
  const allowedId = 'claim-boundary:allowed'
  const prohibitedId = 'claim-boundary:prohibited'
  nodes.push({ id: allowedId, kind: 'claim-boundary', label: `${theoryPackage.claim_boundaries.allowed.length} allowed claim(s)`, status: 'ALLOWED' })
  nodes.push({ id: prohibitedId, kind: 'claim-boundary', label: `${theoryPackage.claim_boundaries.prohibited.length} prohibited claim(s)`, status: 'PROHIBITED' })
  edges.push({ from: root, to: allowedId, relation: 'bounds' })
  edges.push({ from: root, to: prohibitedId, relation: 'bounds' })

  const open_linkages: string[] = []
  if (theoryPackage.assumptions.length > 0) open_linkages.push('Per-operator assumption usage is not yet declared by theory-package:v0.1.')
  if (theoryPackage.invariants.length > 0) open_linkages.push('Per-operator invariant and predicate linkage is not yet declared by theory-package:v0.1.')
  if (theoryPackage.operators.some((item) => item.status === 'THEORY_MAP_OPEN')) open_linkages.push('One or more operator meanings remain THEORY_MAP_OPEN.')

  return { nodes, edges, open_linkages }
}

function markdownTable(headers: string[], rows: string[][]): string {
  const escape = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ')
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n')
}

export function buildAuditPacketMarkdown(theoryPackage: TheoryPackage): string {
  const profile = buildReadinessProfile(theoryPackage)
  const receipt = theoryPackage.operators[0]
    ? buildReceiptEnvelope(theoryPackage, theoryPackage.operators[0].id, { timestamp_utc: 'RUNTIME_TIMESTAMP' })
    : null
  const ambiguityRows = [
    ...theoryPackage.objects.filter((item) => item.status !== 'ACCEPTED').map((item) => [`object:${item.id}`, item.status, item.definition]),
    ...theoryPackage.operators.filter((item) => item.status !== 'ACCEPTED').map((item) => [`operator:${item.id}`, item.status, item.semantics]),
    ...theoryPackage.assumptions.filter((item) => item.status !== 'ACCEPTED').map((item) => [`assumption:${item.id}`, item.status, item.text]),
    ...theoryPackage.invariants.filter((item) => item.status !== 'ACCEPTED').map((item) => [`invariant:${item.id}`, item.status, item.text]),
  ]
  const roleEntries = Object.entries(theoryPackage.metadata).filter(([key]) => ['custodian', 'auditor', 'steward', 'authority'].includes(key))

  return `# H0–H6 Recovery and Audit Packet\n\n` +
    `**Package:** ${theoryPackage.theory.name}  \n` +
    `**Identity:** \`${theoryPackage.theory.id}@${theoryPackage.theory.version}\`  \n` +
    `**Schema:** \`${theoryPackage.schema_version}\`  \n` +
    `**Declared maturity:** Level ${theoryPackage.maturity_level} — ${packageLevelName(theoryPackage.maturity_level)}  \n` +
    `**Reality Gate:** ${theoryPackage.evidence.reality_gate}  \n\n` +
    `> Generated from the package manifest. This packet reports declared and recovered structure; it does not promote candidate definitions.\n\n` +
    `## H0 — Scope and Evidence Freeze\n\n` +
    `- Summary: ${theoryPackage.theory.summary}\n` +
    `- Motivation: ${theoryPackage.theory.motivation}\n` +
    `- Implementations in scope: ${theoryPackage.implementations.map((item) => `${item.id} (${item.language}, ${item.version}, ${item.status})`).join('; ') || 'NONE'}\n` +
    `- Execution route: ${String(theoryPackage.metadata.execution_route ?? 'THEORY MAP OPEN')}\n` +
    `- Evidence note: ${theoryPackage.evidence.notes}\n\n` +
    `## H1 — Observable Object Inventory\n\n` +
    markdownTable(['ID', 'Name', 'Definition', 'Evidence', 'Status'], theoryPackage.objects.map((item) => [item.id, item.name, item.definition, item.evidence_class, item.status])) +
    `\n\n## H2 — Operation Catalog\n\n` +
    markdownTable(['ID', 'Name', 'Inputs', 'Outputs', 'Semantics', 'Implementation', 'Evidence', 'Status'], theoryPackage.operators.map((item) => [item.id, item.name, item.input_types.join(', '), item.output_types.join(', '), item.semantics, item.implementation ?? 'NONE', item.evidence_class, item.status])) +
    `\n\n### Open operation-contract fields\n\n` +
    `The v0.1 package schema does not yet bind assumptions, invariants, failure conditions, reversibility, or receipt predicates to each operator. These remain explicit recovery obligations.\n\n` +
    `## H3 — Current Receipt Schema Specimen\n\n` +
    (receipt ? `\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\`` : 'No operator exists from which to generate a receipt envelope.') +
    `\n\n## H4 — Authority Map\n\n` +
    (roleEntries.length > 0 ? markdownTable(['Role', 'Declared holder'], roleEntries.map(([key, value]) => [key, String(value)])) : 'THEORY MAP OPEN — no custodian, auditor, steward, or authority roles are declared in metadata.') +
    `\n\n## H5 — Ambiguity Register\n\n` +
    (ambiguityRows.length > 0 ? markdownTable(['Object', 'Disposition', 'Open definition'], ambiguityRows) : 'No non-ACCEPTED definitions are currently declared.') +
    `\n\n### Cross-cutting ambiguities\n\n` +
    `- Per-operator assumption linkage: THEORY MAP OPEN.\n` +
    `- Per-operator invariant/predicate linkage: THEORY MAP OPEN.\n` +
    `- Failure and recovery contracts: THEORY MAP OPEN unless stated inside operator semantics.\n` +
    `- Implementation agreement is conformance evidence, not automatically epistemic independence.\n\n` +
    `## H6 — App-to-Concept Map\n\n` +
    markdownTable(['Visible/portable feature', 'Governance concept', 'Status'], [
      ['Theory manifest', 'Typed package identity and scope', 'IMPLEMENTED'],
      ['Object registry', 'Observable object inventory', theoryPackage.objects.length > 0 ? 'DECLARED' : 'OPEN'],
      ['Operator registry', 'Lawful transition catalog', theoryPackage.operators.length > 0 ? 'DECLARED' : 'OPEN'],
      ['Receipt envelope', 'Package-bound execution/provenance record', receipt ? 'AVAILABLE' : 'OPEN'],
      ['Claim boundaries', 'Allowed and prohibited inference surface', 'DECLARED'],
      ['Reality Gate', 'External evidence and replication lane', theoryPackage.evidence.reality_gate],
      ['Execution route', 'Package-specific runtime adapter', String(theoryPackage.metadata.execution_route ?? 'THEORY MAP OPEN')],
    ]) +
    `\n\n## Readiness Profile\n\n` +
    markdownTable(['Axis', 'Score', 'Open obligations'], profile.axes.map((item) => [item.name, `${item.passed}/${item.total} (${item.percent}%)`, item.criteria.filter((entry) => !entry.passed).map((entry) => entry.action).join('; ') || 'None'])) +
    `\n\n## First Falsifiers\n\n` +
    theoryPackage.invariants.map((item) => `- **${item.id}:** Specify an admissible counterexample or execution that would falsify: ${item.text}`).join('\n') +
    `\n`
}

function codeIdentifier(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^([0-9])/, '_$1')
  return cleaned || 'operation'
}

export function buildPythonScaffold(theoryPackage: TheoryPackage): string {
  const functions = theoryPackage.operators.map((operator) => {
    const name = codeIdentifier(operator.id)
    return `def ${name}(*inputs: object, **parameters: object) -> tuple[list[object], dict[str, object]]:\n    \"\"\"${operator.name}\n\n    Declared semantics: ${operator.semantics.replaceAll('"', '\\"')}\n    Input types: ${operator.input_types.join(', ') || 'none'}\n    Output types: ${operator.output_types.join(', ') || 'none'}\n\n    This scaffold is not an implementation and must not emit PASS.\n    \"\"\"\n    raise NotImplementedError(\"THEORY_MAP_OPEN: implement, test, and receipt-bind ${operator.id}\")\n`
  }).join('\n\n')
  return `\"\"\"Generated implementation scaffold for ${theoryPackage.theory.id}@${theoryPackage.theory.version}.\n\nThis file is a planning artifact. It is not executable evidence and may not be\npromoted to a reference implementation until semantics, tests, receipts, and\nclaim boundaries are reviewed.\n\"\"\"\n\nfrom __future__ import annotations\n\nPACKAGE_ID = ${JSON.stringify(theoryPackage.theory.id)}\nPACKAGE_VERSION = ${JSON.stringify(theoryPackage.theory.version)}\nRECEIPT_SCHEMA_VERSION = \"parallax-receipt-envelope:v0.1\"\n\n${functions || '# No operators declared.'}\n`
}

export function buildTypeScriptScaffold(theoryPackage: TheoryPackage): string {
  const functions = theoryPackage.operators.map((operator) => {
    const name = codeIdentifier(operator.id)
    return `/**\n * ${operator.name}\n * Declared semantics: ${operator.semantics.replaceAll('*/', '* /')}\n * Inputs: ${operator.input_types.join(', ') || 'none'}\n * Outputs: ${operator.output_types.join(', ') || 'none'}\n * Planning scaffold only: never report PASS from this stub.\n */\nexport function ${name}(..._inputs: unknown[]): never {\n  throw new Error('THEORY_MAP_OPEN: implement, test, and receipt-bind ${operator.id}')\n}`
  }).join('\n\n')
  return `/**\n * Generated implementation scaffold for ${theoryPackage.theory.id}@${theoryPackage.theory.version}.\n * This is a planning artifact, not executable evidence.\n */\n\nexport const PACKAGE_ID = ${JSON.stringify(theoryPackage.theory.id)} as const\nexport const PACKAGE_VERSION = ${JSON.stringify(theoryPackage.theory.version)} as const\nexport const RECEIPT_SCHEMA_VERSION = 'parallax-receipt-envelope:v0.1' as const\n\n${functions || '// No operators declared.'}\n`
}

export function buildPlanningReceipt(theoryPackage: TheoryPackage, operationId: string, timestamp = new Date().toISOString()): ReceiptEnvelope {
  return buildReceiptEnvelope(theoryPackage, operationId, {
    timestamp_utc: timestamp,
    status: 'NOT_RUN',
    claims_supported: [],
    claims_prohibited: [...theoryPackage.claim_boundaries.prohibited],
    checks: [{ predicate_id: 'execution-not-performed', status: 'NOT_RUN', expected: 'A package-specific implementation and reviewed execution contract.' }],
  })
}
