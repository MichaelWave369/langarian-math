# Numerical Policy — Langarian Math Workbench v0.3

**Status:** Active (2026-07-22)  
**Applies to:** Python reference kernel and any conformance port

## 1. Floating-Point Representation
- Internal state vectors: `numpy.complex128` (IEEE 754 double precision complex).
- All public metrics and invariants that return scalars use Python `float` (double).
- Comparisons use absolute tolerance `1e-9` for resonance / phase-equivariance unless a tighter contract is declared on a specific invariant.
- Coherence / similarity values are clamped to the closed interval `[0.0, 1.0]` after computation.

## 2. Complex Number Encoding (Canonical Serialization)
For hashes and receipts, every complex value is emitted as a two-element list of floats:
```json
[real, imag]
```
- `real` and `imag` are ordinary IEEE 754 doubles converted via `float(np.real(z))` / `float(np.imag(z))`.
- No polar form is used in the canonical payload.
- No special encoding for exact zeros beyond ordinary float zero.

## 3. Canonical JSON Rules (for state_hash and receipt_id)
- `json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)`
- Keys ordered lexicographically.
- No whitespace variation.
- Timestamps are *excluded* from the mathematical identity hash of an operation body when comparing pure computational equivalence (event identity vs mathematical identity). Current receipts include timestamp; future schema will separate them cleanly.
- Optional fields that are `None` are omitted or normalized consistently.

## 4. Zero-Vector Conventions
- Resonance of the zero vector is exactly `0.0`.
- Phase of the zero vector is defined as `0.0` (convention for totality and receipt predictability).
- `normalized_complex_similarity(0, 0) = 1.0`
- `normalized_complex_similarity(0, x) = 0.0` for any nonzero x (and symmetrically).
- These conventions are part of the formal kernel contract and are tested.

## 5. Dimension Policy
- `pad_to_common_dim` is the current default for binary operators that require equal length (zero-pad the shorter vector).
- Future stable operators may declare stricter policies (reject, truncate, or explicit padding mode) via parameters; the policy must appear in the receipt parameters and assumptions.
- Dimension < 1 is rejected at state construction.

## 6. NaN / Infinity Policy
- State construction raises `ValueError` on any non-finite real or imaginary part.
- Operators assume well-typed finite inputs; they do not attempt to “heal” NaNs.

## 7. Cross-Language / Conformance Tolerances
When a TypeScript (or other) mirror is used:
- Resonance / norm comparison: absolute tolerance `1e-9` (or relative `1e-12` for large magnitudes, whichever is larger).
- Similarity / coherence: absolute tolerance `1e-12` after clamping.
- Phase: absolute tolerance `1e-9` radians (after reduction mod 2π).
- Any divergence beyond tolerance produces a WARN receipt status and never upgrades epistemic tag.

## 8. Resource Bounds (Workbench)
- Maximum dimension for interactive construction: 256 (hard limit; larger requires explicit experimental flag).
- Maximum program length / nesting depth: documented in DSL_SPEC.
- These bounds exist to prevent denial-of-service via the expression language or imported programs; they are not mathematical claims.

## 9. Hash Determinism Guarantee
Under the same KERNEL_VERSION, METRIC_VERSION, canonical serialization rules, and identical mathematical inputs, the `state_hash` and `receipt_id` (excluding pure event timestamps) are bit-identical across runs of the reference kernel.

---
*This policy is the numerical constitution for all v0.3 receipts.*
