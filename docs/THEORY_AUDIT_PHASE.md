# Theory Audit and Operator Contract Phase v0.2

**Status:** implemented browser phase  
**Scope:** package recovery, semantic attack, exact execution contracts, scaffold generation, and planning receipts  
**Non-goal:** this phase does not execute arbitrary imported theories.

## Why this phase exists

Theory Package Architecture v0.1 created a lawful intake path. The audit phase then exposed a missing layer: an operator could have a name, typed inputs and outputs, prose semantics, and even an implementation location without declaring the exact obligations an independent implementation must satisfy.

Theory Package v0.2 closes that gap with a required execution contract for every operator.

## Required per-operator contract

Every operator now declares:

- parameter names, types, required status, and constraints;
- preconditions;
- assumption identifiers used;
- invariant identifiers checked;
- named predicates and tolerances;
- failure conditions with `REJECT`, `FAIL_RECEIPT`, or `WARN_RECEIPT` outcomes;
- reversibility classification and boundary;
- required receipt fields;
- a first falsifier.

The contract schema is:

```text
operator-contract:v0.2
```

The package schema is:

```text
theory-package:v0.2
```

## Five readiness axes

### Documentary recovery

Checks identity, motivation, objects, assumptions, claim boundaries, and manifest validity.

### Formal semantics and contracts

Checks whether:

- object identities are resolved;
- operator maps are bounded;
- every operator carries a v0.2 contract;
- contracts contain no `THEORY_MAP_OPEN` placeholders;
- invariants and falsifiers are registered.

### Executable reference

Checks whether:

- the package has earned executable status;
- a reference implementation exists;
- every Level 3+ operator names an implementation location;
- every generic receipt envelope binds the exact operator contract.

### Conformance and independence

Checks multiple execution surfaces, disclosed mirror dependence, and the boundary between implementation agreement and independent scientific confirmation.

### Reality Gate

Tracks evidence, prediction, falsification, literature comparison, and replication separately from formal and computational success.

## Contract-bound receipt envelope

The generic receipt envelope is now:

```text
parallax-receipt-envelope:v0.2
```

It binds:

- package identity and version;
- operator identity;
- operator-contract version;
- assumption ids;
- invariant ids;
- predicate ids;
- the first falsifier;
- implementation identity;
- inputs, parameters, outputs, checks, parents, status, and bounded claims.

A receipt marked `NOT_RUN` is still planning evidence only. Every contract predicate remains `NOT_RUN` until a package-specific implementation records an observation.

## Dependency and provenance map

The audit graph now includes explicit edges:

- object → operator input;
- operator → object output;
- assumption → operator;
- operator → invariant;
- operator → named predicate;
- operator → failure condition;
- operator → implementation location.

These edges are read from the contract. They are no longer inferred from package-level prose.

## Operational contract versus interpretation

A precise operational contract does not automatically settle every theoretical interpretation.

The current Langarian `bridge` operation is the important example:

- executable behavior is contracted;
- input validation, bounded similarity, edge-local cost, failure outcomes, and receipt fields are explicit;
- the higher-level question of whether the concept should ultimately be classified as a comparison, provenance relation, correspondence, or transition remains open.

Therefore:

> Contracted implementation behavior may be exact while theoretical object-kind interpretation remains `THEORY_MAP_OPEN`.

## Safe implementation scaffolds

Generated Python and TypeScript scaffolds include the full contract obligations, but immediately throw. They cannot emit `PASS`, produce outputs, or count as implementations.

## H0–H6 packet export

The H2 operation catalog now includes the full per-operator contract table. First falsifiers are exported as declared attack surfaces rather than converted into proof claims.

## Public example boundary

The open-source repository contains:

- the executable Langarian package;
- a neutral Generic Provenance Workflow example.

No private or third-party research program is bundled into the active public package library.

## Governing rule

> An implementation must satisfy the declared contract; the implementation may not silently rewrite the contract, and the contract may not silently resolve an open interpretation.
