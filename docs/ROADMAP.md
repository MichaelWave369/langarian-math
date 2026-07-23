# Roadmap

Langarian Math grows by receipts, not hype.

> **The ledger serves reality, not the author.**

## Current candidate

**v0.3.1-rc.1 — Three-Gate Governance Clarification**

This release changes public governance language and documentation without
changing the v0.3 mathematical kernel, receipt schema, metric, DSL, or
TypeScript conformance contract.

Version strings are declared once in `src/langarian/version.py`
(`VERSION_MANIFEST`). The mathematical model remains the bounded finite complex
model (`langarian-finite-complex-model-v0.2.1`).

Added or clarified in v0.3.1:

- Public **Proof Gate** label renamed to **Formal Eligibility Gate**.
- Historical Python names remain for API compatibility.
- Three-gate research architecture documented and shown in the workbench:
  - Syntax / Integrity Gate
  - Formal Eligibility Gate
  - Reality Gate
- Formal Eligibility Gate PASS explicitly means “eligible for formal review,”
  not “proved.”
- Formal validity explicitly does not imply empirical or physical validity.
- Future Reality Gate evidence framework documented without claiming current
  implementation or passage.
- Governing maxim added: “The ledger serves reality, not the author.”

## Current workbench foundation

- Finite complex vector states with resource limits (`MAX_DIM=64`,
  `MAX_STATES=32`, `MAX_PROGRAM_STEPS=64`, and related limits)
- Scale-safe normalized complex similarity (`metric:v0.3`)
- Receipt-emitting operators with deterministic `content_hash` plus event-level
  `receipt_id`
- Receipt validation at four distinct levels: schema, hash, status, and version
- Invariant checks including recorded input lineage; empty invariant lists fail
- Epistemic tags and formal-eligibility filtering with promoted-model exclusion
- CLI receipt runner, validator, and explainer
- Deterministic conformance fixture generator with a fixed clock
- TypeScript kernel mirror replaying committed Python fixtures with byte-exact
  hashes and `1e-12` value tolerance
- DSL v0.3 text syntax and JSON program format compiling to the same AST
- Receipt Ledger UI with distinct actions: Check shape, Verify
  hash/status/version, Recompute locally
- Eight-module workbench UI with exact-value tables
- Static local-first public site with no backend
- Native GitHub Actions coverage for Python 3.11/3.12, browser tests,
  TypeScript conformance, production build, and npm audit

## v0.3.x remaining polish

- Capped YAML example ingest or a structured error envelope
- Automated real-browser end-to-end tests in Chromium and at least one
  additional browser engine
- Deeper keyboard-navigation and screen-reader validation
- Reduced-motion preference testing
- Beginner onboarding and first-session comprehension testing
- Visual-density refinement without weakening the visible epistemic boundary
- Optional Pyodide reference playground, still deferred by design

## Reality Gate future lane

The Reality Gate is not a current feature claim. Research before implementation
must define:

- evidence record schema;
- literature-comparison receipts;
- preregistered prediction records;
- empirical datasets and uncertainty custody;
- independent reconstruction classes;
- independent replication classes;
- contradiction and retraction states;
- evidence expiration and re-review;
- conflicts-of-interest disclosure;
- dissent preservation.

A future UI must use an evidence matrix, not one green “truth” badge. See
`docs/REALITY_GATE.md`.

## Shipped earlier

### v0.3.0 — Workbench foundation

- Hardened Python authority kernel
- TypeScript conformance mirror
- Safe bounded DSL parser/executor
- Receipt ledger and validation layers
- Proof Gate implementation, now publicly named Formal Eligibility Gate
- Eight-module browser workbench
- Mathematical, numerical, security, migration, user, and developer docs

### v0.1.x — Kernel hardening

- Receipt validation CLI
- Deterministic example receipts
- Expanded property and boundary tests

### v0.2.x — CLI Receipt Runner

```bash
langarian run examples/basic_369.yaml --receipts-dir receipts
langarian validate receipts/basic_369_bridge.json
langarian explain receipts/basic_369_bridge.json
```

- First-class receipt validation
- Human-readable receipt explanations
- YAML examples, including declared-cost handling

## Future mathematical research lanes

These are exploratory directions, not commitments, and none are trunk claims:

- Stronger finite-space operator families
- Direct-sum and tensor-product experiments
- Optional proof-kernel experiments
- Performance-layer experiments
- Formal theorem lanes
- Richer glyph dictionaries
- Category-theoretic bridge semantics

## Promotion rule

A future idea can move into trunk only when it has:

1. Minimal implementation.
2. Tests.
3. Receipts.
4. Clear epistemic tags.
5. No unearned theorem language.
6. An explicit statement of which gate it has and has not passed.
