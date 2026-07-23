# Operator Catalog — Langarian Math Workbench v0.3

This catalog describes the executable surface currently implemented in `src/langarian/operators.py` and mirrored in `web/src/kernel/operators.ts`.

It separates three questions:

1. What does the implementation execute?
2. What mathematics follows from the declared map?
3. What status does the operator have in the input-general native foundation?

An implemented operator is not automatically a foundational law.

## 1. Shared state domain

Unless stated otherwise, operators act on finite complex vectors:

\[
x\in\mathbb C^n,\qquad 1\le n\le 64.
\]

Demonstration coordinates, names, glyphs, and project branding are not part of the mathematical domain.

## 2. Foundation status vocabulary

- **CORE** — neutral implemented behavior appropriate for foundation recovery.
- **CORE / SEMANTICS OPEN** — implemented neutral behavior whose object kind or governance meaning remains ambiguous.
- **SYMBOLIC EXTENSION** — implemented behavior tied to a selected symbolic convention; valid computation, non-foundational.
- **CANDIDATE** — proposed but not yet stable.
- **EXPERIMENTAL** — research/demo lane.
- **INTERPRETIVE** — quarantined from formal eligibility.
- **REJECTED** — must not re-enter the stable surface without a new promotion review.

## 3. Implemented operators

### 3.1 `harmonic_sum(a, b)` — CORE

**Map**

\[
H(a,b)=\iota_a(a)+\iota_b(b)\in\mathbb C^{\max(\dim a,\dim b)},
\]

where the shorter vector is embedded by leading-coordinate zero padding.

**Input type**

Two finite complex states, possibly of different dimensions.

**Output type**

One finite complex state.

**Preserved or controlled properties**

- output dimension is the padded common dimension;
- both input hashes are recorded;
- state finiteness and coherence bounds are checked.

**Changed quantities**

Norm, phase, component values, and similarity may change.

**Important boundary**

The padding map is an explicit convention, not a theorem forced by the objects. The emitted before/after coherence fields use different statistics; they must not be read as a single canonical delta without further formalization.

### 3.2 `phase_shift(state, angle)` — CORE

**Map**

\[
P_\theta(x)=e^{i\theta}x.
\]

**Input type**

One finite complex state and a finite real angle in radians.

**Output type**

One finite complex state.

**General mathematics**

For every admissible `x` and real `theta`:

\[
\|P_\theta(x)\|=\|x\|.
\]

Component ratios and projective direction are preserved. The representative global phase changes.

**Software claim boundary**

The general theorem comes from elementary complex linear algebra. The receipt records a per-instance conformance check under the declared numerical policy; it does not prove the theorem.

### 3.3 `attenuated_phase_shift(state, angle, attenuation)` — CORE

**Map**

\[
A_{\theta,\eta}(x)=\eta e^{i\theta}x,\qquad \eta\ge0.
\]

**Input type**

One finite complex state, a finite real angle, and a finite non-negative real factor.

**Output type**

One finite complex state.

**General mathematics**

\[
\|A_{\theta,\eta}(x)\|=\eta\|x\|.
\]

For nonzero `x` and nonzero `eta`, projective direction is preserved. At `eta=0`, the output is the zero vector and projective direction is undefined.

**Naming boundary**

The implementation permits `eta>1`; this is amplification, not attenuation. Interfaces must state that explicitly.

**Cost boundary**

The current cost label is caller-declared and unverified. I3 checks presence for decreases; it does not calculate adequacy and does not account for amplification.

### 3.4 `phi_scale(state, n)` — SYMBOLIC EXTENSION

**Implemented map**

\[
F_n(x)=\varphi^n e^{in\gamma}x,
\qquad
\gamma=\frac{2\pi}{\varphi}.
\]

Here `gamma` is the reflex of the conventional phyllotaxis golden angle.

**Input type**

One finite complex state and an integer `n` with `|n|<=64`.

