# Master Architecture — Langarian Math Workbench v0.3

Status of this document: descriptive architecture reference for product version
`0.3.0-rc.1` at HEAD `5dedaf1`. Implementation status is stated per component;
nothing here certifies a theorem, a proof, or a physical claim. The kernel is a
finite-dimensional formal kernel candidate (see `README.md` and
`docs/CLAIM_BOUNDARY_MATRIX.md`).

Sources: `SPEC.md` (swarm contract), `/mnt/agents/output/design/design.md`,
audit lanes A/B/C/F/H (`/mnt/agents/output/audit/*.md`), and the hardened Python
kernel under `src/langarian/`.

## 1. Component status at HEAD 5dedaf1

| Component | Path | Status |
|---|---|---|
| Python reference kernel | `src/langarian/` | **Implemented** (hardened v0.3 contracts; 81/81 tests pass locally: `PYTHONPATH=src python -m pytest -q`) |
| Conformance fixtures | `fixtures/conformance/*.json`, generator `src/langarian/fixtures.py` | **Implemented** (deterministic clock `1970-01-01T00:00:00+00:00`; regeneration byte-identical) |
| Version manifest (single source) | `src/langarian/version.py` | **Implemented** |
| Resource limits + typed errors | `src/langarian/limits.py` | **Implemented** |
| Receipt validation levels | `src/langarian/validation.py` | **Implemented** (schema/hash/status/version) |
| CLI (`run`/`validate`/`explain`) | `src/langarian/cli.py` | **Implemented** (validate prints the four levels distinctly; clean errors for missing/unreadable files) |
| TypeScript kernel port | `web/src/kernel/` | **Implemented** per SPEC §4 — 43 conformance replay tests pass: values abs ≤ 1e-12, `state_hash`/`content_hash` byte-exact vs Python fixtures; `web/src/kernel/version.ts` is generated from `version.py`, never hand-edited |
| DSL (text + JSON program) | `web/src/dsl/` | **Implemented** per `docs/DSL_SPEC.md` (SPEC §5) — text parser and JSON program form to the same AST; SSA/DAG executor with caps; structured errors |
| Workbench UI (8 modules) | `web/src/ui/` | **Implemented** per SPEC §6 and `design/design.md` — State Builder, Operator Lab, Program Builder, Result Inspector, Receipt Ledger, Proof Gate, Visualizations, Example Library; 10 UI smoke tests; no independent real-browser session (see `docs/TEST_AND_CONFORMANCE_REPORT.md`) |
| Session receipt ledger | `web/src/ledger/` | **Implemented** (26 ledger tests) |
| Red-team reruns / TS conformance replay | — | **Run** — independent red team reproduced all gates; blockers R1–R3 closed and rechecked PASS, R1–R7 closed (see `docs/SECURITY_THREAT_MODEL.md` §5 and `docs/SWARM_AUDIT_REPORT.md`) |

## 2. System shape

```
examples/*.yaml ──> cli.py ──> operators.py ──> OperationReceipt (JSON)
                                    │
fixtures/conformance/*.json <── fixtures.py (deterministic clock)
                                    │
Python kernel (reference of record)         TypeScript port (shipped, conformance-checked)
┌──────────────────────────────┐           ┌──────────────────────────────┐
│ version.py  (single source)  │─generate─>│ web/src/kernel/version.ts    │
│ limits.py   (typed errors)   │           │ complex {re,im} arithmetic   │
│ state.py    (ResonantState)  │           │ scaleSafeSimilarity          │
│ metrics.py  (similarity,     │─fixtures─>│ replay: values abs ≤ 1e-12,  │
│             coherence)       │  replay   │ hashes byte-exact or build   │
│ operators.py (5 stable ops)  │           │ fails (SPEC §4)              │
│ contracts.py (I1..I5, I8)    │           └──────────────────────────────┘
│ receipts.py (content_hash /  │
│              receipt_id)     │
│ validation.py (4 levels)     │
│ proof_gate.py (tag filter)   │
└──────────────────────────────┘
```

Layering (acyclic, verified by import inspection):
`version`/`limits`/`epistemic` < `state` < `metrics`/`contracts` < `receipts` <
`operators` < `cli`; `validation` depends on `receipts`/`epistemic`/`version`;
`proof_gate` depends on `claims`/`epistemic` only.

Known legacy items: `src/langarian/validator.py` is an orphaned pre-v0.3
validator (nothing imports it); `glyphs.py`, `spaces.py`, `dynamics.py` are
stub/demo/research-lane modules, not part of the stable operator surface.

## 3. Python kernel (implemented)

### 3.1 State — `src/langarian/state.py`
`ResonantState`: frozen dataclass wrapping a 1-D `complex128` vector.
Hardening at f00bd61:

- Construction defensively copies the vector and calls
  `vector.setflags(write=False)` (audit Lane H finding H-2; SPEC §3.1).
