# Controlled Repository Writer and Commit Attestation — v0.8

Status: **implemented public governance phase**

This phase governs the boundary between an authorized package-release archive and a reviewable repository mutation.

It answers one narrow question:

> Can the exact target manifest recorded in one authorized release archive be placed on one review branch, with replay protection and commit-bound provenance, without granting the browser or workflow permission to reinterpret the release?

It does not answer whether the theory is true, whether the mathematics is proved, or whether the generated pull request should be merged.

## Governing rule

```text
AUTHORIZED_NOT_COMMITTED archive
        +
exact live source hash
        +
registered target path
        +
unused replay key
        +
trusted base-branch writer
        =
review-branch application, not merge
```

The governing sentence is:

> The repository writer may commit only the archived target manifest to a dedicated review branch, then record that exact commit and replay consumption before opening a pull request.

## Public artifact versions

```text
repository-writer-policy:v0.1
repository-writer-plan:v0.1
repository-application-receipt:v0.1
repository-replay-ledger:v0.1
repository-application-bundle:v0.1
repository-writer-request:v0.1
```

Schemas:

- [`schemas/repository-writer-plan.schema.json`](../schemas/repository-writer-plan.schema.json)
- [`schemas/repository-application-receipt.schema.json`](../schemas/repository-application-receipt.schema.json)
- [`schemas/repository-replay-ledger.schema.json`](../schemas/repository-replay-ledger.schema.json)

Repository policy and ledger:

- [`.parallax/repository-writer-policy.json`](../.parallax/repository-writer-policy.json)
- [`.parallax/release-replay-ledger.json`](../.parallax/release-replay-ledger.json)

## Why a separate writer exists

Release Governance v0.7 deliberately stops at:

```text
AUTHORIZED_NOT_COMMITTED
```

That status proves custody over an exact transition artifact. It does not prove that the repository still contains the signed source manifest, that the transition has not already been applied, or that the eventual commit contains only the signed target bytes.

Without a separate writer, a valid archive could still be:

- applied to a source manifest that changed after signing;
- written to the wrong repository path;
- applied more than once;
- mixed with unrelated edits;
- pushed directly to the protected branch;
- detached from the commit that actually changed the manifest;
- represented as merged when it exists only on a branch;
- executed using code supplied by the archive request itself.

This phase closes those gaps.

## Trusted-code boundary

The manual workflow accepts:

- a request Git ref containing the public release archive;
- the archive path on that ref;
- a registered target-manifest path;
- a base branch;
- `dry-run` or `apply` mode;
- the exact expected release-receipt id.

The workflow does **not** check out and execute code from the request ref.

Instead it:

1. checks out the trusted base branch;
2. fetches the request ref as data;
3. extracts only the named archive bytes;
4. extracts the target manifest, writer policy, and replay ledger from one exact base commit;
5. runs the writer shipped by that trusted base commit.

An archive therefore cannot replace the verifier that judges it.

## Registered target policy

The writer accepts only package-id and path pairs listed in:

```text
.parallax/repository-writer-policy.json
```

The initial public registry contains:

```text
langarian-finite-complex
    → examples/theory-packages/langarian-finite-complex.json

generic-provenance-workflow
    → examples/theory-packages/generic-provenance-workflow.json
```

A caller cannot redirect a valid archive to `README.md`, a workflow file, executable source, or another package manifest.

The policy explicitly records:

```text
require_pull_request = true
prohibit_direct_main_write = true
```

## Independent verification obligations

The Node 20 writer independently verifies the complete public archive rather than trusting its displayed status.

It verifies at least:

### Signed authority decision

- decision-recorder signature;
- content-addressed decision id;
- recorder public-key fingerprint;
- recorder active status and scope;
- decision validity window for promotion;
- approved status;
- absence of an operative appeal;
- absence of an already-authorized rollback for promotion.

### Rollback authority

For rollback, it verifies:

