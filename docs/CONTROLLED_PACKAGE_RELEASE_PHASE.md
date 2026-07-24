# Controlled Package Mutation and Release Governance — v0.7

Status: **implemented public governance phase**

This phase governs the boundary between a signed promotion or rollback decision and an actual package-manifest change.

It answers a narrow question:

> Given one operative signed authority decision, which exact manifest bytes may enter one separately controlled repository write?

It does not answer whether the theory is true, whether the mathematics is proved, or whether the repository was already changed.

## Governing rule

A governance decision may authorize a change, but it must never become an unbounded instruction such as:

```text
Promote the package.
```

The release layer converts that broad authorization into one content-addressed transition:

```text
exact before manifest hash
        +
restricted signed patch
        +
exact after manifest hash
        +
independent release custody
        =
authorized release artifact, not yet committed
```

The governing sentence is:

> No package mutation is authorized until its source bytes, permitted patch, target bytes, decision, and release authority are bound into one verifiable archive.

## Why this phase exists

The previous phases establish:

1. package structure;
2. operator contracts;
3. conformance evidence;
4. evidence custody;
5. promotion eligibility;
6. mandate-bound authority approval.

None of those phases should directly edit a package manifest.

Without a separate release layer, a valid decision could still be applied:

- to the wrong package version;
- after the source manifest changed;
- with extra undocumented edits;
- by the same authority that approved it;
- after the decision expired or was appealed;
- multiple times;
- without preserving the prior manifest;
- without a reconstructable before/after record.

This phase closes that gap.

## Public artifact versions

```text
package-manifest-patch:v0.1
package-release-policy:v0.1
package-release-proposal:v0.1
package-release-receipt:v0.1
package-release-bundle:v0.1
package-release-archive:v0.1
```

The portable archive schema is:

- [`schemas/package-release-archive.schema.json`](../schemas/package-release-archive.schema.json)

## Release actions

The phase supports two actions:

```text
PROMOTION
ROLLBACK
```

### Promotion

A promotion proposal must consume an operative signed authority decision whose status is:

```text
APPROVED_PENDING_PACKAGE_UPDATE
```

The before manifest must match:

- the decision package id;
- the decision package version;
- the decision current maturity level;
- the exact signed before-manifest hash.

The after manifest must use the decision target maturity level.

### Rollback

A rollback proposal must consume:

- a cryptographically valid signed authority decision;
- an independently verified rollback quorum;
- a package whose release-governance metadata binds it to that decision.

The rollback target maturity is the decision's recorded prior maturity level.

A rollback receives a new version. It does not restore an old file by deleting subsequent history.

## Restricted patch surface

The v0.1 policy permits exactly three manifest paths:

```text
/theory/version
/maturity_level
/metadata/release_governance
```

No other object, operator, assumption, invariant, implementation, claim boundary, evidence status, or theory identity may change through this lane.

The patch must contain exactly one operation for each permitted path and no other paths.

The release engine compares normalized immutable views of the before and after manifests. Any mutation outside the allowed surface blocks the release.

## Release-governance metadata

The after manifest receives an append-only governance record containing at least:

```json
{
  "schema_version": "release-governance-metadata:v0.1",
  "action": "PROMOTION",
  "authority_decision_id": "authority-decision:<sha256>",
  "prior_manifest_hash": "sha256:<hex>",
  "prior_version": "1.0.0",
  "released_at_utc": "<timestamp>",
  "release_authority_id": "authority:<sha256>"
}
```

For rollback, `action` is `ROLLBACK`.

This record does not replace the external release ledger or repository history. It provides a direct manifest-level pointer back to the governing decision and prior state.

## Independent release custody

The release authority must:

- be active;
- have a content-addressed Ed25519 identity;
- carry role `release-custodian`;
- carry `release:package-mutation` for promotion or `release:package-rollback` for rollback;
- be distinct from the signed decision recorder;
- be distinct from all approval authorities recorded in the decision;
- declare at least one independence domain outside the governance quorum domains.

Declared independence is a governance control. It is not proof of social, institutional, financial, or empirical independence.

## Signed release proposal

A release proposal binds:

- action;
- authority decision id;
- package id;
- source version;
- target version;
- before-manifest SHA-256;
- after-manifest SHA-256;
- patch SHA-256;
- exact patch operations;
- release authority id;
- issue and expiry times;
- release-policy identity;
- release-authority signature.

The proposal is content-addressed as:

```text
release-proposal:<sha256>
```

The default proposal validity window is 60 minutes.

## Decision gate

