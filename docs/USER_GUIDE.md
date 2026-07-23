# User Guide — Langarian Math Workbench v0.3 (0.3.0-rc.1)

Welcome. Langarian Math Workbench is a **small formal kernel candidate** for
experimenting with finite-dimensional complex vector transformations, where
every operation emits an inspectable receipt. It does **not** claim to be
physics, psychology, therapy, or a completed mathematical theory.

## What you can do today (0.3.0-rc.1, HEAD 5dedaf1)

- Run built-in examples from the command line and get JSON receipts.
- Validate receipts at four clearly labeled levels.
- Print a plain-language explanation of any receipt.
- Use the browser workbench (`web/`, static site): build states, apply the
  five operators, write and run DSL v0.3 programs (text or JSON), inspect
  results and exact values, keep a session receipt ledger, check receipts at
  distinct levels, and try the Proof Gate — all locally, no backend.

## The browser workbench

The workbench (`web/`) is a Vite + React static site. Its TypeScript kernel
(`web/src/kernel/`) mirrors the Python reference kernel and is replayed
against the Python-generated conformance fixtures: metric/vector values agree
within absolute `1e-12`, and state/receipt content hashes are byte-exact.

The eight modules: State Builder, Operator Lab, Program Builder (DSL text or
JSON program), Result Inspector, Receipt Ledger, Proof Gate, Visualizations,
Example Library. Every visualization pairs with an exact-value table.

Honest limits, unchanged from the CLI:

- The Receipt Ledger offers three distinctly labeled actions — **"Check
  shape"**, **"Verify hash/status/version"**, **"Recompute locally"**. A
  shape-only pass is never presented as "verified", and only "Recompute
  locally" re-runs the mathematics.
- `cost` annotations on bridges/attenuation are **caller-declared**, never
  computed or verified.
- Receipts are integrity-hashed but **not authenticated** — there is no
  signing or emitter identity. A valid hash means "untampered", not "from a
  trusted source".
- Interpretive content stays in dashed/desaturated panels and cannot enter
  the Proof Gate.

```bash
cd web
npm ci && npm run sync:version && npm run dev
```

## Install

Requires Python ≥ 3.10. Tested locally on 3.12.12 (81/81 tests at 5dedaf1).
A CI workflow for 3.11/3.12 plus web gates exists (`.github/workflows/`), but
GitHub-hosted runner execution was not part of this release record — see
`docs/TEST_AND_CONFORMANCE_REPORT.md` §"Not run".

```bash
pip install -e .
```

## Run an example

```bash
langarian run examples/basic_369.yaml --receipts-dir receipts
```

This performs three operations — a harmonic sum, a bridge, and a phi scale —
and writes three receipts into `receipts/`. A second example with declared
cost accounting:

```bash
langarian run examples/phase_shift_cost.yaml --receipts-dir receipts
```

Exit codes: `0` success, `1` validation failure, `2` unsupported operation.

## Check a receipt

```bash
langarian validate receipts/basic_369_bridge.json
```

Validation reports **four separate levels**, printed distinctly:

1. **Schema** — the file is shaped like a receipt. Shape-only; it is *never*
   called "verified".
2. **Hash** — the recorded `content_hash` and `receipt_id` are recomputed and
   compared (tamper detection).
3. **Status** — the recorded status matches the collapsed invariant results.
4. **Version** — kernel/metric/schema versions are in the current allowlist
   (`receipt:v0.3` era). Older receipts are rejected, not silently accepted.

The command exits nonzero if any level fails. Even when all four pass, that is
**local consistency checking** — it is not a re-run of the mathematics, and it
is not proof of anything beyond "this file is internally consistent and
untampered."

## Understand a receipt

```bash
langarian explain receipts/basic_369_bridge.json
```

Key fields, in plain terms:

- `operator` — which of the five operations ran.
- `input_hashes` / `output_hash` — content fingerprints of the states in/out.
- `content_hash` — fingerprint of the mathematical content (same operation →
  same hash, any time).
- `receipt_id` — fingerprint of this particular emission event (includes the
  timestamp; unique per run; **not** a content hash).
- `invariant_results` — the individual checks with `PASS`/`WARN`/`FAIL`.
- `status` — collapsed from the checks; an empty check list would be FAIL,
  never PASS.
- `epistemic_tag` — the claim status of the result (see below).
- `claims` — the exact statements the operation makes, each tagged.

## The five operations

Full details in `docs/OPERATOR_CATALOG.md`; quick reference:

| Operation | What it does | Watch for |
|---|---|---|
| `harmonic_sum(a, b)` | Adds two state vectors | Δcoherence compares two different statistics (documented caveat) |
| `phase_shift(s, θ)` | Rotates phase by θ; norm preserved per instance (checked) | Zero state is allowed |
| `attenuated_phase_shift(s, θ, att, cost=...)` | Rotates and scales by `att` | `att < 1` without a cost label → FAIL; `att > 1` passes with no accounting (documented I3 limitation) |
| `phi_scale(s, n)` | Scales by φⁿ and rotates by n golden-angle increments | `n` must be an integer with \|n\| ≤ 64; negative `n` FAILs by design |
| `bridge(a, b, cost=...)` | Records a typed transition with coherence | `cost` is your own annotation — declared, not computed or verified |

## Epistemic tags (how to read claims)

| Tag | Meaning | Can enter a proof context? |
|---|---|---|
| FORMAL | Established by an invariant/contract/proof obligation (instance-scoped) | Yes |
| COMPUTED | Produced by a kernel computation | Yes |
| MODEL | A modeling assumption | No — and promoted model claims stay blocked unless they carry an explicit `formal_derivation_id` |
| INTERPRETIVE / METAPHOR / OBSERVED | Quarantined content | No |
| FAILED | A failed result | No |

Decorative labels and glyphs in the shipped examples (e.g. `sigma_3`,
"creative") are opaque strings, not formal objects; they never appear in
`claims[]`.

## Limits you'll hit (by design)

State dimension ≤ 64, systems ≤ 32 states, `phi_scale` exponent within ±64,
labels ≤ 120 characters, glyphs ≤ 16, metadata ≤ 4096 bytes. All numbers and
parameters must be finite. Exceeding a limit produces a clear typed error or a
FAILED receipt — never a crash traceback.

## Where to go next

- `docs/OPERATOR_CATALOG.md` — exact operator semantics.
- `docs/RECEIPT_SCHEMA_vNEXT.md` — every receipt field and validation level.
- `docs/MATHEMATICAL_DEFINITIONS.md` — the math, with conventions labeled.
- `docs/DEVELOPER_GUIDE.md` — if you want to build or extend.
- `docs/MIGRATION_v0.2_to_v0.3.md` — if you have v0.1/v0.2 receipts.
- `docs/TEST_AND_CONFORMANCE_REPORT.md` — what was tested, exact counts, and
  what was not run.
