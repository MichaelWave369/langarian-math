# Receipt Schema

Every kernel operation emits an `OperationReceipt`.

Receipts are the public trace layer: they show what was computed, what was checked, and whether the result passed, warned, or failed.

## Fields

| Field | Meaning |
|---|---|
| `receipt_id` | Stable SHA-256 hash of the receipt body. |
| `kernel_version` | Version of the Langarian Python reference kernel. |
| `metric_version` | Version of the coherence/similarity metric used. |
| `timestamp_utc` | UTC timestamp when the receipt was emitted. |
| `operator` | Operation name, such as `harmonic_sum`, `phase_shift`, or `bridge`. |
| `input_hashes` | Content hashes of all input states. |
| `output_hash` | Content hash of the output state or target state. |
| `parameters` | Operator parameters, including cost labels when applicable. |
| `coherence_before` | Coherence before the operation when meaningful. |
| `coherence_after` | Coherence after the operation when meaningful. |
| `invariant_results` | List of invariant checks with `PASS`, `WARN`, or `FAIL`. |
| `status` | Collapsed receipt status. Any `FAIL` fails the receipt. Any `WARN` warns the receipt. |
| `epistemic_tag` | Claim-status tag for the operation result. |
| `claims` | Tagged statements attached to the operation. |

## Minimal example

```json
{
  "operator": "phase_shift",
  "input_hashes": ["sha256:..."],
  "output_hash": "sha256:...",
  "coherence_before": 1.0,
  "coherence_after": 1.0,
  "status": "PASS",
  "epistemic_tag": "COMPUTED"
}
```

## Invariant result shape

```json
{
  "name": "I5.phase_equivariance",
  "status": "PASS",
  "message": "Pure phase rotation preserved resonance.",
  "value": {
    "before": 1.0,
    "after": 1.0
  },
  "metadata": {}
}
```

## Interpretation quarantine

Receipts may carry interpretive claims, but those claims cannot certify formal validity. The Proof Gate blocks `MODEL`, `INTERPRETIVE`, `METAPHOR`, `OBSERVED`, and `FAILED` claims from formal proof use.

## Receipt rule

No silent transformations. If the state changes, the receipt says how.