For promotion, the signed decision must be operative under the authority lifecycle:

- signature valid;
- recorder valid and active;
- status approved;
- not expired;
- no valid appeal open;
- no rollback quorum already authorized.

For rollback, the original decision's cryptographic record must remain valid and the rollback quorum must independently verify. Decision expiry does not erase the historical decision or prevent a later properly mandated rollback.

## Atomic before/after integrity

The release engine computes:

```text
before_manifest_hash = SHA256(canonical(before_manifest))
after_manifest_hash  = SHA256(canonical(apply(before_manifest, patch)))
patch_digest         = SHA256(canonical({schema_version, patch}))
```

The source object is never mutated while materializing the after manifest.

A repository writer must compare the live source bytes to `before_manifest_hash` immediately before applying the patch. If the hash differs, the write must stop and a new proposal must be produced.

This is optimistic concurrency control over the package manifest.

## Release receipt

The signed release receipt has one of two statuses:

```text
AUTHORIZED_NOT_COMMITTED
BLOCKED
```

`AUTHORIZED_NOT_COMMITTED` means:

- the decision gate is open;
- the release proposal is valid;
- the exact source hash matches;
- the exact restricted patch is valid;
- the exact after hash matches;
- the after package validates;
- role separation and release custody pass.

It does **not** mean the repository changed.

Every receipt explicitly records:

```text
repository_commit_status = NOT_COMMITTED
```

The receipt is signed by the same independent release authority that signed the proposal and is content-addressed as:

```text
release-receipt:<sha256>
```

## Replay protection

The receipt includes a deterministic replay key derived from:

- authority decision id;
- action;
- before-manifest hash;
- after-manifest hash.

The browser can compute and display this key, but it cannot enforce global uniqueness.

The eventual repository writer or external release ledger must reject a replay key that has already been consumed.

This limitation is explicit. A portable artifact cannot by itself know every write performed elsewhere.

## Portable release archive

A release archive contains:

```text
signed authority decision
public authority bundle
before manifest
after manifest
signed release proposal
signed release receipt
```

The archive is self-contained for public verification. It contains public keys and signed records only. It contains no private keys and grants no repository permissions.

Imported archives are treated as data and re-evaluated locally.

## Repository-write boundary

This phase deliberately stops before a repository commit.

A later controlled writer must:

1. validate the archive;
2. verify every signature and identity fingerprint;
3. re-evaluate the decision and release policy;
4. verify the live source manifest hash;
5. verify the replay key is unused;
6. write only the archived after manifest;
7. record the resulting commit identity;
8. emit a commit-attached application receipt;
9. preserve the before manifest and all governance artifacts.

Until those steps occur, the release receipt remains `AUTHORIZED_NOT_COMMITTED`.

## Current Langarian ruling

The current public Langarian package has not re-earned strict Level-4 conformance because adversarial, declared-failure, and first-falsifier evidence remains incomplete.

Therefore its current authority decision remains blocked.

The Release Governance room intentionally demonstrates:

```text
release proposal signature: valid
before/after hash binding: valid
release authority separation: valid
authority decision gate: blocked
release result: BLOCKED
repository commit: not performed
```

This is the expected result.

A valid release custodian cannot convert a blocked governance decision into an authorized mutation.

## Security and claim boundaries

This phase does not prove:

- mathematical correctness;
- empirical truth;
- reviewer independence beyond declared metadata;
- repository application;
- replay-key uniqueness outside the current ledger;
- absence of forks or external copies;
- that Git history can or should be rewritten.

The phase prohibits these inferences:

```text
The repository was automatically modified.
The package release was applied more than once.
Release signatures prove the mathematical claims.
The package passed the Reality Gate.
Historical manifests or decisions may be deleted.
```

## Test obligations

The phase must prove at least:

- an operative signed decision plus independent release custody authorizes an exact promotion artifact;
- the source manifest object is not mutated;
- a blocked decision remains blocked despite valid release custody;
- a decision recorder cannot also act as release custodian under the default policy;
- stale before-manifest hashes fail;
- unauthorized patch paths fail;
- target-manifest tampering fails;
- signed receipts bind the exact proposal and both manifests;
- rollback requires valid independent rollback quorum;
- rollback produces a new version and preserves prior history;
- public artifacts contain no private research identifiers.

## Constitutional summary

```text
Decision is not mutation.
Authorization is not commit.
A patch may change only what the decision earned.
The live before hash must match at the instant of write.
Release authority must be separate from governance approval.
Rollback appends history; it does not erase history.
A signed release receipt proves custody over an exact transition, not truth.
```
