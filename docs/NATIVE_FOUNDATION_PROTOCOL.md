# Langarian Native Foundation Protocol

**Status:** Foundation Phase — active  
**Scope:** governance-first recovery of the mathematics already implemented by the Langarian workbench  
**Canon status:** this protocol governs recovery and audit; candidate mathematical structures remain **NOT CANON** until independently implemented and tested.

> The ledger serves reality, not the author.

## 1. Purpose

Langarian is not to be justified by a preferred number sequence, visual motif, shell, spiral, golden-ratio analogy, or inherited Lagrangian language. The foundation must be recovered from executable behavior:

- typed states;
- implemented operators;
- lawful composition;
- receipts;
- invariant checks;
- claim boundaries;
- authority and version rules;
- failure and recovery behavior.

Every symbol introduced into the formal model must refer to something the workbench actually represents, executes, records, or rejects.

## 2. Four formal obligations

A recovered specification must satisfy four obligations.

1. **Expressiveness** — reproduce every legal operation in scope.
2. **Exclusion** — reject every operation declared illegal by the recovered rules.
3. **Preservation** — preserve every invariant actually enforced or mathematically proved.
4. **Observability** — expose unresolved ambiguity, implementation divergence, failure, and unsupported inference.

A definition is mature only when two independent implementers can build compatible systems from it without asking the author what was meant.

## 3. H0 — scope and evidence freeze

Before formalization, each audit must freeze:

- repository, branch, and commit;
- product, kernel, model, metric, receipt, DSL, and port versions;
- admitted source files and documents;
- implemented commands in scope;
- sample programs and exported receipts;
- runtime implementations being compared;
- explicit exclusions.

No behavior from another Parallax application or design document may be silently imported into this scope.

## 4. Evidence classes

Every recovered assertion must carry one evidence class:

- **OBSERVED** — witnessed in an execution or exported artifact;
- **IMPLEMENTED** — directly present in source code;
- **DOCUMENTED** — stated in an admitted specification;
- **INFERRED** — concluded from behavior but not explicitly specified;
- **ASPIRATIONAL** — intended but not enforced;
- **UNKNOWN** — unresolved.

Implemented behavior and aspirational governance must never be reported as the same thing.

## 5. Recovery packets

### H1 — Observable Object Inventory

For every object record:

- stable identifier and name;
- creator;
- required fields;
- identity rule;
- mutable fields;
- deletion or tombstone behavior;
- version behavior;
- evidence of existence;
- current implementation;
- open ambiguities.

### H2 — Operation Catalog

For every operation record:

- input type;
- preconditions;
- actor authority;
- mathematical or computational transformation;
- output type;
- receipt behavior;
- failure behavior;
- reversibility;
- implementation location.

### H3 — Receipt Specimens

Provide one actual exported receipt for each operation class and document:

- input identities and hashes;
- operator identity and version;
- parameter encoding;
- output identity and hash;
- predicate checks;
- status collapse;
- runtime and schema versions;
- claim boundaries;
- parent references.

### H4 — Authority Map

Identify who or what may create, test, review, promote, quarantine, supersede, revoke, repair, and audit.

### H5 — Ambiguity Register

At minimum include:

- deletion versus tombstoning;
- claim mutation versus new version;
- source revision;
- receipt challenge;
- retroactive authority;
- conflicting governance rules;
- edge cost versus path cost;
- the meaning of `bridge`;
- genesis-state custody;
- implementation disagreement.

### H6 — App-to-Concept Map

Map every visible feature to a recovered governance concept. When no lawful mapping exists, mark it **THEORY MAP OPEN**.

## 6. Audit dispositions

Ori-style independent audit uses the following dispositions:

- **ACCEPTED**
- **PROVISIONAL**
- **MERGED**
- **SPLIT REQUIRED**
- **REJECTED**
- **ASPIRATIONAL**
- **IMPLEMENTATION DIVERGENCE**
- **THEORY MAP OPEN**

`PASS` alone is insufficient. A pass must name the predicate, operands, tolerance, expected condition, observed value, and implementation version.

## 7. Input-generality rules

### Fixture Non-Privilege Rule

No property observed from a selected demonstration input may be promoted to a general claim until it has been derived for the full admissible input class or tested against declared boundaries.

### Symbolic Separation Rule

Project symbols, branding, visual metaphors, historically motivating numbers, and aesthetically selected constants receive no mathematical privilege without independent operational necessity or proof.

The neutral state class is:

\[
x \in \mathbb{C}^n, \qquad 1 \le n \le 64.
\]

The vector `(3,6,9)` may remain as a historical demonstration fixture, but it is not foundational evidence. The same applies to shells, Fibonacci imagery, and golden-ratio language.

Required test classes include:

- ordinary real vectors such as `(1,2,4)`;
- signed vectors such as `(2,-5,7)`;
- complex vectors such as `(1+i,3-2i,-4i)`;
- vectors with zero components;
- the entire zero vector where the operation is defined;
- degenerate and repeated-component vectors;
- random vectors;
- extreme finite magnitudes;
- adversarial parameter and dimension boundaries.

## 8. Current operator semantics and boundaries

### Phase shift

\[
P_\theta(x)=e^{i\theta}x.
\]

