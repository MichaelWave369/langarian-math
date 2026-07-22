# Receipt Schema vNEXT (Workbench v0.3)

**Schema version:** `receipt-schema:v0.3.0`  
**Status:** Candidate (extends existing receipts without breaking current consumers)

## Design Goals
- Every state-changing operation emits a receipt.
- Mathematical identity is separable from event identity (timestamp).
- Multiple verification layers are distinguishable:
  - structurally valid
  - hash-valid
  - locally reproducible
  - mathematically contract-valid
  - formally proof-eligible
- Version fields for kernel, metric, schema, and (when present) DSL / application.

## Core Body Fields (canonical for hash)

```json
{
  "schema_version": "receipt-schema:v0.3.0",
  "kernel_version": "langarian-python-ref-v0.2.0",
  "metric_version": "metric:v0.2.normalized_complex_similarity",
  "operator": "phase_shift",
  "input_hashes": ["sha256:..."],
  "output_hash": "sha256:...",
  "parameters": { ... },
  "coherence_before": 1.0,
  "coherence_after": 1.0,
  "invariant_results": [ ... ],
  "status": "PASS",
  "epistemic_tag": "COMPUTED",
  "claims": [ ... ],
  "assumptions": [],
  "numerical_policy": "numerical-policy:v0.3.0",
  "tolerance": { "resonance": 1e-9, "similarity": 1e-12 }
}
```

`timestamp_utc` and `receipt_id` are attached *outside* the pure mathematical body for event identity. The `receipt_id` continues to be the SHA-256 of the canonical body (including or excluding timestamp according to the policy documented in NUMERICAL_POLICY.md; current implementation includes it for continuity).

## Verification Layers (never collapsed)

1. **Structurally valid** — parses against schema, required fields present, types correct.
2. **Hash-valid** — recomputed receipt_id matches stored id.
3. **Locally reproducible** — same inputs + parameters under same kernel/metric versions produce bit-identical (or tolerance-equivalent) output_hash.
4. **Mathematically contract-valid** — all invariants that were declared PASS/WARN/FAIL are re-evaluated and match.
5. **Formally proof-eligible** — every claim in the receipt has a proof-eligible epistemic tag (or an explicitly promoted model assumption).

A green “verified” badge is forbidden. The UI must expose the five layers separately.

## Import / Export
- Single receipt: JSON.
- Bundle: JSON array or JSON Lines with a manifest containing schema_version and kernel_version.
- Imported receipts are treated as untrusted data; validation never executes arbitrary code.

## Migration Notes
Existing v0.2 receipts remain readable. New fields are additive. Old receipts without `schema_version` are treated as `receipt-schema:v0.2.x` and cannot claim v0.3 verification layers without re-emission under the new kernel.

---
*Receipts are the ledger. The ledger is the truth.*
