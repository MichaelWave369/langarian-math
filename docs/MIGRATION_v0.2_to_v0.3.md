# Migration Guide — v0.1.x/v0.2 → v0.3 (`0.3.0-rc.1`)

Audience: anyone with receipts, hashes, scripts, or docs produced before
commit f00bd61. v0.3 is **additive for normal inputs**, with five intentional
hardening behavior changes (SPEC §3 intro), each listed below with its reason.

## 1. Version map (old → new)

| Concept | Before | v0.3 |
|---|---|---|
| Package | `0.1.3` (`pyproject.toml`) | `0.3.0rc1` per SPEC §2 (bumped at 35839b8); manifest `product_version = "0.3.0-rc.1"` remains the version of record |
| Kernel version string (in every state hash and receipt) | `langarian-python-ref-v0.1.1` (**drifted** from package) | `langarian-python-ref-v0.3.0` (single source: `src/langarian/version.py`) |
| Metric | `metric:v0.2.normalized_complex_similarity` | `metric:v0.3.scale_safe_normalized_complex_similarity` |
| Receipt schema | implicit, no version field | `receipt:v0.3` (explicit field) |
| Model | — | `langarian-finite-complex-model-v0.2.1` (unchanged model, now named) |
| DSL | — | `langarian-dsl:v0.3` (implemented in `web/src/dsl/`) |
| Fixtures | — | `fixtures:v0.3` |

## 2. Hash-domain change (breaking)

State hashes and receipt hashes change for identical inputs, because:

1. `kernel_version` inside every hashed payload changed
   (`v0.1.1` → `v0.3.0`).
2. Receipt bodies gained `receipt_schema_version` and the `content_hash`
   identity.

**Consequence:** v0.1/v0.2 hashes are not comparable to v0.3 hashes. There is
no re-hash bridge — recompute states/operations under the v0.3 kernel to get
new hashes. This is deliberate: the old domain also contained the version
drift defect (D1) and non-deterministic receipt identity.

## 3. Receipt format changes

| Change | Detail | Action |
|---|---|---|
| New field `content_hash` | Deterministic content identity (excludes `timestamp_utc`) | Use it for sameness/dedup/conformance |
| `receipt_id` redefined in docs | Emission-event identity (includes timestamp); was previously the only hash and was loosely called "stable" | Stop comparing `receipt_id` across runs; it is unique per emission by design |
| New field `receipt_schema_version` | `receipt:v0.3` | Required by the schema level |
| Validation replaced | Old `validate` was shape-only ("PASS receipt schema") and trusted `status`/`receipt_id` from the file | New `validate` checks schema + hash + status + version and exits nonzero on hash/status/version failure; old receipts fail schema (missing fields) and version (not allowlisted) → **import as unsupported** |
| Empty `invariant_results` | Collapsed to PASS | Collapses to **FAIL**; schema level requires ≥1 invariant |

**Old receipts:** rejected by the version allowlist; there is no automatic
migration path in v0.3. Re-run the operations under the new kernel and
re-emit. This is intentional (no silent downgrade acceptance, SPEC §3.6).

## 4. Intentional hardening behavior changes

| # | Change | Before | After (v0.3) | Why |
|---|---|---|---|---|
| 1 | `dim == 0` rejection | Constructible; failed later at I1 | `ValueError` at construction (`state.py:92-93`) | Deferred rejection let malformed states exist |
| 2 | `phi_scale` non-integral `n` | Silently truncated (`int(2.7)` → `n=2`) | `TypeError`; also `ValueError` for non-finite, `LimitError` for \|n\| > 64 | Silent truncation falsified receipts; overflow crashed with `OverflowError` |
| 3 | Negative `system_coherence` weights | Accepted; coherence could leave [0, 1] | `ValueError` | Negative weights are not meaningful for coherence averaging |
| 4 | Empty invariant list | PASS | FAIL | "No checks" must not read as "all passed" |
| 5 | I4 semantics | `trace_preservation`: passed if any input hash list was non-empty; evaluated before history finalization | `trace_inputs_recorded`: non-empty **and** each hash matches recorded source hashes; legacy name kept only as a metadata alias | The old check verified nothing about traces (Lane B item 16) |

## 5. Metric behavior changes (same math, fixed edges)

- Similarity is now scale-safe (`metrics.py`): values are unchanged in exact
  arithmetic, but the v0.2 floating-point failures are fixed — self-similarity
  of `1e-200`/`5e-162` vectors is `1.0` (was `0.0` via NaN clamp), and the
  zero conventions hold at all finite magnitudes.
- NaN intermediates now raise `MetricError` instead of being silently clamped
  to `0.0`.
- Resonance of huge-but-finite states (e.g. `1e200`) is finite (was `inf`).
- `-0.0` normalizes to `0.0` in the hash domain (was: hash splitting between
  numerically equal vectors).
- Non-JSON metadata (numpy scalars/arrays, non-finite floats, non-string keys)
  is now a typed construction error instead of an unhandled `TypeError` during
  hashing.

## 6. Invariant/claim wording changes

- I4 emitted name: `I4.trace_inputs_recorded` (legacy `I4.trace_preservation`
  appears only in result metadata as `legacy_name`).
- I5 documentation name: `phase_norm_preservation`; receipts still emit
  `I5.phase_equivariance` as a compatibility alias. The check is a
  per-instance norm comparison, not equivariance in the group-theoretic sense.
- phase_shift claim text is now instance-scoped ("…in this operation
  instance…").
- I3 docstring states plainly: label-presence gate only; adequacy of declared
  cost not verified; increases (attenuation > 1) are unaccounted.

## 7. Proof Gate change

`evaluate_claims`/`require_proof_eligible` now block claims with
`metadata.promoted_from == "MODEL"` unless `metadata.formal_derivation_id` is
present. Scripts that promoted MODEL claims and then used them in proof
contexts will now be rejected — that rejection is the fix (Lane C item 5,
Lane H M-11). A distinct ASSUMPTION tag is a documented future addition.

## 8. CLI notes

- Flags are unchanged: `run <yaml> --receipts-dir`, `validate <receipt>`,
  `explain <receipt>`. (The ROADMAP's `--emit-receipt` flag never existed;
  that doc item remains open — see `docs/CLAIM_BOUNDARY_MATRIX.md` D3.)
- `validate` output format changed: four labeled lines instead of one
  "PASS receipt schema" line.
- YAML ingest is **still uncapped** at 5dedaf1 (tracked as M-5 in
  `docs/SECURITY_THREAT_MODEL.md`, declared out of scope for v0.3); do not
  point the CLI at untrusted YAML until the cap/structured-error work lands.

## 9. What did not change

- The five operators, their math, and their signatures (except typed-error
  tightening above).
- Zero conventions, padding/embedding convention, phase convention.
- Epistemic tag set and Proof Gate allow/block tags.
- Examples (`examples/*.yaml`) run unchanged and produce the same mathematics
  with new hashes.
