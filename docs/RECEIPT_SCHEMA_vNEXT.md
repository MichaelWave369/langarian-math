# Receipt Schema vNEXT — `receipt:v0.3`

This is the normative receipt contract for Langarian Math Workbench v0.3,
implemented at commit f00bd61 by `src/langarian/receipts.py` (emission),
`src/langarian/validation.py` (validation levels), and
`src/langarian/version.py` (version allowlists). It supersedes
`docs/RECEIPT_SCHEMA.md` for new receipts; the older document remains as the
v0.1.x/v0.2 historical record.

Receipts are the public trace layer: they record what was computed, what was
checked, and the collapsed status. A receipt is evidence about one operation
instance — never a proof, never a universal claim, and never self-authenticating
(hashes provide integrity, not provenance; there is no signing in v0.3).

## 1. Fields (emitted body)

`OperationReceipt.body(include_receipt_id=True)` (`receipts.py:57-77`):

| Field | Type | Meaning |
|---|---|---|
| `kernel_version` | string | `langarian-python-ref-v0.3.0` (allowlisted) |
| `metric_version` | string | `metric:v0.3.scale_safe_normalized_complex_similarity` (allowlisted) |
| `receipt_schema_version` | string | `receipt:v0.3` (allowlisted) |
| `timestamp_utc` | string | ISO-8601 UTC emission time. **Not part of content identity** |
| `operator` | string | One of the five stable operator names |
| `input_hashes` | string[] | State content hashes of the actual input states; must be non-empty |
| `output_hash` | string | State content hash of the output (or bridge target) |
| `parameters` | object | Operator parameters incl. declared cost annotations |
| `coherence_before` | number \| null | Nullable (`bridge` emits null) |
| `coherence_after` | number \| null | Coherence after the operation |
| `invariant_results` | object[] | Each `{name, status, message, value, metadata}`; **must contain ≥1 entry** |
| `status` | enum | `PASS` \| `WARN` \| `FAIL`; must equal the collapse of `invariant_results` |
| `epistemic_tag` | enum | `FORMAL` \| `COMPUTED` \| `MODEL` \| `INTERPRETIVE` \| `METAPHOR` \| `OBSERVED` \| `FAILED` |
| `claims` | object[] | Each `{text, tag, evidence, metadata}` |
| `content_hash` | string | Deterministic content identity (§2) |
| `receipt_id` | string | Emission-event identity (§2) |

## 2. Two identities: `content_hash` vs `receipt_id`

Implemented in `receipts.py:79-89` (SPEC §3.5):

- **`content_hash`** = `sha256:` of the canonical JSON of the body **minus
  `timestamp_utc`, `content_hash`, and `receipt_id`**. Identical operations
  produce identical content hashes at any time. Use for mathematical identity,
  deduplication, and cross-language conformance.
- **`receipt_id`** = `sha256:` of the canonical body **including
  `timestamp_utc`** (minus both identity fields). Unique per emission event.
  Use for ledger audit ordering. **It is not a content hash** — do not compare
  receipt ids to detect sameness of mathematics.
- `input_hashes` remain *state* content hashes (`ResonantState.state_hash()`).
- State `history` records `receipt_id` values (emission events). Multi-hop
  lineage verification across a persisted ledger is a ledger-level check, not a
  kernel invariant (I4 checks existence + match against recorded source hashes
  for one hop only).

## 3. Canonical JSON contract (hash domain)

Shared by state hashing and receipt hashing (`state.py:_canonical_json`,
`receipts.py:canonical_json` — both use identical settings per SPEC §3.10):

- `sort_keys=True`, `separators=(',', ':')`, `ensure_ascii=False`, one shared
  `default=str` fallback.
- Float formatting is **CPython shortest-repr** semantics: integral floats keep
  `.0` (`3.0`, not `3`); exponent form `e±NN` with sign and zero-padded
  two-digit exponent (`1e-07`, not `1e-7`); notation boundaries per CPython
  `repr`.
- `-0.0` normalizes to `0.0` at canonicalization (construction coerces through
  `float()`; vectors/metadata carrying `-0.0` hash identically to `0.0`).
- **Non-finite floats (NaN, ±inf) are rejected at ingest/serialization with a
  typed error — never emitted** (`state.py:_validate_metadata`); kernel
  arithmetic paths raise `MetricError` instead of serializing a non-finite
  intermediate.
- Metadata: string keys; JSON-safe values (str/int/finite float/bool/None/
  list/dict); canonical-JSON size ≤ `MAX_METADATA_BYTES = 4096`.

