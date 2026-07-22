# Operator Catalog — Langarian Math Workbench v0.3

**Kernel:** langarian-python-ref-v0.2.0  
**Classification key:** STABLE | CANDIDATE | EXPERIMENTAL | INTERPRETIVE | REJECTED

## STABLE Operators (trunk)

### harmonic_sum
- **Signature:** `(ResonantState, ResonantState) → OperationResult`
- **Definition:** Component-wise addition after zero-pad to common dimension.
- **Domain / Codomain:** Finite complex states → finite complex state.
- **Invariants:** I1, I2, I3 (with declared recomposition note), I4, I8.
- **Epistemic class:** COMPUTED
- **Forbidden claims:** “direct sum”, “coproduct”, “category morphism”.
- **Edge cases:** Different dimensions (pad), zero vectors, large magnitudes.
- **Receipt fields:** operator, input_hashes, output_hash, parameters (glyph), coherence_before/after, invariants, claims.

### phase_shift
- **Signature:** `(ResonantState, angle_radians: float) → OperationResult`
- **Definition:** Global multiplication by e^{iθ}.
- **Invariants:** I1, I2, I5 (resonance preservation), I4, I8.
- **Epistemic class:** COMPUTED
- **Forbidden claims:** Physical phase conservation, representation theory of U(1) beyond the scalar action.
- **Edge cases:** θ mod 2π, zero state (still defined).

### attenuated_phase_shift
- **Signature:** `(ResonantState, angle, attenuation ≥ 0, cost_label) → OperationResult`
- **Definition:** α · e^{iθ} · v. Cost label mandatory when resonance decreases.
- **Invariants:** I1–I4, I8; I3 fails without cost.
- **Epistemic class:** COMPUTED
- **Forbidden claims:** Thermodynamic or information-theoretic cost interpretations unless explicitly modeled and tagged MODEL.

### phi_scale
- **Signature:** `(ResonantState, n: int = 1) → OperationResult`
- **Definition:** Φⁿ dilation + n · golden-angle rotation.
- **Invariants:** I1–I4, I8.
- **Epistemic class:** COMPUTED
- **Forbidden claims:** Special formal status of Φ or golden angle beyond the arithmetic used.

### bridge
- **Signature:** `(ResonantState, ResonantState, cost=0) → BridgeResult`
- **Definition:** Records transition candidate + coherence. Does not alter states.
- **Invariants:** I1, I2, I4, I8.
- **Epistemic class:** COMPUTED (with explicit disclaimer)
- **Forbidden claims:** Natural transformation, functor, categorical morphism, path integral.

## CANDIDATE Operators (under consideration for later promotion)

- scalar_multiply
- normalize (to unit resonance)
- complex_conjugate
- componentwise_product
- weighted_harmonic_sum
- inner_product (returning scalar + receipt)
- euclidean_distance / projective_distance
- finite matrix transform / unitary matrix transform (with explicit matrix receipt)
- operator composition (program-level)

Each must receive formal definition, edge cases, invariants, tests, and a Claim Boundary Matrix row before STABLE promotion.

## EXPERIMENTAL (quarantined)

- UnitaryFlowDemo (dynamics.py) — norm-preserving rotation demonstration only.
- FiniteComplexSpace helpers, glyph nearest-score.
- Any direct-sum, tensor/Kronecker, Gram–Schmidt, eigen-analysis, Hamiltonian toy models.

These may not appear in the default Workbench operator laboratory without an EXPERIMENTAL badge and explicit user opt-in.

## REJECTED (for now)

- Any operator that would silently alter epistemic status.
- Operators whose only justification is “it looks like sacred geometry.”

---
*Catalog is the gate. Promotion requires receipts and tests.*
