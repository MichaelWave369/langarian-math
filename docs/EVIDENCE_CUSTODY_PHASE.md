# Evidence Custody Phase v0.4

**Status:** implemented browser and CI phase  
**Scope:** canonical evidence identity, signing, verification, supersession, revocation, and CI build provenance  
**Non-goal:** signatures and attestations do not establish mathematical proof or empirical truth.

## Why this phase exists

Contract Conformance v0.3 answers whether a declared evidence suite covers operator contracts and whether implementation surfaces agree.

It does not, by itself, answer:

- whether the evidence bytes changed after review;
- which key signed a particular evidence artifact;
- whether the signer is still active;
- whether an older artifact was superseded;
- whether evidence was explicitly revoked;
- which repository commit and workflow produced a released evidence bundle.

Evidence Custody v0.4 adds those lifecycle controls without converting origin or integrity into truth.

## Trust separation

The workbench maintains four distinct questions:

1. **Integrity** — are these the same bytes or canonical data that were signed?
2. **Origin** — which declared identity or workflow signed or attested them?
3. **Conformance** — do the observations satisfy the operator contract and agree across implementations?
4. **Reality** — does the theory survive empirical testing and independent replication?

A positive answer to an earlier question does not answer a later one.

## Canonical subject identity

Custody subjects are hashed as canonical JSON using SHA-256.

Canonicalization:

- sorts object keys lexicographically;
- preserves array order;
- normalizes negative zero to zero;
- rejects `NaN`, infinity, cycles, functions, symbols, `bigint`, and undefined values;
- emits UTF-8 JSON bytes.

Digest form:

```text
sha256:<64 lowercase hexadecimal characters>
```

The browser recomputes this digest during every verification.

## Local Ed25519 signer lane

The browser may generate an Ed25519 key pair through Web Crypto.

The public identity records:

- stable signer id derived from the public JWK digest;
- display name;
- Ed25519 public JWK;
- authority scope;
- active or revoked status;
- creation timestamp;
- custody-class metadata.

The private key:

- remains in memory;
- is not written into exported custody bundles;
- is not uploaded by the workbench;
- disappears when the page or session is discarded.

This local lane proves the protocol mechanics and control of an ephemeral key. Durable institutional custody should use an external signer, hardware-backed key, or CI identity rather than treating the browser demonstration key as permanent authority.

## Signed evidence envelope

Schema:

```text
evidence-custody-envelope:v0.1
```

An envelope binds:

- subject kind;
- canonical subject digest;
- subject locator;
- signer id;
- signing timestamp;
- superseded evidence ids;
- bounded metadata.

The Ed25519 signature covers the canonical envelope body excluding the signature and derived evidence id.

The evidence id is then derived from the canonical signed body:

```text
evidence:<sha256 of canonical envelope body plus signature>
```

This makes evidence identifiers content-addressed and prevents an arbitrary id from being detached from the signed record.

## Supersession

A newer valid envelope may list earlier evidence ids in `supersedes`.

Supersession:

- does not delete the prior envelope;
- leaves the full history inspectable;
- marks the older evidence inactive for current custody use;
- applies only when the superseding envelope itself verifies and has not been revoked.

A broken or revoked envelope cannot lawfully supersede prior evidence.

## Revocation

Schema:

```text
evidence-revocation:v0.1
```

A revocation record binds:

- target evidence id;
- authority signer id;
- reason;
- issuance timestamp;
- metadata;
- Ed25519 signature.

The revocation id is content-addressed from its canonical signed body.

The browser accepts a revocation only when:

- the authority identity is known;
- the authority is active;
- the signature verifies;
- the revocation id matches the canonical signed body.

A valid revocation leaves the evidence visible but prevents it from being counted as active custody evidence.

## Custody bundle

Schema:

```text
evidence-custody-bundle:v0.1
```

A portable custody bundle contains only:

- public signer identities;
- signed evidence envelopes;
- signed revocation records;
- public metadata.

It contains no private key and no executable code.

## Browser verification profile

For every envelope the browser reports:

- subject-digest match;
- evidence-id match;
- signature validity;
- signer identity presence;
- signer status;
- revocation status;
- supersession status;
- final acceptance.

Active evidence must satisfy all cryptographic and lifecycle checks.

## GitHub Actions attestation lane

On a push to `main`, the test workflow:

1. runs the Python, browser, and cross-language conformance suites;
2. builds a public evidence-custody directory;
3. hashes each included source artifact;
4. writes `ci-evidence-custody-manifest:v0.1` with repository, commit, ref, workflow, run, and subject digests;
5. archives the directory;
6. uploads the archive as a workflow artifact;
7. submits a GitHub build-provenance attestation for the archive.

The attestation uses GitHub Actions OIDC and GitHub’s artifact-attestation service. In a public repository, the signing lane is backed by Sigstore infrastructure and binds the archive digest to the workflow identity.

Verification example:

```bash
gh attestation verify \
  --owner MichaelWave369 \
  langarian-evidence-custody-<commit>.tar.gz
```

The exact artifact name is emitted by the workflow.

## CI claim boundary

The GitHub attestation supports claims such as:

- this archive digest was produced by the named repository workflow;
- the archive is associated with a particular commit and workflow run;
- downloaded bytes either match or fail the attested digest.

It does not support claims such as:

- every conformance observation inside is correct;
- the implementation is bug-free;
- the operator contract is mathematically complete;
- the theory describes nature;
- GitHub workflow identity is an independent scientific replication.

## Relationship to Contract Conformance v0.3

Contract Conformance determines whether an evidence suite is structurally and behaviorally sufficient for promotion.

Evidence Custody determines whether a particular evidence artifact has preserved identity, origin, and lifecycle.

The intended gate is:

```text
valid operator contract
        ↓
complete conformance suite
        ↓
active signed or attested custody
        ↓
formal promotion review
```

Custody cannot repair missing test classes, unexercised failures, unresolved semantics, or absent first-falsifier evidence.

## Public boundary

The custody phase uses only:

- the public Langarian package;
- public conformance fixtures;
- public schemas and documentation;
- neutral CI provenance metadata.

No private research package or identifier is included.

## Governing rule

> A signature establishes accountable custody over identified bytes. It does not grant those bytes the right to overstate what they prove.
