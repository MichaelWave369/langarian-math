# Promotion Authority and Mandate Governance v0.6

**Status:** active public governance phase  
**Target:** Level-4 package authorization only  
**Package mutation:** never automatic  
**Reality Gate:** outside this phase

> Evidence may become eligible for review. Eligibility does not decide who may approve it.

## 1. Purpose

Custody-aware promotion v0.5 determines whether one exact package and one exact evidence suite may enter governance review. It does not answer:

- who may approve a promotion;
- how long that authority lasts;
- which review roles must participate;
- whether reviewers are meaningfully distinct;
- how many approvals are required;
- how a rejection blocks approval;
- how a decision expires;
- how a mandate is renewed;
- how a decision may be appealed;
- how a prior approval may be rolled back.

Promotion Authority v0.6 adds those controls without changing a package manifest.

## 2. Governing sequence

```text
Package validity
      ↓
Contract conformance
      ↓
Evidence custody
      ↓
Promotion eligibility assessment
      ↓
Signed authority mandates
      ↓
Signed role-specific ballots
      ↓
Quorum and independence checks
      ↓
Signed authority decision
      ↓
Separate controlled package-update step
```

No later stage may repair a failed earlier stage. In particular:

> A unanimous council cannot vote missing conformance evidence into existence.

## 3. Portable versions

```text
promotion-authority:v0.1
promotion-authority-bundle:v0.1
promotion-mandate:v0.1
promotion-ballot:v0.1
promotion-appeal:v0.1
promotion-rollback-ballot:v0.1
promotion-authority-policy:v0.1
promotion-authority-decision:v0.1
signed-promotion-decision:v0.1
```

Schemas:

- `schemas/promotion-authority-bundle.schema.json`
- `schemas/signed-promotion-decision.schema.json`

## 4. Authority identities

An authority identity contains:

- a public Ed25519 key;
- a content-derived authority id;
- declared roles;
- declared independence domains;
- explicit authority scopes;
- active or revoked status;
- creation time and bounded metadata.

The authority id is derived from the canonical public-key fingerprint:

```text
authority:<sha256(public JWK)>
```

A display name is not an identity anchor.

## 5. Mandates

A mandate is a signed, temporary authorization issued by an authority carrying:

```text
issue:promotion-mandate
```

Each mandate binds:

- issuer identity;
- subject authority identity;
- package id and version;
- target level;
- review role;
- allowed scopes;
- validity start and expiry;
- maximum decision uses;
- superseded mandate ids;
- signature and content-derived mandate id.

A mandate outside its time window is non-operative. It remains part of the ledger.

### Renewal

Renewal creates a new signed mandate that references the old mandate through `supersedes`.

The old record is:

- retained;
- inspectable;
- non-operative;
- not treated as a current quorum blocker when a valid renewal replaces it.

Renewal never edits the old mandate in place.

## 6. Ballots

A promotion ballot is signed by the mandated authority and binds:

- one exact promotion assessment id;
- one exact package and version;
- one exact target level;
- one active mandate;
- one disposition: `APPROVE`, `REJECT`, or `ABSTAIN`;
- a reason and timestamp.

One authority may cast only one ballot for an assessment under the default policy.

## 7. Default quorum policy

The default Level-4 authority policy requires:

```text
minimum approvals: 2
minimum declared independence domains: 2
required roles:
  - mathematical-review
  - implementation-audit
valid rejection blocks: true
```

Required scopes:

```text
issue:promotion-mandate
vote:promotion-level4
record:promotion-decision
appeal:promotion-decision
rollback:promotion-decision
```

Declared independence domains are governance metadata. They make correlated review visible; they do not prove statistical, institutional, or epistemic independence.

## 8. Protected rejection

Under the default policy, a valid `REJECT` ballot blocks authorization even when the approval count would otherwise satisfy quorum.

This prevents a protected dissenter from becoming merely decorative.

A future policy may define a different rejection rule, but it must do so explicitly and version the policy.

## 9. Signed aggregate decision

After quorum evaluation, an accountable decision recorder signs the aggregate decision receipt.

The recorder must hold:

```text
record:promotion-decision
```

The signed receipt records:

- exact promotion assessment;
- package id, version, current level, and target level;
- policy id and version;
- accepted approval and rejection ballot ids;
- distinct authority ids;
- independence domains;
- covered roles;
- mandate ids;
- blockers and warnings;
- issue and expiry times;
- recorder identity and signature;
- supported claim and prohibited inferences.

Possible statuses:

```text
APPROVED_PENDING_PACKAGE_UPDATE
REJECTED
BLOCKED
```

Even `APPROVED_PENDING_PACKAGE_UPDATE` does not edit the package.

## 10. Decision expiry

The default signed decision is valid for 180 days.

An expired decision remains historically valid as a record of what was decided, but it is no longer operative authorization for a package update.

A fresh package update requires a new assessment and/or renewed authority process as required by policy.

## 11. Appeals

An active authority with:

```text
appeal:promotion-decision
```

may file a signed appeal against a specific decision id.

A valid appeal:

- opens independent re-review;
- makes the signed decision non-operative while review is open;
- does not delete or rewrite the decision;
- does not automatically reverse it.

## 12. Rollback

Rollback uses signed rollback ballots bound to:

- one exact signed decision;
- the exact package and target level;
- active, verified rollback-capable mandates;
- the same role and independence requirements as promotion quorum.

The default rollback quorum requires two accepted ballots across two declared independence domains and the required review roles.

A successful rollback status is:

```text
ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE
```

This authorizes a separate reversal step. It does not silently edit the package manifest.

## 13. Decision lifecycle

A signed decision is operative only when all are true:

1. recorder signature is valid;
2. decision id matches the canonical signed body;
3. recorder identity is active, scoped, and fingerprint-bound;
4. decision is within its validity window;
5. status is `APPROVED_PENDING_PACKAGE_UPDATE`;
6. no valid appeal is open;
7. no valid rollback quorum has authorized reversal.

The lifecycle evaluator exposes every blocker.

## 14. Current Langarian ruling

The bundled Langarian conformance suite remains incomplete under the strict v0.3 contract-conformance gate.

Therefore the current authority demonstration may show:

- valid evidence custody;
- valid authority identities;
- valid mandates;
- two accepted approval ballots;
- required role coverage;
- two declared independence domains;
- a valid recorder signature;

while still producing:

```text
BLOCKED
```

The blocker remains the prerequisite promotion assessment.

This is intended behavior.

## 15. Security and import boundary

Imported authority bundles are data only.

They may contain:

- public keys;
- signed mandates;
- signed ballots;
- appeals;
- rollback ballots;
- metadata.

They do not contain private keys and cannot execute code.

Browser-generated private keys remain in memory only.

## 16. Prohibited inferences

Neither quorum nor signatures establish that:

- the package manifest changed;
- the package mathematically deserves promotion;
- the reviewers are empirically independent;
- the theory is scientifically true;
- the Reality Gate passed;
- an expired, appealed, or rolled-back decision remains operative.

## 17. Public/private boundary

No private research package, derivation, identifier, or theory content belongs in this public authority layer.

The authority machinery is theory-neutral governance infrastructure.

## 18. Governing rule

> Authority is temporary, scoped, plural, signed, reviewable, and reversible. It is never self-justifying.
