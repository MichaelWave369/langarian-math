# Architecture Decision Record: Browser Kernel Strategy

**ADR ID:** WEB-KERNEL-001  
**Date:** 2026-07-22  
**Status:** Proposed (decision pending final evidence)  
**Context:** Langarian Math Workbench v0.3 must remain local-first, GitHub-Pages compatible, and keep the Python reference kernel as the single mathematical authority.

## Options Evaluated

### Option A — Python in Browser (Pyodide / similar)
- **Pros:** Single source of truth; exact same code path; NumPy available; offline-capable once loaded.
- **Cons:** Large download (~several MB + packages); slower cold start; limited package surface; potential floating-point / environment differences still need fixtures; browser compatibility surface.
- **Fit for GitHub Pages:** Possible (static assets), but load-time experience is the main risk.

### Option B — TypeScript Conformance Port
- **Pros:** Lightweight, fast start, excellent browser ergonomics, easy to ship on GitHub Pages, deterministic control over floating-point policy.
- **Cons:** Requires disciplined cross-language fixtures; risk of silent divergence if not continuously tested; second implementation must never become authority.
- **Mitigation:** Python-generated canonical fixtures + automated conformance tests + explicit tolerance + version matching + warnings on divergence.

### Option C — Service Architecture (API)
- **Pros:** Always uses authoritative Python.
- **Cons:** Violates local-first maxim; hosting cost, availability, privacy, offline, and reproducibility concerns. Rejected for v0.3 core experience.

## Decision Criteria (ordered)
1. Mathematical authority remains Python unless documented otherwise.
2. Local-first / offline capability after first load.
3. GitHub Pages static hosting compatibility.
4. Deterministic receipts and hashes under documented numerical policy.
5. Reasonable cold-start and size for an instrument-grade tool.
6. Ability to run the same conformance fixtures in CI.

## Current Recommendation (provisional)
**Hybrid governed by Option B primary + optional Pyodide secondary.**

- Implement a bounded TypeScript mirror of the *approved stable operators and metrics only*.
- Generate canonical fixtures from the Python kernel.
- Run cross-language conformance tests on every PR.
- Ship the TS implementation in the static web app for the interactive workbench.
- Keep a “Run against Python kernel (Pyodide)” advanced mode behind an experimental toggle for verification and research users.
- Any divergence surfaces a clear WARN and never upgrades claim status.

This preserves local-first, keeps load size small, and makes the authority relationship explicit and testable.

## Consequences
- Requires investment in fixture generation and numerical policy documentation.
- Requires explicit version and tolerance fields in every receipt produced by the browser layer.
- Experimental operators stay Python-only until promoted.

## Open Questions for Final Decision
- Exact floating-point tolerance policy (see NUMERICAL_POLICY.md).
- Whether Pyodide secondary path is required for v0.3 or deferred.
- Size budget for the workbench bundle.

**Next step:** Flesh numerical policy + generate first fixture set before locking the ADR to Accepted.

---
*Ledger above ego. Evidence before convenience.*
