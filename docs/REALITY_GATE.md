# Reality Gate — Future Evidence Framework

**Status:** design document only. Not implemented. Not a current Langarian claim.

The Reality Gate would evaluate whether an internally valid and formally reviewable model has earned scientific confidence through contact with literature, evidence, prediction, and independent replication.

It must never be implemented as a single “true / false” button.

## Boundary

The current Langarian Math Workbench can establish that:

- a finite computation ran;
- its receipt is structurally valid;
- its recorded content hash matches;
- declared invariants passed or failed;
- its claims are or are not eligible for formal review.

The current workbench cannot establish that:

- a mathematical model describes nature;
- a physical interpretation is correct;
- a theory is empirically confirmed;
- a scientific consensus exists.

## Candidate evidence record

A future Reality Gate record should contain at least:

```json
{
  "reality_gate_schema": "reality-gate:draft-v0.1",
  "subject_claim_id": "claim:...",
  "formal_artifact_hashes": ["sha256:..."],
  "status": "UNASSESSED",
  "scope": "explicit bounded statement",
  "literature": [],
  "empirical_tests": [],
  "predictions": [],
  "replications": [],
  "contradictions": [],
  "alternative_explanations": [],
  "uncertainties": [],
  "dissent": [],
  "reviewed_at": "ISO-8601 timestamp",
  "reviewers": [],
  "conflicts_of_interest": []
}
```

This example is illustrative, not a frozen schema.

## Evidence dimensions

### Literature comparison

Record:

- databases and sources searched;
- exact search dates;
- relevant prior art;
- supporting and conflicting work;
- whether the claim is novel, derivative, or already known;
- unresolved disagreements.

A literature search is not empirical confirmation.

### Empirical consistency

Record:

- datasets;
- instruments and calibration;
- inclusion and exclusion rules;
- uncertainty model;
- preprocessing;
- analysis code version;
- fit metrics;
- contradictions and unexplained residuals.

Fitting existing data is not the same as successful prediction.

### Prediction

A prediction should be registered before the outcome is known and include:

- exact predicted quantity;
- acceptable range;
- deadline or observation window;
- measurement procedure;
- comparison baseline;
- failure criterion;
- amendment history.

Post-hoc reinterpretation must remain visible in the ledger.

### Independent reconstruction

A reconstruction counts as independent only when the reconstructing party did not simply replay a hidden artifact from the original author. Record:

- disclosed inputs;
- reconstruction method;
- implementation differences;
- resulting values;
- discrepancies;
- relationship to the originating team.

### Independent replication

Replication must distinguish:

- same data / same code;
- same data / independent code;
- new data / same method;
- new data / independent method.

These are different strengths of evidence and must not share one badge.

## Candidate states

- `UNASSESSED` — no Reality Gate review has occurred.
- `INTERNALLY_VALID` — formal and computational prerequisites are recorded.
- `LITERATURE_COMPARED` — prior work and alternatives are documented.
- `EMPIRICALLY_CONSISTENT` — scoped observations are compatible within declared uncertainty.
- `PREDICTIVELY_SUPPORTED` — preregistered predictions succeeded against declared baselines.
- `INDEPENDENTLY_REPLICATED` — unaffiliated replication met declared criteria.
- `CONTRADICTED` — relevant evidence conflicts with the claim.
- `RETRACTED` — the claim owner has withdrawn the claim while preserving its history.

States are not necessarily linear. A claim may be `PREDICTIVELY_SUPPORTED` in one domain and `CONTRADICTED` in another. Scope must always travel with status.

## Required governance

A future implementation must:

- preserve negative and null results;
- preserve superseded versions;
- prohibit deletion of failed predictions from the audit history;
- expose dissent rather than average it away;
- identify who supplied each evidence item;
- distinguish evidence integrity from evidence quality;
- prevent authors from labeling their own work “independently replicated”;
- expire or re-review evidence-sensitive statuses;
- make contradictions as visible as support.

## UI rule

The Reality Gate must not use a single green completion indicator. It should show an evidence matrix with incomplete, supportive, conflicting, expired, and not-applicable states.

The default state for every current Langarian artifact is:

> **Reality Gate: UNASSESSED — no claim about nature has been established.**

## Governing maxim

> **The ledger serves reality, not the author.**