**Output type**

One finite complex state.

**Foundation ruling**

This operator is valid finite arithmetic and remains available for compatibility and explicit symbolic experiments. It is **not** generic scalar multiplication and does not establish that the golden ratio, Fibonacci numbers, spirals, shells, growth, harmony, or 3-6-9 are privileged in the native theory.

The neutral family for future formalization is:

\[
S_a(x)=ax,\qquad a\in\mathbb C.
\]

A future `scalar_scale` operator may enter the stable surface only through the normal promotion rule: Python and TypeScript implementations, tests, conformance fixtures, receipts, and reviewed claim boundaries.

### 3.5 `bridge(source, target, cost=0)` — CORE / SEMANTICS OPEN

**Current computation**

- records source and target hashes;
- computes normalized complex similarity;
- stores the target hash as output hash;
- records a caller-declared finite cost value;
- emits a typed receipt.

**Current object-kind ambiguity**

The command may be read as a comparison, provenance relation, declared correspondence, synthetic transition edge, or path annotation. These are not the same mathematical object.

**Audit disposition**

\[
\boxed{\text{SPLIT REQUIRED — candidate, not yet executed}}
\]

Until a future API split is implemented, the bounded meaning is:

> `bridge` records a source/target relation candidate plus coherence and an edge-local caller declaration.

It does not establish state equality, path equivalence, category-theoretic naturality, provenance completeness, or a unique ancestry chain.

## 4. Edge cost versus path cost

The current `bridge` parameter must be interpreted as:

\[
c_{\mathrm{edge}}(x,y).
\]

It must not be promoted to:

\[
c_{\mathrm{path}}(x\rightsquigarrow y)=\bigoplus_j c(e_j).
\]

The cost domain and composition operator remain open. Consequently:

```text
bridge(A, D, cost=0)
```

means only that the new declared bridge edge has zero caller-declared cost. It does not erase intermediate costs or imply a zero-cost historical path.

## 5. Composition observations

For phase-weighted scaling maps:

\[
T_{\theta,\eta}(x)=\eta e^{i\theta}x,
\]

composition gives:

\[
T_{\theta_2,\eta_2}\circ T_{\theta_1,\eta_1}
=
T_{\theta_1+\theta_2,\eta_1\eta_2}.
\]

The identity is `T_(0,1)`. An inverse exists when `eta` is nonzero:

\[
T_{\theta,\eta}^{-1}=T_{-\theta,1/\eta}.
\]

If the admissible family is restricted to `0<=eta<=1`, it is generally not closed under inverses. These are mathematical observations about the declared maps; the full receipt-bearing algebra remains a candidate until receipt composition and governance semantics are recovered.

## 6. Invariant classes

Future audit should classify checks as:

- **structural** — type, dimension, finite representation;
- **numerical** — bounds, tolerances, norm or similarity checks;
- **provenance** — input and parent identities remain addressable;
- **governance** — authority, version, cost, and promotion rules;
- **epistemic** — claim tags and prohibited inferences.

A single label `PASS` is insufficient. Each result must identify the actual predicate, operands, expected condition, observed value, tolerance, and implementation version.

## 7. Fixture non-privilege

The historical `(3,6,9)` example is classified as an **INTERPRETIVE demonstration fixture**. It may be preserved for project history but may not validate its own significance.

Every foundational claim must be stated for arbitrary admissible inputs and pressure-tested on neutral, random, zero, degenerate, extreme, and adversarial cases.

## 8. Promotion rule

No new operator enters the stable executable surface silently. Promotion requires:

1. an exact mathematical or computational map;
2. admissible input and output types;
3. Python reference implementation;
4. TypeScript conformance mirror;
5. deterministic fixtures and tests;
6. receipt fields and failure behavior;
7. reviewed claim language;
8. explicit foundation status.

See `docs/NATIVE_FOUNDATION_PROTOCOL.md` for the governing recovery and audit process.
