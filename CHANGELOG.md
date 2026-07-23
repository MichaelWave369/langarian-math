# Changelog

All notable changes to Langarian Math Workbench. This project records
behavioral truth over marketing: entries list evidence and explicitly note
what was **not** run.

## [0.3.0-rc.1] — 2026-07-23

Full v0.3 workbench release candidate: hardened Python reference kernel,
TypeScript conformance port, DSL v0.3, and the eight-module browser workbench.
Kernel hardening landed at `f00bd61`; TS kernel/DSL/UI and the red-team fix
group (R1–R7) landed through HEAD `5dedaf1`.

### Evidence (release-candidate gates; full detail in `docs/TEST_AND_CONFORMANCE_REPORT.md`)

- Python tests: `PYTHONPATH=src python -m pytest -q` → **81 passed** (local
  run, Python 3.12.12; was 26 at the pre-v0.3 baseline).
- Fixture determinism: regenerating `fixtures/conformance/*.json` is
  byte-identical (`FIXTURES_DETERMINISTIC`; fixed clock
  `1970-01-01T00:00:00+00:00`).
- Web tests: `cd web && npm ci && npm run sync:version && npm run test` →
  **181 passed** (9 vitest files), including **43** Python↔TS conformance
  replay tests (values abs ≤ 1e-12, hashes byte-exact) and **10** UI smoke
  tests.
- Web build: `npm run build` → `dist/` JS 340.91 kB (gzip 103.55 kB), CSS
  10.64 kB (gzip 2.79 kB), `index.html` 0.88 kB.
- Supply chain: `npm audit` → **0 vulnerabilities** on the web lockfile.
- Red-team closure: an independent red team reproduced the gates and rechecked
  its blockers — **R1, R2, R3 closed and rechecked PASS**; all items **R1–R7
  closed** (fix commits `1af6ab2`, `17983ef`, `6251578`, `c40bc8f`,
  `211ef6c`, roll-up `0112a0e`). Residual documented items: YAML example
  ingest remains uncapped (declared out of scope for v0.3 with warning);
  GitHub CI runner execution not performed; browser-based UI testing not
  independently re-run by the red team; TSX/`tsc` UI smoke typing is not a
  gate; receipts remain unauthenticated by design (integrity hashing only).
- Source audits applied: `/mnt/agents/output/audit/` lanes A/B/C/F/H and the
  SPEC governance review; baseline `/mnt/agents/output/baseline/BASELINE_AUDIT.md`.
  Lane summary: `docs/SWARM_AUDIT_REPORT.md`.

### Added

- `src/langarian/version.py` — single-source version manifest
  (`kernel_version = langarian-python-ref-v0.3.0`,
  `metric:v0.3.scale_safe_normalized_complex_similarity`,
  `receipt:v0.3`, `langarian-dsl:v0.3`, `fixtures:v0.3`,
  `langarian-ts-port-v0.3.0`, …) plus import allowlists. Fixes the
  `v0.1.1`-vs-`0.1.3` receipt-identity drift (audit D1).
- `src/langarian/limits.py` — typed `LimitError`/`MetricError` and resource
  limits: `MAX_DIM=64`, `MAX_STATES=32`, `MAX_PROGRAM_STEPS=64`,
  `MAX_DSL_TOKENS=4096`, `MAX_AST_DEPTH=32`, `MAX_METADATA_BYTES=4096`,
  `MAX_LABEL_CHARS=120`, `MAX_GLYPH_CHARS=16`, `MAX_PHI_SCALE_POWER=64`.
- `src/langarian/validation.py` — four-level receipt validation
  (schema/hash/status/version); shape-only passes are never labeled
  "verified"; version allowlist rejects older/unknown receipts.
- Receipt `content_hash` (deterministic, excludes `timestamp_utc`) alongside
  `receipt_id` (emission-event identity, includes timestamp). New receipt
  field `receipt_schema_version`.
- `src/langarian/fixtures.py` + `fixtures/conformance/` — deterministic
  conformance corpus incl. adversarial magnitudes (`1e-200`, `5e-162`,
  `1e200`), 14 typed-error cases, and tampered-receipt expectations.
- Tests: `tests/test_hardening.py` (boundary, malformed input, tamper,
  deterministic content hash, seeded property-style norm preservation /
  projective similarity / scale safety, immutability, empty-invariants FAIL,
  version downgrade rejection) and `tests/test_fixtures.py`.
- TypeScript kernel port `web/src/kernel/` — complex `{re,im}` arithmetic,
  scale-safe similarity, five operators, receipts with
  `contentHash`/`receiptId`, four-level validation, and a canonical JSON
  serializer reproducing CPython float repr; byte-exact hashes against the
  Python fixtures (conformance mismatch = test failure).
- DSL v0.3 implementation `web/src/dsl/` — text lexer/parser and JSON program
  form compiling to the same AST; SSA/DAG executor with step/token/depth
  caps; structured `{line, column, code, message}` errors; typed kernel
  errors contained as `KERNEL_ERROR`.
