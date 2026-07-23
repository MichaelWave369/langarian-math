# Test and Conformance Report — Langarian Math Workbench v0.3 (0.3.0-rc.1)

Scope: what was executed, with which commands, and the exact counts; the
Python↔TypeScript conformance approach; and — explicitly — what was **not**
run. Recorded per SPEC §8: anything not executed is listed as not run, never
implied.

Primary evidence: `/mnt/agents/output/reports/release_candidate_gates.log`
(release-candidate gate run), reproduced by the independent red team and
again in the final-docs worktree at HEAD `5dedaf1` (same counts: 81 and 181).

## 1. Commands and results

### Python kernel

```bash
pip install -e '.[dev]'
PYTHONPATH=src python -m pytest -q
```

**Result: 81 passed** (local run, Python 3.12.12; 0.62s). Up from 26 tests at
the pre-v0.3 baseline (`/mnt/agents/output/baseline/pytest_baseline.log`).

### Fixture determinism

```bash
PYTHONPATH=src python -m langarian.fixtures --out <tmpdir>
# compare against committed fixtures/conformance/*.json
```

**Result: `FIXTURES_DETERMINISTIC`** — regeneration is byte-identical to the
committed corpus. All fixture receipts use the fixed clock
`1970-01-01T00:00:00+00:00`, so `content_hash` and `receipt_id` are
reproducible.

### Web workbench

```bash
cd web
npm ci                      # 101 packages from the committed lockfile
npm run sync:version        # regenerates src/kernel/version.ts from version.py
npm run test                # vitest run
```

**Result: 181 passed (9 test files)** — per-file breakdown from the gate log:

| Test file | Tests |
|---|---|
| `test/ledger/ledger.test.ts` | 26 |
| `test/conformance/conformance.test.ts` | 43 |
| `test/dsl/executor.test.ts` | 16 |
| `test/dsl/jsonProgram.test.ts` | 11 |
| `test/dsl/parser.test.ts` | 22 |
| `test/ui/ui-smoke.test.ts` | 10 |
| `test/kernel/canonical.test.ts` | 36 |
| `test/kernel/limits.test.ts` | 9 |
| `test/kernel/validation.test.ts` | 8 |
| **Total** | **181** |

The 10 UI smoke tests are included in the 181 (they also run standalone via
`npm run test:ui` → 10 passed). The 43 conformance tests also run standalone
via `npm run test:conformance` → 43 passed.

Version sync at gate time reported
`python_kernel_version_mirrored=langarian-python-ref-v0.3.0`,
`ts_port_version=langarian-ts-port-v0.3.0` (divergence would fail
conformance).

### Production build

```bash
cd web && npm run build
```

**Result:** success (vite 7.3.6, 67 modules, 2.82s). Artifact sizes:

| Artifact | Size | gzip |
|---|---|---|
| `dist/index.html` | 0.88 kB | 0.48 kB |
| `dist/assets/index-*.css` | 10.64 kB | 2.79 kB |
| `dist/assets/index-*.js` | 340.91 kB | 103.55 kB |

### Dependency audit

```bash
cd web && npm audit
```

**Result: `found 0 vulnerabilities`** against the committed lockfile
(dependency floors applied, incl. `vite ≥ 7.3.5`).

## 2. Conformance approach (Python ↔ TypeScript)

- **Fixtures of record:** `src/langarian/fixtures.py` generates
  `fixtures/conformance/*.json` — states, all five operators with expected
  outputs, similarity edge cases (zero, underflow, overflow, cross-dim),
  adversarial magnitudes (`1e-200`, subnormal `5e-162`, `1e200`), 14
  typed-error cases, and a tampered receipt with expected per-level
  validation outcomes. Deterministic clock; corpus committed.
- **Replay:** `web/test/conformance/conformance.test.ts` loads the Python
  fixtures and re-executes them against the TS kernel (`web/src/kernel/`).
- **Value tolerance:** vectors and metrics must match Python within absolute
  `1e-12` across the tested magnitude range `1e±{10,100,200}` (SPEC §4).
  Both sides use IEEE-754 binary64 arithmetic, so arithmetic ports 1:1; the
  tolerance absorbs only libm/ordering differences.
- **Hash byte-exactness:** `state_hash` and receipt `content_hash` must be
  **byte-exact** against the Python fixtures. This requires the TS canonical
  JSON serializer to reproduce CPython float repr semantics exactly (sorted
  keys, tight separators, `ensure_ascii=False` behavior, integral floats keep
  `.0`, zero-padded 2-digit exponents, `-0.0` → `0.0`, non-finite rejected).
  **Any hash mismatch is a conformance test failure — never a tolerated
  pass.**
- **Version manifest:** `web/src/kernel/version.ts` is generated from
  `src/langarian/version.py` by `npm run sync:version`; divergence fails
  conformance.

## 3. What was NOT run

Listed per SPEC §8; none of the following is implied by any pass above:

- **GitHub-hosted CI runners.** The workflows (Python 3.11/3.12 matrix, web
  test/conformance/build/audit gates) are committed, but runner execution on
  GitHub was not performed as part of this release record. All results above
  are local runs, independently reproduced by the red team.
- **Independent real-browser session.** No browser-driven UI testing was
  performed by the red team; UI coverage is exactly the 10 vitest UI smoke
  tests (jsdom-style, no rendering engine). TSX/`tsc` type-checking of the UI
  is not a gate (the UI is JSX; TypeScript covers kernel/DSL/ledger only).
- **Pyodide.** The Pyodide reference playground is deferred by design
  (SPEC §1; TS conformance port was chosen over Pyodide). No Pyodide build or
  run exists.
- **`pip-audit` as a gate.** An environment-wide scan was logged
  (`/mnt/agents/output/reports/pip_audit.log`); it covers the whole sandbox
  Python installation rather than a project lockfile and was not treated as a
  release gate.
- **Receipt authenticity.** Out of scope by design: receipts are
  integrity-hashed, not signed; validation never establishes emitter identity
  (`docs/SECURITY_THREAT_MODEL.md` §1).

## 4. Known limitations of these results

- Gate counts are point-in-time at HEAD `5dedaf1`; the deterministic fixture
  check is the guard against silent drift.
- UI smoke tests verify module wiring and labeled actions, not visual
  rendering or accessibility in a real browser.
- YAML example ingest remains uncapped (declared out of scope for v0.3 with a
  documented warning — `docs/SECURITY_THREAT_MODEL.md` M-5).
