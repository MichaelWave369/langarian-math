# Formal Eligibility Gate

The public name of this boundary is the **Formal Eligibility Gate**.

The historical Python module and API names remain `proof_gate.py`,
`ProofGateReport`, `ProofGateError`, and `require_proof_eligible` for backward
compatibility.

Its job is narrow and important:

> keep interpretive, metaphorical, observed, failed, and unpromoted model claims out of formal mathematical review.

It does **not** prove mathematics. It does **not** validate a theorem. It does
**not** establish that a model describes nature.

## Place in the three-gate architecture

```text
Syntax / Integrity Gate
        ↓
Formal Eligibility Gate
        ↓
Reality Gate
```

- The **Syntax / Integrity Gate** asks whether an artifact is well formed,
  internally consistent, version-compatible, and untampered.
- The **Formal Eligibility Gate** asks whether a claim is permitted to enter
  formal mathematical review.
- A future **Reality Gate** would ask whether a formally coherent model has
  earned scientific confidence through literature comparison, empirical
  consistency, prediction, and independent replication.

The current workbench implements the first two boundaries. It does not run or
pass a Reality Gate.

## Eligible tags

- `FORMAL`
- `COMPUTED`

These tags may enter formal review because they arise from explicit formal
records or bounded kernel computations.

A `COMPUTED` tag means:

> a finite computation was performed under the declared model.

It does not mean:

> therefore a theorem has been proved.

## Blocked tags

- `MODEL`
- `INTERPRETIVE`
- `METAPHOR`
- `OBSERVED`
- `FAILED`

These tags can still appear in receipts and remain valuable records. They
simply cannot certify eligibility for formal mathematical review.

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

A metaphor remains blocked:

```python
Claim("This feels luminous.", EpistemicTag.METAPHOR)
```

## Model promotion

A `MODEL` claim may be promoted into a bounded assumption record only when it
includes:

- an `assumption_id`;
- a justification;
- the original tag in metadata.

A promoted model claim still cannot enter formal review as a derived result
unless it carries an explicit `formal_derivation_id`.

Promotion records an accepted assumption. It does not prove the assumption and
it does not make the model empirically true.

## Meaning of PASS

A gate PASS means:

> every supplied claim is eligible to enter formal mathematical review under the declared tag rules.

A gate PASS does **not** mean:

- the proof is valid;
- the theorem is true;
- the model is physically meaningful;
- the model matches observations;
- nature agrees.

## House rules

> Beautiful language is welcome. Formal review still needs receipts.

> The ledger serves reality, not the author.

See also:

- `docs/THREE_GATE_ARCHITECTURE.md`
- `docs/REALITY_GATE.md`