- `dim == 0` is rejected with `ValueError`; `dim > MAX_DIM=64` with
  `LimitError`; non-finite components with `ValueError`.
- Metadata is validated at construction: string keys, JSON-safe values
  (str/int/finite float/bool/None/list/dict), canonical-JSON size ≤
  `MAX_METADATA_BYTES=4096`. Non-JSON or non-finite metadata is a typed error,
  never a crash inside hashing (SPEC §3.1, §3.10).
- `state_hash()` = `sha256:` over the canonical payload (kernel_version,
  label, glyph, vector pairs, metadata, history).

### 3.2 Metrics — `src/langarian/metrics.py`
`metric:v0.3.scale_safe_normalized_complex_similarity`
(`METRIC_VERSION` in `version.py`). See `docs/NUMERICAL_POLICY.md` for the
full policy. Key points:

- Similarity normalizes each vector by its max component magnitude before the
  inner product, so squared norms cannot underflow/overflow (Lane B item 4,
  Lane H H-4). Exact-arithmetic value unchanged; zero conventions
  `C(0,0)=1`, `C(0,x)=0` are evaluated before scaling and now hold at all
  finite magnitudes, including subnormals.
- A non-finite or non-positive intermediate raises `MetricError`; NaN is never
  silently clamped.
- `system_coherence` rejects negative weights (typed `ValueError`) and
  documents that diagonal self-similarities are included in the average.
- Resonance (Euclidean norm) is computed scale-safely in `state.py:119-131`.

### 3.3 Operators — `src/langarian/operators.py`
Exactly five stable operators (SPEC §1: no new stable operators in v0.3):
`harmonic_sum`, `phase_shift`, `attenuated_phase_shift`, `phi_scale`, `bridge`.
Full specification: `docs/OPERATOR_CATALOG.md`. Parameter hardening:

- `angle_radians`, `attenuation`, `cost` must be finite (typed error otherwise).
- `phi_scale` exponent `n` must be integral with `|n| ≤ MAX_PHI_SCALE_POWER=64`;
  non-integral `n` is a `TypeError` (intentional hardening — v0.2 silently
  truncated; see `docs/MIGRATION_v0.2_to_v0.3.md`).
- Every operator emits an `OperationReceipt` with invariants, claims, and
  before/after coherence.

### 3.4 Contracts — `src/langarian/contracts.py`
Invariants I1 `well_typed_state`, I2 `coherence_bound`, I3 `accounted_change`,
I4 `trace_inputs_recorded` (renamed/redefined in v0.3: `input_hashes` non-empty
AND each equals a recorded source hash; legacy name `I4.trace_preservation`
appears only as a metadata alias), I5 (emitted name `I5.phase_equivariance`;
v0.3 documentation name `phase_norm_preservation` — the check is a per-instance
norm comparison, not a group-theoretic equivariance proof), I8
`interpretation_quarantine`. The I6/I7 numbering gap is historical and
documented (no I6/I7 ever existed). `combine_statuses([])` collapses to FAIL —
"no checks" never reads as PASS (SPEC §3.4; Lane H H-3).

### 3.5 Receipts — `src/langarian/receipts.py`
Two distinct identities (SPEC §3.5):

- `content_hash` — deterministic mathematical identity; SHA-256 of the
  canonical body **excluding** `timestamp_utc` and both identity fields.
- `receipt_id` — emission-event identity; includes `timestamp_utc`, unique per
  emission; **not** a content hash.

Full schema: `docs/RECEIPT_SCHEMA_vNEXT.md`. Canonical JSON contract:
sorted keys, `separators=(',',':')`, `ensure_ascii=False`, shared
`default=str` fallback, CPython shortest-repr float formatting, `-0.0`
normalized to `0.0`, non-finite floats rejected at ingest/serialization.

### 3.6 Validation — `src/langarian/validation.py`
Shared multi-level receipt validation returning levels
`{schema, hash, status, version}`:

- **schema**: required fields, enum values, ≥1 invariant result. Shape-only
  pass is never labeled "verified".
- **hash**: recompute `content_hash` and `receipt_id`, compare (tamper
  detection).
- **status**: `collapse(invariant_results) == status`, empty list → FAIL,
  FAILED tag forces FAIL.
- **version**: allowlists from `version.py`
  (`ALLOWED_KERNEL_VERSIONS`, `ALLOWED_METRIC_VERSIONS`,
  `ALLOWED_RECEIPT_SCHEMA_VERSIONS`); older/unknown versions rejected.

Even full success is *local consistency verification*, not recomputation of
the underlying mathematics. Local re-execution ("Recompute locally") is a
separate, explicit operation (SPEC §1; planned for the TS/UI lane).

### 3.7 Proof Gate — `src/langarian/proof_gate.py`
Tag filter only; it does not prove mathematics. Allowed tags: FORMAL, COMPUTED.
v0.3 hardening (Lane C item 5; SPEC §3.7): any claim with
`metadata.promoted_from == "MODEL"` is blocked from proof contexts unless
metadata also carries `formal_derivation_id`. A distinct ASSUMPTION tag is a
documented future addition, not implemented.

