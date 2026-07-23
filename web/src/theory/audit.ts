import {
  buildReceiptEnvelope,
  canExecutePackage,
  operatorContractResolved,
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
  kind: 'package' | 'object' | 'operator' | 'assumption' | 'invariant' | 'predicate' | 'failure' | 'implementation' | 'claim-boundary'
  label: string
  status: string
}

export interface DependencyEdge {
  from: string
  to: string
  relation: 'declares' | 'input-to' | 'outputs' | 'implemented-by' | 'bounds' | 'uses-assumption' | 'checks-invariant' | 'checks-predicate' | 'fails-on'
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
  return { id, name, summary, passed, total: criteria.length, percent: criteria.length === 0 ? 0 : Math.round((passed / criteria.length) * 100), criteria }
}

export function buildReadinessProfile(theoryPackage: TheoryPackage): TheoryReadinessProfile {
  const validation = validateTheoryPackage(theoryPackage)
  const executableImplementations = theoryPackage.implementations.filter((item) => item.status === 'reference' || item.status === 'mirror')
  const referenceImplementations = executableImplementations.filter((item) => item.status === 'reference')
  const mirrors = executableImplementations.filter((item) => item.status === 'mirror')
  const openObjects = theoryPackage.objects.filter((item) => !isResolved(item.definition, item.status))
  const openOperators = theoryPackage.operators.filter((item) => !isResolved(item.semantics, item.status))
  const openContracts = theoryPackage.operators.filter((item) => !operatorContractResolved(item))
  const unimplementedOperators = theoryPackage.operators.filter((item) => !item.implementation)
  const unresolvedInvariants = theoryPackage.invariants.filter((item) => item.status === 'THEORY_MAP_OPEN')

  const documentation = axis('documentation', 'Documentary recovery', 'Can another reader identify what the theory contains, why it exists, and what it may claim?', [
    criterion('manifest-valid', 'Manifest validates', validation.ok, validation.ok ? 'No schema or cross-reference issues.' : `${validation.issues.length} validation issue(s).`, 'Resolve every manifest validation issue.'),
    criterion('identity-complete', 'Identity and motivation are explicit', theoryPackage.theory.summary.trim() !== '' && theoryPackage.theory.motivation.trim() !== '', 'Summary and motivation are present.', 'State what the theory is and what problem caused it to be built.'),
    criterion('objects-declared', 'At least one object is declared', theoryPackage.objects.length > 0, `${theoryPackage.objects.length} object(s) declared.`, 'Declare the object kinds used by the theory.'),
    criterion('assumptions-declared', 'Assumptions are visible', theoryPackage.assumptions.length > 0, `${theoryPackage.assumptions.length} assumption(s) declared.`, 'List the assumptions that bound every derivation.'),
    criterion('claims-bounded', 'Allowed and prohibited claims are explicit', theoryPackage.claim_boundaries.allowed.length > 0 && theoryPackage.claim_boundaries.prohibited.length > 0, `${theoryPackage.claim_boundaries.allowed.length} allowed and ${theoryPackage.claim_boundaries.prohibited.length} prohibited claim(s).`, 'Declare both what the package may support and what it must never imply.'),
  ])

  const formalization = axis('formalization', 'Formal semantics and contracts', 'Are objects, operators, predicates, failures, and falsifiers precise enough for independent implementation?', [
    criterion('objects-resolved', 'Object definitions are resolved', openObjects.length === 0, openObjects.length === 0 ? 'No object definition is marked open.' : `${openObjects.length} object definition(s) remain open.`, 'Replace open placeholders with exact identity and admissibility rules.'),
    criterion('operators-declared', 'At least one operator is declared', theoryPackage.operators.length > 0, `${theoryPackage.operators.length} operator(s) declared.`, 'Declare the legal transformations or review operations.'),
    criterion('operators-resolved', 'Operator semantics are resolved', openOperators.length === 0, openOperators.length === 0 ? 'Every operator has bounded semantics.' : `${openOperators.length} operator semantic definition(s) remain open.`, 'Define each operator as an exact mathematical or computational map.'),
    criterion('contracts-present', 'Every operator has a v0.2 execution contract', theoryPackage.operators.every((item) => item.contract.contract_version === 'operator-contract:v0.2'), `${theoryPackage.operators.length} contract(s) inspected.`, 'Add the complete v0.2 contract block to every operator.'),
    criterion('contracts-resolved', 'Execution contracts have no open placeholders', openContracts.length === 0, openContracts.length === 0 ? 'Every contract states preconditions, predicates, failures, reversibility, receipt fields, and a falsifier.' : `${openContracts.length} contract(s) remain open.`, 'Resolve every THEORY_MAP_OPEN contract field and unknown reversibility class.'),
    criterion('invariants-declared', 'Invariant or proof obligations are registered', theoryPackage.invariants.length > 0, `${theoryPackage.invariants.length} invariant(s) registered.`, 'Register what must remain true and the scope of each obligation.'),
    criterion('invariants-resolved', 'Invariant identities are not THEORY_MAP_OPEN', unresolvedInvariants.length === 0, unresolvedInvariants.length === 0 ? 'No invariant is marked THEORY_MAP_OPEN.' : `${unresolvedInvariants.length} invariant(s) remain THEORY_MAP_OPEN.`, 'Give every invariant an exact predicate, domain, and falsifier.'),
  ])

  const execution = axis('execution', 'Executable reference', 'Can the declared maps run through a package-specific implementation and emit contract-bound receipts?', [
    criterion('package-executable', 'Package has earned executable status', canExecutePackage(theoryPackage), canExecutePackage(theoryPackage) ? 'Maturity, implementation, and contract requirements permit execution.' : 'Execution remains blocked.', 'Add a package-specific reference implementation; never route through an unrelated kernel.'),
    criterion('reference-present', 'A reference implementation is declared', referenceImplementations.length > 0, `${referenceImplementations.length} reference implementation(s).`, 'Declare one versioned reference implementation.'),
    criterion('operator-coverage', 'Every declared operator names an implementation location', theoryPackage.operators.length > 0 && unimplementedOperators.length === 0, unimplementedOperators.length === 0 ? 'Every operator has an implementation location.' : `${unimplementedOperators.length} operator(s) have no implementation.`, 'Implement each executable operator or keep the package below Level 3.'),
    criterion('receipt-contract', 'Receipt envelopes bind exact contracts', theoryPackage.operators.every((operator) => {
      try {
        const receipt = buildReceiptEnvelope(theoryPackage, operator.id, { timestamp_utc: '1970-01-01T00:00:00Z' })
        return receipt.operator_contract.version === operator.contract.contract_version && receipt.operator_contract.predicate_ids.length === operator.contract.predicates.length
      } catch {
        return false
      }
    }), `${theoryPackage.operators.length} contract-bound envelope(s) evaluated.`, 'Repair contract references so every run binds assumptions, invariants, predicates, and the first falsifier.'),
  ])

  const conformance = axis('conformance', 'Conformance and independence', 'Do multiple execution surfaces agree, and are the limits of their independence stated honestly?', [
    criterion('two-surfaces', 'At least two executable surfaces exist', executableImplementations.length >= 2, `${executableImplementations.length} executable surface(s).`, 'Add a second implementation or independent conformance harness.'),
    criterion('mirror-dependencies', 'Mirror dependence is disclosed', mirrors.length === 0 || mirrors.every((item) => (item.independent_from?.length ?? 0) > 0), mirrors.length === 0 ? 'No mirror is declared.' : `${mirrors.filter((item) => (item.independent_from?.length ?? 0) > 0).length}/${mirrors.length} mirror(s) disclose dependence.`, 'State which reference, algorithms, fixtures, prompts, or sources each mirror shares.'),
    criterion('conformance-claim-bounded', 'Conformance is not described as empirical independence', theoryPackage.claim_boundaries.prohibited.some((claim) => /independ|reality|nature|empirical/i.test(claim)), 'Prohibited claims include an empirical or independence boundary.', 'Explicitly prohibit treating implementation agreement as independent scientific confirmation.'),
  ])

  const reality = axis('reality', 'Reality Gate', 'Are empirical tests, evidence, prediction, and replication tracked separately from formal coherence?', [
    criterion('reality-classified', 'Reality Gate status is classified', theoryPackage.evidence.reality_gate !== 'not_evaluated', `Reality Gate: ${theoryPackage.evidence.reality_gate}.`, 'Register a planned evidence program without claiming it has passed.'),
    criterion('evidence-notes', 'Evidence notes describe the external test lane', theoryPackage.evidence.notes.trim().length >= 20, theoryPackage.evidence.notes || 'No evidence notes.', 'Describe datasets, literature comparisons, predictions, falsifiers, or replication needs.'),
    criterion('reality-not-laundered', 'Formal success is prohibited from implying reality', theoryPackage.claim_boundaries.prohibited.some((claim) => /reality|nature|physical|empirical/i.test(claim)), 'A Reality-Gate boundary appears in prohibited claims.', 'Add an explicit prohibition against treating formal validity as empirical truth.'),
  ])

  const axes = [documentation, formalization, execution, conformance, reality]
  const blockers = axes.flatMap((item) => item.criteria.filter((entry) => !entry.passed))
  const warnings: string[] = []
  if (theoryPackage.maturity_level >= 3 && execution.percent < 100) warnings.push('Declared maturity includes execution, but the execution axis still has blockers.')
  if (theoryPackage.maturity_level >= 4 && conformance.percent < 100) warnings.push('Declared maturity includes conformance, but the conformance axis still has blockers.')
  if (theoryPackage.maturity_level >= 5 && reality.percent < 100) warnings.push('Declared maturity includes Reality-Gate candidacy, but the evidence axis still has blockers.')
  if (formalization.percent < 100 && execution.percent === 100) warnings.push('Code exists while some interpretation semantics remain open. The operational contract must not silently settle the unresolved theory meaning.')

  return { package_id: theoryPackage.theory.id, package_version: theoryPackage.theory.version, declared_maturity: theoryPackage.maturity_level, declared_maturity_name: packageLevelName(theoryPackage.maturity_level), axes, blockers, warnings }
}

