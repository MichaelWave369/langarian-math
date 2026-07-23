# Security Threat Model — Langarian Math Workbench v0.3

Source: Lane H adversarial surface map
(`/mnt/agents/output/audit/Lane_H_red_team_surface.md`, 14 PoCs executed
against the pre-hardening kernel), updated at HEAD 5dedaf1 with per-item
dispositions including the independent red-team fix group (R1–R7). Severity
scale: Critical/High/Medium/Low. "Implemented" means code exists at 5dedaf1
and is covered by tests; "Specified" means a binding contract exists (SPEC)
but code does not; "Planned" means scheduled, no contract code yet.

**Honesty ledger:** an independent red team reproduced all release gates
(81 pytest, 181 web tests, 43 conformance replay, fixture determinism,
build, `npm audit` = 0) and rechecked its blockers: **R1, R2, R3 closed and
rechecked PASS**; all items **R1–R7 closed** (see §5). Residual items
recorded, not smoothed over: YAML example ingest uncapped (declared out of
scope for v0.3); GitHub CI runner execution not performed; browser-based UI
testing not independently run by the red team; TSX/`tsc` UI smoke typing is
not a gate; receipts unauthenticated by design. Mitigations marked
Implemented are supported by the test suites (81/81 Python locally:
`PYTHONPATH=src python -m pytest -q`, Python 3.12.12; 181/181 web vitest).

## 1. Assets and trust boundaries

- **Assets:** receipt integrity (hash + status + version honesty), state hash
  stability, claim boundaries (no trust laundering into proof contexts),
  availability of the CLI/workbench under hostile input.
- **Trust boundaries:** imported receipt JSON; imported DSL/program text;
  YAML example files; metadata/label/glyph strings (attacker-controlled
  Unicode rendered by a future UI); the TS/Python language boundary (hash
  domain); third-party supply chains (npm, pip).
- **Out of scope for v0.3:** receipt authenticity (no signing/provenance —
  hashes give integrity only, never emitter identity); multi-hop ledger
  lineage verification (ledger-level check, not a kernel invariant).

## 2. Threat register (Lane H items → v0.3 dispositions)

### P0 — verification honesty / ledger integrity

| ID | Threat | Disposition at 5dedaf1 |
|---|---|---|
| H-1 (High) | Decorative validation: `status`/`receipt_id` trusted from file; tampered PASS receipts validate | **Implemented** — four-level validation (`src/langarian/validation.py`): schema (never labeled "verified"), hash recompute (`content_hash` + `receipt_id`), status collapse consistency, version allowlist. CLI prints levels distinctly and exits nonzero on hash/status/version failure. Tamper expectations pinned in `fixtures/conformance/tampered_receipt.json`; covered by `tests/test_hardening.py` |
| H-2 (High) | Frozen `ResonantState` mutable → hash invalidation after receipt emission | **Implemented** — defensive copy + `vector.setflags(write=False)` in `__post_init__` (`state.py:89-99`); mutation raises. Tested |
| H-3 (High) | Empty `invariant_results` collapses to PASS | **Implemented** — `combine_statuses([])` → FAIL (`epistemic.py:38-51`); schema level requires ≥1 invariant. Tested |
| H-4 (High) | Silent overflow/underflow → wrong coherence reported as PASS | **Implemented** — scale-safe similarity/norm; zero branch before scaling; non-finite intermediate → `MetricError`, never clamped. Property-style seeded tests across magnitudes (`tests/test_hardening.py`, `tests/test_metrics.py`); fixtures pin `1e±200`/subnormal cases |

### P1 — parser/ingest and resource exhaustion

| ID | Threat | Disposition |
|---|---|---|
| M-5 (Medium) | YAML example ingest: alias bomb; uncaught `AttributeError`/`ValueError` tracebacks | **Declared out of scope for v0.3 — residual, documented.** `cli.py` still uses `yaml.safe_load` with no size/expansion caps. Per SPEC §3.11 the alternatives were caps-with-structured-errors or an explicit out-of-scope declaration; the red team accepted the declaration path with this warning standing: the CLI examples path is for trusted local files only — do not point it at untrusted YAML. Capped ingest or a structured error envelope remains future work for v0.3.0 final |
| M-6 (Medium) | No dimension/size limits in kernel | **Implemented (kernel side)** — `limits.py`: `MAX_DIM=64`, `MAX_STATES=32`, `MAX_METADATA_BYTES=4096`, `MAX_LABEL_CHARS=120`, `MAX_GLYPH_CHARS=16`, `MAX_PHI_SCALE_POWER=64`; typed `LimitError`s, tested at boundaries (0, 1, MAX, MAX+1). DSL-side caps (`MAX_PROGRAM_STEPS=64`, `MAX_DSL_TOKENS=4096`, `MAX_AST_DEPTH=32`) are **specified** (`docs/DSL_SPEC.md`), pending the DSL implementation |
| M-7 (Medium) | `phi_scale`/attenuation overflow → unhandled `OverflowError`; NaN parameters crash | **Implemented** — finite-parameter coercion, integral-n check, `|n| ≤ 64`; extreme/NaN/inf parameters are typed errors or FAILED receipts, never tracebacks. Fixture error cases pin 14 typed-error paths |

