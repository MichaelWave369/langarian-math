# Mathematical Definitions — Langarian Math Workbench v0.3

Scope: the finite-dimensional model implemented by the Python reference kernel
at commit f00bd61 (`src/langarian/`). Model version
`langarian-finite-complex-model-v0.2.1`; metric version
`metric:v0.3.scale_safe_normalized_complex_similarity`.

Language policy: standard mathematical terms below are used only in their
standard, verifiable sense (norm, inner product, Cauchy–Schwarz). Everything
labeled *convention* is a deliberate modeling choice, not a mathematical
requirement. Nothing here is a theorem about physics, infinite-dimensional
spaces, RKHS, symplectic geometry, or category theory, and no single
computation certifies a universal proposition.

## 1. States

**ResonantState** (`src/langarian/state.py`): a typed finite-dimensional state
is a vector `v ∈ C^n`, `1 ≤ n ≤ MAX_DIM = 64`, with finite real and imaginary
parts, plus optional `glyph`, `label` (opaque strings), `metadata` (JSON-safe
mapping), and `history` (tuple of receipt ids).

- The vector is the formal object; resonance, phase, and coherence are derived
  functions.
- Immutability: construction defensively copies and marks the array read-only.
- `dim == 0` is not constructible (typed `ValueError`).

**Padding convention** (`pad_to_common_dim`, `state.py:189-201`): to compare or
add states of different dimensions, the shorter vector is embedded in the
leading coordinates of the larger space and zero-padded. Zero blocks contribute
nothing to norms or inner products, so padded values equal the embedded values.
This is a convention (a choice of embedding), stated for reproducibility.

## 2. Resonance

`resonance(v) = ‖v‖₂` — the Euclidean (ℓ²) norm. Standard definition.

Implementation (`state.py:119-131`) computes it scale-safely: divide by the max
component magnitude, take the norm, multiply back. Identical value in exact
arithmetic; avoids overflow to `inf` and underflow to 0 for finite extreme
magnitudes. See `docs/NUMERICAL_POLICY.md`.

## 3. Phase

`phase(v)` is a **convention**, not an invariant of the projective class
(`state.py:134-149`):

1. If `resonance(v) == 0`, phase is defined as `0.0` (convention, for totality
   and predictable receipts).
2. Else let `s = Σᵢ vᵢ`. If `|s| > 0`, phase = `arg(s)` floor-mod `2π`.
3. Else (exact cancellation), phase = `arg(vₖ)` floor-mod `2π`, where `k` is
   the index of the dominant-magnitude component (`argmax |vᵢ|`).

Bounded description: a deterministic, rotation-equivariant phase statistic of
the chosen representative. Exact-zero branch conditions are correct because the
zeros involved arise exactly; near-cancelling sums take the sum branch on what
may be floating-point noise (documented limitation, Lane B item 3).

## 4. Normalized complex similarity (coherence)

`normalized_complex_similarity(a, b)` (`metrics.py:36-77`):

```
C(a, b) = |⟨a, b⟩|² / (‖a‖² · ‖b‖²),   ⟨a, b⟩ = vdot(a, b)
```

- Standard Hermitian inner product (conjugate-linear in the first argument).
- Bounded in `[0, 1]` by the Cauchy–Schwarz inequality (standard result).
- Homogeneous of degree 0 in each argument: invariant under any nonzero complex
  rescaling — i.e., the standard projective (ray) similarity. This invariance
  is exercised by tests (`tests/test_metrics.py`, `tests/test_operators.py`).
- **Zero conventions** (conventions, not standard definitions — similarity is
  genuinely undefined at 0): `C(0, 0) = 1`, `C(0, x) = 0` for nonzero `x`.
- **Scale safety (metric:v0.3):** each vector is normalized by its max
  component magnitude before the inner product; the zero-vector branch is
  handled before scaling. Conventions and the [0,1] bound now hold at all
  finite magnitudes, including subnormals (fixes Lane B item 4 / Lane H H-4:
  underflow previously inverted both zero conventions and NaN was silently
  clamped to 0.0).
- A non-finite or non-positive scaled-norm intermediate raises `MetricError`;
  nothing is silently clamped.

## 5. System coherence

`system_coherence(states, weights=None)` (`metrics.py:80-117`): the weighted
average of pairwise `C(states[i], states[j])` over all `(i, j)` pairs.

