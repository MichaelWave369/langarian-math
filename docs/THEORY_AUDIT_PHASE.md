# Theory Audit and Execution Readiness Phase

**Status:** implemented browser phase  
**Scope:** package recovery, semantic attack, scaffold generation, and planning receipts  
**Non-goal:** this phase does not execute arbitrary imported theories.

## Why this phase exists

Theory Package Architecture v0.1 created a lawful intake path. A theory can now enter Parallax as a documentary, formal, executable, conformance-tested, or Reality-Gate package without being forced through the finite-complex Langarian kernel.

The next problem is harder:

> What must be true before a documentary or formal package may become executable?

A single maturity number is not enough. A project may have working code while its definitions remain ambiguous, or elegant formal semantics while no executable reference exists. This phase therefore audits five independent readiness axes.

## Five readiness axes

### Documentary recovery

Checks whether the package declares:

- identity and motivation;
- objects;
- assumptions;
- allowed claims;
- prohibited claims;
- a valid portable manifest.

### Formal semantics

Checks whether:

- object identities are resolved;
- legal operators are declared;
- operator maps are no longer `THEORY_MAP_OPEN`;
- invariants and proof obligations are registered;
- invariant identities are precise enough to falsify.

### Executable reference

Checks whether:

- the package has earned executable status;
- a reference implementation exists;
- every executable operator names an implementation location;
- every declared operator can be bound to a generic package receipt envelope.

### Conformance and independence

Checks whether:

- at least two execution surfaces exist;
- mirror dependence is disclosed;
- implementation agreement is not presented as independent empirical confirmation.

Conformance and epistemic independence remain different claims.

### Reality Gate

Checks whether:

- external evidence status is explicitly classified;
- evidence notes describe datasets, literature comparisons, predictions, falsifiers, or replication;
- formal success is prohibited from implying physical or empirical truth.

## H0–H6 packet export

The browser can export a Markdown recovery packet generated only from the selected package manifest:

- **H0:** scope and evidence freeze;
- **H1:** observable object inventory;
- **H2:** operation catalog;
- **H3:** receipt-envelope specimen;
- **H4:** authority map;
- **H5:** ambiguity register;
- **H6:** app-to-concept map.

The packet preserves `PROVISIONAL`, `CANDIDATE`, and `THEORY_MAP_OPEN` states. Generation never promotes a definition.

## Dependency and provenance map

The audit module renders only edges supported by the package manifest:

- object → operator input;
- operator → object output;
- operator → implementation location;
- package → object, operator, assumption, invariant, implementation, and claim boundary.

Theory Package v0.1 does not yet declare which assumptions and invariants each operator consumes. Those missing edges are reported as open linkages rather than inferred.

## Safe implementation scaffolds

Python and TypeScript scaffolds may be exported for each package.

They contain:

- package identity;
- declared operator names;
- declared input and output types;
- declared semantics;
- explicit `NotImplementedError` or thrown errors.

A scaffold is a planning artifact. It cannot emit `PASS`, produce outputs, or count as an implementation.

## Planning receipts

Before implementation, the audit module can create package-bound receipts with:

```text
status = NOT_RUN
outputs = []
claims_supported = []
```

The receipt records intended work without pretending that an operator executed. Planning receipts remain local to the browser session unless exported.

## Current discovery

The audit exposes a real structural issue in the existing Langarian package:

- Python and TypeScript execution surfaces exist and conform;
- some operator semantics, especially `bridge`, remain open.

This is not treated as failure. It is recorded as an asymmetric maturity profile: implementation can be ahead of formal semantic recovery.

## Next schema obligation

Theory Package v0.2 should add per-operator execution contracts:

- preconditions;
- assumptions used;
- invariants or predicates checked;
- failure conditions;
- reversibility;
- receipt fields;
- first falsifiers.

Until that schema exists, the audit displays these linkages as `THEORY MAP OPEN`.

## Governing rule

> Implementation behavior may provide evidence about what exists, but it may not silently become the definition of what the theory means.
