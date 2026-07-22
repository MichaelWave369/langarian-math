# Mathematical Definitions — Langarian Math Reference Kernel

**Kernel version:** langarian-python-ref-v0.2.0  
**Status:** Authoritative for the finite-dimensional implementation  
**Language rule:** All statements below are definitions or computational contracts of the reference implementation. They are not theorems of infinite-dimensional analysis, physics, or category theory unless explicitly promoted later with full derivation.

## 1. ResonantState

A *ResonantState* is a pair `(v, meta)` where:

- `v ∈ ℂⁿ` for some finite `n ≥ 1` (stored as `numpy.complex128`),
- all components of `v` are finite,
- `meta` may contain optional `glyph: str | None`, `label: str | None`, `metadata: dict`, and an immutable `history` of receipt identifiers.

The formal object is the vector `v`. Derived quantities are functions of `v`.

## 2. Resonance

```
resonance(s) ≔ ‖v‖₂ = √(∑ |vᵢ|²)
```

Exact Euclidean norm. Zero vector has resonance 0.

## 3. Global Phase Estimate (Convention)

```
phase(s) ≔
  0                                           if resonance(s) = 0
  arg(∑ vᵢ) mod 2π                            if ∑ vᵢ ≠ 0
  arg(v_k) mod 2π where k = argmax |vᵢ|       otherwise
```

This is a convenient global phase *estimate* for receipts and visualization. It is not claimed to be the unique or physically meaningful phase of a multi-component state.

## 4. Normalized Complex Similarity

For two states a, b (after zero-padding to common dimension):

```
C(a, b) ≔
  1                                           if ‖a‖ = ‖b‖ = 0
  0                                           if exactly one of ‖a‖, ‖b‖ is 0
  |⟨a, b⟩|² / (‖a‖² ‖b‖²)   clamped to [0, 1]   otherwise
```

where `⟨a, b⟩ = a† b` (NumPy `vdot`). The value is a real number in [0, 1]. It is invariant under global phase of either argument and under simultaneous nonzero scaling of both arguments (projective).

## 5. System Coherence

For a finite collection of states S = {s₁ … sₘ} and optional weight matrix W:

```
system_coherence(S, W) ≔ (∑ᵢⱼ Wᵢⱼ · C(sᵢ, sⱼ)) / (∑ᵢⱼ Wᵢⱼ)
```

Default W is the all-ones matrix. Requires m ≥ 1 and total weight ≠ 0.

## 6. Core Operators (computational definitions)

### harmonic_sum(a, b)
```
v_out = pad(a) + pad(b)
```
Receipt records input hashes, output hash, coherence before/after, and standard invariants.

### phase_shift(s, θ)
```
v_out = v · exp(i θ)
```
Resonance is preserved up to floating-point tolerance (contract I5).

### attenuated_phase_shift(s, θ, α, cost_label)
```
v_out = α · v · exp(i θ)     (α ≥ 0)
```
If resonance decreases, a non-empty `cost_label` must be supplied or the receipt status is FAIL.

### phi_scale(s, n)
```
Φ = (1 + √5)/2
v_out = Φⁿ · v · exp(i · n · (2π / Φ))
```
Pure computational dilation + golden-angle rotation.

### bridge(source, target, cost=0)
Records a typed transition candidate. Coherence = C(source, target). No algebraic morphism claim.

## 7. Invariants (contracts)

- I1 well_typed_state
- I2 coherence_bound ∈ [0, 1]
- I3 accounted_change (decreases require declared cost)
- I4 trace_preservation (input hashes recorded)
- I5 phase_equivariance (pure phase preserves resonance)
- I8 interpretation_quarantine (no INTERPRETIVE/METAPHOR/OBSERVED as formal proof inputs)

Exact status combination: any FAIL → FAIL; else any WARN → WARN; else PASS.

## 8. What is explicitly *not* claimed

- Infinite-dimensional Hilbert space structure
- Symplectic / Hamiltonian geometry
- Category-theoretic naturality of bridge
- Physical conservation laws
- Psychological or therapeutic models
- That Φ or 3-6-9 confer special formal status beyond the arithmetic used

These may appear in INTERPRETIVE or EXPERIMENTAL layers only.

---
*Definitions are the ground. Everything else is interpretation.*
