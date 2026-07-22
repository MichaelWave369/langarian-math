# Changelog

All notable changes to the Langarian Math reference kernel and Workbench are recorded here.

## [0.3.0-dev] — 2026-07-22 (branch k3/langarian-workbench-v0.3)

### Added
- Phase Zero full repository + mathematical audit (`docs/SWARM_AUDIT_REPORT.md`)
- Master Architecture document for Workbench v0.3
- WEB_KERNEL_ADR (provisional hybrid TypeScript conformance + optional Pyodide)
- Numerical Policy, Claim Boundary Matrix, Receipt Schema vNEXT
- Mathematical Definitions and Operator Catalog
- First-class `Program` / multi-step calculation model
- Safe DSL (`dsl:v0.3.0`) with parser, resource bounds, and no-eval guarantee
- Deterministic Program executor that emits full receipts and lineage
- Property-based tests (Hypothesis) for phase invariance, similarity, hashes, zero conventions
- DSL + executor unit tests
- `langarian program` CLI command
- Example `examples/basic_369.lang`
- Security Threat Model foundation
- KERNEL_VERSION reconciled to `langarian-python-ref-v0.2.0`

### Changed
- Package version → `0.3.0-dev`
- ROADMAP updated to reflect Workbench status

### Notes
- Existing operator semantics and receipt behavior for single operations remain unchanged.
- Experimental material stays quarantined.
- Browser Workbench UI, visualizations, and TypeScript conformance port are next.

## [0.1.3] — prior main

Finite complex reference kernel with receipts, Proof Gate, and static React landing page.
