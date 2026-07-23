# Changelog

All notable changes to Langarian Math Workbench. This project records
behavioral truth over marketing: entries list evidence and explicitly note
what was **not** run.

## [0.3.1-rc.1] — 2026-07-23

Focused governance-clarification release. No mathematical operator, kernel,
metric, receipt-schema, DSL, or TypeScript conformance semantics changed.

### Added

- Three-gate research architecture:
  - Syntax / Integrity Gate
  - Formal Eligibility Gate
  - Reality Gate
- `docs/THREE_GATE_ARCHITECTURE.md`.
- `docs/REALITY_GATE.md`, explicitly marked as a future evidence framework and
  not a current implementation or physics-validation claim.
- Persistent UI explanation that formal validity does not imply empirical or
  physical validity.
- Governing maxim: **“The ledger serves reality, not the author.”**

### Changed

- Public-facing **Proof Gate** name changed to **Formal Eligibility Gate**.
- Gate PASS language changed from proof-adjacent wording to “eligible for
  formal mathematical review.”
- Historical Python module and API names remain for backward compatibility:
  `proof_gate.py`, `ProofGateReport`, `ProofGateError`, and
  `require_proof_eligible`.
- Epistemic-strip tag descriptions now distinguish formal-review eligibility
  from proof and from contact with nature.
- Example Library gate-rejection example renamed publicly while retaining its
  stable internal id.
- Product version bumped to `0.3.1-rc.1`; kernel/model/metric/receipt/DSL/port
  versions remain unchanged because their behavior did not change.

### Evidence

- Existing Python and browser test suites remain the release gates.
- Native GitHub Actions cover Python 3.11/3.12, browser tests,
  Python/TypeScript conformance, Vite production build, and high-severity npm
  audit.
- New governance text introduces no claim that a Reality Gate has been run or
  passed.

### Still not claimed

- No theorem is proved by a Formal Eligibility Gate pass.
- No physical model is validated by this workbench.
- No empirical, predictive, or replication status is generated in v0.3.1.
- Automated real-browser accessibility and multi-engine end-to-end testing
  remain future work.

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
  closed**.
- Source audits applied: repository, mathematical, claims/epistemic, security,
  visual, and adversarial lanes. Lane summary: `docs/SWARM_AUDIT_REPORT.md`.

### Added

- `src/langarian/version.py` — single-source version manifest.
- `src/langarian/limits.py` — typed resource limits and kernel errors.
- `src/langarian/validation.py` — four-level receipt validation.
- Deterministic `content_hash` alongside event-level `receipt_id`.
- `src/langarian/fixtures.py` + `fixtures/conformance/`.
- Boundary, malformed-input, tamper, property-style, immutability, and version
  tests.
- TypeScript kernel port `web/src/kernel/`.
- DSL v0.3 implementation `web/src/dsl/`.
- Session receipt ledger `web/src/ledger/` and engine facade.
- Eight-module workbench UI: State Builder, Operator Lab, Program Builder,
  Result Inspector, Receipt Ledger, Proof Gate, Visualizations, and Example
  Library.
- Web CI gates: install, test, conformance, build, and audit.
- Mathematical, architectural, numerical, security, user, developer, and
  migration documentation.

### Changed

- `ResonantState` became defensively immutable.
- `dim == 0` states are rejected.
- Similarity and resonance became scale-safe.
- `phi_scale` rejects invalid, non-integral, non-finite, and oversized powers.
- `system_coherence` rejects negative weights.
- Empty invariant lists collapse to FAIL.
- I4 became `trace_inputs_recorded` with a legacy alias.
- I5 is documented as per-instance phase-norm preservation, not a theorem.
- I3 is documented as a label-presence gate.
- Phase-shift claims were restricted to instance scope.
- Proof Gate blocks claims promoted from MODEL without a
  `formal_derivation_id`.
- Operator parameters must be finite.
- CLI validation prints the four validation levels separately.
- Canonical JSON behavior was unified across Python and TypeScript.

### Known gaps carried into rc.1

- YAML example ingest has no size/expansion caps and is restricted to trusted
  local examples.
- Receipts are unauthenticated by design: hashing gives integrity, not emitter
  identity.
- Multi-hop ledger lineage verification is a ledger-level check, not a kernel
  invariant.
- Independent real-browser accessibility testing remained outside the initial
  K3 release record.
- Pyodide reference playground remained deferred.
