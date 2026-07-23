# Operator Catalog — Langarian Math Workbench v0.3

Stable surface at commit f00bd61: exactly five operators
(`src/langarian/operators.py`). SPEC §1: **no new stable operators in v0.3**;
proposed extensions are classified here (§3) but none are implemented in the
stable surface. All operators emit `OperationReceipt` records
(`docs/RECEIPT_SCHEMA_vNEXT.md`) tagged COMPUTED, with invariants per
`docs/MATHEMATICAL_DEFINITIONS.md` §7.

Claim language below is verbatim from the kernel where quoted. Claims certify
the operation instance only.

## 1. Stable operators

### 1.1 `harmonic_sum(a, b, *, glyph=None, label=None) -> OperationResult`

- **Math:** finite vector addition over the padded common dimension:
  `out = pad(a) + pad(b) ∈ C^max(dim a, dim b)` (standard vector addition;
  embedding convention in `docs/MATHEMATICAL_DEFINITIONS.md` §1).
- **Parameters:** optional `glyph`, `label` (output cosmetics only).
- **Coherence fields:** `coherence_before = C(a, b)` (pairwise similarity of
  inputs); `coherence_after = system_coherence([a, b, out])` (average pairwise
  similarity of the augmented 3-state system, diagonal included).
  **Documented caveat** (`operators.py:98-100`): before and after are
  *different statistics*; Δcoherence in I3 compares them anyway, so the
  operator always declares a blanket cost string.
- **Declared cost (always):** `"harmonic recomposition may reduce pairwise
  similarity"` — covers e.g. `harmonic_sum(a, −a)` → zero resonance.
- **Invariants emitted:** I1 (×3: a, b, out), I2 (×2), I3, I4, I8.
- **Claim (verbatim):** "Harmonic sum computed by finite complex vector
  addition." (COMPUTED)
- **Failure modes:** state-construction errors propagate (dim, finiteness,
  metadata). An extreme-magnitude sum (`|a+b|` overflowing binary64) produces
  non-finite components, which the output-state constructor rejects with a
  typed `ValueError` — no inf state can be emitted.

### 1.2 `phase_shift(state, angle_radians, *, label=None) -> OperationResult`

- **Math:** `out = e^{iθ} · v` — multiplication by a unit-modulus complex
  scalar (a U(1) global rotation; unit-modulus scalar multiplication is
  norm-preserving on Cⁿ by standard definition). Norm preservation is exact in
  exact arithmetic and checked per instance within 1e-9 by I5.
- **Parameters:** `angle_radians` must coerce to a **finite** float; NaN/±inf
  is a typed `ValueError`, non-numeric a `TypeError`
  (`operators.py:_finite_parameter`).
- **Coherence fields:** `coherence_before = C(v, v) = 1`;
  `coherence_after = C(v, out)` (1 up to floating point, by projective
  invariance).
- **Invariants emitted:** I1 (×2), I2 (×2), I5, I4, I8.
- **Claim (verbatim):** "Pure phase shift preserved resonance in this operation
  instance under the v0.2 finite vector model." (COMPUTED) — instance-scoped
  per Lane C item 3.
- **Failure modes:** non-finite/non-numeric angle (typed errors). Note: the
  zero state is a valid input (output is the zero state; I5 compares 0 to 0).

### 1.3 `attenuated_phase_shift(state, angle_radians, attenuation, *, cost_label, label=None) -> OperationResult`

- **Math:** `out = s · e^{iθ} · v`, so `Δresonance = (s − 1)·‖v‖` exactly for
  finite `s ≥ 0`.
- **Parameters:** `angle_radians` finite float; `attenuation` finite float,
  `s < 0` rejected with `ValueError`; `cost_label` is a caller-declared,
  **unverified** annotation string (required in practice when `s < 1` — I3
  fails otherwise). UI/DSL must present `cost` as caller-declared, not computed.
- **Amplification note (bounded wording):** `s > 1` is allowed and passes I3
  *without* any cost declaration, because I3 is a label-presence gate for
  decreases only — it is not a bound on amplification and does not verify cost
  adequacy. Increases are unaccounted by design of I3
  (`operators.py:173-178`).
- **Coherence fields:** `coherence_before = C(v, v) = 1`;
  `coherence_after = C(v, out) = 1` up to floating point (projective
  invariance; attenuation is a positive rescaling).
- **Invariants emitted:** I1 (×2), I2 (×2), I3, I4, I8.
- **Claim (verbatim):** "Attenuated phase shift computed with declared cost
  accounting." (COMPUTED)
- **Failure modes:** non-finite angle/attenuation (`ValueError`), negative
  attenuation (`ValueError`), missing cost label with `s < 1` (receipt FAIL via
  I3 — a normal, typed outcome, exercised in `tests/test_operators.py`). An
  extreme `s` that overflows the output vector is caught by output-state
  construction (typed `ValueError`).

### 1.4 `phi_scale(state, n=1, *, label=None) -> OperationResult`

- **Math:** `out = φⁿ · e^{i·n·GOLDEN_ANGLE} · v` — scalar dilation by the
  golden-ratio power plus a phase advance of `n` golden-angle increments
  (`GOLDEN_ANGLE = 2π/φ`, the reflex of the conventional `2π/φ²`; see
  `docs/MATHEMATICAL_DEFINITIONS.md` §6). Projective similarity `C(v, out)`
  is 1 up to floating point (exercised by tests).
