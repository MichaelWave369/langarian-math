# Merge Observation and Release Reconciliation — v0.9

Status: **implemented public governance phase**

This phase governs the boundary between a controlled package application that exists on a review branch and a package state that has actually entered the repository's base branch through a merged pull request.

It answers one narrow question:

> Did GitHub merge the exact controlled application that was reviewed, and what exact prior state may a future separately governed rollback reference?

It does not answer whether the theory is true, whether the package should be rolled back, or whether a merge may be erased.

## Governing rule

The original application receipt remains immutable:

```text
status = APPLIED_ON_REVIEW_BRANCH
merge_status = NOT_MERGED
```

After a verified merge, the system appends a different record:

```text
repository-merge-observation:v0.1
status = MERGED
```

The merge observation does not edit the original receipt from `NOT_MERGED` to `MERGED`.

The governing sentence is:

> A later repository event must be recorded as a later observation, never as a retroactive rewrite of what an earlier receipt truthfully knew.

## Why this phase exists

The controlled writer establishes that:

- an authorized target manifest was committed on a review branch;
- the mutation commit is known;
- a replay key was consumed on that branch;
- an application receipt binds the branch and commit;
- an application bundle was uploaded and attested.

That still does not establish that:

- the pull request was merged;
- the reviewed tree is the tree that reached the base branch;
- the merge contains the same application receipt;
- the merged replay ledger contains the same replay entry;
- the original signed release chain still verifies;
- the exact rollback boundary has been frozen.

This phase closes those gaps.

## Public artifact versions

```text
repository-reconciliation-policy:v0.1
repository-merge-observation:v0.1
repository-rollback-anchor:v0.1
repository-merge-ledger:v0.1
repository-merge-reconciliation-bundle:v0.1
```

Schemas:

- [`schemas/repository-merge-observation.schema.json`](../schemas/repository-merge-observation.schema.json)
- [`schemas/repository-rollback-anchor.schema.json`](../schemas/repository-rollback-anchor.schema.json)
- [`schemas/repository-merge-ledger.schema.json`](../schemas/repository-merge-ledger.schema.json)

## Trigger boundary

The reconciliation workflow runs only for:

- a merged pull request whose head branch begins with `controlled-release/`; or
- an explicit manual reconciliation request naming a merged controlled-release pull request.

The workflow uses `pull_request_target` only to run trusted code from `main`.

It does not check out or execute code from the application pull request.

The application branch is fetched as repository data for commit and tree inspection.

## Required pull-request shape

A controlled application pull request must change exactly three paths:

```text
registered package manifest
artifacts/repository-applications/<application-receipt>.json
.parallax/release-replay-ledger.json
```

Any additional file blocks reconciliation.

This protects the writer contract from a review branch that adds unrelated source, workflow, documentation, or governance changes after the controlled writer runs.

## Application provenance verification

The application receipt records the GitHub Actions workflow run that created it.

The reconciler:

1. resolves that exact workflow run;
2. downloads the `controlled-release-application-<run>` artifact;
3. verifies its GitHub artifact attestation;
4. extracts the attested application bundle;
5. requires the attested application receipt to be byte-identical to the repository receipt;
6. requires the writer plan and replay entry to bind that receipt.

A missing, expired, detached, or unverifiable application artifact blocks reconciliation.

Artifact retention therefore creates an explicit operational time boundary. Long-delayed merges may require a separately governed recovery procedure rather than silent acceptance.

## Original release-chain replay

The reconciler does not accept the application receipt as a substitute for the earlier signed release chain.

It re-runs the trusted controlled repository writer's validation against:

- the original release archive from the attested application bundle;
- the exact base manifest from the application receipt's recorded base commit;
- the writer policy from that base commit;
- the replay ledger as it existed before the application;
- the original writer-plan evaluation timestamp;
- the exact expected release-receipt id.

The newly generated writer plan must match the attested writer plan canonically.

This proves that the application was based on the same governed transition the writer originally validated.

It does not prove the mathematical claims inside that transition.

## Commit ancestry

The workflow verifies:

- the application receipt's base commit is an ancestor of the application PR head;
- the recorded mutation commit is an ancestor of the application PR head;
- the target manifest, application receipt, and replay ledger are present in the merged tree.

Two merge topologies are supported:

```text
HEAD_ANCESTOR_OF_MERGE
TREE_EQUIVALENT_SQUASH_OR_REBASE
```

A squash or rebase merge may not preserve the application commit topology on the base branch.

For that reason, reconciliation binds both:

- the historical mutation and application-head commits; and
- the actual base-branch merge commit and governed tree content.

Commit ancestry alone is insufficient. Tree equivalence is mandatory.

## Governed tree equivalence

For each governed application path, the workflow compares the reviewed application head with the merged tree.

It requires byte identity for:

- the target manifest;
- the application receipt;
- the replay ledger.

The reconciliation engine additionally verifies canonical identities:

```text
hash(base manifest)   = application.before_manifest_hash
hash(head manifest)   = application.after_manifest_hash
hash(merged manifest) = application.after_manifest_hash
head manifest         = merged manifest
head replay entry     = merged replay entry
```

A conflict resolution, manual edit, merge queue mutation, or other tree change that alters a governed file blocks reconciliation.

