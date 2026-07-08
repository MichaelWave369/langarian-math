# Langarian Math

[![tests](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/tests.yml)
[![pages](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml/badge.svg)](https://github.com/MichaelWave369/langarian-math/actions/workflows/pages.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-cyan.svg)](LICENSE)
[![python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](pyproject.toml)

**Version:** Python reference implementation v0.1.4 for **Langarian Math v0.2 FKC** plus the **v0.2.1 Epistemic Receipt Patch**, **Public Proof Gate**, **Public Polish Patch**, and the first **Reduced-Domain Helper**.

**Live site:** https://michaelwave369.github.io/langarian-math/

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
- Proof Gate for formal claim eligibility
- Receipt validation and explanation CLI commands
- Invariant checks and PASS/WARN/FAIL statuses
- Finite space helper harvested safely from Kimi v1
- Norm-preserving unitary flow demo kept as a research-lane demo
- Generic reduced-domain bracket-wall scanner with MODEL-tagged receipts
- React / GitHub Pages scaffold in `web/`

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

## Run the reduced-domain scan

```bash
langarian run examples/bracket_wall_scan.yaml --receipts-dir receipts
langarian validate receipts/bracket_wall_scan.json
langarian explain receipts/bracket_wall_scan.json
```

This command computes the finite sample screen for:

```text
B(t) = 1 - 6*kappa^2*c^2*V_gamma_gamma(t)
```

A PASS receipt means the supplied samples satisfy the selected bracket-wall rule. It is not a proof of a larger theory or a validation of full dynamics.

## Validate and explain receipts

```bash
langarian validate receipts/basic_369_bridge.json
langarian explain receipts/basic_369_bridge.json
```

These commands validate public receipt shape and print a human-readable summary. They do not recompute or overclaim the underlying operation.

## Web app

A small Vite + React public landing page lives in `web/`.

```bash
cd web
npm install
npm run dev
npm run build
```

A GitHub Pages workflow is included at `.github/workflows/pages.yml`. To publish it, set the repository Pages source to **GitHub Actions** in the repo settings.

## Core boundary

A poetic or interpretive statement may ride along with a computation, but it cannot be used as proof. The formal kernel only promotes typed states, computed metrics, invariant checks, and receipts. Reduced-domain helpers are model-tagged until a later proof lane earns stronger claims.

## Public docs

- `docs/PROOF_GATE.md`
- `docs/RECEIPT_SCHEMA.md`
- `docs/USAGE.md`
- `docs/REDUCED_DOMAIN.md`
- `docs/ROADMAP.md`
- `docs/Kimi_v1_Harvest_Review.md`

## Package layout

```text
src/langarian/
  state.py           finite complex vector state model
  metrics.py         resonance, phase, coherence metrics
  operators.py       harmonic_sum, phase_shift, attenuated_phase_shift, phi_scale, bridge
  receipts.py        immutable operation receipt + hashing
  validator.py       invariant runner
  epistemic.py       proposition/result tags
  proof_gate.py      formal proof-context eligibility gate
  claims.py          tagged proposition records
  contracts.py       invariant contracts
  glyphs.py          tiny glyph dictionary stub with nearest-score helper
  spaces.py          finite C^n utility helper, no infinite Hilbert claim
  dynamics.py        norm-preserving rotation demo, no symplectic theorem claim
  reduced_domain.py  reduced-domain bracket-wall scanner, model-tagged
  cli.py             example runner + receipt validator/explainer
```

## Kimi v1 Harvest

Kimi's v1.0 artifact is preserved under `experimental/kimi_v1_harvest/` as a pressure-test branch. It is not trunk. The safe harvest patch adds finite-space utilities, a norm-preserving rotation demo, and glyph nearest-score helpers while downgrading unearned category/RKHS/symplectic/theorem claims. See `docs/Kimi_v1_Harvest_Review.md`.