export function buildDependencyGraph(theoryPackage: TheoryPackage): DependencyGraph {
  const root = `package:${theoryPackage.theory.id}`
  const nodes: DependencyNode[] = [{ id: root, kind: 'package', label: `${theoryPackage.theory.name} ${theoryPackage.theory.version}`, status: theoryPackage.theory.status }]
  const edges: DependencyEdge[] = []

  for (const object of theoryPackage.objects) {
    const id = `object:${object.id}`
    nodes.push({ id, kind: 'object', label: object.name, status: object.status })
    edges.push({ from: root, to: id, relation: 'declares' })
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
  for (const operator of theoryPackage.operators) {
    const id = `operator:${operator.id}`
    nodes.push({ id, kind: 'operator', label: operator.name, status: operator.status })
    edges.push({ from: root, to: id, relation: 'declares' })
    for (const input of operator.input_types) edges.push({ from: `object:${input}`, to: id, relation: 'input-to' })
    for (const output of operator.output_types) edges.push({ from: id, to: `object:${output}`, relation: 'outputs' })
    for (const assumptionId of operator.contract.assumptions_used) edges.push({ from: `assumption:${assumptionId}`, to: id, relation: 'uses-assumption' })
    for (const invariantId of operator.contract.invariants_checked) edges.push({ from: id, to: `invariant:${invariantId}`, relation: 'checks-invariant' })
    for (const predicate of operator.contract.predicates) {
      const predicateId = `predicate:${operator.id}:${predicate.id}`
      nodes.push({ id: predicateId, kind: 'predicate', label: predicate.statement, status: predicate.required ? 'REQUIRED' : 'OPTIONAL' })
      edges.push({ from: id, to: predicateId, relation: 'checks-predicate' })
    }
    for (const failure of operator.contract.failure_conditions) {
      const failureId = `failure:${operator.id}:${failure.id}`
      nodes.push({ id: failureId, kind: 'failure', label: failure.condition, status: failure.outcome })
      edges.push({ from: id, to: failureId, relation: 'fails-on' })
    }
    if (operator.implementation) {
      const implementationId = `implementation-location:${operator.id}`
      nodes.push({ id: implementationId, kind: 'implementation', label: operator.implementation, status: 'DECLARED' })
      edges.push({ from: id, to: implementationId, relation: 'implemented-by' })
    }
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
  for (const operator of theoryPackage.operators) {
    if (!operatorContractResolved(operator)) open_linkages.push(`${operator.id}: execution contract contains an open placeholder or unknown reversibility.`)
    if (operator.status === 'THEORY_MAP_OPEN') open_linkages.push(`${operator.id}: operational behavior is contracted, but the higher-level interpretation remains THEORY_MAP_OPEN.`)
  }
  return { nodes, edges, open_linkages }
}

function markdownTable(headers: string[], rows: string[][]): string {
  const escape = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ')
  return [`| ${headers.map(escape).join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`)].join('\n')
}

export function buildAuditPacketMarkdown(theoryPackage: TheoryPackage): string {
  const profile = buildReadinessProfile(theoryPackage)
  const receipt = theoryPackage.operators[0] ? buildReceiptEnvelope(theoryPackage, theoryPackage.operators[0].id, { timestamp_utc: 'RUNTIME_TIMESTAMP' }) : null
  const ambiguityRows = [
    ...theoryPackage.objects.filter((item) => item.status !== 'ACCEPTED').map((item) => [`object:${item.id}`, item.status, item.definition]),
    ...theoryPackage.operators.filter((item) => item.status !== 'ACCEPTED').map((item) => [`operator:${item.id}`, item.status, item.semantics]),
    ...theoryPackage.assumptions.filter((item) => item.status !== 'ACCEPTED').map((item) => [`assumption:${item.id}`, item.status, item.text]),
    ...theoryPackage.invariants.filter((item) => item.status !== 'ACCEPTED').map((item) => [`invariant:${item.id}`, item.status, item.text]),
  ]
  const roleEntries = Object.entries(theoryPackage.metadata).filter(([key]) => ['custodian', 'auditor', 'steward', 'authority'].includes(key))
  const contractRows = theoryPackage.operators.map((item) => [
    item.id,
    item.contract.preconditions.join('; '),
    item.contract.assumptions_used.join(', ') || 'NONE',
    item.contract.invariants_checked.join(', ') || 'NONE',
    item.contract.predicates.map((predicate) => predicate.id).join(', '),
    item.contract.failure_conditions.map((failure) => `${failure.id}:${failure.outcome}`).join(', '),
    `${item.contract.reversibility.classification}: ${item.contract.reversibility.condition}`,
    item.contract.first_falsifier,
  ])

  return `# H0–H6 Recovery and Audit Packet\n\n` +
    `**Package:** ${theoryPackage.theory.name}  \n` +
    `**Identity:** \`${theoryPackage.theory.id}@${theoryPackage.theory.version}\`  \n` +
    `**Schema:** \`${theoryPackage.schema_version}\`  \n` +
    `**Declared maturity:** Level ${theoryPackage.maturity_level} — ${packageLevelName(theoryPackage.maturity_level)}  \n` +
    `**Reality Gate:** ${theoryPackage.evidence.reality_gate}  \n\n` +
    `> Generated from the package manifest. This packet reports declared and recovered structure; it does not promote candidate definitions.\n\n` +
    `## H0 — Scope and Evidence Freeze\n\n` +
    `- Summary: ${theoryPackage.theory.summary}\n- Motivation: ${theoryPackage.theory.motivation}\n` +
    `- Implementations in scope: ${theoryPackage.implementations.map((item) => `${item.id} (${item.language}, ${item.version}, ${item.status})`).join('; ') || 'NONE'}\n` +
    `- Execution route: ${String(theoryPackage.metadata.execution_route ?? 'THEORY MAP OPEN')}\n- Evidence note: ${theoryPackage.evidence.notes}\n\n` +
    `## H1 — Observable Object Inventory\n\n` + markdownTable(['ID', 'Name', 'Definition', 'Evidence', 'Status'], theoryPackage.objects.map((item) => [item.id, item.name, item.definition, item.evidence_class, item.status])) +
    `\n\n## H2 — Operation Catalog\n\n` + markdownTable(['ID', 'Name', 'Inputs', 'Outputs', 'Semantics', 'Implementation', 'Evidence', 'Status'], theoryPackage.operators.map((item) => [item.id, item.name, item.input_types.join(', '), item.output_types.join(', '), item.semantics, item.implementation ?? 'NONE', item.evidence_class, item.status])) +
    `\n\n### Per-operator execution contracts\n\n` + markdownTable(['Operator', 'Preconditions', 'Assumptions', 'Invariants', 'Predicates', 'Failures', 'Reversibility', 'First falsifier'], contractRows) +
    `\n\n## H3 — Current Receipt Schema Specimen\n\n` + (receipt ? `\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\`` : 'No operator exists from which to generate a receipt envelope.') +
    `\n\n## H4 — Authority Map\n\n` + (roleEntries.length > 0 ? markdownTable(['Role', 'Declared holder'], roleEntries.map(([key, value]) => [key, String(value)])) : 'THEORY MAP OPEN — no authority roles are declared in metadata.') +
    `\n\n## H5 — Ambiguity Register\n\n` + (ambiguityRows.length > 0 ? markdownTable(['Object', 'Disposition', 'Open definition'], ambiguityRows) : 'No non-ACCEPTED definitions are currently declared.') +
    `\n\n### Cross-cutting boundaries\n\n- Execution contracts specify operational obligations; they do not silently resolve an operator whose interpretation remains THEORY_MAP_OPEN.\n- Implementation agreement is conformance evidence, not automatically epistemic independence.\n- A first falsifier is a declared attack surface, not evidence that the operator has survived it.\n\n` +
    `## H6 — App-to-Concept Map\n\n` + markdownTable(['Visible/portable feature', 'Governance concept', 'Status'], [
      ['Theory manifest', 'Typed package identity and scope', 'IMPLEMENTED'],
      ['Object registry', 'Observable object inventory', theoryPackage.objects.length > 0 ? 'DECLARED' : 'OPEN'],
      ['Operator registry', 'Lawful transition catalog', theoryPackage.operators.length > 0 ? 'DECLARED' : 'OPEN'],
      ['Execution contracts', 'Preconditions, assumptions, predicates, failures, reversibility, receipts, falsifiers', theoryPackage.operators.every(operatorContractResolved) ? 'RESOLVED' : 'PARTIAL'],
      ['Receipt envelope', 'Package and operator-contract-bound execution/provenance record', receipt ? 'AVAILABLE' : 'OPEN'],
      ['Claim boundaries', 'Allowed and prohibited inference surface', 'DECLARED'],
      ['Reality Gate', 'External evidence and replication lane', theoryPackage.evidence.reality_gate],
      ['Execution route', 'Package-specific runtime adapter', String(theoryPackage.metadata.execution_route ?? 'THEORY MAP OPEN')],
    ]) +
    `\n\n## Readiness Profile\n\n` + markdownTable(['Axis', 'Score', 'Open obligations'], profile.axes.map((item) => [item.name, `${item.passed}/${item.total} (${item.percent}%)`, item.criteria.filter((entry) => !entry.passed).map((entry) => entry.action).join('; ') || 'None'])) +
    `\n\n## First Falsifiers\n\n` + theoryPackage.operators.map((item) => `- **${item.id}:** ${item.contract.first_falsifier}`).join('\n') + `\n`
}

function codeIdentifier(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^([0-9])/, '_$1')
  return cleaned || 'operation'
}

