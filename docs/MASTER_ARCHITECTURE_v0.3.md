# Langarian Math Workbench v0.3 — Master Architecture

**Status:** Living document (scaffolded 2026-07-22)  
**Branch:** `k3/langarian-workbench-v0.3`  
**Constitutional maxim:** Langarian Math grows by receipts, not hype. Ledger above ego.

## 1. Product Identity

**Name:** Langarian Math Workbench v0.3  
**Tagline:** A Receipt-Governed Calculator for Finite Complex-State Mathematics

The Workbench is a precise mathematical instrument, not a mystical novelty calculator and not a generic dashboard. It allows a user to:

1. Construct finite complex-valued states.
2. Apply mathematical operators.
3. Build multi-step transformation programs.
4. Inspect numerical results and invariants.
5. Visualize state geometry and operator behavior.
6. Examine assumptions and claim status.
7. Generate immutable operation receipts.
8. Trace full lineage of every result.
9. Separate formal computation from models, observations, metaphors, and interpretation.
10. Export calculations in reproducible machine-readable formats.

## 2. Constitutional Rules (Non-Negotiable)

- Preserve trunk integrity of the existing Python formal kernel.
- No unearned theorem language.
- No trust laundering (AI generation, pretty graphs, numerical stability, or swarm consensus do not create formal status).
- No silent transformations — every state-changing operation states operator identity, inputs, parameters, output, tolerances, assumptions, invariants, claim status, implementation version, and receipt identity.
- Interpretation quarantine: MODEL / INTERPRETIVE / METAPHOR / OBSERVED / FAILED never certify formal results.
- Experimental features remain explicitly classified (STABLE | CANDIDATE | EXPERIMENTAL | INTERPRETIVE | REJECTED).
- Never fabricate success (tests, inspections, verifications, deployments).

## 3. Authority Model

- **Python reference kernel** (`src/langarian/`) is the single mathematical authority unless an explicit Architecture Decision Record justifies otherwise.
- Browser layer may execute a conformance-port or Pyodide instance, but must never silently become a second authority.
- All public schemas are versioned: kernel, metric, receipt, DSL, application, visualization.
- Hashes are based on canonical serialization with documented float / complex / Unicode / NaN policy.

## 4. High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Workbench UI (React)                     │
│  State Builder · Operator Lab · Program Editor · Ledger     │
│  Result Inspector · Proof Gate Panel · Visualizations       │
└──────────────────────────┬──────────────────────────────────┘
                           │ typed program / AST
┌──────────────────────────▼──────────────────────────────────┐
│              Calculation Engine (browser)                   │
│  Safe DSL parser → typed AST → operator registry            │
│  Conformance to Python kernel (fixtures + tolerances)       │
└──────────────────────────┬──────────────────────────────────┘
                           │ receipts + states
┌──────────────────────────▼──────────────────────────────────┐
│           Authoritative Python Kernel (trunk)               │
│  ResonantState · metrics · operators · contracts            │
│  receipts · proof_gate · epistemic tags                     │
└─────────────────────────────────────────────────────────────┘
```

## 5. Key Design Decisions (to be formalized in ADRs)

- **WEB_KERNEL_ADR.md** — Python-in-browser (Pyodide) vs TypeScript conformance port vs hybrid. Decision driven by load size, determinism, local-first goals, and GitHub Pages constraints.
- Program model is first-class (ordered steps, dependency graph, cumulative warnings, exportable).
- Expression language is parser-based, typed, resource-bounded, versioned, and serializable. No arbitrary code execution.
- Visualizations carry explicit mathematical definitions, scale information, edge-case notes, and numeric inspection. Animations do not imply physical dynamics unless modeled.

## 6. Versioning Policy

| Artifact              | Version field                     |
|-----------------------|-----------------------------------|
| Python kernel         | KERNEL_VERSION                    |
| Metrics               | METRIC_VERSION                    |
| Receipt schema        | schema_version (receipt body)     |
| DSL / Program         | dsl_version                       |
| Application / UI      | package / app version             |
| Visualization suite   | viz_version (when behavior affects interpretation) |

Timestamps are event identity only; mathematical identity of an operation is independent of wall-clock time.

## 7. Classification of Features

Every proposed operator or surface receives one of:

- **STABLE** — in trunk, contracts + tests + receipts
- **CANDIDATE** — implemented behind flag, under review
- **EXPERIMENTAL** — quarantined, may be removed
- **INTERPRETIVE** — never formal
- **REJECTED** — recorded with reason

## 8. Security & Failure Boundaries

- No eval / arbitrary code execution
- Dimension, nesting, and resource limits
- Untrusted labels, glyphs, metadata, imported receipts treated as data
- Clear errors; no silent degradation of formal status

## 9. Accessibility & Usability

Keyboard navigation, focus states, screen-reader labels, reduced-motion, non-color status cues, readable math notation, responsive layouts, copyable exact values, two explanation levels (technical + plain language that does not change meaning).

## 10. Documentation Deliverables

See the Master Build Assignment §14. All required docs will be created or updated on this branch before any claim of completion.

---

This document will be expanded with concrete module boundaries, data-flow diagrams, and schema references as implementation proceeds.