## Append-only merge observation

A successful verification emits:

```text
repository-merge-observation:v0.1
status = MERGED
reconciliation_record_status = PENDING_RECONCILIATION_PR
```

The observation binds:

- repository and pull-request number;
- application branch and head commit;
- mutation commit;
- actual merge commit;
- merge time and merger identity;
- merge topology;
- application, release, and authority receipt ids;
- target path and replay key;
- base, reviewed, and merged manifest hashes;
- replay-entry and application-bundle hashes;
- successful application-attestation verification;
- successful original release-chain replay;
- rollback-anchor id.

The observation is content-addressed as:

```text
merge-observation:<sha256>
```

## Separate reconciliation pull request

The workflow does not push reconciliation artifacts directly to `main`.

It creates a deterministic branch:

```text
release-reconciliation/pr-<application-pr>-<observation-prefix>
```

That branch contains only:

- one merge observation;
- one rollback anchor;
- the appended merge-ledger entry.

The workflow opens a separate reconciliation pull request.

This gives reviewers a final opportunity to inspect what the automated reconciler observed without reopening or rewriting the already-merged application pull request.

The reconciliation workflow does not trigger recursively for its own pull request because its head does not begin with `controlled-release/`.

## Merge ledger

The append-only merge ledger is:

```text
.parallax/release-merge-ledger.json
```

It rejects duplicate reconciliation by:

- application receipt id;
- replay key;
- merge commit.

Each entry binds the observation, application, mutation, merge, target, and rollback anchor.

The original replay ledger remains unchanged by this phase except for the entry already merged through the application pull request.

## Rollback anchor

A successful reconciliation emits:

```text
repository-rollback-anchor:v0.1
status = AVAILABLE_FOR_GOVERNED_ROLLBACK
```

The rollback anchor records:

- the merged package state hash;
- the prior manifest hash;
- the application base commit;
- mutation commit;
- application-head commit;
- merge commit;
- target path;
- authority decision;
- release and application receipts;
- patch digest;
- replay key.

Its purpose is to establish an exact coordinate for a later rollback proposal.

It explicitly does **not** authorize rollback.

A rollback still requires:

- the existing independent rollback mandate and quorum;
- a new rollback release proposal;
- a new target version;
- independent release custody;
- a new controlled repository application;
- a new merge observation.

Rollback appends another governed transition. It never deletes this merge or restores history by force.

## Post-merge provenance

The workflow packages:

- merge observation;
- rollback anchor;
- reconciliation bundle;
- application receipt;
- pull-request metadata;
- application-attestation verification output;
- reconciliation branch, pull request, and record commit metadata.

It uploads the archive and produces a GitHub build-provenance attestation using Actions OIDC/Sigstore.

That attestation establishes workflow origin and byte integrity for the reconciliation archive.

It does not prove that the package's mathematical or empirical claims are true.

## Browser boundary

The GitPage includes a **Merge Reconciliation** room.

It can:

- import a merge observation as data;
- validate its required identities, commits, hashes, and verification flags;
- import a rollback anchor as data;
- verify that the observation and anchor bind the same application, merge commit, and manifest hash;
- display the application → merge → rollback-anchor chain.

It cannot:

- query private GitHub data;
- download workflow artifacts;
- verify Sigstore provenance;
- write repository files;
- authorize rollback.

## Failure conditions

Reconciliation blocks when any of these occur:

- pull request is not merged;
- base branch is not `main`;
- head branch is not a controlled-release branch;
- application receipt id is invalid;
- application artifact or attestation cannot be verified;
- original signed release chain fails replay;
- mutation or base commit is detached from the application head;
- application PR changes extra files;
- reviewed and merged target manifests differ;
- merged manifest hash differs from the authorized target hash;
- application receipt differs between head, artifact, and merge tree;
- replay entry differs between head, artifact, and merge tree;
- application receipt, replay key, or merge commit was already reconciled.

A blocked reconciliation does not undo the GitHub merge automatically.

It creates a governance incident requiring inspection and, when appropriate, a separately authorized rollback.

## Current Langarian ruling

The current public Langarian package still lacks complete adversarial, declared-failure, and first-falsifier evidence under the strict conformance gate.

Therefore no valid `AUTHORIZED_NOT_COMMITTED` Langarian promotion archive currently exists for the repository writer to apply.

This phase adds the post-merge machinery without changing the Langarian package manifest or maturity.

## Claim boundaries

A valid merge observation supports only this claim:

> The exact controlled application pull request was merged, and the governed target manifest, application receipt, and replay entry in the merge tree match the reviewed and attested application.

It does not establish:

- mathematical proof;
- empirical validation;
- Reality Gate passage;
- correctness of reviewer independence claims;
- automatic rollback authority;
- permission to delete prior commits or artifacts;
- that every non-governed repository file is trustworthy.

## Constitutional summary

```text
Application is not merge.
Merge must be observed, not assumed.
A later observation must not rewrite an earlier receipt.
Commit ancestry does not replace tree equivalence.
Attestation proves origin and bytes, not truth.
A rollback anchor is a coordinate, not authority.
Rollback appends history; it never erases history.
The merge ledger rejects duplicate reconciliation.
The browser may inspect records but cannot reconcile GitHub.
```