export function buildPythonScaffold(theoryPackage: TheoryPackage): string {
  const functions = theoryPackage.operators.map((operator) => {
    const name = codeIdentifier(operator.id)
    const contract = operator.contract
    return `def ${name}(*inputs: object, **parameters: object) -> tuple[list[object], dict[str, object]]:\n    \"\"\"${operator.name}\n\n    Declared semantics: ${operator.semantics.replaceAll('"', '\\"')}\n    Preconditions: ${contract.preconditions.join('; ')}\n    Assumptions: ${contract.assumptions_used.join(', ') || 'none'}\n    Predicates: ${contract.predicates.map((item) => item.id).join(', ')}\n    Failure conditions: ${contract.failure_conditions.map((item) => `${item.id}:${item.outcome}`).join(', ')}\n    Reversibility: ${contract.reversibility.classification} — ${contract.reversibility.condition}\n    First falsifier: ${contract.first_falsifier}\n\n    This scaffold is not an implementation and must not emit PASS.\n    \"\"\"\n    raise NotImplementedError(\"THEORY_MAP_OPEN: implement, test, and receipt-bind ${operator.id}\")\n`
  }).join('\n\n')
  return `\"\"\"Generated implementation scaffold for ${theoryPackage.theory.id}@${theoryPackage.theory.version}.\n\nThis file is a planning artifact. It is not executable evidence and may not be\npromoted to a reference implementation until semantics, contracts, tests,\nreceipts, and claim boundaries are reviewed.\n\"\"\"\n\nfrom __future__ import annotations\n\nPACKAGE_ID = ${JSON.stringify(theoryPackage.theory.id)}\nPACKAGE_VERSION = ${JSON.stringify(theoryPackage.theory.version)}\nRECEIPT_SCHEMA_VERSION = \"parallax-receipt-envelope:v0.2\"\nOPERATOR_CONTRACT_VERSION = \"operator-contract:v0.2\"\n\n${functions || '# No operators declared.'}\n`
}

