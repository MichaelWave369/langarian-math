# Claim Boundary Matrix — v0.3 update

Origin: Lane C claims/epistemic audit (`/mnt/agents/output/audit/Lane_C_claims_epistemic.md`),
updated at commit f00bd61 for v0.3 dispositions. Rule set: bounded language;
no unearned theorem/proof/canonical/physical claims; MODEL, INTERPRETIVE,
METAPHOR, OBSERVED, and FAILED content never certifies formal results;
uncertainty is recorded in ledgers/audits, not smoothed over. Invariant PASSes
are per-instance evidence, not proofs of universal propositions.

## 1. Substantive claims

| # | Statement | Location | Tag | Allowed uses | Forbidden uses | v0.3 disposition |
|---|---|---|---|---|---|---|
| 1 | "small formal kernel candidate … does not claim to be physics, psychology, therapy, or a completed mathematical theory" | `README.md:12` | Hedged disclaimer | Positioning, onboarding | None — model boundary statement | **Kept** |
| 2 | "Claim-Safe Formal Kernel Candidate" | `web/src/App.jsx` | Hedged ("Candidate") | Workbench header/subtitle | Dropping "Candidate"; physics/therapy adjectives | **Kept** (web is now the shipped v0.3 workbench at 5dedaf1) |
| 3 | phase_shift claim text | `src/langarian/operators.py:160` | COMPUTED | Per-operation receipt claim, instance scope | Use as a general theorem from one receipt | **Resolved** — claim reworded to instance scope: "…preserved resonance in this operation instance…" |
| 4 | I5 invariant name outran its check | `src/langarian/contracts.py:126-151` | Invariant ID | Internal check ID | Implying group-theoretic equivariance | **Resolved per SPEC §3.4** — v0.3 documentation name is `phase_norm_preservation` with docstring stating the per-instance scope; receipts keep the legacy emitted name `I5.phase_equivariance` as a compatibility alias (tests require it) |
| 5 | `promote_model_assumption()` re-tagged MODEL → COMPUTED (proof-eligible) | `src/langarian/proof_gate.py:40-50, 95-116` | Mechanism | Bounded assumption recording with id + justification + `promoted_from` metadata | Silent trust laundering into proof chains | **Resolved (interim)** — `evaluate_claims`/`require_proof_eligible` now block any claim with `metadata.promoted_from == "MODEL"` lacking `formal_derivation_id`; tested (`tests/test_proof_gate.py`). A distinct non-proof-eligible ASSUMPTION tag remains a documented **future** addition (SPEC §3.7) |
| 6 | Phi Scale UI card "z' = Φⁿz" understated the operator | `web/src/App.jsx` (v0.1 landing page) | Untagged UI formula | n/a | Claiming phi_scale is pure dilation | **Resolved** — the v0.1 static card is gone; the shipped Operator Lab presents operator math from kernel truth (`docs/OPERATOR_CATALOG.md` §1.4: `z' = φⁿ·e^{i·n·2π/φ}·z`) with tagged claims (Lane F §2.3.5) |
| 7 | `UnitaryFlowDemo` "not called a symplectic theorem" | `src/langarian/dynamics.py` | Demo, explicitly negated | U(1) scalar-rotation demo, invariant test seed | Symplectic/Hamiltonian/physics framing | **Kept** — classified EXPERIMENTAL in `docs/OPERATOR_CATALOG.md` §3 |
| 8 | `FiniteComplexSpace` "not a proof of infinite-dimensional Hilbert, RKHS, or physics claims" | `src/langarian/spaces.py` | Explicitly negated | Cⁿ helper | Hilbert/RKHS/physics claims | **Kept** |
| 9 | `GlyphDictionary` "not proof of RKHS completeness or symbolic truth" | `src/langarian/glyphs.py` | Explicitly negated stub | Label lookup with similarity score | RKHS/frame/dictionary-completeness claims | **Kept** — CANDIDATE stub, not exported |
| 10 | Bridge "typed transition/path, not a category-theoretic proof" | `src/langarian/operators.py:267-294` | COMPUTED + disclaimer | Transition candidate with coherence/cost/invariants | Naturality, functoriality, category semantics | **Kept** |
| 11 | FORMAL tag = "established by an invariant, contract, or proof obligation" | `src/langarian/epistemic.py:15-27` | System definition | Per the constitution | Treating one invariant PASS as a discharged universal | **Kept with caveat** — `docs/MATHEMATICAL_DEFINITIONS.md` §7-§8 state invariant evidence is instance-scoped |
| 12 | Proof Gate "does not prove mathematics by itself" | `docs/PROOF_GATE.md`; `src/langarian/proof_gate.py:1-4` | Self-limiting | Tag filter description | Presenting gate PASS as mathematical verification | **Kept** |
| 13 | Kimi v1 downgrades ("Complete v1.0", "canonical metric", naturality, RKHS glyphs, symplectic theorem) | `docs/Kimi_v1_Harvest_Review.md`; `experimental/kimi_v1_harvest/README.md` | Quarantined | Historical record | Re-importing v1.0 language into trunk | **Kept (REJECTED)** — re-entry only via the 5-point promotion rule |
| 14 | Numerology-flavored example labels (`sigma_3/6/9`, glyph "creative") | `examples/*.yaml` | Untagged labels | Decorative metadata flowing into receipts as opaque strings | Interpreting labels as claims | **Kept** — labels are typed as opaque strings and never enter `claims[]`; classified INTERPRETIVE in the operator catalog |
| 15 | UI operator-card notes ("Pure rotation preserves resonance.") | `web/src/App.jsx` (v0.1) → `web/src/ui/modules/OperatorLab.jsx` (v0.3) | Untagged UI statements | UI summaries backed by I5 + tests | Flat universal claims without receipts/tests | **Resolved** — the v0.3 Operator Lab states formulas and assumptions explicitly, instance-scoped, alongside per-operation receipts and invariant results (Lane F §2.4) |

