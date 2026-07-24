# Custody-Aware Promotion Governance v0.5

**Status:** implemented public governance phase  
**Policy schema:** `promotion-policy:v0.1`  
**Assessment schema:** `promotion-assessment:v0.1`

> Evidence must be admissible before it can influence promotion.

## 1. Purpose

The Contract Conformance gate answers whether a package has complete, agreeing evidence for every declared operator contract. Evidence Custody answers whether an exact evidence artifact is identifiable, signed, active, and lifecycle-preserved.

Neither question alone authorizes promotion.

This phase combines them without collapsing their meanings:

```text
package validity
      +
contract conformance
      +
custody admission
      ↓
promotion eligibility assessment
      ↓
separate governance review
```

The engine does not edit a theory-package manifest. It emits an append-only assessment recording why Level-4 review is allowed or blocked.

## 2. Governing separation

Three decisions remain distinct.

1. **Conformance decision** — does the evidence satisfy the operator contracts?
2. **Evidence-admission decision** — may the exact evidence enter the promotion record?
3. **Promotion decision** — should a governance authority approve a new package version or maturity declaration?

v0.5 implements the first two and produces an eligibility assessment for the third. It does not claim to be the final promotion authority.

## 3. Default Level-4 policy

The public policy is:

```text
level4-custody-aware-promotion@0.1.0
```

It requires:

- a valid `theory-package:v0.2` package;
- a valid `contract-conformance-suite:v0.1` suite;
- full Level-4 conformance eligibility;
- at least one active evidence envelope;
- at least one distinct evidence signer;
- subject kind `contract-conformance-suite`;
- exact package id and package version metadata;
- exact suite locator and SHA-256 digest;
- signer scope `sign:contract-conformance-suite`;
- signer identity derived from the supplied public-key fingerprint;
- authorized revocation records;
- consistent, acyclic supersession history.

A future policy may increase the minimum number of independent custodians. v0.1 deliberately separates that policy choice from the evidence format.

## 4. Evidence admission

An evidence envelope is admissible only when all of the following hold:

- the underlying custody verifier accepts it;
- its subject is the exact suite under review;
- its canonical digest matches;
- its package metadata matches;
- its signer is active;
- its signer id matches the public-key fingerprint;
- its signer has the required authority scope;
- it is not revoked;
- it is not superseded;
- its lifecycle relations are valid.

A valid signature with the wrong scope or wrong package binding is cryptographically interesting but promotion-inadmissible.

## 5. Revocation authority

A signer may revoke its own evidence only when it declares:

```text
revoke:self-issued-evidence
```

Revoking evidence issued by another signer requires:

```text
revoke:any-evidence
```

An unauthorized signed revocation blocks promotion rather than silently deciding whether the target evidence should be restored. This conservative result exposes governance ambiguity for review.

## 6. Supersession authority

Supersession must:

- reference an existing evidence id;
- not reference itself;
- remain within the same subject kind and locator;
- remain acyclic;
- be issued by the original signer unless the new signer has `supersede:any-evidence`.

Superseded evidence remains in the ledger but is not active promotion evidence.

## 7. Assessment receipt

The engine emits:

```text
promotion-assessment:v0.1
```

The receipt records:

- package id, version, current maturity, and target level;
- policy id, version, and schema;
- exact suite locator and digest;
- admitted evidence ids and signer ids;
- conformance eligibility and blockers;
- custody readiness and lifecycle issue count;
- final status;
- supported claim;
- prohibited inferences.

Statuses are:

- `ELIGIBLE_FOR_REVIEW`
- `BLOCKED`

The assessment id is a canonical SHA-256 identity over the full assessment body.

## 8. Non-mutation rule

An eligible assessment does not modify:

- `theory.version`;
- `maturity_level`;
- package status;
- source files;
- Reality Gate status.

Promotion requires a separately reviewed package-manifest change. That change should cite the assessment receipt and produce a new versioned custody trail.

## 9. Current Langarian result

The current Langarian suite can be signed and admitted into custody. It remains blocked from custody-aware Level-4 review because the stricter Contract Conformance phase still lacks complete adversarial, declared-failure, and first-falsifier evidence for every operator.

This is the expected honest result:

```text
custody evidence admitted
conformance incomplete
promotion blocked
```

Cryptographic custody cannot manufacture missing mathematical evidence.

## 10. Claim boundary

An `ELIGIBLE_FOR_REVIEW` assessment means only:

> The exact package and exact conformance suite satisfy the named admission policy and may enter a separate Level-4 governance review.

It does not mean:

- the package was promoted;
- the theory was proved;
- the implementation is bug-free;
- signer count equals epistemic independence;
- the Reality Gate was passed;
- the theory describes nature.

## 11. Public-safety boundary

This public phase contains only Langarian and neutral governance architecture. It includes no private research package or private theory material.