Any conforming serializer (including the TypeScript port, SPEC §4) must
reproduce these byte-exactly; the conformance fixtures
(`fixtures/conformance/`) contain adversarial floats (`1e-200`, `1e200`,
subnormal `5e-162`, cross-dim cases) to test this.

## 4. Validation levels

`validation.validate_receipt_data(data) -> ReceiptValidation`
(`src/langarian/validation.py`) returns four separately reported levels:

| Level | Semantics | A pass means |
|---|---|---|
| `schema` | Required fields present; `sha256:` prefixes; status/tag enums; `input_hashes` non-empty; ≥1 invariant result with valid name/status | The document is shaped like a receipt. **Shape-only; never labeled "verified"** |
| `hash` | Recompute `content_hash` (body minus timestamp minus identity fields) and `receipt_id` (body plus timestamp) and compare to recorded values | Body integrity — no tampering of hashed fields |
| `status` | `collapse(invariant_results) == status`, with empty list → FAIL and FAILED tag → FAIL override | Recorded status is consistent with recorded checks |
| `version` | `kernel_version`, `metric_version`, `receipt_schema_version` each in the current allowlists (`{receipt:v0.3}` etc.) | Not a downgrade/forgery of version metadata |

Explicit non-goals:

- Even all four levels passing is **local consistency verification**, not
  recomputation of the underlying mathematics (`validation.py:229-234`).
  Local re-execution ("Recompute locally") is a separate explicit operation,
  surfaced only by that explicit action (SPEC §1); it is implemented in the
  workbench Receipt Ledger (`web/src/ledger/`) as a distinctly labeled
  action.
- `locally_reproducible` is therefore **not** a receipt validation level and
  must never appear as one.
- `proof_eligible` applies to **claims at the Proof Gate**, not to receipts.
  There is no single vague "verified" badge.

CLI behavior (`src/langarian/cli.py:64-90`): `langarian validate <receipt>`
prints each level distinctly (`PASS/FAIL receipt schema (shape only; never
called verified)`, `… hash integrity …`, `… status consistency …`,
`… version allowlist …`) and exits nonzero if any of hash/status/version fails
(also nonzero on schema failure). Tamper fixture expectations live in
`fixtures/conformance/tampered_receipt.json`.

## 5. Timestamp import policy

`timestamp_utc` is an emission-event field: excluded from `content_hash`,
included in `receipt_id`. SPEC §3.6 requires an ISO-8601 format check on
import with non-conforming timestamps rejected or quarantined. **Status at
5dedaf1: enforced** — non-ISO-8601 timestamps are rejected at the schema
level (red-team R3, commit `17983ef`). Ledger ordering by timestamp still
inherits the honesty limits above: timestamps are emitter-supplied, so a
well-formed timestamp is not a trustworthy one (receipts are unauthenticated
by design).

## 6. Version allowlist and migration

Allowlists (`src/langarian/version.py:32-36`): exactly the current
`KERNEL_VERSION`, `METRIC_VERSION`, `RECEIPT_SCHEMA_VERSION`. Older receipts
(pre-v0.3, no `content_hash`/`receipt_schema_version`, kernel
`langarian-python-ref-v0.1.1`) fail the schema and version levels and import
as **unsupported**; there is no silent downgrade acceptance and no automatic
migration path in v0.3. To carry old results forward, re-run the operations
under the v0.3 kernel and re-emit receipts. See
`docs/MIGRATION_v0.2_to_v0.3.md` for the hash-domain change rationale.

## 7. Minimal example (from `fixtures/conformance/op_phase_shift.json`)

```json
{
  "kernel_version": "langarian-python-ref-v0.3.0",
  "metric_version": "metric:v0.3.scale_safe_normalized_complex_similarity",
  "receipt_schema_version": "receipt:v0.3",
  "timestamp_utc": "1970-01-01T00:00:00+00:00",
  "operator": "phase_shift",
  "input_hashes": ["sha256:d987a96e…"],
  "output_hash": "sha256:c4348c10…",
  "parameters": {"angle_radians": 2.0943951023931953},
  "coherence_before": 1.0,
  "coherence_after": 1.0,
  "invariant_results": [
    {"name": "I1.well_typed_state", "status": "PASS", "message": "…", "value": 2, "metadata": {}}
  ],
  "status": "PASS",
  "epistemic_tag": "COMPUTED",
  "claims": [{"text": "Pure phase shift preserved resonance in this operation instance under the v0.2 finite vector model.", "tag": "COMPUTED", "evidence": [], "metadata": {}}],
  "content_hash": "sha256:3d811487…",
  "receipt_id": "sha256:…"
}
```

(Fixture receipts use the deterministic clock; real emissions carry real UTC
timestamps, so their `receipt_id` differs while `content_hash` is stable for
identical operations.)
