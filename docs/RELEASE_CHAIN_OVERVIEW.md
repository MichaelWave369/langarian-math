# Governance-to-Release Chain

The public workbench separates theory admission, evidence, authority, release custody, repository application, merge, and rollback reference into distinct gates:

```text
Theory package
  -> operator contract audit
  -> contract conformance
  -> signed evidence custody
  -> custody-aware promotion eligibility
  -> mandate-bound authority decision
  -> controlled package release artifact
  -> controlled repository writer plan
  -> review-branch mutation commit
  -> commit-bound application receipt + replay consumption
  -> GitHub Actions application provenance attestation
  -> pull-request merge decision
  -> merge observation + release-chain replay
  -> rollback anchor + post-merge provenance attestation
  -> append-only reconciliation pull request
```

## Controlled release boundary

Controlled Package Mutation & Release Governance v0.7 consumes an operative signed authority decision and produces a self-contained public archive containing:

- the signed authority decision;
- the public authority bundle;
- the exact before manifest;
- a restricted, signed manifest patch;
- the exact materialized after manifest;
- a signed release receipt;
- canonical before, patch, and after hashes;
- a deterministic replay key.

Its successful state is:

```text
AUTHORIZED_NOT_COMMITTED
```

## Controlled repository writer boundary

Controlled Repository Writer & Commit Attestation v0.8 consumes only a fully valid `AUTHORIZED_NOT_COMMITTED` archive.

It independently verifies the release chain against:

- trusted base-branch writer code;
- one exact base commit;
- the live registered package-manifest bytes;
- the public target-path policy;
- the repository replay ledger;
- the exact expected release-receipt id.

Dry-run mode emits:

```text
READY_FOR_REVIEW_BRANCH
```

Apply mode is placed behind the GitHub environment `controlled-release`. It creates a dedicated review branch, commits only the archived target manifest, then appends a commit-bound application receipt and replay-ledger entry.

Its application receipt records:

```text
APPLIED_ON_REVIEW_BRANCH
merge_status = NOT_MERGED
```

The workflow opens a pull request and GitHub-attests the application bundle. It never pushes the application directly to `main`.

Merging that pull request remains a separate human and repository-governance decision.

## Merge reconciliation boundary

Merge Observation & Release Reconciliation v0.9 begins only after a controlled application pull request is actually merged.

It verifies:

- the pull request merged into `main`;
- the head branch is a controlled-release branch;
- the PR changed exactly the target manifest, application receipt, and replay ledger;
- the recorded mutation and base commits are ancestors of the reviewed application head;
- the application bundle's GitHub provenance attestation verifies;
- the original signed release chain replays to the same writer plan;
- the reviewed and merged target manifests are byte-identical;
- the reviewed and merged replay entries are byte-identical;
- the merged target hash equals the authorized after-manifest hash;
- the application receipt, replay key, and merge commit have not already been reconciled.

A successful reconciliation appends:

```text
repository-merge-observation:v0.1
status = MERGED
```

and:

```text
repository-rollback-anchor:v0.1
status = AVAILABLE_FOR_GOVERNED_ROLLBACK
```

The original application receipt remains unchanged at `merge_status = NOT_MERGED` because that was the accurate state when it was issued.

The rollback anchor identifies the exact merged and prior manifest hashes. It does not authorize rollback.

Reconciliation artifacts are written on a separate `release-reconciliation/...` branch and opened as another pull request. The workflow also uploads and GitHub-attests a post-merge provenance bundle.

## Current Langarian result

The current Langarian release demonstration remains `BLOCKED` because its strict contract-conformance evidence is incomplete. Valid release custody, a valid repository writer, and merge-reconciliation machinery cannot override a blocked authority decision.

No current package manifest is changed by adding these governance layers.

See:

- [`CONTROLLED_PACKAGE_RELEASE_PHASE.md`](CONTROLLED_PACKAGE_RELEASE_PHASE.md)
- [`CONTROLLED_REPOSITORY_WRITER_PHASE.md`](CONTROLLED_REPOSITORY_WRITER_PHASE.md)
- [`MERGE_RECONCILIATION_PHASE.md`](MERGE_RECONCILIATION_PHASE.md)
- [`../schemas/package-release-archive.schema.json`](../schemas/package-release-archive.schema.json)
- [`../schemas/repository-writer-plan.schema.json`](../schemas/repository-writer-plan.schema.json)
- [`../schemas/repository-application-receipt.schema.json`](../schemas/repository-application-receipt.schema.json)
- [`../schemas/repository-replay-ledger.schema.json`](../schemas/repository-replay-ledger.schema.json)
- [`../schemas/repository-merge-observation.schema.json`](../schemas/repository-merge-observation.schema.json)
- [`../schemas/repository-rollback-anchor.schema.json`](../schemas/repository-rollback-anchor.schema.json)
- [`../schemas/repository-merge-ledger.schema.json`](../schemas/repository-merge-ledger.schema.json)
