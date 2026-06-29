# Kimi v1 Harvest Review

**Status:** WARN / HARVEST  
**Trunk protected:** Langarian Math v0.2 FKC + v0.2.1 Epistemic Receipt Patch  
**Decision:** Do not replace trunk. Harvest useful implementation ideas only.

## Ledger Verdict

Kimi's `v1.0` materials are useful as a visionary and executable pressure test, but they over-promote several structures beyond what the code proves. The safest path is to preserve the artifact as an experimental branch and graduate only small, testable modules into the trunk.

## Accepted Harvests

1. **Finite complex space helper**  
   Added `src/langarian/spaces.py` with `FiniteComplexSpace`. This gives us dimension checks, inner products, norms, and zero vectors without claiming infinite-dimensional Hilbert theory.

2. **Unitary flow demo**  
   Added `src/langarian/dynamics.py` with `UnitaryFlowDemo`. This demonstrates norm preservation under global complex rotation. It is deliberately not called a symplectic theorem.

3. **Glyph nearest-score helper**  
   Extended `GlyphDictionary` with `nearest_with_score()`. This keeps glyphs useful while preserving the rule that glyphs are labels/stubs in trunk.

4. **Test ideas**  
   Added tests for finite space, glyph scoring, and norm-preserving flow.

## Rejected or Downgraded Claims

- **“Complete v1.0”** — not accepted. The kernel remains v0.2.x until independent receipts and property tests justify promotion.
- **“Unique canonical metric”** — downgraded to `metric:v0.2.normalized_complex_similarity`.
- **“Bridge naturality”** — not accepted. Current bridge code checks finite similarity/path receipt status, not category-theoretic naturality.
- **“RKHS frame glyphs”** — not accepted. Current glyph dictionary is a finite nearest-label helper.
- **“Symplectic resonance conservation theorem”** — not accepted. Current demo is unit-complex scalar rotation, not a full Hamiltonian proof.
- **Emotional/alchemical examples** — allowed only as MODEL / INTERPRETIVE / METAPHOR layers, never as formal proof.

## Promotion Rule

A concept graduates from experimental harvest into trunk only when it has:

1. A minimal finite-dimensional implementation.
2. Tests that fail if the behavior is broken.
3. Receipt output when it performs a kernel operation.
4. No unearned theorem language.
5. Explicit epistemic tags for any interpretive claim.

## Next Suggested Patch

`v0.2.2 Space + Dynamics Harvest Patch`

This patch keeps the build moving without allowing v1.0 language to outrun the receipts.