- the historical decision signature and recorder identity;
- active rollback authorities;
- signed rollback ballots;
- signed and non-superseded rollback mandates;
- mandate issuer authority;
- package and decision binding;
- two distinct authorities;
- two declared independence domains;
- mathematical-review and implementation-audit role coverage.

### Release proposal

- release-custodian signature;
- content-addressed proposal id;
- active content-addressed authority identity;
- correct release role and action scope;
- separation from the decision recorder and approval authorities;
- at least one declared domain outside the governance quorum;
- proposal validity window;
- exact decision and package binding;
- exact three-path patch;
- patch digest;
- before-manifest hash;
- after-manifest hash;
- immutable package content outside the authorized fields.

### Release receipt

- release-custodian signature;
- content-addressed receipt id;
- `AUTHORIZED_NOT_COMMITTED` status;
- `NOT_COMMITTED` repository status;
- exact proposal, decision, hash, patch, and replay-key binding.

### Live repository state

- exact live source bytes at the selected base commit;
- registered package target;
- unused replay key.

Any failed obligation stops before a writer plan exists.

## Writer plan

A successful dry run emits:

```text
repository-writer-plan:v0.1
status = READY_FOR_REVIEW_BRANCH
```

The plan binds:

- package id;
- source and target versions;
- action;
- target path;
- archive digest;
- authority decision id;
- release proposal id;
- release receipt id;
- before-manifest hash;
- after-manifest hash;
- patch digest;
- replay key;
- evaluation time.

It also emits the exact archived target manifest.

The plan is content-addressed as:

```text
writer-plan:<sha256>
```

A plan is not a repository commit and does not consume replay state.

## Apply-mode confirmation

`apply` mode requires the caller to provide the exact:

```text
release-receipt:<sha256>
```

The workflow compares the supplied id with the verified archive before any mutation begins.

This prevents an operator from intending to apply one release while accidentally dispatching another archive.

## GitHub environment gate

The `apply` job uses the GitHub environment:

```text
controlled-release
```

Repository administrators should configure that environment with required reviewers.

The repository file can name the environment, but required-reviewer configuration is maintained in GitHub settings rather than source control.

A dry run does not require application authority and performs no write.

## Review-branch application

The workflow creates a branch named:

```text
controlled-release/<workflow-run-id>-<replay-prefix>
```

It starts from the exact base commit used during validation.

The first commit changes only the registered package manifest and uses the exact archived target bytes.

It records:

```text
mutation_commit = <git commit id>
```

The workflow does not amend that commit with later metadata.

## Commit-bound application receipt

After the mutation commit exists, the writer emits:

```text
repository-application-receipt:v0.1
status = APPLIED_ON_REVIEW_BRANCH
merge_status = NOT_MERGED
```

The receipt binds:

- repository;
- base ref and base commit;
- review branch;
- mutation commit;
- target path;
- package and action;
- complete release-chain identifiers;
- before, after, and patch hashes;
- replay key;
- GitHub workflow run identity;
- issue time;
- supported and prohibited claims.

It is content-addressed as:

```text
repository-application:<sha256>
```

The receipt is committed in a second review-branch commit together with replay-ledger consumption.

The two-commit structure is intentional:

1. the mutation commit establishes the exact target-manifest commit id;
2. the record commit can then bind that already-existing mutation commit without predicting Git history.

## Replay ledger

The repository replay ledger is append-only:

```text
.parallax/release-replay-ledger.json
```

Each entry binds:

- replay key;
- application receipt;
- release receipt;
- package and action;
- target path;
- base and mutation commits;
- application branch;
- consumption time;
- `NOT_MERGED` status.

The same replay key must not appear twice.

The workflow uses concurrency group:

```text
controlled-release-writer
```

This serializes controlled writer runs and reduces the chance of parallel replay races.

The generated pull request carries both the target mutation and replay consumption. They become part of the base branch atomically when the pull request is merged.

## Pull-request boundary

The workflow pushes only the dedicated review branch and opens a pull request.

It never pushes the application directly to `main`.