export function buildTypeScriptScaffold(theoryPackage: TheoryPackage): string {
  const functions = theoryPackage.operators.map((operator) => {
    const name = codeIdentifier(operator.id)
    const contract = operator.contract
    return `/**\n * ${operator.name}\n * Declared semantics: ${operator.semantics.replaceAll('*/', '* /')}\n * Preconditions: ${contract.preconditions.join('; ')}\n * Assumptions: ${contract.assumptions_used.join(', ') || 'none'}\n * Predicates: ${contract.predicates.map((item) => item.id).join(', ')}\n * Failure conditions: ${contract.failure_conditions.map((item) => `${item.id}:${item.outcome}`).join(', ')}\n * Reversibility: ${contract.reversibility.classification} — ${contract.reversibility.condition}\n * First falsifier: ${contract.first_falsifier}\n * Planning scaffold only: never report PASS from this stub.\n */\nexport function ${name}(..._inputs: unknown[]): never {\n  throw new Error('THEORY_MAP_OPEN: implement, test, and receipt-bind ${operator.id}')\n}`
  }).join('\n\n')
  return `/**\n * Generated implementation scaffold for ${theoryPackage.theory.id}@${theoryPackage.theory.version}.\n * This is a planning artifact, not executable evidence.\n */\n\nexport const PACKAGE_ID = ${JSON.stringify(theoryPackage.theory.id)} as const\nexport const PACKAGE_VERSION = ${JSON.stringify(theoryPackage.theory.version)} as const\nexport const RECEIPT_SCHEMA_VERSION = 'parallax-receipt-envelope:v0.2' as const\nexport const OPERATOR_CONTRACT_VERSION = 'operator-contract:v0.2' as const\n\n${functions || '// No operators declared.'}\n`
}

export function buildPlanningReceipt(theoryPackage: TheoryPackage, operationId: string, timestamp = new Date().toISOString()): ReceiptEnvelope {
  const operator = theoryPackage.operators.find((item) => item.id === operationId)
  if (!operator) throw new Error(`Unknown operation ${operationId}.`)
  return buildReceiptEnvelope(theoryPackage, operationId, {
    timestamp_utc: timestamp,
    status: 'NOT_RUN',
    claims_supported: [],
    claims_prohibited: [...theoryPackage.claim_boundaries.prohibited],
    checks: [
      { predicate_id: 'execution-not-performed', status: 'NOT_RUN', expected: 'A package-specific implementation and reviewed v0.2 execution contract.' },
      ...operator.contract.predicates.map((predicate) => ({ predicate_id: predicate.id, status: 'NOT_RUN' as const, expected: predicate.statement })),
    ],
  })
}
