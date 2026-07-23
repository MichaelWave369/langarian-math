# Developer Guide — Langarian Math Workbench v0.3

Technical onboarding for contributors at HEAD 5dedaf1 (product
`0.3.0-rc.1`). Read `docs/MASTER_ARCHITECTURE_v0.3.md` first; this guide is
the practical how-to.

## 1. Repository layout

```
src/langarian/          Python reference kernel (implementation of record)
  version.py            single-source version manifest — edit versions ONLY here
  limits.py             resource limits + typed errors (LimitError, MetricError)
  state.py              ResonantState (immutable complex128 vector, state_hash)
  metrics.py            scale-safe similarity, system_coherence
  operators.py          the five stable operators
  contracts.py          invariants I1..I5, I8
  receipts.py           OperationReceipt, canonical JSON, content_hash/receipt_id
  validation.py         four-level receipt validation
  epistemic.py          tags, statuses, collapse rules
  claims.py             Claim records
  proof_gate.py         tag filter + promoted-MODEL blocking
  fixtures.py           deterministic conformance fixture generator
  cli.py                run / validate / explain
  glyphs.py spaces.py dynamics.py validator.py   stub/demo/legacy — see §6
tests/                  81 tests (pytest)
fixtures/conformance/   generated fixture corpus (committed)
examples/               YAML examples for the CLI
web/                    Vite + React workbench
  src/kernel/           TypeScript mirror of the Python kernel (conformance-checked)
  src/dsl/              DSL v0.3 lexer/parser/executor + JSON program form
  src/ledger/           session receipt ledger engine
  src/ui/               eight workbench modules (React)
  test/                 vitest suites: kernel, DSL, ledger, conformance, UI smoke
docs/                   this documentation set
```

## 2. Setup and checks

```bash
pip install -e '.[dev]'
PYTHONPATH=src python -m pytest -q          # 81 passed at 5dedaf1 (local run, Python 3.12.12)
```

Regenerate fixtures (deterministic; byte-reproducible on a given platform):

```bash
PYTHONPATH=src python -m langarian.fixtures --out fixtures/conformance
```

CLI smoke test:

```bash
langarian run examples/basic_369.yaml --receipts-dir /tmp/receipts
langarian validate /tmp/receipts/basic_369_bridge.json
langarian explain /tmp/receipts/basic_369_bridge.json
```

Web workbench:

```bash
cd web
npm ci
npm run sync:version      # regenerate src/kernel/version.ts from version.py (never hand-edit it)
npm run test              # 181 passed at 5dedaf1 (9 files; incl. 43 conformance, 10 UI smoke)
npm run test:conformance  # fixture replay only (43 tests)
npm run build             # dist: ~341 kB JS (~104 kB gzip), ~11 kB CSS
```

## 3. Invariants of the codebase (do not break)

1. **Version single source.** All version strings come from
   `src/langarian/version.py`. Changing any value requires a migration note
   (SPEC §2). The TS manifest is generated from it, never hand-edited.
2. **Canonical JSON contract.** One serialization behavior for state hashing
   and receipts: sorted keys, `separators=(',',':')`, `ensure_ascii=False`,
   `default=str`, CPython float repr, `-0.0`→`0.0`, non-finite rejected
   (SPEC §3.10; `docs/RECEIPT_SCHEMA_vNEXT.md` §3). Changing this changes the
   hash domain → new `receipt_schema_version` + migration notes.
3. **Receipt identities.** `content_hash` excludes `timestamp_utc`;
   `receipt_id` includes it. Do not conflate them
   (`docs/RECEIPT_SCHEMA_vNEXT.md` §2).
4. **Empty invariants ⇒ FAIL.** `combine_statuses([])` must never return PASS.
5. **Typed errors only.** No unhandled `OverflowError`/`TypeError`/tracebacks
   on user-facing paths; use `LimitError`/`ValueError`/`MetricError`.
6. **Claim discipline.** Every emitted claim is tagged; no theorem/physics/
   canonical-language claims; instance-scoped wording
   (`docs/CLAIM_BOUNDARY_MATRIX.md`).
7. **No new stable operators in v0.3.** Extensions follow the classification
   and promotion rule in `docs/OPERATOR_CATALOG.md` §3.

## 4. Testing conventions

- `tests/test_hardening.py` — boundary dims, malformed inputs, tamper,
  deterministic content hash, seeded property-style cases (norm preservation,
  projective similarity, scale safety across magnitudes), immutability, empty
  invariants FAIL, version downgrade rejection.
- `tests/test_fixtures.py` — fixture corpus regeneration agreement and
  tampered-receipt expectations.
- When behavior changes, add focused tests in the nearest existing file; run
  the full suite before committing.

## 5. TypeScript port (shipped — invariants to preserve)

`web/src/kernel/` implements SPEC §4 per `docs/WEB_KERNEL_ADR.md`. The binding
contracts, now enforced by `web/test/conformance/` (43 replay tests):

- `{re, im}` complex objects; matches Python within abs `1e-12` over
  `1e±{10,100,200}`; `state_hash`/`content_hash` byte-exact vs
  `fixtures/conformance/*.json` — any hash mismatch is a test failure, never
  a tolerated pass.
- The canonical JSON serializer (`web/src/kernel/canonical.ts`) reproduces
  CPython float repr semantics exactly — the highest-risk port item; change it
  only with a hash-domain migration note.
- Floor-mod phase; zero-vector phase → 0; `argmax` tie-breaking replicated;
  scale-safe similarity with the same zero-first branching.
- No `eval`/`new Function`/dynamic import of user strings; imported JSON
  rejects `__proto__`/`constructor`/`prototype` keys.
- DSL per `docs/DSL_SPEC.md` (structured errors, SSA/DAG executor, caps) lives
  in `web/src/dsl/`; kernel errors are typed (`LangarianTypeError`) and the
  executor contains throws as structured `KERNEL_ERROR`s.
- `web/src/kernel/version.ts` is generated by `npm run sync:version` from
  `src/langarian/version.py`; divergence fails conformance. Never hand-edit.

## 6. Known legacy surfaces (handle with care)

- `validator.py` — orphaned pre-v0.3 validator; nothing imports it. Use
  `validation.py`. Rescue-or-remove is a future-lane decision.
- `glyphs.py` — stub, not exported; `spaces.py` — unused helper;
  `dynamics.py` — research-lane demo (EXPERIMENTAL). None are part of the
  stable operator surface.
- Invariant numbering I1..I5, I8: I6/I7 never existed; keep the gap.
- Receipt writes are atomic (tmp+rename) with filename sanitization (red-team
  R6, commit c40bc8f); missing/unreadable receipt files produce clean CLI
  errors (R7, commit 211ef6c). YAML example ingest remains uncapped — declared
  out of scope for v0.3 with a documented warning
  (`docs/SECURITY_THREAT_MODEL.md`, M-5); do not claim it as done.

## 7. Documentation rules

- Every capability statement must be true at the current commit; mark in-flight
  work as specified/in progress, never shipped.
- Cite file paths where useful; keep claims bounded and tagged per
  `docs/CLAIM_BOUNDARY_MATRIX.md`.
- Uncertainty goes in ledgers (threat model, migration notes), not in
  marketing copy.
