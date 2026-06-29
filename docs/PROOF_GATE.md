# Proof Gate

The Proof Gate is the executable form of the Langarian claim boundary.

It does **not** prove mathematics by itself. Its job is narrower and important:

> keep interpretive, metaphorical, observed, and unpromoted model claims out of formal proof contexts.

## Allowed proof-input tags

- `FORMAL`
- `COMPUTED`

These may be used as proof inputs because they come from invariant contracts, explicit computation, or bounded kernel operations.

## Blocked proof-input tags

- `MODEL`
- `INTERPRETIVE`
- `METAPHOR`
- `OBSERVED`
- `FAILED`

These tags can still appear in a receipt. They simply cannot certify a formal pass.

## Example

```python
from langarian.claims import Claim
from langarian.epistemic import EpistemicTag
from langarian.proof_gate import require_proof_eligible

claims = [
    Claim("Similarity computed by the kernel.", EpistemicTag.COMPUTED),
]

require_proof_eligible(claims)
```

A metaphor is blocked:

```python
Claim("This feels luminous.", EpistemicTag.METAPHOR)
```

## Model promotion

A `MODEL` claim may be promoted into a bounded assumption record only when it includes:

- an `assumption_id`
- a justification
- the original tag in metadata

This is not proof that the model is true. It is a receipt that the assumption was explicitly accepted for a bounded context.

## House rule

Beautiful language is welcome. Proof still needs receipts.