The meanings remain separate:

```text
READY_FOR_REVIEW_BRANCH
    archive and live state passed writer preflight

APPLIED_ON_REVIEW_BRANCH
    exact target manifest exists in a named mutation commit

NOT_MERGED
    base branch has not accepted the application

MERGED
    not claimed by v0.8 artifacts
```

A later merge observer may append a merge receipt. It must not rewrite the original application receipt.

## GitHub Actions attestation

After creating the review branch and pull request, the workflow assembles:

- public release archive;
- writer plan;
- target manifest;
- application receipt;
- application bundle;
- updated replay ledger;
- repository, branch, commit, pull-request, and workflow metadata.

It archives the directory, uploads it as a workflow artifact, and invokes:

```text
actions/attest-build-provenance@v3
```

The resulting GitHub artifact attestation binds the application bundle digest to the repository and GitHub Actions OIDC workflow identity.

Attestation proves workflow origin and byte integrity. It does not prove that the pull request was merged or that package claims are correct.

## Browser Repository Writer room

The GitPage adds a **Repository Writer** workspace.

It can:

- display the public target registry;
- import a public release archive as data;
- re-run browser archive verification;
- compare the selected bundled manifest hash to the archive before hash;
- check the supplied replay-key view;
- export a workflow request template containing the exact release receipt id.

The browser cannot:

- inspect the authoritative repository replay ledger;
- create a trusted Git commit;
- protect a GitHub environment;
- create a GitHub attestation;
- push a branch;
- open or merge a pull request.

The browser preflight is a convenience view, not the writer authority.

## Current Langarian ruling

The current public Langarian package still lacks complete strict-conformance evidence for every operator.

Therefore it has not earned an operative promotion decision, and its release archive remains blocked.

The writer correctly refuses to produce:

```text
READY_FOR_REVIEW_BRANCH
```

for that blocked archive.

No package manifest is changed by introducing v0.8.

## Failure rules

The writer fails closed when:

- archive structure is unsupported;
- any required signature or content-addressed id fails;
- authority scope or role fails;
- promotion decision is expired, appealed, rolled back, or blocked;
- rollback quorum fails;
- proposal is expired;
- live source hash differs;
- target path is unregistered;
- patch paths differ from the authorized surface;
- target manifest differs from the signed patch result;
- release receipt is blocked or detached;
- expected receipt id differs;
- replay key already exists;
- base or mutation commit format is invalid.

No partial writer plan is emitted after failure.

## Claim boundaries

This phase supports only these bounded claims:

- the named public archive was independently verified by the trusted writer;
- the live base-commit manifest matched the signed before hash;
- the exact archived target manifest was committed on the named review branch;
- the mutation commit is recorded in an append-only application receipt;
- the replay key was consumed on that review branch;
- the application bundle was submitted for GitHub workflow attestation.

It prohibits these inferences:

```text
The pull request was merged.
The base branch already contains the target manifest.
The release can be applied again elsewhere.
The theory or mathematics was proved.
The Reality Gate passed.
Declared authority independence proves real-world independence.
Prior manifests, receipts, decisions, or ledgers may be erased.
```

## Test obligations

The phase must prove at least:

- a valid signed archive produces a writer plan;
- the exact target manifest is emitted;
- finalization binds a real-form commit id;
- application status remains `NOT_MERGED`;
- replay consumption is appended;
- stale live manifests fail;
- unregistered targets fail;
- replayed transitions fail;
- post-signature target tampering fails;
- blocked archives fail;
- existing numerical fixtures and executable conformance remain unchanged;
- no private research identifier enters public artifacts.

## Constitutional summary

```text
Archive is not application.
Application branch is not merge.
The writer executes trusted base-branch code only.
Live bytes must match the signed before hash.
Only registered target paths may change.
Replay is consumed once.
The mutation commit is recorded after it exists.
Main is changed only through pull-request review.
Attestation proves workflow custody, not truth.
History remains append-only.
```