### P1 — hash/canonicalization and cross-language conformance

| ID | Threat | Disposition |
|---|---|---|
| H-8 (High) | Canonical JSON not portable: float formatting, `NaN`/`Infinity` tokens, `-0.0` splitting, asymmetric `default=str` | **Implemented (Python + TS)** — shared canonical contract (SPEC §3.10): sorted keys, tight separators, `ensure_ascii=False`, `default=str` on both call sites, CPython float repr, `-0.0`→`0.0`, non-finite rejected at ingest with typed errors. The TS serializer (`web/src/kernel/canonical.ts`) reproduces CPython float semantics and is pinned by 43 conformance replay tests with **byte-exact** `state_hash`/`content_hash` equality — any mismatch is a test failure, not a tolerated pass |
| M-9 (Medium) | `receipt_id` includes wall-clock timestamp (non-reproducible); imported timestamps unvalidated; receipts unauthenticated | **Implemented (identity split + timestamp check)** — content/emission split done (`content_hash` excludes timestamp; `receipt_id` includes it); ISO-8601 import validation **enforced** at schema level in Python and TS (red-team R3, commit `17983ef`). Signing/provenance: **out of scope v0.3 by design**, documented here and in `docs/RECEIPT_SCHEMA_vNEXT.md`, not smoothed over |
| M-10 (Medium) | Version downgrade accepted; lineage one hop deep; I4 cosmetic | **Implemented (version + I4)** — allowlists reject older/unknown `kernel_version`/`metric_version`/`receipt_schema_version` (tested, incl. downgrade rejection); I4 redefined as `trace_inputs_recorded` (non-empty AND match recorded source hashes; evaluated against finalized metadata). **Lineage depth: by design** a ledger-level check; documented, not claimed as a kernel invariant |

### P2 — claim/proof-gate governance

| ID | Threat | Disposition |
|---|---|---|
| M-11 (Medium) | `promote_model_assumption` as trust-laundering primitive | **Implemented (interim)** — Proof Gate blocks any `promoted_from == "MODEL"` claim lacking `formal_derivation_id` (`proof_gate.py:40-50`); tested in `tests/test_proof_gate.py`. Distinct ASSUMPTION tag: **documented future addition** (SPEC §3.7) |

### P2 — web/workbench (forward-looking)

| ID | Threat | Disposition |
|---|---|---|
| M-12 (Medium) | Dependency vulnerabilities & supply chain: vite 7.0.0 CVEs (dev-server scoped), no lockfile, `npm install` not `npm ci`, no audit gates, unpinned Python deps | **Implemented (web lane)** — committed lockfile, `npm ci` in workflows and docs, dependency floors applied (`vite ≥ 7.3.5`; gate build used vite 7.3.6), web gates job (test/conformance/build/audit) in CI. `npm audit` on the lockfile: **0 vulnerabilities** (`/mnt/agents/output/reports/release_candidate_gates.log`). Caveat: GitHub-hosted runner execution was not part of the rc.1 release record; `pip-audit` was not a gate (environment-wide scan only, `/mnt/agents/output/reports/pip_audit.log`) |
| L-13 (Low today / High for workbench) | XSS/UI-spoofing via labels, glyphs, metadata, claims (bidi-override/homoglyph badge spoofing) | **Implemented (UI lane)** — SPEC §6 mitigations shipped in `web/src/ui/`: bidi-override/control characters stripped at ingest; status badges are fixed chrome (icon+position+text), never user text; no `dangerouslySetInnerHTML`/raw-markdown rendering of receipt content; CSP meta tag in `index.html`. Covered by 10 UI smoke tests (vitest, no real browser). Label/glyph length caps implemented kernel-side (120/16 chars). Caveat: no independent real-browser session was run |
| L-14 (forward) | DSL/parser abuse, prototype pollution, deep nesting, cycles | **Implemented** — `web/src/dsl/` ships the SPEC §4/§5 mitigations: no `eval`/`new Function`/dynamic import; `__proto__`/`constructor`/`prototype` keys rejected; token/depth/step caps before evaluation; SSA+DAG executor; typed kernel errors contained as structured `KERNEL_ERROR`. Covered by parser/jsonProgram/executor suites (49 tests) |
| L-15 (Low) | Unsafe file handling: non-atomic receipt writes; future path-traversal via attacker-controlled filenames | **Implemented** — atomic tmp+rename receipt writes and filename sanitization for export/import (red-team R6, commit `c40bc8f`); clean CLI error/exit for missing or unreadable receipt files (R7, commit `211ef6c`) |

