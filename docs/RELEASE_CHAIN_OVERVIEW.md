# Governance-to-Release Chain

The public workbench separates theory admission, evidence, authority, release custody, repository application, and merge into distinct gates:

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
  -> GitHub Actions provenance attestation
  -> pull-request merge decision (still separate)
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

## Current Langarian result

The current Langarian release demonstration remains `BLOCKED` because its strict contract-conformance evidence is incomplete. Valid release custody and a valid repository writer cannot override a blocked authority decision.

No current package manifest is changed by adding the writer.

See:

- [`CONTROLLED_PACKAGE_RELEASE_PHASE.md`](CONTROLLED_PACKAGE_RELEASE_PHASE.md)
- [`CONTROLLED_REPOSITORY_WRITER_PHASE.md`](CONTROLLED_REPOSITORY_WRITER_PHASE.md)
- [`../schemas/package-release-archive.schema.json`](../schemas/package-release-archive.schema.json)
- [`../schemas/repository-writer-plan.schema.json`](../schemas/repository-writer-plan.schema.json)
- [`../schemas/repository-application-receipt.schema.json`](../schemas/repository-application-receipt.schema.json)
- [`../schemas/repository-replay-ledger.schema.json`](../schemas/repository-replay-ledger.schema.json)
