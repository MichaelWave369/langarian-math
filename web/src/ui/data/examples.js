/**
 * Reproducible example library for Langarian Math Workbench v0.3.
 *
 * Every example is deterministic DSL text (or a scripted action) and carries
 * an epistemic classification: mathematical / computational / model /
 * interpretive / metaphorical. Metaphorical readings are quarantined —
 * shown in dashed panels, never routed into the Proof Gate.
 */

export const GOLDEN_PROGRAM = `A = state([[3,0],[6,0],[9,0]], label="A")
B = phase_shift(A, pi/3)
C = phi_scale(B, 2)
D = attenuated_phase_shift(C, pi/9, 0.75, cost="declared attenuation")
bridge(A, D, cost=0)
`

export const EXAMPLES = [
  {
    id: 'basic-369',
    title: 'Basic 3-6-9',
    classification: 'mathematical',
    summary: 'Construct the vector [[3,0],[6,0],[9,0]]: resonance 3·√14, phase 0, well-typed (I1 PASS).',
    boundary: 'The computation is exact arithmetic on a finite vector. Any numerological reading of "3-6-9" is metaphor, not a claim of this kernel.',
    metaphorNote: '“3-6-9” appears in popular mysticism. That reading is metaphorical and quarantined: the kernel only computes with the numbers 3, 6, 9 as real components.',
    source: `A = state([[3,0],[6,0],[9,0]], label="A", glyph="369")
B = harmonic_sum(A, A)
`,
  },
  {
    id: 'phase-invariance',
    title: 'Pure phase invariance',
    classification: 'mathematical',
    summary: 'phase_shift by π/3 rotates every component; resonance is preserved within 1e-9 (I5 PASS), similarity to the original stays in [0,1].',
    boundary: 'Per-instance invariance check under the v0.2 finite vector model — not a group-theoretic equivariance proof.',
    source: `A = state([[3,0],[6,0],[9,0]], label="A")
B = phase_shift(A, pi/3)
`,
  },
  {
    id: 'attenuation-declared-cost',
    title: 'Attenuation with declared cost',
    classification: 'computational',
    summary: 'attenuated_phase_shift with α=0.75 and a declared cost: resonance decreases, I3 passes because a cost label is present.',
    boundary: 'I3 is a label-presence gate only: the adequacy, magnitude, or kind of the declared cost is not verified.',
    source: `A = state([[3,0],[6,0],[9,0]], label="A")
D = attenuated_phase_shift(A, pi/9, 0.75, cost="declared attenuation")
`,
  },
  {
    id: 'attenuation-no-cost-fails',
    title: 'Attenuation without cost (fails)',
    classification: 'computational',
    summary: 'Same attenuation without a cost label: the kernel emits a FAIL receipt (I3 accounted_change FAIL) instead of silently succeeding.',
    boundary: 'This is the honest failure path: a decrease without declared cost is recorded as FAIL, never hidden.',
    source: `A = state([[3,0],[6,0],[9,0]], label="A")
D = attenuated_phase_shift(A, pi/9, 0.75)
`,
  },
  {
    id: 'phi-scaling',
    title: 'Phi scaling',
    classification: 'mathematical',
    summary: 'phi_scale(A, 2): resonance multiplies by Φ² and phase advances by 2 golden angles (2 × 2π/Φ).',
    boundary: 'The operator is a scalar dilation plus a golden-angle phase advance — finite arithmetic, nothing more.',
    metaphorNote: 'Claims that the golden ratio encodes universal harmony or natural growth patterns are metaphorical and quarantined from this result.',
    source: `A = state([[3,0],[6,0],[9,0]], label="A")
C = phi_scale(A, 2)
`,
  },
  {
    id: 'identical-bridge',
    title: 'Identical-state bridge',
    classification: 'computational',
    summary: 'bridge(A, A) records a transition candidate with coherence C(A,A) = 1.',
    boundary: 'A bridge receipt is a typed transition/path record, not a category-theoretic naturality proof. The cost field is caller-declared and unverified.',
    source: `A = state([[3,0],[6,0],[9,0]], label="A")
bridge(A, A, cost=0)
`,
  },
  {
    id: 'orthogonal-comparison',
    title: 'Orthogonal comparison',
    classification: 'mathematical',
    summary: 'bridge between orthogonal basis states: coherence C(x,y) = 0 exactly.',
    boundary: 'C is the squared normalized inner product |⟨x,y⟩|² / (‖x‖²‖y‖²) in [0,1].',
    source: `X = state([[1,0],[0,0]], label="X")
Y = state([[0,0],[1,0]], label="Y")
bridge(X, Y, cost=0)
`,
  },
  {
    id: 'dimension-mismatch',
    title: 'Dimension mismatch',
    classification: 'computational',
    summary: 'harmonic_sum of a dim-3 and a dim-2 state: the shorter vector is zero-padded to the common dimension before addition.',
    boundary: 'Padding is an explicit documented convention, not an error — the receipt records both input hashes.',
    source: `A = state([[3,0],[6,0],[9,0]], label="A")
B = state([[1,1],[2,2]], label="B")
C = harmonic_sum(A, B)
`,
  },
  {
    id: 'zero-vector-edge',
    title: 'Zero-vector edge',
    classification: 'mathematical',
    summary: 'The zero state: resonance 0, phase defined as 0 by convention; similarity C(0,0)=1 and C(0,x)=0.',
    boundary: 'Zero conventions are part of metric:v0.3 and are checked before any scale-safe normalization runs.',
    source: `Z = state([[0,0],[0,0]], label="Z")
bridge(Z, Z, cost=0)
`,
  },
  {
    id: 'receipt-tampering',
    title: 'Receipt tampering detection',
    classification: 'computational',
    summary: 'Runs a program, then imports an altered copy of one of its receipts: the hash level fails and the import lands in quarantine.',
    boundary: 'Altered data is never silently trusted: hash/status/version levels are recomputed on import and failures are quarantined with explicit reasons.',
    action: 'tamper',
    source: `A = state([[3,0],[6,0],[9,0]], label="A")
B = phase_shift(A, pi/3)
`,
  },
  {
    id: 'proof-gate-rejection',
    title: 'Proof Gate rejection',
    classification: 'model',
    summary: 'Imports an honestly-hashed receipt carrying an INTERPRETIVE claim and a claim promoted from MODEL without a formal derivation id: the Proof Gate blocks both.',
    boundary: 'Promoted MODEL claims without formal_derivation_id are rejected even when relabeled; interpretive claims have no path into the gate.',
    action: 'gate',
    source: `A = state([[3,0],[6,0],[9,0]], label="A")
B = phase_shift(A, pi/3)
`,
  },
  {
    id: 'multi-step-chain',
    title: 'Multi-step chain (SPEC golden program)',
    classification: 'computational',
    summary: 'The SPEC §5 golden program: state → phase_shift → phi_scale → attenuated_phase_shift → bridge, with per-step receipts and lineage.',
    boundary: 'Every step emits a receipt; lineage is traceable through input hashes across the ledger.',
    source: GOLDEN_PROGRAM,
  },
]
