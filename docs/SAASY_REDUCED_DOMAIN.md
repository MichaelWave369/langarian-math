# SaaSy Reduced-Domain Helper

This document describes the first claim-safe SaaSy-facing helper in Langarian Math.

It is a finite sample scanner for the reduced bracket-wall expression:

```text
B(t) = 1 - 6*kappa^2*c^2*V_gamma_gamma(t)
```

A PASS receipt means only this:

> The supplied finite samples satisfy the selected bracket-wall inequality.

It does **not** prove SaaSy cosmology, solve the dynamics, infer a potential, or promote a physics claim.

## Why this exists

SaaSy math work needs quick executable gates without losing claim custody. The reduced Hamiltonian lane carries the bracket-wall condition as a safety/domain check. Langarian can now turn that check into a repeatable receipt before later symbolic or numerical work depends on it.

## Symbols under custody

The helper records the reduced-symbol custody set:

```text
a, P, theta, p_theta, N, gamma, C_red, B(t)
```

The scanner does not introduce a new degree of freedom. It only accepts finite scalar samples for `t`, `kappa`, `c`, and `v_gamma_gamma`, then computes `B(t)`.

## CLI example

```bash
langarian run examples/saasy_bracket_wall.yaml --receipts-dir receipts
langarian validate receipts/saasy_bracket_wall_scan.json
langarian explain receipts/saasy_bracket_wall_scan.json
```

## Python example

```python
from langarian import scan_bracket_wall

scan = scan_bracket_wall([
    {"t": 0.0, "kappa": 1.0, "c": 0.1, "v_gamma_gamma": 0.5},
    {"t": 1.0, "kappa": 1.0, "c": 0.1, "v_gamma_gamma": 0.75},
])

print(scan.is_safe)
print(scan.min_bracket_value)
print(scan.receipt.status)
```

## Receipt interpretation

The receipt is tagged `MODEL`. That is intentional. This preserves the public boundary:

- computed scalar values are recorded;
- domain PASS/WARN/FAIL is recorded;
- the receipt can support a later workflow decision;
- the receipt cannot be used as a formal proof of the full theory.

## Next build directions

Good next phases after this patch:

1. Add a reduced-equation card registry for `C_red`, `gamma`, and `B(t)`.
2. Add dimensional/unit notes for each SaaSy symbol.
3. Add a finite sweep runner that can scan a grid of model parameters.
4. Export SaaSy scan receipts into a Parallax Ledger packet shape.
5. Only after those are stable, consider symbolic proof-kernel experiments.
