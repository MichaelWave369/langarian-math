# Parallax Theory Workbench — Langarian Math

[![tests](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml)
[![pages](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-cyan.svg)](LICENSE)
[![python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](pyproject.toml)

**Product version:** Langarian Math Workbench **v0.3.1-rc.1**  
**Theory Package Architecture:** **v0.1**  
**Live site:** https://michaelwave369.github.io/langarian-math/

The site now has two deliberately separated layers:

```text
Parallax governance shell
        ↓
portable theory packages
        ↓
package-specific executable kernels, when earned
```

Langarian remains the first executable package: a finite-dimensional, receipt-bearing workbench for governed complex-vector transformations. The larger Parallax shell can now admit documentary and formal theory packages without pretending the Langarian vector kernel can execute every theory.

> **The ledger serves reality, not the author.**

## Where a theory enters

A theory enters through a portable manifest that declares:

- objects;
- operators;
- assumptions;
- invariant candidates;
- claim boundaries;
- evidence and Reality Gate status;
- implementation surfaces;
- maturity level.

The browser now opens on a **Theory Packages** module where a researcher can:

- inspect the bundled Langarian and SaaSy packages;
- see why each package exists;
- distinguish documentary/formal packages from executable ones;
- generate a generic package-bound receipt envelope;
- create a new package with the Theory Definition Wizard;
- validate, export, and locally import package manifests;
- open the Langarian executable workbench only when the selected package has earned executable status.

See [`docs/THEORY_PACKAGE_SPEC.md`](docs/THEORY_PACKAGE_SPEC.md) and [`schemas/theory-package.schema.json`](schemas/theory-package.schema.json).

## Can any theory be plugged in?

Any sufficiently explicit theory may enter at **Level 1** as a documentary package. That does not make it executable or true.

| Level | Meaning |
|---|---|
| L1 | Documentary theory: objects, assumptions, claims, dependencies, and unknowns are mapped |
| L2 | Formal specification: domains, operators, proof obligations, and failure conditions are defined |
| L3 | Executable reference: at least one runtime executes declared operators and emits receipts |
| L4 | Conformance tested: a second implementation or test surface produces compatible behavior |
| L5 | Reality-Gate candidate: predictions, datasets, falsifiers, literature comparison, and replication are registered |

The governance architecture is general. Execution is package-specific and must be earned.

Imported manifests are treated as data. The browser does **not** execute arbitrary package code.

## Bundled packages

### Langarian Finite Complex Transformations — Level 4

The current executable package includes:

- finite complex vector states;
- resonance as Euclidean norm;
- a deterministic representative-phase convention;
- normalized complex similarity;
- `harmonic_sum`;
- `phase_shift`;
- `attenuated_phase_shift` / phase-weighted scaling;
- a semantically open `bridge` relation candidate;
- operation receipts and deterministic integrity hashes;
- Python and TypeScript implementation surfaces;
- conformance fixtures and tests;
- a Formal Eligibility Gate.

Package specimen: [`examples/theory-packages/langarian-finite-complex.json`](examples/theory-packages/langarian-finite-complex.json)

### SaaSy Reduced Hamiltonian Program — Level 2

SaaSy is admitted as a documentary/formal package shell rather than being routed through the wrong executable kernel. It records candidate objects, reduction and derivation operations, assumptions, provenance invariants, promotion boundaries, and open semantics.

Package specimen: [`examples/theory-packages/saasy-reduced-hamiltonian.json`](examples/theory-packages/saasy-reduced-hamiltonian.json)

Its non-executable status is a feature: open definitions remain `THEORY_MAP_OPEN` instead of being filled with invented equations.

## Generic receipt envelope

Theory packages can generate an unexecuted envelope with:

- theory package id, version, and schema;
- operation id;
- implementation id and version;
- inputs, parameters, and outputs;
- assumptions used;
- named predicate checks;
- supported and prohibited claims;
- parent receipt ids;
- explicit status;
- timestamp.

The envelope schema version is:

```text
parallax-receipt-envelope:v0.1
```

An envelope marked `NOT_RUN` is a template, not evidence that an operation executed.

## Foundation Phase

The native mathematics is recovered from executable behavior rather than imposed Lagrangian language, preferred numbers, shells, spirals, or golden-ratio symbolism.

The governing obligations are:

1. **Expressiveness** — reproduce every legal operation in scope.
2. **Exclusion** — reject illegal operations.
3. **Preservation** — preserve proved or enforced invariants.
4. **Observability** — expose ambiguity, failure, unsupported inference, and implementation divergence.

See [`docs/NATIVE_FOUNDATION_PROTOCOL.md`](docs/NATIVE_FOUNDATION_PROTOCOL.md).

## Input-general mathematics

The Langarian package begins with arbitrary admissible states:

\[
x\in\mathbb C^n,\qquad 1\le n\le64.
\]

Every foundational claim must be pressure-tested with ordinary, signed, complex, zero-containing, degenerate, random, extreme, and adversarial inputs.

### Fixture Non-Privilege Rule

No property observed from a selected demonstration input may become a general claim until it is derived for the full admissible class or tested against declared boundaries.

### Symbolic Separation Rule

Branding, shells, spirals, Fibonacci imagery, the golden ratio, and the historical 3-6-9 fixture receive no mathematical privilege without independent operational necessity or proof.

## Core maps and symbolic extension

### Neutral maps

\[
P_\theta(x)=e^{i\theta}x
\]

and

\[
A_{\theta,\eta}(x)=\eta e^{i\theta}x,\qquad \eta\ge0.
\]

The implementation permits `eta > 1`, which is amplification rather than attenuation.

### `phi_scale`

`phi_scale` remains an implemented compatibility extension using a golden-ratio power and reflex golden-angle convention. It is not generic scaling or a privileged native law.

A neutral future family would be:

\[
S_a(x)=ax,\qquad a\in\mathbb C.
\]

## Bridge boundary

`bridge(source, target, cost=k)` currently records a source/target relation candidate, similarity, and an edge-local caller declaration.

It does not prove:

- state equality;
- path equivalence;
- category-theoretic naturality;
- provenance completeness;
- unique ancestry;
- zero historical path cost.

`cost=0` means zero declared cost on the newly recorded edge only.

## Genesis custody

Operator calls emit receipts. In v0.3, `state()` creates a root state without an operation receipt. The interface exposes this as an open genesis-custody boundary rather than claiming complete lineage.

A future genesis receipt should distinguish constructed, imported, observed, simulated, manually declared, and recovered roots.

## Three gates

```text
Syntax / Integrity Gate
        ↓
Formal Eligibility Gate
        ↓
Reality Gate
```

1. **Syntax / Integrity** — well formed, internally consistent, version-compatible, and untampered.
2. **Formal Eligibility** — allowed into mathematical review.
3. **Reality** — compared with literature, empirical evidence, prediction, falsification, and replication.

The current executable workbench implements the first two boundaries. Theory packages explicitly record Reality Gate status but do not silently pass it.

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

## Run the historical compatibility example

```bash
langarian run examples/basic_369.yaml --receipts-dir receipts
```

The example remains for project history. Its selected numbers and Phi operation do not validate their own significance.

## Validate and explain executable receipts

```bash
langarian validate receipts/basic_369_bridge.json
langarian explain receipts/basic_369_bridge.json
```

Validation checks schema, integrity hash, status consistency, and allowed versions. It does not independently recompute the operation.

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
- visualization: `viz:v0.3`
- theory package schema: `theory-package:v0.1`
- generic receipt envelope: `parallax-receipt-envelope:v0.1`

## Key documents

- [`docs/THEORY_PACKAGE_SPEC.md`](docs/THEORY_PACKAGE_SPEC.md)
- [`schemas/theory-package.schema.json`](schemas/theory-package.schema.json)
- [`docs/NATIVE_FOUNDATION_PROTOCOL.md`](docs/NATIVE_FOUNDATION_PROTOCOL.md)
- [`docs/DSL_SPEC.md`](docs/DSL_SPEC.md)
- [`docs/OPERATOR_CATALOG.md`](docs/OPERATOR_CATALOG.md)
- [`docs/MATHEMATICAL_DEFINITIONS.md`](docs/MATHEMATICAL_DEFINITIONS.md)
- [`docs/CLAIM_BOUNDARY_MATRIX.md`](docs/CLAIM_BOUNDARY_MATRIX.md)
- [`docs/RECEIPT_SCHEMA_vNEXT.md`](docs/RECEIPT_SCHEMA_vNEXT.md)
- [`docs/NUMERICAL_POLICY.md`](docs/NUMERICAL_POLICY.md)
- [`docs/TEST_AND_CONFORMANCE_REPORT.md`](docs/TEST_AND_CONFORMANCE_REPORT.md)

## Core boundary

A valid package manifest is not a valid theory. A valid receipt is not a proof. A formally coherent model is not automatically a description of nature.

Record what happened. Record what did not happen. Record what was assumed. Record what remains unknown.