- **Convention:** the diagonal (self-similarities, each 1 by the zero
  convention) **is included** in the average. Deliberate averaging choice,
  documented in the docstring.
- Weights must be finite and non-negative (negative weights could push the
  result outside [0, 1] and are rejected with a typed error; v0.3 hardening).
- `1 ≤ len(states) ≤ MAX_STATES = 32`; empty input and zero-sum weights are
  typed errors.

## 6. Constants

- `PHI = (1 + √5)/2` — the golden ratio (standard).
- `GOLDEN_ANGLE = 2π/PHI ≈ 3.88322… rad (≈ 222.49°)` — the kernel's
  golden-angle increment. Naming note (Lane B item 8): the conventional
  phyllotaxis "golden angle" is `2π/φ² ≈ 137.508°`; `2π/φ` is its reflex
  counterpart (rotation by `−2π/φ²` mod 2π). The constant is used as a phase
  increment only; no botanical or physical claim is attached.

## 7. Invariants (per-instance checks)

From `src/langarian/contracts.py`. Every invariant result is evidence about
**one operation instance**, never a discharged proof obligation for a universal
claim.

| ID | Name (emitted) | Check | Honest scope |
|---|---|---|---|
| I1 | `well_typed_state` | dim ≥ 1 and all components finite | Redundant with the constructor; kept as receipt evidence |
| I2 | `coherence_bound` | `0 ≤ value ≤ 1` | Guard on recorded coherence values |
| I3 | `accounted_change` | if Δresonance or Δcoherence < −1e-12, a declared-cost string must be present | **Label-presence gate only.** It does not verify the adequacy, magnitude, or kind of the declared cost; increases are always free (attenuation > 1 passes without declaration) |
| I4 | `trace_inputs_recorded` | `input_hashes` non-empty AND (when recorded source hashes are provided) every input hash appears in them | Existence + match check against recorded source hashes; multi-hop lineage verification across a persisted ledger is a ledger-level check, not a kernel invariant. Legacy name `I4.trace_preservation` kept as a metadata alias only |
| I5 | `phase_equivariance` (emitted name; v0.3 documentation name `phase_norm_preservation`) | `|R_before − R_after| ≤ 1e-9` for a phase-rotation instance | Per-instance norm comparison with an absolute tolerance; **not** a group-theoretic equivariance property test (Lane C item 4). Tolerance is absolute and not scale-relative (documented limitation) |
| I8 | `interpretation_quarantine` | WARN if any claim tag ∈ {INTERPRETIVE, METAPHOR, OBSERVED} | Quarantine warning; blocked set intentionally differs from the Proof Gate's blocked set (which also blocks MODEL and FAILED) |

Status collapse (`src/langarian/epistemic.py:combine_statuses`): any FAIL →
FAIL; else any WARN → WARN; else PASS. **An empty invariant list collapses to
FAIL** — "no checks ran" never reads as "all checks passed" (v0.3 hardening).
A receipt with epistemic tag FAILED forces status FAIL.

Numbering note: I6 and I7 never existed; the I5→I8 gap is historical
(Lane C D6) and preserved for receipt compatibility.

## 8. Epistemic tags

`EpistemicTag` (`src/langarian/epistemic.py`): FORMAL, COMPUTED, MODEL,
INTERPRETIVE, METAPHOR, OBSERVED, FAILED. Only FORMAL and COMPUTED are
proof-eligible. FORMAL is defined as "established by an invariant, contract, or
proof obligation" — with the caveat (Lane C item 11) that invariant-derived
FORMAL evidence is instance-scoped. MODEL/INTERPRETIVE/METAPHOR/OBSERVED/FAILED
never certify formal results, and the Proof Gate additionally blocks claims
promoted from MODEL that lack an explicit `formal_derivation_id`
(`proof_gate.py:40-50`).

## 9. What the kernel does not claim

Per the claim boundary (`docs/CLAIM_BOUNDARY_MATRIX.md`): the kernel does not
claim to be physics, psychology, therapy, or a completed mathematical theory;
`bridge` is a typed transition record, not a category-theoretic naturality
result; `phi_scale` rotation uses the reflex golden angle increment named
above; receipts and invariant PASSes certify computation instances, not
universal propositions.
