# Roadmap

Langarian Math grows by receipts, not hype.

## Current trunk

**v0.3.0-rc.1 — Math Workbench release candidate**

Version strings are declared once in `src/langarian/version.py` (`VERSION_MANIFEST`); the mathematical model remains the bounded finite complex model (`langarian-finite-complex-model-v0.2.1`).

Shipped in this trunk:

- Finite complex vector states with resource limits (`MAX_DIM=64`, `MAX_STATES=32`, `MAX_PROGRAM_STEPS=64`, and friends) and immutable vectors/metadata
- Scale-safe normalized complex similarity (`metric:v0.3`) preserving the zero conventions `C(0,0)=1`, `C(0,x)=0`
- Receipt-emitting operators with deterministic `content_hash` (timestamp excluded) plus `receipt_id` for event uniqueness
- Receipt validation at four distinct levels: schema shape, hash integrity, status consistency, schema-version allowlist (`receipt:v0.3`; older versions rejected)
- Invariant checks including `trace_inputs_recorded`; empty invariant lists collapse to FAIL
- Epistemic tags and Proof Gate with promoted-model-claim exclusion
- CLI receipt runner, validator, and explainer (`langarian run|validate|explain`)
- Deterministic conformance fixture generator (`python -m langarian.fixtures --out fixtures/conformance`, fixed clock `1970-01-01T00:00:00+00:00`)
- Public docs: usage, migration (v0.2 → v0.3 hash-domain change), receipt schema, proof gate, DSL spec, security threat model
- TypeScript kernel mirror in `web/src/kernel/` replaying Python conformance fixtures byte-exactly (hashes) and within `1e-12` (values) — 43 conformance tests
- DSL v0.3 text syntax compiling to the same AST as the JSON program format (`web/src/dsl/`)
- Receipt ledger UI with distinct actions: "Check shape", "Verify hash/status/version", "Recompute locally"
- Eight-module workbench UI (State Builder, Operator Lab, Program Builder, Result Inspector, Receipt Ledger, Proof Gate, Visualizations, Example Library) with exact-value tables
- Static public site stays local-first; no backend

## v0.3.x → v0.3.0 final — remaining polish

- Capped YAML example ingest or a structured error envelope (currently declared out of scope with a documented warning)
- GitHub-hosted CI runner execution recorded as release evidence (gates currently reproduced locally and by the independent red team)
- Independent real-browser UI pass (current UI coverage: 10 vitest smoke tests)
- Optional Pyodide reference playground (deferred by design, SPEC §1)

## Shipped earlier (kept for the record)

### v0.1.x — Kernel hardening

- Receipt validation CLI (`langarian validate`)
- Deterministic example receipts (via the v0.3 deterministic-clock fixture generator)
- Expanded property/boundary tests

### v0.2.x — CLI Receipt Runner

Target commands (now shipped; note the actual flag is `--receipts-dir`, not `--emit-receipt`):

```bash
langarian run examples/basic_369.yaml --receipts-dir receipts
langarian validate receipts/basic_369_bridge.json
langarian explain receipts/basic_369_bridge.json
```

- First-class receipt validation
- Human-readable receipt explanations
- YAML examples, including a declared-cost example

## Future research lanes

These are exploratory directions, not commitments, and none are trunk claims:

- Stronger finite-space operator families
- Direct-sum / tensor product experiments
- Optional proof-kernel experiments
- Performance layer experiments
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