### 3.8 Fixtures — `src/langarian/fixtures.py`, `fixtures/conformance/`
Deterministic generator (`python -m langarian.fixtures --out fixtures/conformance`)
emitting: states (incl. `1e-200`, `1e200`, subnormal `5e-162`), all five
operators with expected outputs/hashes, similarity edge cases (zero, underflow,
overflow, cross-dim), typed-error cases, and tampered-receipt cases with
expected per-level validation outcomes. All fixture receipts use the fixed
clock so `content_hash`/`receipt_id` are reproducible.

## 4. TypeScript port (implemented at 5dedaf1)

SPEC §4 contract for `web/src/kernel/`, now shipped and conformance-tested
(`web/test/conformance/`, 43 tests):

- Complex `{ re: number, im: number }`; vectors as arrays.
- Must match Python within abs `1e-12` across magnitudes `1e±{10,100,200}`.
- Fixture replay asserts values within tolerance **and** `state_hash`/receipt
  `content_hash` byte-exact equality; any hash mismatch is a conformance build
  failure, never a tolerated pass.
- Canonical JSON serializer implementing SPEC §3.10 (CPython float repr
  semantics) — the highest-risk port item.
- No `eval`, no `new Function`, no dynamic import of user strings;
  prototype-pollution-safe JSON handling (`__proto__`, `constructor`,
  `prototype` keys rejected).
- Embeds the generated version manifest; divergence from `version.py` is a
  build failure.

Decision rationale and alternatives: `docs/WEB_KERNEL_ADR.md`.

## 5. DSL (implemented at 5dedaf1)

Text syntax and JSON program form compile to the same AST; registry is exactly
the five operators plus `state`. Grammar, errors, executor semantics, and
limits are specified in `docs/DSL_SPEC.md` (from SPEC §5) and implemented in
`web/src/dsl/` (lexer/parser, JSON program form, SSA/DAG executor with
step/token/depth caps, structured errors, typed kernel errors contained as
`KERNEL_ERROR`).

## 6. UI (implemented at 5dedaf1)

SPEC §6 + `design/design.md`: Vite + React retained; TypeScript only for
kernel/DSL; no Tailwind/shadcn; dark scientific workstation theme; eight
modules (State Builder, Operator Lab, Program Builder, Result Inspector,
Receipt Ledger, Proof Gate, Visualizations, Example Library). Receipt ledger
buttons carry exact labels: "Check shape", "Verify hash/status/version",
"Recompute locally". Interpretive panels are quarantined (dashed/desaturated)
and cannot enter the Proof Gate. Every visualization has an exact-value table
and a caption. Status uses icon+text, never color alone.

## 7. Version manifest (single source)

`src/langarian/version.py` is the only hand-edited version source:

| Key | Value |
|---|---|
| product_version | `0.3.0-rc.1` |
| kernel_version | `langarian-python-ref-v0.3.0` |
| model_version | `langarian-finite-complex-model-v0.2.1` |
| metric_version | `metric:v0.3.scale_safe_normalized_complex_similarity` |
| receipt_schema_version | `receipt:v0.3` |
| dsl_version | `langarian-dsl:v0.3` |
| fixture_version | `fixtures:v0.3` |
| ts_port_version | `langarian-ts-port-v0.3.0` |
| visualization_version | `viz:v0.3` |

Any change to these values requires a migration note explaining why
(SPEC §2). The v0.1.1→v0.3.0 hash-domain change is documented in
`docs/MIGRATION_v0.2_to_v0.3.md`.

## 8. Resource limits

From `src/langarian/limits.py` (SPEC §1): `MAX_DIM=64`, `MAX_STATES=32`,
`MAX_PROGRAM_STEPS=64`, `MAX_DSL_TOKENS=4096`, `MAX_AST_DEPTH=32`,
`MAX_METADATA_BYTES=4096`, `MAX_LABEL_CHARS=120`, `MAX_GLYPH_CHARS=16`,
`MAX_PHI_SCALE_POWER=64`. Exceeding a limit is a typed error
(`LimitError`/`ValueError`) or a FAILED receipt — never a traceback.
DSL/executor limits are enforced at 5dedaf1: kernel-side limits in
`src/langarian/limits.py`, DSL-side caps (`MAX_PROGRAM_STEPS`,
`MAX_DSL_TOKENS`, `MAX_AST_DEPTH`) in the `web/src/dsl/` parser/executor.

## 9. Claim discipline

All documentation and UI copy follow `docs/CLAIM_BOUNDARY_MATRIX.md`:
bounded language; MODEL/INTERPRETIVE/METAPHOR/OBSERVED/FAILED never certify
formal results; uncertainty is recorded in ledgers/audits, not smoothed over.
Invariant PASSes are per-instance evidence, not proofs of universal
propositions.
