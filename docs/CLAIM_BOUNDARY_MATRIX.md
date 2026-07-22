# Claim Boundary Matrix — Langarian Math Workbench v0.3

**Status:** Active foundation (2026-07-22)  
**Purpose:** Make every public statement’s epistemic status, allowed uses, and promotion requirements explicit.

## Legend

| Tag          | Proof-eligible? | Typical origin                          |
|--------------|-----------------|-----------------------------------------|
| FORMAL       | Yes             | Explicit definition + derivation        |
| COMPUTED     | Yes             | Kernel operator / invariant result      |
| MODEL        | No (unless promoted) | Explicit modeling assumption       |
| INTERPRETIVE | No              | Human or AI reading of a result         |
| METAPHOR     | No              | Poetic or symbolic language             |
| OBSERVED     | No              | Empirical measurement outside kernel    |
| FAILED       | No              | Contract violation or runtime error     |

Promotion of a MODEL claim requires an explicit `assumption_id`, justification, and receipt that the assumption was accepted for a bounded context. Promotion never turns a MODEL into a theorem.

## Core Operator Claims (current trunk)

| Statement | Current Tag | Allowed Uses | Forbidden Uses | Evidence for Promotion | Disposition |
|-----------|-------------|--------------|----------------|------------------------|-------------|
| “Harmonic sum computed by finite complex vector addition.” | COMPUTED | Formal input, receipts, tests | Calling it a direct-sum algebra or category morphism | Full algebraic axioms + proofs | STABLE |
| “Pure phase shift preserves resonance under the v0.2 finite vector model.” | COMPUTED | Formal input (I5) | Claiming unitary group representation theory or physical conservation | Group-homomorphism proofs | STABLE |
| “Attenuated phase shift computed with declared cost accounting.” | COMPUTED | Formal input when cost declared | Silent attenuation without cost | — | STABLE |
| “Phi scaling applied as scalar dilation plus golden-angle phase advance.” | COMPUTED | Computational result | Claiming special number-theoretic or sacred status as formal | — | STABLE |
| “Bridge candidate recorded as a typed transition/path, not a category-theoretic proof.” | COMPUTED | Path recording | Natural transformation / morphism claim | Category theory formalization | STABLE (explicit disclaimer) |
| Phase of zero vector is 0 | COMPUTED (convention) | Receipts, determinism | Physical phase claim | — | STABLE convention |
| C(0,0)=1, C(0,x)=0 | COMPUTED (convention) | Similarity metric | Continuity claims at origin without proof | — | STABLE convention |

## Proof Gate Rules (executable)

- Only FORMAL and COMPUTED may enter a formal proof context.
- MODEL may be promoted to a bounded assumption record; the original tag remains visible in metadata.
- INTERPRETIVE / METAPHOR / OBSERVED / FAILED are always blocked from certifying formal status.
- UI must never collapse “receipt hash matches” + “invariant PASS” into “theorem proved.”

## UI / Documentation Language Rules

- Every visualization, plain-language explanation, and example must declare its layer: mathematical / computational / model-based / interpretive / metaphorical.
- “Looks coherent”, “feels resonant”, “sacred geometry”, or similar language is INTERPRETIVE or METAPHOR and must be visually quarantined from the formal ledger.
- Example library entries state their classification explicitly.

## Future Candidate Operators

Any new operator (scalar multiply, normalize, inner product, matrix transform, direct sum, tensor, etc.) must receive a row in this matrix *before* promotion to STABLE. The matrix is the promotion gate.

---
*No claim outruns its evidence.*
