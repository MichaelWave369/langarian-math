# Three-Gate Research Architecture

Langarian Math separates three questions that research software often collapses:

```text
Syntax / Integrity Gate
        ↓
Formal Eligibility Gate
        ↓
Reality Gate
```

The gates are ordered, but authority does not automatically flow through them. Passing an earlier gate does not imply passage through a later gate.

> **The ledger serves reality, not the author.**

## 1. Syntax / Integrity Gate

### Question

> Is this artifact well formed, internally consistent, version-compatible, and untampered?

### Current implementation

The workbench implements this boundary through:

- typed finite states and bounded inputs;
- canonical serialization;
- deterministic content hashes;
- receipt schema validation;
- status consistency checks;
- version allowlists;
- invariant results;
- local operation recomputation;
- quarantine for malformed or altered imports.

### What a pass means

A pass means the artifact satisfies the declared structural and computational checks.

### What a pass does not mean

It does not mean:

- a theorem has been proved;
- the model is complete;
- an interpretation is justified;
- the artifact came from a trusted author;
- the model describes nature.

## 2. Formal Eligibility Gate

### Question

> Is this claim allowed to enter formal mathematical review under the declared model and epistemic rules?

This is the public name of the interface historically called the **Proof Gate**. Internal Python names such as `proof_gate.py`, `ProofGateReport`, and `require_proof_eligible` remain for compatibility.

### Current implementation

The gate admits claims tagged:

- `FORMAL`
- `COMPUTED`

It blocks:

- `MODEL`
- `INTERPRETIVE`
- `METAPHOR`
- `OBSERVED`
- `FAILED`

It also blocks a claim promoted from `MODEL` unless the claim carries an explicit `formal_derivation_id`. Claims attached to quarantined receipts remain blocked.

### What a pass means

A pass means the claim may enter formal mathematical review.

### What a pass does not mean

It does not mean:

- the proof is correct;
- the theorem is true;
- the model is physically meaningful;
- the model is empirically supported;
- nature agrees.

The gate is an admissibility filter, not a theorem prover.

## 3. Reality Gate

### Question

> Does the formally coherent model earn scientific confidence through contact with existing knowledge and the world?

The Reality Gate is a **future evidence framework**. Langarian Math v0.3.1 does not implement, run, or pass it.

Candidate evidence dimensions include:

1. **Mathematical consistency** — formal definitions and derivations survive review.
2. **Computational reproducibility** — independent implementations reproduce declared results.
3. **Independent reconstruction** — another investigator can rebuild the result from disclosed inputs and methods.
4. **Literature comparison** — the claim is compared fairly with established work and competing explanations.
5. **Empirical consistency** — available observations do not contradict the claim within declared uncertainty.
6. **Predictive success** — the model makes risky, time-bounded, falsifiable predictions that perform better than relevant baselines.
7. **Independent replication** — unaffiliated investigators reproduce the empirical result.

These dimensions should remain distinct. A model can be mathematically consistent yet empirically contradicted. It can fit known data without making useful predictions. It can make one successful prediction without independent replication.

## Proposed Reality Gate states

A future implementation should avoid a single green “truth” badge. Candidate states are:

- `UNASSESSED`
- `INTERNALLY_VALID`
- `LITERATURE_COMPARED`
- `EMPIRICALLY_CONSISTENT`
- `PREDICTIVELY_SUPPORTED`
- `INDEPENDENTLY_REPLICATED`
- `CONTRADICTED`
- `RETRACTED`

Each state must carry evidence, scope, date, methods, uncertainty, and dissent. `CONTRADICTED` and failed predictions remain in the ledger.

## Independence rules

A future Reality Gate should require:

- no self-certification of independent reconstruction or replication;
- named evidence sources and retrieval dates;
- preservation of null and negative results;
- explicit competing explanations;
- separation of model fit from prediction;
- versioned datasets and analysis code;
- visible conflicts of interest;
- expiration or re-review when evidence changes.

## Non-collapse rule

The following implications are forbidden:

```text
program executed  ⇏  receipt valid
receipt valid     ⇏  mathematics proved
mathematics valid ⇏  model describes nature
model fits data   ⇏  model predicts successfully
one replication  ⇏  scientific consensus
```

## House rule

Record what happened. Record what did not happen. Record what was assumed. Record what remains unproved.

The ledger is not a monument to the author. It is a memory system in service of correction.