For every admissible `x` and real `theta`, exact complex linear algebra gives:

\[
\|P_\theta(x)\|=\|x\|.
\]

A theorem supplies the expected behavior. A conformance test checks whether this implementation obeys it. The test does not prove the theorem.

### Scalar transformation family

The neutral family is:

\[
S_a(x)=ax, \qquad a\in\mathbb C.
\]

For nonzero `x` and nonzero `a`, projective direction and normalized absolute similarity are preserved; norm and global phase generally change.

The currently implemented `phi_scale` is **not** neutral scalar scaling. It applies a golden-ratio power and a reflex golden-angle rotation. It therefore remains an implemented symbolic extension, not a privileged law of the native foundation.

### Attenuated phase shift

\[
A_{\theta,\eta}(x)=\eta e^{i\theta}x, \qquad \eta\ge 0.
\]

The implementation currently permits `eta > 1`, which is amplification rather than attenuation. Documentation and interfaces must say so explicitly.

### Bridge

`bridge` is currently semantically overloaded and remains **SPLIT REQUIRED** until recovery determines whether each use is:

- a provenance relation;
- a comparison;
- a declared correspondence;
- a synthetic transition edge;
- a state-producing transformation.

A relation, comparison, and transformation are not interchangeable object kinds.

## 9. Edge cost and path cost

A bridge receipt with `cost=0` means only that the newly declared edge carries zero caller-declared cost. It must not imply that the historical path from source to target had zero cost.

Use the distinction:

\[
c_{\mathrm{edge}}(x,y)
\]

versus

\[
c_{\mathrm{path}}(x\rightsquigarrow y)=\bigoplus_j c(e_j).
\]

The composition operator `oplus` and cost domain remain candidates. A zero-cost edge may not erase or replace prior cost history.

## 10. Genesis-state custody

A root state need not have a preceding transformation, but it must have an origin class and custody record. Suggested origin classes:

- constructed;
- imported;
- observed;
- simulated;
- manually declared;
- recovered.

The current v0.3 DSL emits no operation receipt for `state()`. Until a genesis receipt exists, interfaces must label this as an open custody boundary rather than saying lineage is complete.

## 11. Receipt theory candidates

A receipt may be sketched as:

\[
R=(\text{inputs},\text{operator},\text{parameters},\text{output},\text{checks},\text{status},\text{versions},\text{claims}).
\]

This remains a candidate, not canon.

Three equivalence notions must remain distinct:

1. **Execution equivalence** — same execution identity, implementation, parameters, and hashes.
2. **Semantic equivalence** — different executions realize the same mathematical map on the relevant domain.
3. **Claim equivalence** — receipts lawfully support the same bounded claim.

Receipt composition requires compatible types, versions, policies, claim boundaries, and matching output/input identities. A composite receipt references its component receipts; it never replaces their history.

Receipt ancestry should be modeled as a provenance DAG rather than assumed to be a unique chain. Multi-input derivations, comparisons, reviews, and merges may have several parents.

## 12. Candidate native structure

The following structures are orientation sketches only:

\[
\mathfrak P=(\mathcal S,\mathcal O,\circ,\mathcal I,\mathcal R,\mathcal C)
\]

and

\[
\mathcal P=(\mathcal O_b,\mathcal E,\mathcal T,\mathcal A,\mathcal V,\mathcal R).
\]

Possible readings include typed states or objects, relations, lawful transitions, invariant families, authority, versioned rules, receipt maps, and claim boundaries.

**CANDIDATE — NOT CANON.** The recovered object determines the notation, not the reverse.

## 13. First theorem candidates

These are proof obligations, not current claims:

1. Every legal transformation preserves accessible provenance or an auditable custody-preserving tombstone.
2. Every non-genesis receipt has a complete, finite, addressable parent set.
3. Receipt ancestry is acyclic under the declared transition rules.
4. No promoted claim can lose all reachable derivation evidence through a legal transition.
5. A zero-cost edge cannot rewrite the accumulated cost of an existing path.
6. Independent implementations of a mature definition produce compatible states, receipts, failures, and claim boundaries.

Each candidate must include a first falsifier.

## 14. Independent-audit profile

Independence is not a Boolean. Audits may share model families, training data, source documents, prompts, retrieval, implementation, or human framing.

A candidate independence profile is:

\[
\mathbf d=(d_{\mathrm{model}},d_{\mathrm{data}},d_{\mathrm{prompt}},d_{\mathrm{source}},d_{\mathrm{implementation}},d_{\mathrm{human}}).
\]

This is a research direction, not an implemented score.

## 15. Role separation

- **Hughes — implementation custodian:** expose actual machinery, including awkward and conflicting behavior.
- **Ori — independent auditor:** attack definitions, invariants, conformance, and implementation agreement.
- **Emet — mathematical steward:** formalize only after recovery and audit evidence exist; distinguish derivation from candidate language.

No role may promote a definition solely because it is elegant, familiar, or symbolically attractive.

## 16. Governing principle

> No aesthetically selected number sequence may become theoretical evidence for its own significance.

Beauty may guide demonstrations. Only recovered semantics, proof, conformance, and evidence may govern the foundation.
