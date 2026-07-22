# Langarian Math Workbench v0.3 — Swarm Audit Report

**Branch:** `k3/langarian-workbench-v0.3`  
**Baseline SHA (main):** `6718bf07ddbb66cee4398d2c063ae7a9535bca22`  
**Audit date:** 2026-07-22  
**Orchestrator:** K3 Swarm (principal engineering + mathematical systems architect)

## Executive Summary of Baseline

The repository is a clean, disciplined finite-dimensional reference kernel (Python) plus a minimal static React landing page. The constitutional center (`src/langarian/`) is intact, correctly epistemic-tagged, and already emits operation receipts. No unearned theorem language appears in the core operators. Experimental Kimi v1 material is properly quarantined.

**Primary gap for v0.3:** The product must evolve from “reference kernel + informational site” into a **functioning, polished, claim-safe mathematical calculator and visual workbench**. This requires a program model, safe DSL, browser integration strategy, receipt ledger UI, visualizations, expanded tests, and full documentation suite — without diluting the formal kernel.

## Lane A — Repository Cartography

### File / Module Map
```
.
├── .github/
│   ├── ISSUE_TEMPLATE/ (bug, claim_boundary, feature, review)
│   └── workflows/
│       ├── pages.yml
│       └── tests.yml          # pytest only, Python 3.11
├── docs/
│   ├── GITHUB_PAGES.md
│   ├── Kimi_v1_Harvest_Review.md
│   ├── Langarian_Math_v0_2_1_Epistemic_Receipt_Patch.md
│   ├── PROOF_GATE.md
│   ├── RECEIPT_SCHEMA.md
│   ├── ROADMAP.md
│   ├── USAGE.md
│   └── command_line.md
├── examples/
│   ├── basic_369.yaml
│   └── phase_shift_cost.yaml
├── experimental/
│   └── kimi_v1_harvest/       # quarantined, not trunk
├── receipts/                  # example output location
├── src/langarian/
│   ├── __init__.py
│   ├── claims.py
│   ├── cli.py
│   ├── contracts.py
│   ├── dynamics.py            # UnitaryFlowDemo (research lane)
│   ├── epistemic.py
│   ├── glyphs.py              # stub
│   ├── metrics.py
│   ├── operators.py           # 5 core operators
│   ├── proof_gate.py
│   ├── receipts.py
│   ├── spaces.py              # FiniteComplexSpace helper
│   ├── state.py               # ResonantState
│   └── validator.py
├── tests/
│   ├── test_cli_receipts.py
│   ├── test_harvest.py
│   ├── test_invariants.py
│   ├── test_metrics.py
│   ├── test_operators.py
│   ├── test_proof_gate.py
│   └── test_state.py
├── web/                       # Vite + React 19 static landing only
│   ├── index.html
│   ├── package.json
│   ├── src/{App.jsx, main.jsx, styles.css}
│   └── vite.config.mjs
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── pyproject.toml
```

### Dependency Graph
- Runtime: `numpy`, `PyYAML`
- Dev: `pytest`
- Web: React 19, Vite 7 (no calculation logic)
- No transitive scientific stack beyond NumPy

### Runtime / CLI / Receipt Flow
1. User constructs `ResonantState` (or loads via YAML example).
2. Operator (`harmonic_sum` | `phase_shift` | `attenuated_phase_shift` | `phi_scale` | `bridge`) produces `OperationResult` / `BridgeResult` containing new state + `OperationReceipt`.
3. Receipt body is canonical-JSON hashed → `receipt_id`.
4. State history appends receipt_id.
5. CLI can `run`, `validate`, `explain` receipts.
6. Proof Gate filters claims by epistemic tag before formal contexts.

### Version Metadata Map (pre-reconciliation)
| Location                  | Value                                      |
|---------------------------|--------------------------------------------|
| pyproject.toml            | 0.1.3                                      |
| state.py KERNEL_VERSION   | langarian-python-ref-v0.1.1                |
| metrics.py METRIC_VERSION | metric:v0.2.normalized_complex_similarity  |
| README                    | v0.1.3 for Langarian Math v0.2 FKC + patch |
| web/package.json          | 0.1.0                                      |
| ROADMAP                   | speaks of v0.1.x / v0.2.x / v0.3 Visual    |

