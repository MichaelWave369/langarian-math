# ADR — Web Kernel: TypeScript Conformance Port

- **Status:** Accepted (SPEC §1 decision) and **implemented** — at HEAD
  5dedaf1 `web/src/kernel/` is the shipped TypeScript conformance port and
  `web/` is the v0.3 workbench (DSL, ledger, eight UI modules). This ADR
  records the decision, evidence, and consequences.
- **Deciders:** v0.3 swarm (SPEC §1), grounded in Lane F audit
  (`/mnt/agents/output/audit/Lane_F_web_architecture.md`) and baseline
  evidence (`/mnt/agents/output/baseline/`).
- **Context:** The workbench must run in the browser as a static, local-first
  GitHub Pages site while producing results that agree with the Python
  reference kernel — including byte-exact hashes.

## 1. Decision

**Build a TypeScript conformance port of the kernel, verified against
Python-generated fixtures.** Pyodide is deferred to an optional future
reference playground. A service architecture is rejected for v0.3.

## 2. Options compared

Evidence from Lane F §1 and the baseline audit:

| Criterion | TS conformance port | Pyodide (browser CPython) | Service architecture |
|---|---|---|---|
| First load (wire) | ~65 kB gzip (measured baseline build: JS 189.98 kB / 60.16 kB gzip, `baseline/npm_build_tmp.out`) | ~8–15 MB (runtime + numpy wheel ~7 MB + stdlib ~5 MB; order-of-magnitude from Pyodide release artifacts, not pinned/measured) | ~65 kB client + network RTT per operation |
| Startup | <100 ms | Multi-second cold boot | Network-bound |
| Offline / local-first | Native | Native only if self-hosted (adds ~20 MB to dist) | **Fails offline** |
| GitHub Pages static hosting | Native (existing `pages.yml` workflow) | Compatible (static wasm) | **Incompatible without an external host** |
| Behavioral agreement with Python | Fixture replay + explicit tolerance; hash-exact requires a Python-compatible float serializer (hard part, bounded) | Bit-identical by construction | Identical (same interpreter) |
| Security surface | Small; no remote code; no `eval` if the parser is hand-built | Large runtime blob; CDN/third-party supply chain if not self-hosted | New trust boundary: backend, secrets, CORS, DoS — precisely an unverifiable trust point, against the "receipts not hype" constitution |
| Cost/ops | None | None | Hosting + maintenance |

## 3. Why the port is feasible here (evidence)

- The formal kernel core is small: 13 modules, ~1,226 LOC total at audit time,
  ~900 LOC formal core; NumPy use is shallow (complex128 arithmetic, `norm`,
  `vdot`, `exp`, `angle`, `argmax`, `sum`, `isfinite`) — Lane F §1.2.
- The operator surface is five operators with a fully enumerable contract —
  ideal for a conformance fixture matrix.
- Python floats and JS numbers are both IEEE-754 doubles, so arithmetic ports
  1:1; the only systemic divergence risk is canonical JSON float
  serialization, addressed by contract (§4).

## 4. Conformance strategy (binding, SPEC §4)

1. **Fixtures:** Python generator (`src/langarian/fixtures.py`) emits
   `fixtures/conformance/*.json` — states, operations, expected vectors,
   coherences, state hashes, receipt content hashes — under a deterministic
   clock (`1970-01-01T00:00:00+00:00`). Fixtures are committed to the repo.
2. **Tolerances:** vector/metric values abs ≤ `1e-12` across tested magnitudes
   `1e±{10,100,200}` (guards libm ULP differences in `exp`/`atan2`); complex
   representation `{re: number, im: number}`.
3. **Hash exactness:** `state_hash` and receipt `content_hash` must be
   **byte-exact** with Python fixtures. Any hash mismatch is a conformance
   build failure, never a tolerated pass (SPEC governance review P0-1).
4. **Canonical JSON serializer (highest-risk item):** the TS side must
   implement the SPEC §3.10 contract — sorted keys, tight separators,
   `ensure_ascii` false, **CPython shortest-repr float formatting** (`3.0`
   not `3`; `1e-07`-style zero-padded signed exponents; CPython notation
   boundaries), `-0.0` → `0.0`, non-finite rejected. Tested against the
   adversarial fixture floats (`1e-200`, `1e200`, subnormal `5e-162`,
   cross-dim cases).
5. **Version manifest:** `web/src/kernel/version.ts` is **generated** from
   `src/langarian/version.py` at build/fixture time, never hand-edited; the TS
   port displays `python_kernel_version_mirrored` + `ts_port_version`;
   divergence is a build failure.
6. **Porting traps explicitly documented** (Lane F §2.3): floor-mod for phase
   (`%` semantics differ for negatives), zero-vector phase → 0, `argmax`
   tie-breaking on exact cancellation must be replicated exactly, scale-safe
   similarity preserving zero conventions, non-negative weights only in
   system coherence.

## 5. Security contract for the port (SPEC §4)

- No `eval`, no `new Function`, no dynamic `import()` of user strings.
- Prototype-pollution-safe JSON handling: reject `__proto__`, `constructor`,
  `prototype` keys in imported receipts/programs.
- DSL parser is hand-written against `docs/DSL_SPEC.md` with token/depth/step
  caps before evaluation.

## 6. Consequences

**Positive**
- Keeps the ~65 kB gzip, sub-100 ms, offline-capable, static-Pages product.
- No backend, no new trust boundary.
- Conformance is *verifiable* precisely because the surface is small: fixtures
  pin both values and hash bytes, and any drift fails the build.

**Negative / costs accepted**
- Two implementations to maintain; mitigated by generated version manifest,
  shared fixtures, and the small kernel surface.
- The canonical-JSON float serializer is exacting work; if it proves
  infeasible for some float class, the fallback is a decimal-string encoding
  change to the hash domain — which would be a `receipt_schema_version` bump
  requiring migration notes (SPEC §2 rule).
- Pyodide's bit-identical behavior is forgone; it remains available as an
  optional future "Reference Kernel Playground" panel (lazy-loaded,
  self-hosted, clearly labeled) — never the primary engine.
- Service architecture may be revisited only as an optional *verifier* lane,
  not as a compute dependency.

## 7. Status and follow-ups

- TS kernel/DSL/UI: **shipped** at 5dedaf1 (SPEC §4/§6 contracts implemented
  in `web/src/kernel/`, `web/src/dsl/`, `web/src/ledger/`, `web/src/ui/`).
- Conformance replay: **run** — 43 vitest replay tests pass locally (values
  abs ≤ 1e-12, hashes byte-exact; mismatch = test failure) and the workflow
  includes a web gates job; GitHub-hosted runner execution was not part of
  the rc.1 release record (see `docs/TEST_AND_CONFORMANCE_REPORT.md`).
- UI formula drift guard: **resolved** — the Operator Lab states the full
  `phi_scale` formula `z' = Φⁿ·z·e^{i·n·(2π/Φ)}` from kernel constants (the
  v0.1 Phi Scale card `z' = Φⁿz` understated the operator — Lane C item 6);
  see `docs/CLAIM_BOUNDARY_MATRIX.md`.
