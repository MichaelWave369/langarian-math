# Contributing

Thank you for helping build Langarian Math.

This project welcomes ideas, code, docs, examples, tests, and critique. The house rule is simple:

> receipts over hype.

## Claim boundary

Langarian Math is an experimental formal-language and symbolic-computation prototype. It is not a validated physics theory, psychology model, therapeutic system, or proof of metaphysical claims.

## Contribution rules

1. **Keep trunk finite-dimensional unless a branch says otherwise.**
2. **Add tests for new behavior.**
3. **Emit receipts for kernel operations.**
4. **Use epistemic tags honestly.**
5. **Do not promote metaphor into proof.**
6. **Prefer small patches over huge rewrites.**
7. **Claims must follow `docs/CLAIM_BOUNDARY_MATRIX.md`; request a claim-boundary review when wording changes public meaning.**

## Epistemic tags

Use these tags when attaching claims:

- `FORMAL`
- `COMPUTED`
- `MODEL`
- `INTERPRETIVE`
- `METAPHOR`
- `OBSERVED`
- `FAILED`

Only `FORMAL` and `COMPUTED` claims may enter formal proof contexts.

## Pull request checklist

Before opening a PR, ask:

- Does this change preserve the claim boundary?
- Are tests included or updated?
- Do receipts still serialize?
- Are interpretive claims quarantined?
- Is the README/docs updated if public behavior changed?
- If claims, tags, receipts, or Proof Gate behavior changed, was a claim-boundary review requested?

## Good first contributions

- More YAML examples
- Better receipt explanations
- More invariant and property tests
- Documentation cleanup
- Visual demo mockups

Note: CLI receipt validation commands have shipped; contributions there should focus on clearer validation-level explanations and tamper examples.

## Review culture

Be kind, precise, and grounded. Big ideas are welcome. The Ledger decides what passes.
