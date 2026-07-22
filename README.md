# Langarian Math

[![tests](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml)
[![pages](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-cyan.svg)](LICENSE)
[![python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](pyproject.toml)

**Current development branch:** [`k3/langarian-workbench-v0.3`](https://github.com/MichaelWave369/langarian-math/tree/k3/langarian-workbench-v0.3)  
**Package:** `0.3.0-dev` — Langarian Math Workbench foundations  
**Kernel:** `langarian-python-ref-v0.2.0`

**Live site (still the v0.2 informational landing):** https://michaelwave369.github.io/langarian-math/

This repository contains a finite-dimensional, executable, test-first reference kernel for resonance-style symbolic state transformations with immutable operation receipts, plus the growing Workbench that turns the kernel into a usable mathematical calculator.

> Langarian Math grows by receipts, not hype.  
> Ledger above ego.

## What exists today

### Stable kernel
- Finite complex vector states (`ResonantState`)
- Resonance (norm), global phase estimate, normalized complex similarity / coherence
- Operators: `harmonic_sum`, `phase_shift`, `attenuated_phase_shift`, `phi_scale`, `bridge`
- Immutable operation receipts + deterministic hashing
- Invariant contracts (PASS / WARN / FAIL)
- Epistemic tags + Proof Gate
- CLI: `run`, `validate`, `explain`, **`program`** (DSL)

### Workbench foundations (v0.3-dev)
- Multi-step `Program` model with full lineage
- Safe DSL (`dsl:v0.3.0`) — parser → typed Program, no eval, resource bounds
- Deterministic executor that emits a receipt for every state-changing step
- Numerical policy, Claim Boundary Matrix, Operator Catalog, Mathematical Definitions
- Property-based tests and security threat model
- Architecture Decision Record for browser kernel strategy

### Still in progress for full Workbench v0.3
- Interactive browser calculator (State Builder, Operator Laboratory, Receipt Ledger, Proof Gate panel)
- Visualizations with explicit mathematical definitions
- TypeScript conformance port + fixtures
- Expanded example library and accessibility pass
- Final documentation suite and completion gates

## Install & test

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
pytest
```

## Quick DSL example

```bash
langarian program examples/basic_369.lang --receipts-dir receipts
```

or

```bash
python -m langarian.cli program examples/basic_369.lang
```

## Core boundary

A poetic or interpretive statement may ride along with a computation, but it cannot be used as proof. The formal kernel only promotes typed states, computed metrics, invariant checks, and receipts.

## Key documents (Workbench branch)

- `docs/SWARM_AUDIT_REPORT.md`
- `docs/MASTER_ARCHITECTURE_v0.3.md`
- `docs/MATHEMATICAL_DEFINITIONS.md`
- `docs/OPERATOR_CATALOG.md`
- `docs/CLAIM_BOUNDARY_MATRIX.md`
- `docs/RECEIPT_SCHEMA_vNEXT.md`
- `docs/DSL_SPEC.md`
- `docs/NUMERICAL_POLICY.md`
- `docs/WEB_KERNEL_ADR.md`
- `docs/SECURITY_THREAT_MODEL.md`
- `docs/ROADMAP.md`

## License

MIT
