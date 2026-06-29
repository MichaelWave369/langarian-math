# Langarian Math

**Version:** Python reference implementation v0.1.1 for **Langarian Math v0.2 FKC** plus the **v0.2.1 Epistemic Receipt Patch** and the **Kimi v1 Harvest Review**.

This repo is intentionally finite-dimensional, executable, and test-first. It does not claim to be physics, psychology, therapy, or a completed mathematical theory. It is a small formal kernel candidate for resonance-style symbolic state transformations with receipts.

## What this builds

- Finite complex vector states
- Resonance as vector norm
- Phase as a derived global phase estimate
- Coherence as normalized complex similarity
- Pure phase shifts that preserve resonance
- Attenuated phase shifts with declared cost
- Phi scaling / golden-angle rotation
- Harmonic sum via vector addition
- Bridge receipts between states
- Epistemic tags for every claim/result
- Invariant checks and PASS/WARN/FAIL statuses
- Finite space helper harvested safely from Kimi v1
- Norm-preserving unitary flow demo kept as a research-lane demo

## Install locally

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -e '.[dev]'
```

## Run tests

```bash
pytest
```

## Run the 3-6-9 example

```bash
langarian run examples/basic_369.yaml --receipts-dir receipts
```

or without installing console scripts:

```bash
python -m langarian.cli run examples/basic_369.yaml --receipts-dir receipts
```

## Core boundary

A poetic or interpretive statement may ride along with a computation, but it cannot be used as proof. The formal kernel only promotes typed states, computed metrics, invariant checks, and receipts.

## Package layout

```text
src/langarian/
  state.py       finite complex vector state model
  metrics.py     resonance, phase, coherence metrics
  operators.py   harmonic_sum, phase_shift, attenuated_phase_shift, phi_scale, bridge
  receipts.py    immutable operation receipt + hashing
  validator.py   invariant runner
  epistemic.py   proposition/result tags
  claims.py      tagged proposition records
  contracts.py   invariant contracts
  glyphs.py      tiny glyph dictionary stub with nearest-score helper
  spaces.py      finite C^n utility helper, no infinite Hilbert claim
  dynamics.py    norm-preserving rotation demo, no symplectic theorem claim
  cli.py         small runner for examples
```


## Kimi v1 Harvest

Kimi's v1.0 artifact is preserved under `experimental/kimi_v1_harvest/` as a pressure-test branch. It is not trunk. The safe harvest patch adds finite-space utilities, a norm-preserving rotation demo, and glyph nearest-score helpers while downgrading unearned category/RKHS/symplectic/theorem claims. See `docs/Kimi_v1_Harvest_Review.md`.