- Session receipt ledger `web/src/ledger/` and engine facade
  (`web/src/engine.ts`).
- Eight-module workbench UI `web/src/ui/` — State Builder, Operator Lab,
  Program Builder, Result Inspector, Receipt Ledger, Proof Gate,
  Visualizations, Example Library; fixed-chrome status badges, bidi/control
  stripping at ingest, exact-value tables, CSP meta tag, no
  `dangerouslySetInnerHTML` of receipt content.
- Web CI gates: committed lockfile, `npm ci`, `test`/`conformance`/`build`/
  `audit` jobs (SPEC §7); `pyproject.toml` bumped to `0.3.0rc1`.
- Red-team fixes: deep-frozen read-only metadata (R1, `1af6ab2`), ISO-8601
  timestamp rejection at schema level (R3, `17983ef`), scale-safe
  resonance/similarity for deep subnormals (R4, `6251578`), atomic receipt
  writes + filename sanitization (R6, `c40bc8f`), clean CLI error/exit for
  missing/unreadable receipt files (R7, `211ef6c`).
- Docs: `MASTER_ARCHITECTURE_v0.3.md`, `MATHEMATICAL_DEFINITIONS.md`,
  `OPERATOR_CATALOG.md`, `CLAIM_BOUNDARY_MATRIX.md`,
  `RECEIPT_SCHEMA_vNEXT.md`, `DSL_SPEC.md`, `WEB_KERNEL_ADR.md`,
  `NUMERICAL_POLICY.md`, `SECURITY_THREAT_MODEL.md`, `USER_GUIDE.md`,
  `DEVELOPER_GUIDE.md`, `MIGRATION_v0.2_to_v0.3.md`.

### Changed (intentional hardening — see `docs/MIGRATION_v0.2_to_v0.3.md`)

- `ResonantState` is truly immutable (defensive copy + read-only vector);
  metadata is validated (JSON-safe, string keys, finite numbers, ≤ 4096
  canonical bytes) at construction.
- `dim == 0` states are rejected at construction (was: constructible).
- Similarity and resonance are scale-safe: no overflow to `inf`, no underflow
  inversion of the zero conventions; NaN intermediates raise `MetricError`
  instead of silently clamping to `0.0`. Exact-arithmetic values unchanged.
- `phi_scale` rejects non-integral `n` (was: silent truncation), non-finite
  `n`, and `|n| > 64` (was: unhandled `OverflowError`).
- `system_coherence` rejects negative weights (was: accepted, coherence could
  leave [0, 1]); diagonal-inclusion convention documented.
- Empty `invariant_results` collapses to FAIL (was: PASS).
- I4 renamed/redefined to `trace_inputs_recorded` (non-empty AND match against
  recorded source hashes; legacy name kept as metadata alias only).
- I5 documented as `phase_norm_preservation` (per-instance check, not
  group-theoretic equivariance); emitted receipt name unchanged for
  compatibility.
- I3 documented as a label-presence gate (no adequacy check; increases free).
- phase_shift claim reworded to instance scope.
- Proof Gate blocks claims promoted from MODEL that lack a
  `formal_derivation_id`.
- Operator parameters (`angle_radians`, `attenuation`, `cost`) must be finite;
  negative attenuation rejected — all typed errors, no tracebacks.
- CLI `validate` prints the four validation levels distinctly and exits
  nonzero on hash/status/version failure.
- Canonical JSON contract unified: sorted keys, tight separators,
  `ensure_ascii=False`, shared `default=str`, CPython float repr,
  `-0.0` → `0.0`, non-finite floats rejected at ingest/serialization.

### Known gaps carried into rc.1 (honest ledger)

- YAML example ingest has no size/expansion caps (M-5). Per SPEC §3.11 this
  is **declared out of scope for v0.3** with a documented warning
  (`docs/SECURITY_THREAT_MODEL.md`); the CLI examples path is for trusted
  local files. Not smoothed over; capped ingest or a structured error
  envelope remains future work.
- Receipts are **unauthenticated by design**: hashing gives integrity only,
  never emitter identity (no signing/provenance in v0.3).
- Multi-hop ledger lineage verification is a ledger-level check, not a kernel
  invariant.

### Not run (listed per SPEC §8)

- GitHub-hosted CI runner execution (workflows are committed; runners were
  not executed as part of this release record — all gates above are local
  runs, reproduced by the independent red team).
- Independent browser (real-browser UI) testing by the red team; UI coverage
  is the 10 vitest UI smoke tests. TSX/`tsc` type-checking of the UI is not a
  gate.
- `pip-audit` as a release gate (an environment-wide scan was logged at
  `/mnt/agents/output/reports/pip_audit.log`; it covers the whole sandbox
  Python environment, not a project lockfile, and was not treated as a gate).
- Pyodide reference playground (deferred by design, SPEC §1).
