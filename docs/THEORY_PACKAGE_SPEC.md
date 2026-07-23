# Parallax Theory Package Architecture v0.1

**Status:** implemented browser architecture and portable manifest schema  
**Executable package:** Langarian Finite Complex Transformations  
**Documentary/formal example:** SaaSy Reduced Hamiltonian Program

## 1. Why this exists

The original Langarian workbench answered a narrow but important question:

> Did this finite-complex transformation execute as declared, and what claim boundary did the receipt earn?

That did not yet answer the broader question a theorist naturally asks:

> Where does my theory enter the system?

The Theory Package Architecture adds that front door without pretending the current finite-vector kernel can execute every theory.

The core separation is:

```text
Parallax governance shell
        |
        +-- theory package manifest
        |     objects
        |     operators
        |     assumptions
        |     invariants
        |     claim boundaries
        |     evidence status
        |     implementations
        |
        +-- package-specific executable kernel, if earned
```

The governance shell is general. Execution is package-specific.

## 2. What “plugging in a theory” means

A theory may enter at different maturity levels.

### Level 1 — Documentary theory

The package maps:

- objects;
- assumptions;
- claims;
- references or evidence classes;
- dependencies;
- unresolved questions.

Nothing is claimed to execute.

### Level 2 — Formal specification

The package adds exact or candidate definitions for:

- admissible object types;
- operator domains and codomains;
- preconditions;
- proof obligations;
- invariant candidates;
- failure conditions.

A Level 2 package can be audited without being run.

### Level 3 — Executable reference

At least one reference implementation can execute declared operators and emit package-bound receipts.

### Level 4 — Conformance tested

A second implementation or independent test surface produces compatible results under the package specification.

Compatibility does not automatically imply epistemic independence. A direct language port may be conformance evidence while sharing the same algorithmic assumptions.

### Level 5 — Reality-Gate candidate

The package explicitly registers:

- empirical predictions;
- datasets;
- literature comparisons;
- falsifiers;
- replication requirements;
- evidence status.

Level 5 does not mean empirically true. It means the package is structured enough to undergo Reality Gate evaluation.

## 3. Portable manifest

The normative JSON schema is:

```text
schemas/theory-package.schema.json
```

The browser validator additionally enforces cross-field rules that plain JSON Schema cannot fully express, including:

- unique definition identifiers;
- operator input/output references to declared object types;
- at least one executable implementation for Level 3;
- at least two executable surfaces for Level 4;
- explicit Reality Gate classification;
- stable package identity and semantic versioning.

The manifest root is:

```json
{
  "schema_version": "theory-package:v0.1",
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

## 4. Evidence classes

Every object, operation, assumption, and invariant carries an evidence class:

- `OBSERVED`
- `IMPLEMENTED`
- `DOCUMENTED`
- `INFERRED`
- `ASPIRATIONAL`
- `UNKNOWN`

A package must not report an aspirational rule as implemented behavior.

## 5. Definition status

Definitions use:

- `ACCEPTED`
- `PROVISIONAL`
- `CANDIDATE`
- `THEORY_MAP_OPEN`

`THEORY_MAP_OPEN` is not a failure. It is the required honest state when the package does not yet contain enough evidence to define an object or operator precisely.

## 6. Generic receipt envelope

The browser can generate a package-bound receipt envelope template:

```json
{
  "receipt_schema_version": "parallax-receipt-envelope:v0.1",
  "theory_package": {
    "id": "example-theory",
    "version": "0.1.0",
    "schema_version": "theory-package:v0.1"
  },
  "operation_id": "evolve",
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

The envelope is theory-neutral, but it does not execute an operation by itself. A package-specific runtime must populate inputs, outputs, checks, implementation identity, parents, and status.

## 7. Bundled package: Langarian

The current finite-complex workbench is represented as a Level 4 package because it has:

- a Python reference kernel;
- a TypeScript mirror;
- deterministic fixtures;
- receipt hashing;
- conformance tests;
- a browser execution surface.

This does not make the two implementations fully independent. The TypeScript port intentionally mirrors the Python algorithm and therefore supplies conformance evidence rather than a wholly independent scientific confirmation.

## 8. Bundled package: SaaSy

SaaSy enters as a Level 2 documentary/formal package shell.

That is deliberate. It can register objects, assumptions, derivation steps, claim promotion rules, and invariant candidates now without falsely routing reduced-Hamiltonian derivations through the finite-complex Langarian kernel.

Open definitions remain visible as `THEORY_MAP_OPEN` until Hughes supplies implementation evidence, Ori audits the recovered model, and Emet proposes lawful formalization.

## 9. Theory Definition Wizard

The GitPage now opens on a Theory Packages module. The wizard asks for:

- stable package identity;
- name and version;
- summary;
- motivation — “what made you build it?”;
- maturity level;
- object names;
- operator names;
- assumptions;
- invariants;
- allowed claims;
- prohibited claims.

The wizard creates a Level 1-compatible candidate manifest. Missing semantics are marked `THEORY MAP OPEN`; they are not silently invented.

A user may export the manifest, edit it externally, and import it back into the local browser session for validation.

## 10. Security and trust boundary

Package import is local to the browser session and treats imported JSON as data.

A valid manifest means only:

- the package has the required shape;
- references and maturity requirements are internally consistent;
- claim boundaries and Reality Gate status are explicit.

It does not mean:

- the theory is mathematically correct;
- implementations are safe to execute;
- claims are proved;
- the theory describes reality.

Future executable package loading must use an allowlisted plugin system or isolated runtime. Arbitrary code execution from imported manifests is explicitly out of scope for v0.1.

## 11. Governing test

> A definition is mature when two independent implementers can build compatible systems from it without asking the author what was meant.

The package architecture makes that test inspectable. It does not weaken it.
