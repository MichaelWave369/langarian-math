# User Guide — Langarian Math Workbench v0.3.1 (0.3.1-rc.1)

Welcome. Langarian Math Workbench is a **small formal-kernel candidate** for
experimenting with finite-dimensional complex-vector transformations, where
every operation emits an inspectable receipt. It does **not** claim to be
physics, psychology, therapy, or a completed mathematical theory.

> **The ledger serves reality, not the author.**

## What you can do today

- Run built-in examples from the command line and get JSON receipts.
- Validate receipts at four clearly labeled levels.
- Print a plain-language explanation of any receipt.
- Use the browser workbench: build states, apply the five operators, write and
  run DSL v0.3 programs, inspect results and exact values, keep a session
  receipt ledger, check receipts at distinct levels, and use the Formal
  Eligibility Gate — all locally, with no backend.

## The browser workbench

The workbench (`web/`) is a Vite + React static site. Its TypeScript kernel
(`web/src/kernel/`) mirrors the Python reference kernel and is replayed against
the committed Python-generated conformance fixtures: metric/vector values agree
within absolute `1e-12`, and state/receipt content hashes are byte-exact.

The eight modules are:

1. State Builder
2. Operator Lab
3. Program Builder
4. Result Inspector
5. Receipt Ledger
6. Formal Eligibility Gate
7. Visualizations
8. Example Library

Every visualization pairs with an exact-value table.

Honest limits:

- The Receipt Ledger offers three distinctly labeled actions — **Check shape**,
  **Verify hash/status/version**, and **Recompute locally**. A shape-only pass
  is never presented as verification, and only recomputation reruns the
  mathematics.
- `cost` annotations on bridges and attenuation are caller-declared, never
  computed or verified.
- Receipts are integrity-hashed but **not authenticated**. A valid hash means
  “untampered,” not “from a trusted source.”
- Interpretive and metaphorical content remains quarantined and cannot enter
  formal mathematical review.
- A formal-eligibility pass is not proof and is not evidence that a model
  describes nature.

```bash
cd web
npm ci && npm run sync:version && npm run dev
```

## The three-gate architecture

```text
Syntax / Integrity Gate
        ↓
Formal Eligibility Gate
        ↓
Reality Gate
```

### Syntax / Integrity Gate

Asks whether the artifact is well formed, internally consistent,
version-compatible, and untampered.

This boundary is implemented through typed inputs, schema checks, hashes,
status consistency, version allowlists, invariant results, and local
recomputation.

### Formal Eligibility Gate

Asks whether a claim is allowed to enter formal mathematical review.

Eligible tags:

- `FORMAL`
- `COMPUTED`

Blocked tags:

- `MODEL`
- `INTERPRETIVE`
- `METAPHOR`
- `OBSERVED`
- `FAILED`

Claims promoted from `MODEL` remain blocked unless an explicit
`formal_derivation_id` is present.

A pass means **eligible for formal review**. It does not mean proved.

### Reality Gate

Would ask whether a formally coherent model has earned scientific confidence
through literature comparison, empirical consistency, prediction, and
independent replication.

The Reality Gate is a future evidence framework only. The current workbench
does not run it, does not pass it, and does not certify a physics claim.

See:

- `docs/THREE_GATE_ARCHITECTURE.md`
- `docs/REALITY_GATE.md`

## Install

Requires Python ≥ 3.10. Native GitHub Actions run the Python 3.11 and 3.12 test
suites plus the browser tests, Python/TypeScript conformance, production build,
and high-severity npm audit.

```bash
pip install -e .
```

## Run an example

```bash
langarian run examples/basic_369.yaml --receipts-dir receipts
```

This performs three operations — a harmonic sum, a bridge, and a phi scale —
and writes three receipts into `receipts/`. A second example with declared cost
accounting:

```bash
langarian run examples/phase_shift_cost.yaml --receipts-dir receipts
```

Exit codes: `0` success, `1` validation failure, `2` unsupported operation.

## Check a receipt

```bash
langarian validate receipts/basic_369_bridge.json
```

Validation reports four separate levels:

1. **Schema** — the file is shaped like a receipt. Shape-only; it is never
   called verified.
2. **Hash** — the recorded `content_hash` and `receipt_id` are recomputed and
   compared.
3. **Status** — the recorded status matches the collapsed invariant results.
4. **Version** — kernel, metric, and schema versions are in the current
   allowlist.

The command exits nonzero if any level fails. Even when all four pass, that is
local consistency checking. It is not a proof and does not establish empirical
truth.

## Understand a receipt

```bash
langarian explain receipts/basic_369_bridge.json
```

Key fields:

- `operator` — which operation ran.
- `input_hashes` / `output_hash` — fingerprints of the states in and out.
- `content_hash` — fingerprint of the mathematical content.
- `receipt_id` — fingerprint of this particular emission event.
- `invariant_results` — individual checks with `PASS`, `WARN`, or `FAIL`.
- `status` — collapsed from the checks; an empty check list is FAIL.
- `epistemic_tag` — the claim status of the result.
- `claims` — the exact statements the operation makes, each tagged.

## The five operations

Full details are in `docs/OPERATOR_CATALOG.md`.

| Operation | What it does | Watch for |
|---|---|---|
| `harmonic_sum(a, b)` | Adds two state vectors | Δcoherence compares two different statistics; see documented caveat |
| `phase_shift(s, θ)` | Rotates phase by θ; norm preservation is checked per instance | Zero state is allowed |
| `attenuated_phase_shift(s, θ, att, cost=...)` | Rotates and scales by `att` | `att < 1` without a cost label produces FAIL |
| `phi_scale(s, n)` | Scales by φⁿ and rotates by golden-angle increments | `n` must be an integer with \|n\| ≤ 64 |
| `bridge(a, b, cost=...)` | Records a typed transition with coherence | `cost` is caller-declared, not computed or verified |

## Epistemic tags

| Tag | Meaning | Formal-review eligible? |
|---|---|---|
| FORMAL | Formally derived under a declared bounded context | Yes |
| COMPUTED | Produced by a bounded kernel computation | Yes, as computation — not proof |
| MODEL | A modeling assumption | No, unless separately derived and identified |
| INTERPRETIVE / METAPHOR | Quarantined explanatory content | No |
| OBSERVED | Empirical observation recorded separately from formal inputs | No |
| FAILED | A failed result | No |

Decorative labels and glyphs are opaque strings, not formal objects. They never
become claims merely by appearing in a state.

## Limits by design

State dimension ≤ 64, systems ≤ 32 states, `phi_scale` exponent within ±64,
labels ≤ 120 characters, glyphs ≤ 16, metadata ≤ 4096 bytes. All numbers and
parameters must be finite. Exceeding a limit produces a clear typed error or a
FAILED receipt — never an unhandled traceback.

## Where to go next

- `docs/THREE_GATE_ARCHITECTURE.md` — the research-governance boundary.
- `docs/REALITY_GATE.md` — future evidence-framework design.
- `docs/PROOF_GATE.md` — Formal Eligibility Gate documentation; filename kept for compatibility.
- `docs/OPERATOR_CATALOG.md` — exact operator semantics.
- `docs/RECEIPT_SCHEMA_vNEXT.md` — receipt fields and validation levels.
- `docs/MATHEMATICAL_DEFINITIONS.md` — the math, with conventions labeled.
- `docs/DEVELOPER_GUIDE.md` — extending the workbench.
- `docs/TEST_AND_CONFORMANCE_REPORT.md` — test commands and evidence.
