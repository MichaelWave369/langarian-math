# Parallax Theory Package Architecture v0.2

**Status:** implemented browser architecture and portable manifest schema  
**Executable package:** Langarian Finite Complex Transformations  
**Neutral formal example:** Generic Provenance Workflow

## 1. Purpose

The workbench separates a general governance shell from package-specific mathematics and software.

```text
Parallax governance shell
        |
        +-- theory package manifest
        |     objects
        |     operators
        |     execution contracts
        |     assumptions
        |     invariants
        |     claim boundaries
        |     evidence status
        |     implementations
        |
        +-- package-specific executable kernel, if earned
```

The governance shell is general. Execution is package-specific.

## 2. Maturity levels

### Level 1 — Documentary theory

Objects, assumptions, claims, sources, dependencies, and unknowns are mapped. Nothing is claimed to execute.

### Level 2 — Formal specification

Object types, operator domains and codomains, execution contracts, invariant obligations, failure behavior, and first falsifiers are declared. A Level 2 package can be audited without being run.

### Level 3 — Executable reference

At least one reference implementation executes every declared operator and emits package-and-contract-bound receipts.

### Level 4 — Conformance tested

A second implementation or independent test surface produces compatible results under the package specification. Compatibility does not automatically imply epistemic independence.

### Level 5 — Reality-Gate candidate

Empirical predictions, datasets, literature comparisons, falsifiers, replication requirements, and evidence status are explicitly registered.

## 3. Portable manifest

Normative schema:

```text
schemas/theory-package.schema.json
```

Schema version:

```text
theory-package:v0.2
```

Root form:

```json
{
  "schema_version": "theory-package:v0.2",
  "theory": {},
  "maturity_level": 1,
  "objects": [],
  "operators": [],
  "assumptions": [],
  "invariants": [],
  "claim_boundaries": {
    "allowed": [],
    "prohibited": []
  },
  "evidence": {
    "reality_gate": "not_evaluated",
    "notes": ""
  },
  "implementations": [],
  "metadata": {}
}
```

The browser validator additionally enforces:

- unique definition and contract identifiers;
- operator input/output references to declared object types;
- assumption and invariant references to declared ids;
- complete operator-contract shapes;
- at least one executable implementation for Level 3;
- at least two executable surfaces for Level 4;
- implementation locations for every Level 3+ operator;
- explicit Reality Gate classification;
- stable package identity and semantic versioning.

## 4. Per-operator execution contract

Every operator must carry:

```text
operator-contract:v0.2
```

Required fields:

```json
{
  "contract_version": "operator-contract:v0.2",
  "parameters": [],
  "preconditions": [],
  "assumptions_used": [],
  "invariants_checked": [],
  "predicates": [],
  "failure_conditions": [],
  "reversibility": {
    "classification": "unknown",
    "condition": ""
  },
  "receipt_fields": [],
  "first_falsifier": ""
}
```

### Parameters

Each parameter declares a stable id, name, type, whether it is required, and its constraints.

### Preconditions

Preconditions define the admissible execution domain. They are not post-hoc explanations for failed runs.

### Assumptions and invariants

Contracts reference package-level assumption and invariant ids. Unknown references are rejected.

### Predicates

Every check has a stable id, a statement, required status, and an optional tolerance policy. A receipt must name the predicate actually checked; `PASS` alone is insufficient.

### Failure behavior

Each failure condition declares one outcome:

- `REJECT` — do not execute;
- `FAIL_RECEIPT` — execution or postcondition failed and must be recorded;
- `WARN_RECEIPT` — execution may continue, but the boundary remains visible.

### Reversibility

Allowed classes:

- `reversible`;
- `conditionally_reversible`;
- `irreversible`;
- `not_applicable`;
- `unknown`.

`unknown` is valid for an early documentary package but blocks a fully resolved contract audit.

### First falsifier

Every operator declares the first admissible counterexample or run that would defeat its stated behavior. A falsifier is an attack surface, not proof that the operator has survived it.

## 5. Evidence classes and definition status

Evidence classes:

- `OBSERVED`
- `IMPLEMENTED`
- `DOCUMENTED`
- `INFERRED`
- `ASPIRATIONAL`
- `UNKNOWN`

Definition statuses:

- `ACCEPTED`
- `PROVISIONAL`
- `CANDIDATE`
- `THEORY_MAP_OPEN`

A complete operational contract may coexist with an open higher-level interpretation. This is intentional.

## 6. Generic receipt envelope

Schema:

```text
parallax-receipt-envelope:v0.2
```

The envelope binds:

```json
{
  "receipt_schema_version": "parallax-receipt-envelope:v0.2",
  "theory_package": {
    "id": "example-theory",
    "version": "0.1.0",
    "schema_version": "theory-package:v0.2"
  },
  "operation_id": "evolve",
  "operator_contract": {
    "version": "operator-contract:v0.2",
    "assumption_ids": [],
    "invariant_ids": [],
    "predicate_ids": ["output-valid"],
    "first_falsifier": "An admissible run whose output violates the declared map."
  },
  "implementation": {
    "id": null,
    "version": null
  },
  "inputs": [],
  "parameters": {},
  "outputs": [],
  "assumptions_used": [],
  "checks": [],
  "claims_supported": [],
  "claims_prohibited": [],
  "parent_receipts": [],
  "status": "NOT_RUN",
  "timestamp_utc": "RUNTIME_TIMESTAMP"
}
```

The envelope does not execute anything. A package-specific runtime must populate observations, outputs, implementation identity, parents, and status.

## 7. Bundled public packages

### Langarian Finite Complex Transformations — Level 4

The executable package has Python and TypeScript surfaces, deterministic fixtures, receipt hashing, conformance tests, and a browser workbench. Its operators now carry exact execution contracts.

The `bridge` operation illustrates a crucial distinction: its operational behavior is contracted, while its ultimate theoretical object-kind interpretation remains open.

Specimen:

```text
examples/theory-packages/langarian-finite-complex.json
```

### Generic Provenance Workflow — Level 2

A neutral formal package demonstrates exact contracts without an implementation. It defines source attachment and bounded claim review using generic records, claims, and review results.

Specimen:

```text
examples/theory-packages/generic-provenance-workflow.json
```

No private research package is bundled in the active public tree.

## 8. Theory Definition Wizard

The wizard creates a valid documentary candidate. Unknown contract content remains visibly marked `THEORY MAP OPEN`; scaffolds and manifests never invent executable semantics.

A package may be exported, edited externally, and imported back into the local browser session for validation.

## 9. Security and trust boundary

Imported JSON is data only. The browser does not execute arbitrary package code.

A valid manifest means only that its structure, references, maturity rules, contracts, claim boundaries, and Reality Gate classification are internally coherent. It does not mean the theory is correct, proved, safe, or empirically true.

## 10. Governing test

> A definition is mature when two independent implementers can build compatible systems from it without asking the author what was meant.

v0.2 turns that principle into inspectable per-operator obligations.