## 2. Version-drift items (Lane C D1–D6) — v0.3 outcomes

| # | Drift | v0.3 outcome |
|---|---|---|
| D1 | `KERNEL_VERSION = "langarian-python-ref-v0.1.1"` vs package `0.1.3` (receipt identity drift) | **Resolved** — single-source manifest `src/langarian/version.py`; `kernel_version = "langarian-python-ref-v0.3.0"`; `state.py` re-exports from it. Hash-domain change documented in `docs/MIGRATION_v0.2_to_v0.3.md` |
| D2 | ROADMAP "Current trunk v0.1.2" | **Resolved** — `docs/ROADMAP.md` refreshed to the v0.3.0-rc.1 trunk (commit 4df3bb1; web-surface items moved to shipped at 5dedaf1) |
| D3 | ROADMAP target command `--emit-receipt` (never implemented; actual flag `--receipts-dir`) | **Resolved** — flag fixed in ROADMAP at 4df3bb1; CLI reference of record is `docs/USAGE.md` and `docs/DEVELOPER_GUIDE.md` |
| D4 | README references nonexistent `docs/CLI.md` | **Resolved** — README link fixed at 0466e70; `docs/command_line.md` remains a stub redirect to `docs/USAGE.md` |
| D5 | Multiple version namespaces unexplained in one place | **Resolved** — manifest table in `docs/MASTER_ARCHITECTURE_v0.3.md` §7 and old→new mapping in `docs/MIGRATION_v0.2_to_v0.3.md` |
| D6 | Invariant numbering gap I5 → I8 (no I6/I7) | **Documented** — historical gap, no I6/I7 ever existed; kept for receipt compatibility (`docs/MATHEMATICAL_DEFINITIONS.md` §7) |

## 3. Negative results (Lane C, re-confirmed for the doc surface)

- No unhedged `theorem` / `naturality` / `symplectic` / `Hilbert` / `RKHS` /
  `canonical metric` / physics-therapy language in `src/`, `docs/`, `web/src/`,
  `examples/`, `tests/` at audit time; every occurrence carries an explicit
  negation or downgrade. v0.3 docs in this release follow the same rule.
- No tests assert interpretive/metaphor content.

## 4. Standing rules for new claims

1. Every claim emitted by an operator is tagged; receipts carry tags; UI copies
   carry tags when displaying claim text.
2. Universal-quantified statements require an analytic derivation (→ FORMAL
   lane with a proof-obligation mechanism) or must be reworded to instance
   scope.
3. Cost values and bridge costs are caller-declared, unverified annotations;
   any UI/DSL surface must say so (SPEC §5).
4. Shape-only receipt validation is never labeled "verified"
   (`src/langarian/validation.py`; `docs/RECEIPT_SCHEMA_vNEXT.md`).
5. Promoted model claims display distinctly and stay out of proof contexts
   unless a `formal_derivation_id` is present.
