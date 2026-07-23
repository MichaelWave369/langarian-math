# Swarm Audit Report — Langarian Math Workbench v0.3 (0.3.0-rc.1)

How this release was produced: parallel audit lanes, a SPEC governance
review, implementation lanes, and an independent red team — followed by the
release-candidate gates. This document summarizes each lane and its outcome,
and maps the plan's validation gates A–G to executed checks.

Artifact paths below point at the release record under `/mnt/agents/output/`
(external evidence store, not repo-relative links). Repo-side detail:
`docs/TEST_AND_CONFORMANCE_REPORT.md` (commands/counts),
`docs/SECURITY_THREAT_MODEL.md` (threat register + R1–R7 ledger).

## 1. Audit lanes (read-only, pre-implementation)

Baseline: repo at `6718bf0`, 26/26 tests, static v0.1 landing page
(`/mnt/agents/output/baseline/BASELINE_AUDIT.md`).

| Lane | Artifact | Focus | Key findings → disposition |
|---|---|---|---|
| A — Repository cartography | `/mnt/agents/output/audit/Lane_A_repository_cartography.md` | Module map, dead code, version surfaces | Mapped 13 kernel modules; found orphaned `validator.py`; enumerated 5-way version drift → single-source manifest `version.py` (D1 resolved) |
| B — Mathematical audit | `/mnt/agents/output/audit/Lane_B_mathematical_audit.md` | Correctness of the math + FP edge behavior | Definitions sound (standard ℓ² norm, Hermitian inner product, Cauchy–Schwarz bound); flagged FP overflow/underflow (`1e200` → `inf` resonance), mutable "frozen" state, `dim==0` constructible → all fixed in kernel hardening + R4 subnormal fix |
| C — Claims / epistemic | `/mnt/agents/output/audit/Lane_C_claims_epistemic.md` | Overclaim hunt | No reject-grade violations; 4 downgrade items (universal phase_shift claim, I5 name outrunning its check, MODEL→COMPUTED promotion path, understated Phi Scale UI formula) → all resolved; dispositions tracked in `docs/CLAIM_BOUNDARY_MATRIX.md` |
| F — Web architecture | `/mnt/agents/output/audit/Lane_F_web_architecture.md` | Browser strategy | Option scorecard: TS conformance port chosen over Pyodide (~8–15 MB wire, multi-second cold start) and service architecture (breaks local-first/static Pages); identified canonical-JSON float serialization as the hash-exactness risk → SPEC §3.10 contract |
| H — Red-team surface | `/mnt/agents/output/audit/Lane_H_red_team_surface.md` | Adversarial PoCs (14 executed) | H-1 decorative validation, H-2 mutable frozen state, H-3 empty-invariants PASS, H-4 silent overflow reported as PASS; M-5..M-12, L-13..L-15 → per-item dispositions in `docs/SECURITY_THREAT_MODEL.md` |

## 2. SPEC governance review

Artifact: `/mnt/agents/output/audit/SPEC_governance_review.md`. An
independent review of `SPEC.md`/`design.md` against the audit lanes found the
six focus decisions coherent but identified unspecified sub-contracts that
would let the implementation "pass" while receipt-integrity claims were
false. All P0/P1 items were applied to the SPEC revision:

- **P0:** hash-exactness contract for TS conformance (values 1e-12, hashes
  byte-exact, mismatch = failure); canonical JSON float policy (SPEC §3.10);
  metadata immutability (SPEC §3.1).
- **P1:** DSL numeric expressions; I4 redefinition + migration note; receipt
  identity construction and timestamp policy; validation-taxonomy correction
  (schema/hash/status/version, reproducibility separate, proof eligibility
  claim-level); single-source version mechanism; `MAX_PHI_SCALE_N=64`; UI
  trust-laundering gaps (bidi stripping, fixed-chrome badges, CSP).
- **P2:** polish items applied or recorded (scale-safe zero branch, YAML
  limits/scope, atomic writes, filename sanitization, audit floor, …).

## 3. Implementation lanes

| Lane | Output | Evidence |
|---|---|---|
| Python kernel hardening | Limits/typed errors, immutability, scale-safe metric, content_hash/receipt_id split, four-level validation, fixture generator, Proof Gate blocking | commit `f00bd61`; `tests/test_hardening.py`, `tests/test_fixtures.py` |
| TS kernel + conformance | `web/src/kernel/` mirror incl. CPython-exact canonical JSON; byte-exact fixture replay | commits `bcfa983`–`a4487b3`; 43 conformance tests |
| DSL + ledger | `web/src/dsl/` (text + JSON program, SSA/DAG executor, caps, structured errors), `web/src/ledger/` | commits `bd1a5af`–`2e5ea54`; 49 DSL + 26 ledger tests |
| Workbench UI | `web/src/ui/` eight modules with formal/interpretive separation, fixed-chrome badges, exact-value tables | merge `2ddf5bd` (+`03667e9`); 10 UI smoke tests |
| Meta / packaging | ROADMAP refresh, README reconciliation, `pyproject.toml` → `0.3.0rc1`, CI matrix + web gates | commits `35839b8`–`460f967`, `c8e93df`, `21d7175` |
| Red-team fix group | R1, R3, R4, R6, R7 fixes + roll-up | commits `1af6ab2`, `17983ef`, `6251578`, `c40bc8f`, `211ef6c`, `0112a0e` |

