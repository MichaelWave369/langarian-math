# Governed Rollback Materialization & Incident Response v1.0

## Purpose

A rollback is not a deletion, a reset button, or an exception to release governance. It is a new governed release whose target is derived from an exact prior-state anchor.

This phase binds incident response to the existing Parallax release chain:

```text
verified MERGED observation
  -> exact rollback anchor
  -> signed incident declaration
  -> independent signed containment approval
  -> valid rollback quorum
  -> signed ROLLBACK package-release archive
  -> controlled repository writer
  -> rollback application pull request
  -> merge observation and fresh rollback anchor
```

## Constitutional boundary

```text
A rollback anchor identifies a prior state.
A rollback quorum authorizes consideration of reversal.
An incident record documents why containment is required.
A release custodian signs one exact reversal artifact.
Only the controlled writer and reviewed merge may change the repository.
```

None of these records alone authorizes direct mutation of `main`.

## Incident declaration

`incident-response-record:v0.1` is signed by an active authority carrying:

- role `incident-commander`;
- scope `declare:release-incident`.

The record binds:

- repository and package id;
- target manifest path;
- merge observation and rollback anchor;
- current and restore manifest hashes;
- severity;
- observed effects;
- inspectable evidence references;
- containment rationale;
- rollback objective;
- declaration time and signer.

The incident id is content-addressed to the complete signed record.

## Containment approval

`rollback-containment-plan:v0.1` is signed by an active authority carrying:

- role `containment-authority`;
- scope `approve:rollback-containment`.

The plan binds:

- the exact incident;
- the exact rollback anchor;
- the exact signed release archive and release receipt;
- expected current and restore manifest hashes;
- required steps;
- success conditions;
- stop conditions;
- monitoring window.

Default policy requires the containment authority to be separate from both the incident commander and release custodian.

## Rollback quorum

The phase reuses the signed rollback mandate and ballot system from Promotion Authority governance. The original authority decision must remain cryptographically valid, and the rollback profile must report:

```text
ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE
```

Required role coverage, distinct authorities, independence domains, active mandates, signatures, and validity windows remain enforced.

Incident urgency cannot bypass quorum.

## Exact restore target

The trusted materializer obtains two repository states:

1. the live package manifest from the selected trusted base commit;
2. the restore manifest from the rollback anchor's `application_base_commit` and target path.

It rejects the request unless:

- the live hash equals the anchor's merged-manifest hash;
- the restore hash equals the anchor's restore-manifest hash;
- request copies match those repository-derived manifests;
- the rollback archive begins from the exact live manifest;
- the rollback target preserves immutable theory content;
- the archive is an authorized, uncommitted `ROLLBACK` release.

Rollback creates a new semantic version and new release-governance metadata. It does not reuse the old version number or erase the promoted manifest from history.

## Governed rollback request

`governed-rollback-request:v0.1` contains:

- signed incident record;
- signed containment plan;
- merge observation;
- rollback anchor;
- current manifest;
- restore manifest;
- standard `package-release-archive:v0.1`;
- public metadata.

The request is data. Imported code is never executed.

## Materialization workflow

The manual workflow `materialize-governed-rollback`:

1. checks out trusted code from the selected base ref;
2. reads the requested rollback package from another ref strictly as data;
3. retrieves current and restore manifests from exact repository commits;
4. verifies incident, containment, anchor, signatures, hashes, separation, and release binding;
5. re-runs the existing controlled repository writer in planning mode;
6. creates a `governed-rollback/...` branch;
7. commits only incident, containment, release-archive, and writer-handoff records;
8. opens a reviewable record pull request;
9. uploads and GitHub-attests the materialization bundle.

The workflow is gated by the GitHub environment:

```text
rollback-incident-response
```

Repository administrators should configure required human reviewers for that environment.

## Writer handoff

After the rollback record PR is merged, its handoff artifact gives exact inputs for the existing `controlled-release-writer` workflow:

- request ref;
- release archive path;
- target manifest path;
- base ref;
- `mode = apply`;
- exact release-receipt id.

The existing writer then performs live-hash and replay checks, creates a controlled application branch, emits a commit-bound application receipt, opens the rollback application PR, and attests the bundle.

When that application PR merges, the existing reconciliation workflow emits a new `MERGED` observation and a fresh rollback anchor whose `action_applied` is `ROLLBACK`.

## Browser boundary

The Incident Rollback room can:

- import public governed rollback requests;
- validate their portable structure;
- verify signatures and content-addressed ids;
- evaluate rollback quorum and release readiness;
- show the append-only response chain.

It cannot:

- generate trusted institutional identities;
- dispatch workflows;
- write GitHub branches;
- merge pull requests;
- authorize rollback;
- delete prior evidence.

## Statuses

```text
BLOCKED
READY_FOR_CONTROLLED_WRITER
READY_FOR_CONTROLLED_WRITER_VALIDATION
AUTHORIZED_NOT_COMMITTED
APPLIED_ON_REVIEW_BRANCH
MERGED
```

Each status belongs to a different gate. No status silently implies a later one.

## Claim boundary

A successful v1.0 materialization supports only this claim:

> A signed incident, independent containment approval, exact rollback anchor, valid rollback quorum, and signed rollback release archive have been bound into a public artifact that may enter the existing controlled repository writer.

It does not prove:

- that rollback was merged;
- that the incident diagnosis is empirically complete;
- that restored claims are true;
- that the Reality Gate passed;
- that historical records may be deleted;
- that emergency language can override governance.

## Public-only boundary

The phase contains only the public Langarian package architecture and neutral synthetic fixtures. It introduces no private research package, identifier, or unpublished mathematical content.
