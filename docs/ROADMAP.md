# Roadmap

Langarian Math grows by receipts, not hype.

## Current trunk

**v0.1.2 — Public Proof-Gate Patch**

- Finite complex vector states
- Normalized complex similarity
- Receipt-emitting operators
- Epistemic tags
- Proof Gate
- Public docs and contribution flow

## v0.1.x — Kernel hardening

- Expand property tests
- Add receipt validation CLI
- Add deterministic example receipts
- Improve error messages
- Add type checking / linting later if useful

## v0.2.x — CLI Receipt Runner

Target commands:

```bash
langarian run examples/basic_369.yaml --emit-receipt
langarian validate receipts/basic_369_bridge.json
langarian explain receipts/basic_369_bridge.json
```

Goals:

- First-class receipt validation
- Human-readable receipt explanations
- Better YAML examples
- Claim-boundary failure examples

## v0.3.x — Visual Explorer

- Static public site
- Interactive state diagrams
- Receipt explorer
- Operator cards
- Epistemic tag viewer

## Future research lanes

These are not trunk claims yet:

- Stronger finite-space operator families
- Direct-sum / tensor product experiments
- Optional proof-kernel experiments
- Julia or performance layer
- Formal theorem lanes
- Richer glyph dictionaries
- Category-theoretic bridge semantics

## Promotion rule

A future idea can move into trunk only when it has:

1. Minimal implementation.
2. Tests.
3. Receipts.
4. Clear epistemic tags.
5. No unearned theorem language.
