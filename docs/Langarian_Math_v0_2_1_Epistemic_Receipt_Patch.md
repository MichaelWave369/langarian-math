# Langarian Math v0.2.1 — Epistemic Receipt Patch

## Status

Patch over Langarian Math v0.2 FKC. This does not promote the system to v1.0.

## Purpose

The v0.2 FKC grounded the system into a finite-dimensional formal kernel with a Ledger / Validator layer and an interpretation quarantine. This patch adds per-proposition epistemic tags so that every result knows what kind of claim it is.

## Epistemic tags

| Tag | Meaning | Formal proof use |
|---|---|---|
| `FORMAL` | Established by an invariant, contract, or proof obligation. | Allowed |
| `COMPUTED` | Calculated by the kernel with typed inputs and known algorithm. | Allowed as computed evidence |
| `MODEL` | Modeling assumption used to set up a domain. | Not proof unless explicitly accepted as an assumption |
| `INTERPRETIVE` | Symbolic, emotional, narrative, or domain translation. | Not proof |
| `METAPHOR` | Poetic or intuitive explanation. | Not proof |
| `OBSERVED` | External observation or user report. | Evidence only, not formal proof |
| `FAILED` | Failed invariant, invalid state, or rejected transition. | Blocks proof |

## Promotion rule

A proposition tagged `INTERPRETIVE`, `METAPHOR`, or `OBSERVED` cannot be used as a formal proof input. It can only become part of a model after being restated as an explicit `MODEL` assumption and recorded in the receipt.

## Receipt extension

Every receipt now carries:

- `epistemic_tag`
- `claims[]`
- `invariant_results[]`
- `status`: `PASS`, `WARN`, or `FAIL`

## Implementation boundary

The Python reference kernel remains finite-dimensional and deliberately boring. Hilbert spaces, RKHS glyph dictionaries, natural transformations, symplectic dynamics, Julia, and Lean are future research lanes, not trunk requirements.