## 3. Existing mitigations credited (kept from Lane H)

`yaml.safe_load` (not `load`); finiteness gate in state construction;
documented zero conventions; epistemic tag model with proof gate;
`interpretation_quarantine`; 26 pre-hardening tests (now 81) incl. negative
proof-gate tests; no `eval`/`exec`/pickle/subprocess anywhere in the codebase;
React default escaping; CI runs pytest on push/PR.

## 4. Verification status (explicit)

| Check | Status |
|---|---|
| Kernel unit/hardening tests (81) | **Run** — `PYTHONPATH=src python -m pytest -q` → 81 passed (local, Python 3.12.12) |
| Independent red-team recheck | **Run** — gates reproduced; blockers R1/R2/R3 closed and rechecked PASS; R1–R7 closed (§5) |
| TS conformance replay (values + byte-exact hashes) | **Run** — 43/43 vitest replay tests pass; hash mismatch = test failure |
| Web test suite | **Run** — 181/181 passed (9 files; incl. 10 UI smoke) |
| Web build with TS kernel | **Run** — `npm run build` → JS 340.91 kB (gzip 103.55 kB) |
| `npm audit` (web lockfile) | **Run** — 0 vulnerabilities |
| GitHub-hosted CI runner execution | **Not run** — workflows committed; runners not executed in this release record |
| Real-browser UI testing (independent) | **Not run** — UI coverage is the 10 vitest smoke tests; TSX/`tsc` typing not a gate |
| `pip-audit` as a gate | **Not run as a gate** — environment-wide scan logged only (`/mnt/agents/output/reports/pip_audit.log`) |
| Pyodide playground | **Not run** — deferred by design (SPEC §1) |

## 5. Red-team closure ledger (independent red team, rc.1)

The independent red team attacked the hardened kernel/TS port and re-ran the
release gates. Blockers R1–R3 were closed and **rechecked PASS**; all items
R1–R7 are **closed**. Release-record evidence:
`/mnt/agents/output/audit/Final_RedTeam_Report.md`,
`/mnt/agents/output/audit/Final_RedTeam_Blocker_Recheck.md`.

| ID | Item | Status | Fix evidence |
|---|---|---|---|
| R1 | Mutable state metadata after construction (hash invalidation) | **Closed, rechecked PASS** | Deep-frozen read-only metadata (`1af6ab2`) |
| R2 | Blocker (red-team report item) | **Closed, rechecked PASS** | Closed in the fix group; roll-up `0112a0e` |
| R3 | Non-ISO-8601 timestamps accepted on receipt import | **Closed, rechecked PASS** | Schema-level rejection, Python + TS (`17983ef`) |
| R4 | Resonance/similarity wrong for deep subnormals | **Closed** | Scale-safe norm path (`6251578`); fixture-pinned |
| R5 | Red-team report item | **Closed** | Closed in the fix group; roll-up `0112a0e` |
| R6 | Non-atomic receipt writes; unsanitized filenames | **Closed** | Atomic tmp+rename + sanitization (`c40bc8f`) |
| R7 | Tracebacks on missing/unreadable receipt files | **Closed** | Clean CLI typed error/exit (`211ef6c`) |

**Residual scope notes (kept, not smoothed over):**

- YAML example ingest remains uncapped — declared out of scope for v0.3 with
  the M-5 warning standing (trusted local files only).
- GitHub CI runner execution not performed; all gates are local runs,
  reproduced by the red team.
- Browser-based UI testing was not independently run by the red team; UI
  assurance is the 10-test vitest smoke suite, and TSX/`tsc` typing of the UI
  is not a gate.
- Receipts are unauthenticated by design: hashes give integrity only, never
  emitter identity; multi-hop ledger lineage is a ledger-level check.