## 4. Independent red team (rc.1)

Independent of the implementers, the red team reproduced every release gate
and rechecked its blockers. Release-record evidence:
`/mnt/agents/output/audit/Final_RedTeam_Report.md` and
`/mnt/agents/output/audit/Final_RedTeam_Blocker_Recheck.md`.

- **Blockers R1, R2, R3: closed and rechecked PASS.**
- **All items R1–R7: closed** (fix evidence per item in
  `docs/SECURITY_THREAT_MODEL.md` §5).
- Gates reproduced with the same counts as the release-candidate run
  (`/mnt/agents/output/reports/release_candidate_gates.log`): pytest 81,
  web 181 (conformance 43, UI smoke 10 included), fixture determinism,
  build, `npm audit` = 0.

## 5. Residual risks (documented, not smoothed over)

1. **YAML example ingest uncapped** (M-5) — declared out of scope for v0.3
   with a standing warning: trusted local files only; caps/structured errors
   remain future work.
2. **GitHub CI runner execution not performed** — workflows committed; all
   gate evidence is local runs, reproduced by the red team.
3. **No independent real-browser UI session** — UI assurance is the 10-test
   vitest smoke suite; TSX/`tsc` typing of the UI is not a gate.
4. **Receipts unauthenticated by design** — integrity hashing only; no
   signing/provenance; multi-hop lineage is a ledger-level check.
5. **`pip-audit` not a gate** — an environment-wide scan was logged
   (`/mnt/agents/output/reports/pip_audit.log`) but covers the sandbox
   Python installation, not a project lockfile.

## 6. Validation gates A–G (from `/mnt/agents/output/plan.md`)

Each gate is evidence-backed or explicitly recorded as not passed.

| Gate | Meaning | Outcome | Evidence / not-run items |
|---|---|---|---|
| A — Repository Integrity | Single-source versions, deterministic artifacts, reproducible tree | **Passed (local)** | Version manifest + `sync:version` mirror check (`python_kernel_version_mirrored=langarian-python-ref-v0.3.0`, `ts_port_version=langarian-ts-port-v0.3.0`); fixture regeneration byte-identical (`FIXTURES_DETERMINISTIC`); committed lockfile + `npm ci`. GitHub runner execution **not run** |
| B — Mathematical Integrity | Kernel math correct within stated conventions | **Passed** | Lane B findings fixed; 81/81 pytest incl. seeded property-style norm-preservation/projective-similarity/scale-safety across `1e±{10,100,200}`; 43/43 conformance replay: values abs ≤ 1e-12, hashes byte-exact |
| C — Receipt Integrity | Tamper-evident, honestly labeled receipts | **Passed with stated scope** | Four-level validation (schema/hash/status/version); tampered-receipt fixture expectations; R1/R3/R6/R7 fixes; ledger + validation suites (26 + 8 tests). Residual: receipts unauthenticated by design |
| D — Proof-Gate Integrity | No trust laundering into proof contexts | **Passed** | Promoted-MODEL blocking with negative tests (`tests/test_proof_gate.py`); epistemic tag discipline per `docs/CLAIM_BOUNDARY_MATRIX.md`; interpretive panels quarantined from the Proof Gate in UI |
| E — Software Quality | Tests, build, supply chain | **Passed (local)** | pytest 81; vitest 181 (9 files); `vite build` success (JS 340.91 kB / gzip 103.55 kB); `npm audit` 0 vulnerabilities; typed errors, no tracebacks (R7). GitHub runners **not run**; `pip-audit` **not a gate** |
| F — User Experience | Shipped, inspectable workbench | **Passed on test evidence only** | Eight modules shipped; 10/10 UI smoke tests; labeled ledger actions ("Check shape" / "Verify hash/status/version" / "Recompute locally"); accessibility contract (icon+text status, keyboard nav, reduced motion) per SPEC §6. Independent real-browser session **not run** — recorded as the gap |
| G — Documentation | Accurate, bounded docs | **Passed** | Docs set reconciled to shipped status at 5dedaf1 (README, guides, ROADMAP, MIGRATION, ADR, claim matrix); `docs/TEST_AND_CONFORMANCE_REPORT.md`; this report; migration notes for the hash-domain change; not-run lists in CHANGELOG §"Not run" |

## 7. Standing honesty rules carried forward

- No single vague "verified" badge anywhere: validation levels are exact
  (schema / hash / status / version / recompute-locally).
- Invariant PASSes are per-instance evidence, not proofs of universal
  propositions; no physics/theorem/canonical-language claims
  (`docs/CLAIM_BOUNDARY_MATRIX.md`).
- Anything not executed is listed as not run — in this report, in
  `docs/TEST_AND_CONFORMANCE_REPORT.md` §3, and in `CHANGELOG.md`.