- **Parameters:** `n` must be **integral** with `|n| ≤ MAX_PHI_SCALE_POWER =
  64`. Non-integral `n` → `TypeError` (v0.3 intentional hardening; v0.2
  silently truncated — see `docs/MIGRATION_v0.2_to_v0.3.md`); non-finite `n` →
  `ValueError`; `|n| > 64` → `LimitError`. No `OverflowError` can escape.
- **Negative n:** decreases resonance and `phi_scale` exposes no declared-cost
  channel, so such receipts FAIL I3 **by design** (`operators.py:222-229`).
- **Coherence fields:** `coherence_before = C(v, v) = 1`;
  `coherence_after = C(v, out)` ≈ 1.
- **Receipt parameters recorded:** `n`, `phi`, `golden_angle_radians`.
- **Invariants emitted:** I1 (×2), I2 (×2), I3, I4, I8.
- **Claim (verbatim):** "Phi scaling applied as scalar dilation plus
  golden-angle phase advance." (COMPUTED)
- **Failure modes:** typed parameter errors above; overflow of the scaled
  vector is caught by output-state construction (typed `ValueError`).

### 1.5 `bridge(source, target, *, cost=0.0, label=None) -> BridgeResult`

- **Math/semantics:** records a typed transition candidate from `source` to
  `target`: `coherence = C(source, target)`, caller-supplied `cost`, input
  hashes, output hash = `target.state_hash()`. The docstring and claim
  explicitly disclaim category-theoretic naturality
  (`operators.py:267-271`).
- **Parameters:** `cost` is a finite float, **caller-declared, unverified
  annotation** — it is not computed from, or checked against, coherence or any
  other quantity. UI/DSL must label it as such (SPEC §5).
- **Coherence fields:** `coherence_before = None` (schema-consistent: the
  field is nullable); `coherence_after = C(source, target)`.
- **Invariants emitted:** I1 (×2), I2, I4, I8. (No I3: there is no
  before/after delta for a transition record.)
- **Claim (verbatim):** "Bridge candidate recorded as a typed transition/path,
  not a category-theoretic proof." (COMPUTED)
- **Failure modes:** non-finite `cost` (`ValueError`); state-construction
  errors propagate.

## 2. Invariant profile summary

| Operator | I1 | I2 | I3 | I4 | I5 | I8 |
|---|---|---|---|---|---|---|
| harmonic_sum | ×3 | ×2 | ✓ (always-declared cost) | ✓ | — | ✓ |
| phase_shift | ×2 | ×2 | — | ✓ | ✓ | ✓ |
| attenuated_phase_shift | ×2 | ×2 | ✓ | ✓ | — | ✓ |
| phi_scale | ×2 | ×2 | ✓ (no cost channel) | ✓ | — | ✓ |
| bridge | ×2 | ×1 | — | ✓ | — | ✓ |

## 3. Proposed extensions — classification (docs only; not implemented)

Classification levels: **STABLE** (implemented, receipt-emitting, tested),
**CANDIDATE** (plausible future stable, needs implementation + tests +
receipts), **EXPERIMENTAL** (research lane, may exist as demo code, not
promoted), **INTERPRETIVE** (quarantined content, never proof-eligible),
**REJECTED** (formally downgraded; do not re-import into trunk).

| Proposal | Class | Basis |
|---|---|---|
| `harmonic_sum`, `phase_shift`, `attenuated_phase_shift`, `phi_scale`, `bridge` | **STABLE** | This catalog, §1 |
| Direct-sum / tensor composition operators | **CANDIDATE** | Named as future-lane material in the `harmonic_sum` docstring (`operators.py:84-88`); requires full catalog entry, fixtures, receipts before entering trunk |
| `GlyphDictionary.nearest_with_score` (finite-vector similarity lookup over labeled states) | **CANDIDATE** (stub exists) | `src/langarian/glyphs.py` — self-described stub, not exported from `__init__`; explicitly "not proof of RKHS completeness or symbolic truth" |
| `FiniteComplexSpace` helper-based future operators | **CANDIDATE** (infrastructure) | `src/langarian/spaces.py` — Cⁿ utility "not a proof of infinite-dimensional Hilbert, RKHS, or physics claims"; no operator uses it yet |
| `UnitaryFlowDemo` / `UnitaryFlowStep` (U(1) scalar-rotation trajectory demo) | **EXPERIMENTAL** | `src/langarian/dynamics.py` — self-described demo/research lane, "deliberately not called a symplectic theorem" (Lane C item 7); tested as a demo (`tests/test_harvest.py`), not promoted |
| ASSUMPTION epistemic tag (distinct from COMPUTED for promoted model assumptions) | **CANDIDATE** (documented future addition) | SPEC §3.7; `proof_gate.py:40-50` currently blocks promoted MODEL claims lacking `formal_derivation_id` as the interim mechanism |
| Kimi v1 harvest items: "Complete v1.0", "unique canonical metric", bridge naturality, "RKHS frame glyphs", "symplectic resonance conservation theorem" | **REJECTED** | `docs/Kimi_v1_Harvest_Review.md`; `experimental/kimi_v1_harvest/README.md`; re-entry only via the stated 5-point promotion rule (implementation, tests, receipts, no theorem language, tags) |
| Numerology-flavored example labels/glyphs (`sigma_3/6/9`, glyph "creative") | **INTERPRETIVE** (quarantined by construction) | `examples/basic_369.yaml` — opaque label strings only; they never enter `claims[]` (Lane C item 14) |

Promotion rule for any CANDIDATE → STABLE move: implementation in the Python
reference kernel, tests, deterministic conformance fixtures, receipts with
invariants, bounded claim wording reviewed against
`docs/CLAIM_BOUNDARY_MATRIX.md`. No operator enters the stable surface silently.
