# Numerical Policy — Langarian Math Workbench v0.3

Normative policy for kernel arithmetic, implemented in
`src/langarian/state.py`, `src/langarian/metrics.py`, and
`src/langarian/limits.py` (f00bd61, extended for deep-subnormal
resonance/similarity at 6251578, red-team R4); binding on the TypeScript
port via SPEC §4 and the conformance fixtures. Metric version:
`metric:v0.3.scale_safe_normalized_complex_similarity`.

## 1. Representation

- States are `complex128` vectors (IEEE-754 doubles); Python floats and JS
  numbers are both binary64, so arithmetic ports 1:1.
- All state components must be **finite** at construction (typed `ValueError`
  otherwise). There is no path by which a NaN/inf component enters a state.

## 2. Scale-safe metric (metric:v0.3)

**Problem fixed** (Lane B item 4; Lane H H-4): naive
`|⟨a,b⟩|²/(‖a‖²‖b‖²)` underflows/overflows at extreme magnitudes —
e.g. `‖[5e-162]‖²` underflows to 0 (self-similarity computed as 0.0 via a
silent NaN clamp) and `‖[1e200]‖` overflows to `inf`, producing wrong
formal-looking results reported as PASS.

**Policy** (`metrics.py:56-77`):

1. Pad to common dimension.
2. Compute `maxabs = max |component|` for each side; classify zero vectors
   **before any scaling**.
3. Apply zero conventions (§3).
4. Scale each vector into the unit ball (`v / maxabs`), then compute the inner
   product and squared norms on the scaled vectors. Squared norms are now in
   `[1, dim]`, so neither underflow nor overflow is possible for finite input.
5. If a scaled squared norm is non-positive or the final value is non-finite,
   raise `MetricError` — **never silently clamp NaN/inf**.
6. Clamp the final ratio to `[0, 1]` only to absorb floating-point overshoot
   around the Cauchy–Schwarz bound.

The value is mathematically unchanged in exact arithmetic. The same scaling is
applied to resonance (`state.py:119-131`): `resonance([1e200]) = 1e200`
(finite) instead of `inf` (fixture case `large_resonance_finite`).

## 3. Zero conventions

- `C(0, 0) = 1`; `C(0, x) = 0` for nonzero `x`.
- Zero-vector phase = `0.0`.
- These are **conventions** (similarity is genuinely undefined at 0), stated
  for totality and predictable receipts. Since v0.3 they hold at **all finite
  magnitudes**, including subnormal vectors — zero detection uses
  `maxabs == 0.0`, which is exact: underflowed-but-nonzero vectors have
  `maxabs > 0` and take the scaled branch, so the conventions no longer
  invert.

## 4. `-0.0`, NaN, and infinity

- **`-0.0`:** numerically equal to `0.0`; canonicalization normalizes it to
  `0.0` (SPEC §3.10), so equal vectors hash identically. Fixes the v0.2
  hash-splitting finding (Lane B item 15; Lane H P6).
- **NaN / ±inf:**
  - Rejected in state vectors at construction (`ValueError`).
  - Rejected in operator parameters (`angle_radians`, `attenuation`, `cost`,
    `phi_scale` exponent) with typed errors before any computation.
  - Rejected in metadata values with a typed error; never serialized
    (the canonical JSON contract emits strict JSON only — no `NaN`/`Infinity`
    tokens).
  - A non-finite *intermediate* in a metric raises `MetricError`; the operator
    path surfaces this as a typed failure, never a clamped receipt value.

## 5. Magnitude limits

- No explicit magnitude cap on state components: any finite binary64 is
  constructible, and the scale-safe metric/norm keep computations finite.
- Conformance coverage (`fixtures/conformance/edge_cases.json`): `1e-200`,
  `5e-162` (subnormal), `1e200`, cross-dimension, and both zero-convention
  cases at extreme magnitudes. SPEC §3.8's adversarial-float list is satisfied
  by these plus the operator fixtures; `1e300`-class inputs are out of the
  tested range and carry no guarantees beyond finiteness of the construction
  checks.
- Resource (not magnitude) caps: `MAX_DIM=64`, `MAX_STATES=32`,
  `MAX_PHI_SCALE_POWER=64` (`φ^64 ≈ 2.4e13`, comfortably finite), metadata
  byte cap 4096 — see `src/langarian/limits.py`.

## 6. Tolerances (absolute, and honestly labeled)

| Check | Tolerance | Type |
|---|---|---|
| I5 `phase_norm_preservation` (emitted name `I5.phase_equivariance`) | `1e-9` | **Absolute** |
| I3 `accounted_change` decrease threshold | `1e-12` | **Absolute** |
| TS↔Python conformance (vectors/metrics) | `1e-12` | **Absolute** |
| `system_coherence` zero-weight-sum detection | `math.isclose` default | Relative+absolute |

**Documented limitation** (Lane B item 14): kernel tolerances are absolute and
therefore mis-scaled for vectors with ‖v‖ far from 1. I5 compares resonances,
so a 1e-9 absolute tolerance is tighter than floating-point noise for large
states and looser for tiny ones. This is accepted for v0.3 (phase-rotation
norm preservation is near-exact in practice; the tested range spans
`1e±200`); relative-tolerance invariants are future-lane material.

## 7. Canonical JSON float formatting (hash domain)

Per SPEC §3.10 and `docs/RECEIPT_SCHEMA_vNEXT.md` §3: sorted keys,
`separators=(',',':')`, `ensure_ascii=False`, shared `default=str`;
**CPython shortest-repr float semantics** — integral floats keep `.0`,
exponent form `e±NN` with zero-padded two-digit exponent, CPython notation
boundaries. Non-finite floats are never emitted. The TypeScript port must
reproduce these bytes exactly; hash mismatches are build failures.

## 8. Warnings policy

Kernel metric paths are written to avoid emitting `RuntimeWarning` (the v0.2
similarity emitted `invalid value encountered in scalar divide` under
underflow). The scale-safe implementation has no divide-by-zero path: zero
vectors branch before scaling, and scaled norms are ≥ 1. Tests
(`tests/test_hardening.py`, `tests/test_metrics.py`) exercise the extreme
magnitudes directly.

## 9. Determinism

- `state_hash` and receipt `content_hash` are deterministic for identical
  inputs on a given platform (same float bit patterns → same bytes → same
  SHA-256).
- Cross-platform/cross-language determinism is the conformance contract:
  values within `1e-12`, hashes byte-exact; any mismatch fails the build
  rather than passing silently.
