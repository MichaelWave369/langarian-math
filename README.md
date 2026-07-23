# Parallax Theory Workbench — Langarian Math

[![tests](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml)
[![pages](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-cyan.svg)](LICENSE)
[![python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](pyproject.toml)

**Product version:** Langarian Math Workbench **v0.3.1-rc.1**  
**Theory Package Architecture:** **v0.2**  
**Operator Contract Schema:** **v0.2**  
**Live site:** https://michaelwave369.github.io/langarian-math/

The project has three deliberately separated layers:

```text
Parallax governance shell
        ↓
portable theory packages + exact operator contracts
        ↓
package-specific executable kernels, when earned
```

Langarian remains the first executable package: a finite-dimensional, receipt-bearing workbench for governed complex-vector transformations. The larger shell admits documentary and formal packages without pretending one mathematical kernel can execute every theory.

> **The ledger serves reality, not the author.**

## What a theory package declares

A package records:

- typed objects;
- operators and exact execution contracts;
- assumptions and invariant ids;
- named predicates and tolerances;
- failure behavior;
- reversibility;
- receipt fields;
- first falsifiers;
- claim boundaries;
- evidence and Reality Gate status;
- implementation surfaces;
- maturity level.

Normative documents:

- [`docs/THEORY_PACKAGE_SPEC.md`](docs/THEORY_PACKAGE_SPEC.md)
- [`docs/THEORY_AUDIT_PHASE.md`](docs/THEORY_AUDIT_PHASE.md)
- [`schemas/theory-package.schema.json`](schemas/theory-package.schema.json)
- [`schemas/receipt-envelope.schema.json`](schemas/receipt-envelope.schema.json)

## Can any theory enter?

Any sufficiently explicit theory may enter at **Level 1** as a documentary package. That does not make it executable or true.

| Level | Meaning |
|---|---|
| L1 | Documentary theory: objects, assumptions, claims, dependencies, and unknowns are mapped |
| L2 | Formal specification: domains, operators, exact contracts, failures, and falsifiers are declared |
| L3 | Executable reference: a package-specific runtime executes every declared operator and emits contract-bound receipts |
| L4 | Conformance tested: a second implementation or test surface produces compatible behavior |
| L5 | Reality-Gate candidate: predictions, datasets, falsifiers, literature comparison, and replication are registered |

The governance architecture is general. Execution is package-specific and must be earned.

Imported manifests are treated as data. The browser does **not** execute arbitrary package code.

## Public bundled packages

### Langarian Finite Complex Transformations — Level 4

The current executable package includes:

- finite complex vector states;
- Euclidean norm and representative phase;
- normalized complex similarity;
- `harmonic_sum`;
- `phase_shift`;
- `attenuated_phase_shift` / phase-weighted scaling;
- a semantically open `bridge` relation candidate;
- Python and TypeScript implementation surfaces;
- deterministic fixtures and conformance tests;
- operation receipts and integrity hashes;
- exact v0.2 execution contracts;
- a Formal Eligibility Gate.

Specimen: [`examples/theory-packages/langarian-finite-complex.json`](examples/theory-packages/langarian-finite-complex.json)

### Generic Provenance Workflow — Level 2

A neutral public example demonstrates how a non-executable formal package can define:

- stable records and claim versions;
- source attachment;
- bounded review results;
- explicit assumption and invariant links;
- named predicates;
- failure outcomes;
- reversibility boundaries;
- first falsifiers.

Specimen: [`examples/theory-packages/generic-provenance-workflow.json`](examples/theory-packages/generic-provenance-workflow.json)

No private research package is bundled in the active public tree.

## Per-operator execution contract

Schema version:

```text
operator-contract:v0.2
```

Every operator must declare:

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

A contract is an implementation obligation. It is not evidence that an implementation satisfies it.

## Contract-bound receipt envelope

The generic envelope version is:

```text
parallax-receipt-envelope:v0.2
```

It binds a future run to:

- package id, version, and schema;
- operator id;
- contract version;
- assumption, invariant, and predicate ids;
- the first falsifier;
- implementation identity;
- inputs, parameters, outputs, checks, parents, status, and bounded claims.

An envelope marked `NOT_RUN` is planning evidence only.

## Theory Audit room

The GitPage includes a dedicated **Theory Audit** workspace that:

- scores documentary, formal, executable, conformance, and Reality-Gate readiness separately;
- displays every operator contract;
- maps object, assumption, invariant, predicate, failure, and implementation dependencies;
- exports H0–H6 recovery packets;
- creates Python and TypeScript scaffolds that immediately throw;
- creates contract-bound `NOT_RUN` planning receipts.

The audit preserves asymmetric maturity. Working software may coexist with an unresolved interpretation, and the interface does not hide that fact.

## Foundation obligations

1. **Expressiveness** — reproduce every legal operation in scope.
2. **Exclusion** — reject illegal operations.
3. **Preservation** — preserve proved or enforced invariants.
4. **Observability** — expose ambiguity, failure, unsupported inference, and implementation divergence.

See [`docs/NATIVE_FOUNDATION_PROTOCOL.md`](docs/NATIVE_FOUNDATION_PROTOCOL.md).

## Input-general Langarian mathematics

The Langarian state domain begins with arbitrary admissible states:

\[
x\in\mathbb C^n,\qquad 1\le n\le64.
\]

Every foundational claim must be tested on ordinary, signed, complex, zero-containing, degenerate, random, extreme, and adversarial inputs.

### Fixture Non-Privilege Rule

No property observed from a selected demonstration input may become a general claim until it is derived for the full admissible class or tested against declared boundaries.

### Symbolic Separation Rule

Branding, shells, spirals, Fibonacci imagery, the golden ratio, and the historical 3-6-9 fixture receive no mathematical privilege without independent operational necessity or proof.

## Core Langarian maps

\[
P_\theta(x)=e^{i\theta}x
\]

and

\[
A_{\theta,\eta}(x)=\eta e^{i\theta}x,\qquad \eta\ge0.
\]

The implementation permits `eta > 1`, which is amplification rather than attenuation.

`phi_scale` remains a historical compatibility extension. It is not generic scaling or a privileged native law.

## Bridge boundary

`bridge(source, target, cost=k)` records a source/target relation candidate, similarity, and an edge-local caller declaration.

It does not prove:

- state equality;
- path equivalence;
- category-theoretic naturality;
- provenance completeness;
- unique ancestry;
- zero historical path cost.

The v0.2 contract makes the executable behavior precise while leaving the ultimate theoretical object-kind interpretation open.

## Three gates

```text
Syntax / Integrity Gate
        ↓
Formal Eligibility Gate
        ↓
Reality Gate
```

A formal or computational pass never silently becomes empirical truth.

## Install and test

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[dev]'
pytest
```

Browser workbench:

```bash
cd web
npm ci
npm run sync:version
npm run test
npm run build
```

## Version map

Declared in `src/langarian/version.py`:

- product: `0.3.1-rc.1`
- Python kernel: `langarian-python-ref-v0.3.0`
- finite complex model: `langarian-finite-complex-model-v0.2.1`
- metric: `metric:v0.3.scale_safe_normalized_complex_similarity`
- executable receipt schema: `receipt:v0.3`
- DSL: `langarian-dsl:v0.3`
- fixtures: `fixtures:v0.3`
- TypeScript port: `langarian-ts-port-v0.3.0`

Record what happened. Record what did not happen. Record what was assumed. Record what remains unknown.
