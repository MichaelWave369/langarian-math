# Security Threat Model — Langarian Math Workbench v0.3

**Status:** Foundation (2026-07-22)  
**Scope:** Local-first calculator + static web workbench + receipt import/export

## Assets
- Mathematical integrity of results and receipts
- Determinism and reproducibility of hashes
- User machine resources (memory, CPU)
- Integrity of the formal vs interpretive boundary

## Adversaries / Threats Considered

1. **Malicious or malformed DSL / program text**
   - Goal: code execution, infinite loops, memory exhaustion, crash
   - Mitigations: parser-only (no eval/exec), fixed operator registry, hard limits on dimension (256), steps (128), text size (64 KiB), clear rejection

2. **Malicious imported receipts**
   - Goal: hash confusion, schema downgrade, prototype pollution (JS), XSS via labels/glyphs/metadata, false “verified” status
   - Mitigations: treat all imported data as untrusted; validate structure first; never execute content; expose five distinct verification layers; sanitize labels for display; no innerHTML of raw user strings without escaping

3. **Resource exhaustion**
   - Goal: DoS via huge vectors or deeply nested (future) programs
   - Mitigations: explicit bounds enforced before execution; progressive UI warnings

4. **Silent claim escalation**
   - Goal: make a COMPUTED or MODEL result appear formal/theorem-like in the UI
   - Mitigations: Proof Gate panel, visual quarantine of interpretive content, Claim Boundary Matrix, never collapse verification layers

5. **Floating-point / hash divergence across implementations**
   - Goal: different results between Python kernel and browser port that go unnoticed
   - Mitigations: canonical serialization policy, conformance fixtures, explicit tolerances, WARN on divergence

6. **Dependency / supply-chain**
   - Mitigations: pin or constrain versions; minimal dependency surface (NumPy + PyYAML on Python side; React + Vite on web); no unnecessary packages

7. **Browser XSS / prototype pollution**
   - Especially through glyph, label, cost strings, notes, example metadata
   - Mitigations: React text content (not dangerouslySetInnerHTML); schema validation; Content-Security-Policy on the static site where feasible

## Explicit Non-Goals (for v0.3)
- Multi-user server-side execution
- Cryptographic signing of receipts (future candidate)
- Sandboxing of untrusted Python (kernel is trusted reference code)

## Residual Risks
- A determined user can still construct a program that consumes significant memory within the declared limits.
- Visualization libraries (when added) introduce their own attack surface; they will be reviewed before inclusion.
- The optional Pyodide path (if enabled) carries the full Python interpreter surface; it remains behind an experimental toggle.

## Review Cadence
Threat model is updated whenever a new input surface (DSL feature, import format, visualization data path) is added.

---
*Security is part of the ledger.*
