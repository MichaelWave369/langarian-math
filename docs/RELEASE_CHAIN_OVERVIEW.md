# Governance-to-Release Chain

The public workbench separates theory admission, evidence, authority, and repository mutation into distinct gates:

```text
Theory package
  -> operator contract audit
  -> contract conformance
  -> signed evidence custody
  -> custody-aware promotion eligibility
  -> mandate-bound authority decision
  -> controlled package release artifact
  -> separate repository writer (not implemented in the browser)
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

The browser never writes the repository. An authorized receipt remains `AUTHORIZED_NOT_COMMITTED` until a separate writer verifies the live before hash, rejects replay, writes only the archived after manifest, and records the resulting commit.

The current Langarian release demonstration remains `BLOCKED` because its strict contract-conformance evidence is incomplete. Valid release custody cannot override a blocked authority decision.

See [`CONTROLLED_PACKAGE_RELEASE_PHASE.md`](CONTROLLED_PACKAGE_RELEASE_PHASE.md) for the full constitution and [`../schemas/package-release-archive.schema.json`](../schemas/package-release-archive.schema.json) for the portable archive schema.
