# Langarian Math

[![tests](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml)
[![pages](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-cyan.svg)](LICENSE)
[![python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](pyproject.toml)

**Version:** Langarian Math Workbench **v0.3.1-rc.1**  
**Live site:** https://michaelwave369.github.io/langarian-math/

Langarian is a finite-dimensional, executable, receipt-bearing research workbench for governed mathematical transformations. It records what was computed, which checks ran, what claims the run may support, and what remains unproved.

It does **not** claim to be physics, psychology, therapy, sacred geometry, or a completed mathematical theory.

> **The ledger serves reality, not the author.**

## Foundation Phase

The project is now recovering the mathematics already implicit in the implementation rather than imposing a Lagrangian, scalar-field story, preferred number sequence, or visual metaphor onto the software.

The foundation begins with:

- typed finite complex states;
- implemented operators;
- lawful composition;
- invariant checks;
- receipts and versions;
- claim boundaries;
- failure and ambiguity records.

The governing obligations are:

1. **Expressiveness** — reproduce every legal operation in scope.
2. **Exclusion** — reject illegal operations.
3. **Preservation** — preserve proved or enforced invariants.
4. **Observability** — expose ambiguity, failure, unsupported inference, and implementation divergence.

See [`docs/NATIVE_FOUNDATION_PROTOCOL.md`](docs/NATIVE_FOUNDATION_PROTOCOL.md).

## Input-general mathematics

The neutral state class is:

\[
x\in\mathbb C^n,\qquad 1\le n\le64.
\]

Every foundational theorem or invariant must be stated for arbitrary admissible inputs and pressure-tested with ordinary, signed, complex, zero-containing, degenerate, random, extreme, and adversarial cases.

### Fixture Non-Privilege Rule

No property observed from a selected demonstration input may become a general claim until it is derived for the full admissible class or tested against declared boundaries.

### Symbolic Separation Rule

Branding, shells, spirals, Fibonacci imagery, the golden ratio, and the historical 3-6-9 fixture receive no mathematical privilege without independent operational necessity or proof.

The historical examples remain available only as clearly labeled, non-foundational demonstrations.

## What the workbench implements

- finite complex vector states;
- resonance as Euclidean norm;
- a deterministic representative-phase convention;
- normalized complex similarity;
- vector addition through `harmonic_sum`;
- global phase rotation through `phase_shift`;
- phase-weighted non-negative scaling through `attenuated_phase_shift`;
- `bridge` relation/transition-candidate receipts;
- the historical `phi_scale` symbolic extension;
- epistemic tags and bounded claim language;
- operation receipts with deterministic integrity hashes;
- a Formal Eligibility Gate;
- a local-first browser workbench and DSL.

## Core versus symbolic extension

### Core neutral maps

\[
P_\theta(x)=e^{i\theta}x
\]

and

\[
A_{\theta,\eta}(x)=\eta e^{i\theta}x,\qquad \eta\ge0.
\]

The implementation permits `eta > 1`, which is amplification rather than attenuation; the interface must say so.

### `phi_scale`

`phi_scale` is not generic scaling. It applies a golden-ratio power plus a reflex golden-angle phase convention. It remains implemented for compatibility and explicit symbolic experiments, but it is **not** a privileged law of the native foundation.

The neutral future family is:

\[
S_a(x)=ax,\qquad a\in\mathbb C.
\]

A future `scalar_scale` command must pass the normal implementation, receipt, fixture, and conformance promotion process before entering the stable surface.

## Bridge boundary

The current `bridge(source, target, cost=k)` command records source and target identities, similarity, and a caller-declared edge annotation.

It does not prove:

- state equality;
- path equivalence;
- category-theoretic naturality;
- provenance completeness;
- unique ancestry;
- zero historical path cost.

`cost=0` means zero declared cost on the new bridge edge only. It does not erase intermediate transformation history.

The object kind of `bridge` remains under audit and may later split into comparison, provenance-link, declared-correspondence, and transformation concepts.

## Receipts and genesis custody

Operator calls emit receipts. In v0.3, `state()` constructs a root state without an operation receipt.

That is now treated as an explicit open custody boundary:

> No prior transformation is valid for a genesis state. No lineage record is not.

A future genesis-receipt design should record whether the state was constructed, imported, observed, simulated, manually declared, or recovered.

## The three gates

```text
Syntax / Integrity Gate
        ↓
Formal Eligibility Gate
        ↓
Reality Gate
```

1. **Syntax / Integrity Gate** — is the artifact well formed, internally consistent, version-compatible, and untampered?
2. **Formal Eligibility Gate** — may the claim enter formal mathematical review?
3. **Reality Gate** — has the model earned scientific confidence through evidence and independent replication?

The current workbench implements the first two boundaries. It does not run or pass the Reality Gate.

## Install locally

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[dev]'
```

## Run tests

```bash
pytest
```

## Run the historical compatibility example

```bash
langarian run examples/basic_369.yaml --receipts-dir receipts
```

This example is retained for project history and compatibility. Its selected numbers and Phi operation are not validation of their own significance.

## Validate and explain receipts

```bash
langarian validate receipts/basic_369_bridge.json
langarian explain receipts/basic_369_bridge.json
```

Validation separately checks schema shape, content-hash integrity, status consistency, and schema-version allowance. It does not independently recompute the underlying operation.

## Browser workbench

```bash
cd web
npm ci
npm run sync:version
npm run dev
npm run test
npm run build
```

The default browser program now uses a neutral complex fixture:

```text
A = state([[1,1],[3,-2],[0,-4]], label="A")
B = phase_shift(A, pi/7)
C = harmonic_sum(B, B)
D = attenuated_phase_shift(C, pi/11, 0.75, cost="declared edge-local attenuation")
bridge(A, D, cost=0, label="comparison edge only")
```

This is a reproducible example, not a privileged input.

## Version map

Version strings are declared in `src/langarian/version.py`:

- product: `0.3.1-rc.1`
- Python kernel: `langarian-python-ref-v0.3.0`
- finite complex model: `langarian-finite-complex-model-v0.2.1`
- metric: `metric:v0.3.scale_safe_normalized_complex_similarity`
- receipt schema: `receipt:v0.3`
- DSL: `langarian-dsl:v0.3`
- fixtures: `fixtures:v0.3`
- TypeScript port: `langarian-ts-port-v0.3.0`
- visualization: `viz:v0.3`

## Key documents

- [`docs/NATIVE_FOUNDATION_PROTOCOL.md`](docs/NATIVE_FOUNDATION_PROTOCOL.md)
- [`docs/DSL_SPEC.md`](docs/DSL_SPEC.md)
- [`docs/OPERATOR_CATALOG.md`](docs/OPERATOR_CATALOG.md)
- [`docs/MATHEMATICAL_DEFINITIONS.md`](docs/MATHEMATICAL_DEFINITIONS.md)
- [`docs/CLAIM_BOUNDARY_MATRIX.md`](docs/CLAIM_BOUNDARY_MATRIX.md)
- [`docs/RECEIPT_SCHEMA_vNEXT.md`](docs/RECEIPT_SCHEMA_vNEXT.md)
- [`docs/NUMERICAL_POLICY.md`](docs/NUMERICAL_POLICY.md)
- [`docs/TEST_AND_CONFORMANCE_REPORT.md`](docs/TEST_AND_CONFORMANCE_REPORT.md)

## Core boundary

A poetic or interpretive statement may accompany a computation, but it cannot certify a formal result. A formal result may enter review, but that does not make the model empirically true.

Record what happened. Record what did not happen. Record what was assumed. Record what remains unknown.