**Action taken:** KERNEL_VERSION and package version reconciled in this commit toward the v0.3 Workbench target while preserving mathematical identity of existing operators.

### Architectural Debt / Unfinished Surfaces
- No multi-step program / calculation chain model
- No safe expression language / DSL
- Web is informational only (no state builder, operator lab, ledger, visualizations)
- Receipt schema not yet a versioned public contract with full numerical policy
- Limited property-based and adversarial tests
- Glyphs and dynamics remain experimental stubs
- No Architecture Decision Record for browser kernel strategy
- Documentation incomplete for mathematician / developer / beginner / future-agent audiences

## Lane B — Mathematical Audit (Core Findings)

### State
- Finite complex vector, dtype complex128, finite-only enforcement.
- Resonance = Euclidean norm (correct).
- Phase = angle of sum (or max-component fallback); zero-vector convention = 0. Explicitly a convention, not a physical claim.
- Hash = SHA-256 of canonical payload (kernel_version + label + glyph + vector pairs + metadata + history). Deterministic under documented serialization.

### Similarity / Coherence
- `normalized_complex_similarity` = |⟨a|b⟩|² / (‖a‖²‖b‖²) clamped to [0,1].
- Zero conventions: C(0,0)=1, C(0,x)=0. Documented and intentional.
- `system_coherence` = weighted average of pairwise similarities. Correct for finite systems.

### Operators (all emit receipts + invariants)
- `harmonic_sum`: vector addition after pad-to-common-dim. No claim of direct-sum algebra.
- `phase_shift`: global unitary phase. Resonance preserved (I5).
- `attenuated_phase_shift`: scale * exp(iθ) + mandatory cost declaration. Accounted-change invariant.
- `phi_scale`: Φⁿ dilation + n·golden-angle. Pure computational.
- `bridge`: records transition candidate + coherence; explicitly not a category-theoretic morphism.

### Edge Cases Still Needing Stronger Contracts / Tests
- Explicit dimension policy (pad vs reject vs truncate) for all multi-state ops
- Massive dimension / memory limits
- NaN / Inf rejection (already present at construction)
- Hash stability under float normalization / complex encoding across languages
- Zero-vector propagation through every operator

**Verdict:** Core mathematics is sound for a finite reference kernel. No silent transformations. No unearned theorem language in trunk operators. Ready for safe extension under the constitutional rules.

## Lane C — Claims & Epistemic Audit (Preliminary)

Proof Gate correctly blocks MODEL / INTERPRETIVE / METAPHOR / OBSERVED / FAILED from formal contexts. Allowed: FORMAL, COMPUTED.

All current operator claims are tagged COMPUTED and describe exactly what the code does. Interpretation quarantine invariant (I8) exists.

**Risk surface for Workbench UI:** Visualizations, plain-language explanations, and example library must never promote a COMPUTED result into a theorem claim. Strong visual separation between formal ledger and interpretive layer is mandatory.

Full Claim Boundary Matrix will be produced in a subsequent commit.

## Recommended Immediate Order of Work (post-audit)
1. Version reconciliation + this audit report (done in this commit).
2. WEB_KERNEL_ADR.md — decide Python-in-browser vs TypeScript conformance port vs hybrid (local-first, GitHub Pages compatible).
3. Harden numerical policy, canonical serialization, and receipt schema vNEXT.
4. Expand property-based + adversarial tests (Hypothesis where useful).
5. Introduce Program / multi-step calculation model + safe DSL (parser → typed AST, no eval).
6. Browser integration + State Builder + Operator Laboratory + Result Inspector + Receipt Ledger.
7. Visualizations (complex plane, amplitude/phase, lineage graph, coherence matrix) with explicit mathematical definitions.
8. Full documentation suite + migration notes + CHANGELOG + updated ROADMAP.
9. CI expansion, accessibility, security threat model, final gates.

## Status
Phase Zero complete. Baseline recorded. No code behavior changed. Experimental material remains quarantined. Ready for governed extension.

**Ledger above ego.**
