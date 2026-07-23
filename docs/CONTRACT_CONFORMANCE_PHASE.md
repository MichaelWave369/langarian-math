# Contract Conformance Phase v0.3

**Status:** implemented portable evidence architecture  
**Scope:** compare package-specific implementation evidence against `operator-contract:v0.2`  
**Non-goal:** the browser does not execute arbitrary imported code or authenticate external evidence by itself.

## 1. Why this phase exists

Theory Package v0.2 made operator obligations explicit:

- parameters;
- preconditions;
- assumptions;
- invariants;
- named predicates;
- failure behavior;
- reversibility;
- receipt fields;
- first falsifiers.

That creates a new question:

> Did the implementation actually exercise and satisfy the declared contract?

A successful happy-path run is not enough. A mature conformance claim must include ordinary behavior, boundaries, adversarial inputs, declared failure paths, and the first falsifier.

## 2. New portable artifact

The conformance suite schema is:

```text
contract-conformance-suite:v0.1
```

Normative schema:

```text
schemas/contract-conformance-suite.schema.json
```

A suite binds to exactly one package id, package version, and package-schema version.

It contains two object classes.

### Cases

Each case declares:

- stable case id;
- operator id;
- case class;
- description;
- expected overall status;
- expected predicate outcomes;
- expected failure ids;
- whether it exercises the first falsifier;
- evidence requirements.

Case classes are:

```text
nominal
boundary
adversarial
failure
falsifier
```

### Observations

Each implementation observation declares:

- case id;
- implementation id and version;
- operator-contract version;
- receipt-envelope version;
- observed status;
- predicate results;
- observed failure ids;
- comparison signature;
- inspectable evidence reference;
- timestamp.

An observation is evidence data. It is not executable code.

## 3. Validation boundary

The browser validator checks:

- package identity and version binding;
- operator, predicate, failure, and implementation references;
- implementation-version agreement;
- unique case/implementation observations;
- expected versus observed status;
- expected versus observed predicate outcomes;
- expected failure recording;
- required result signatures for successful observations;
- contract and receipt schema versions.

A structurally valid evidence record does not prove that its cited source is authentic. Source authentication, signatures, custody, and remote attestation remain future work.

## 4. Level-4 promotion gate

An operator earns the v0.3 contract-conformance gate only when all of the following are true:

1. the operator contract is resolved;
2. nominal evidence exists;
3. boundary evidence exists;
4. adversarial evidence exists;
5. declared failure behavior is exercised;
6. the first falsifier is exercised;
7. every required predicate appears in at least one case;
8. every declared failure condition appears in at least one case;
9. every case has evidence from every executable implementation surface;
10. the implementation surfaces agree on status, predicate outcomes, failures, and result signature.

The package-level gate additionally requires:

- a valid theory package;
- a valid conformance suite;
- at least two executable implementation surfaces;
- every declared operator passing the operator-level gate.

## 5. Conformance versus independence

Agreement between two ports is useful but limited.

A Python reference and a TypeScript mirror may agree byte-exactly while sharing:

- the same algorithm;
- the same fixtures;
- the same mathematical assumptions;
- the same human interpretation;
- the same specification errors.

Therefore:

> Contract conformance is not independent scientific confirmation.

The existing implementation-dependence disclosure remains part of the package record.

## 6. Current Langarian evidence

The bundled suite records only evidence already present in the public repository:

- Python-generated canonical fixtures;
- TypeScript byte-exact replay;
- canonical state and receipt hashes;
- vector and metric comparison under the declared numerical tolerance.

The bundled specimen is:

```text
examples/conformance/langarian-contract-conformance.partial.json
```

It currently covers:

- nominal harmonic sum;
- cross-dimension harmonic-sum boundary;
- nominal phase shift;
- zero-state phase-shift boundary;
- nominal phase-weighted attenuation;
- nominal bridge relation.

It does **not** manufacture missing evidence.

The stricter v0.3 gate therefore reports Langarian as:

```text
DECLARED LEVEL 4
CONTRACT-CONFORMANCE REVALIDATION OPEN
```

Open obligations include:

- adversarial cases for every operator;
- explicit rejection and failure cases;
- coverage of every declared failure condition;
- executable first-falsifier cases;
- complete evidence from both implementation surfaces for those cases.

This is an intentional strengthening of the standard, not a claim that the existing fixture replay failed.

## 7. Planning scaffold

The GitPage can export a blank conformance scaffold for any package.

The scaffold creates the five required case classes per operator but includes:

```text
observations = []
```

It is a planning artifact. It cannot earn promotion until package-specific runtimes emit inspectable evidence.

## 8. Import boundary

Imported conformance JSON remains local to the browser session.

The browser:

- parses it as data;
- validates package and contract references;
- computes coverage and agreement;
- displays blockers;
- permits export.

The browser does not:

- import or execute runtime code;
- fetch remote evidence automatically;
- certify the identity of an implementation;
- convert a cited file path into trusted evidence;
- pass the Reality Gate.

## 9. Next obligation

The next phase should add **signed evidence custody**:

- canonical conformance-evidence hashing;
- implementation-key identity;
- signed observation envelopes;
- evidence-bundle parent links;
- revocation and supersession;
- trusted and untrusted custody states;
- optional CI-produced attestations.

Until then, the gate proves internal consistency and coverage of declared evidence—not cryptographic custody.

## 10. Governing rule

> No implementation may earn conformance by running only the cases it was already expected to pass.
