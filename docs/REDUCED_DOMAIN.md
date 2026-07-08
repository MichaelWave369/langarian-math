# Reduced-Domain Helper

This document describes a generic finite-sample domain helper in Langarian Math.

It scans supplied scalar samples for an explicit boundary expression.

A PASS receipt means only this:

> The supplied finite samples satisfy the selected boundary inequality.

It does **not** prove a larger theory, solve dynamics, infer a potential, or promote a physics claim.

## Why this exists

Some math workflows need quick executable gates before later symbolic or numerical work depends on a domain condition. This helper turns that kind of check into a repeatable receipt while preserving claim boundaries.

## Symbol custody

The helper records a generic reduced-symbol custody set:

```text
coordinate, momentum, angle, angle_momentum, lapse_like_parameter, gamma_like_parameter, reduced_constraint, B(t)
```

The scanner does not introduce a new degree of freedom. It only accepts finite scalar samples for `t`, `kappa`, `c`, and a curvature-like input, then computes a boundary value.

## CLI example

```bash
langarian run examples/boundary_domain_scan.yaml --receipts-dir receipts
langarian validate receipts/boundary_domain_scan.json
langarian explain receipts/boundary_domain_scan.json
```

## Python example

```python
from langarian import scan_boundary_domain

scan = scan_boundary_domain([
    {"t": 0.0, "kappa": 1.0, "c": 0.1, "curvature": 0.5},
    {"t": 1.0, "kappa": 1.0, "c": 0.1, "curvature": 0.75},
])

print(scan.is_safe)
print(scan.min_boundary_value)
print(scan.receipt.status)
```

## Receipt interpretation

The receipt is tagged `MODEL`. That is intentional. This preserves the public boundary:

- computed scalar values are recorded;
- domain PASS/WARN/FAIL is recorded;
- the receipt can support a later workflow decision;
- the receipt cannot be used as formal proof of a larger theory.

## Next build directions

Good next phases after this patch:

1. Add a reduced-equation card registry for named expressions.
2. Add dimensional/unit notes for each symbol.
3. Add a finite sweep runner that can scan a grid of parameters.
4. Export scan receipts into a generic ledger packet shape.
5. Only after those are stable, consider symbolic proof-kernel experiments.
