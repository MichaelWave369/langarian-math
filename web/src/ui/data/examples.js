/**
 * Reproducible example library for Langarian Math Workbench v0.3.
 *
 * Every example is deterministic DSL text (or a scripted action) and carries
 * an epistemic classification: mathematical / computational / model /
 * interpretive / metaphorical. Metaphorical readings are quarantined —
 * shown in dashed panels, never routed into the Formal Eligibility Gate.
 *
 * Foundation rule: demonstration fixtures are not theoretical evidence. The
 * default program therefore uses an ordinary complex vector rather than a
 * branded number sequence. Historical 3-6-9 and Phi examples remain visible
 * only as explicitly non-foundational compatibility demonstrations.
 */

export const GOLDEN_PROGRAM = `A = state([[1,1],[3,-2],[0,-4]], label="A")
B = phase_shift(A, pi/7)
C = harmonic_sum(B, B)
D = attenuated_phase_shift(C, pi/11, 0.75, cost="declared edge-local attenuation")
bridge(A, D, cost=0, label="comparison edge only")
`

export const EXAMPLES = [
  {
    id: 'basic-369',
    title: 'Historical 3-6-9 fixture (non-foundational)',
    classification: 'interpretive',
    summary: 'Constructs the historical [[3,0],[6,0],[9,0]] demonstration fixture and performs ordinary finite-vector addition.',
    boundary: 'The numbers are an illustrative project-history fixture only. No property of this run is evidence that 3-6-9 is mathematically privileged.',
    metaphorNote: 'Popular numerological readings are quarantined. The kernel treats 3, 6, and 9 only as ordinary real components.',
    source: `A = state([[3,0],[6,0],[9,0]], label="historical_fixture_369", glyph="369")
B = harmonic_sum(A, A)
`,
  },
  {
    id: 'phase-invariance',
    title: 'Pure phase invariance',
    classification: 'mathematical',
    summary: 'phase_shift rotates an arbitrary complex vector; resonance is preserved within the implementation tolerance and projective similarity remains bounded.',
    boundary: 'The general norm-preservation theorem comes from complex linear algebra. This run is a software conformance test, not the proof.',
    source: `A = state([[1,1],[3,-2],[0,-4]], label="A")
B = phase_shift(A, pi/7)
`,
  },
  {
    id: 'attenuation-declared-cost',
    title: 'Attenuation with declared cost',
    classification: 'computational',
    summary: 'attenuated_phase_shift with alpha=0.75 and a declared annotation: resonance decreases and I3 passes because a cost label is present.',
    boundary: 'I3 is a label-presence gate only. The adequacy, magnitude, and kind of the declared cost are not verified.',
    source: `A = state([[2,0],[-5,0],[7,0]], label="A")
D = attenuated_phase_shift(A, pi/11, 0.75, cost="declared attenuation")
`,
  },
  {
    id: 'attenuation-no-cost-fails',
    title: 'Attenuation without cost (fails)',
    classification: 'computational',
    summary: 'The same attenuation without a cost label emits a FAIL receipt through I3 instead of silently succeeding.',
    boundary: 'This is an honest failure path: an unaccounted decrease remains visible.',
    source: `A = state([[2,0],[-5,0],[7,0]], label="A")
D = attenuated_phase_shift(A, pi/11, 0.75)
`,
  },
  {
    id: 'phi-scaling',
    title: 'Phi extension (non-foundational)',
    classification: 'computational',
    summary: 'phi_scale(A, 2) applies the implemented Phi-power dilation and reflex golden-angle phase convention to an ordinary input vector.',
    boundary: 'This is an optional named symbolic extension. The golden ratio is not a privileged law of the native foundation.',
    metaphorNote: 'Shell, growth, universal-harmony, and sacred-geometry interpretations are not supported by this computation.',
    source: `A = state([[1,0],[2,0],[4,0]], label="A")
C = phi_scale(A, 2)
`,
  },
  {
    id: 'identical-bridge',
    title: 'Identical-state bridge',
    classification: 'computational',
    summary: 'bridge(A, A) records a comparison/transition candidate with coherence C(A,A) = 1.',
    boundary: 'The cost field is a caller-declared edge annotation only. It is not an inferred path cost or proof of equivalence.',
    source: `A = state([[1,1],[3,-2],[0,-4]], label="A")
bridge(A, A, cost=0, label="zero new edge cost")
`,
  },
  {
    id: 'orthogonal-comparison',
    title: 'Orthogonal comparison',
    classification: 'mathematical',
    summary: 'bridge between orthogonal basis states records coherence C(x,y) = 0 exactly.',
    boundary: 'C is the squared normalized inner product in [0,1]. The bridge records the comparison; it does not create a category-theoretic morphism.',
    source: `X = state([[1,0],[0,0]], label="X")
Y = state([[0,0],[1,0]], label="Y")
bridge(X, Y, cost=0, label="comparison edge only")
`,
  },
  {
    id: 'dimension-mismatch',
    title: 'Dimension mismatch',
    classification: 'computational',
    summary: 'harmonic_sum of a dim-3 and dim-2 state zero-pads the shorter vector to the common dimension before addition.',
    boundary: 'Padding is an explicit embedding convention rather than a theorem forced by the objects.',
    source: `A = state([[2,0],[-5,0],[7,0]], label="A")
B = state([[1,1],[2,2]], label="B")
C = harmonic_sum(A, B)
`,
  },
  {
    id: 'zero-vector-edge',
    title: 'Zero-vector edge',
    classification: 'mathematical',
    summary: 'The zero state has resonance 0 and phase 0 by convention; the implementation defines C(0,0)=1 and C(0,x)=0.',
    boundary: 'Normalized projective similarity is mathematically undefined at zero. These totalized zero values are documented software conventions.',
    source: `Z = state([[0,0],[0,0]], label="Z")
bridge(Z, Z, cost=0, label="zero-vector convention check")
`,
  },
  {
    id: 'receipt-tampering',
    title: 'Receipt tampering detection',
    classification: 'computational',
    summary: 'Runs a neutral-input program, then imports an altered receipt: the hash level fails and the import is quarantined.',
    boundary: 'Altered data is never silently trusted. Integrity validation does not independently recompute the underlying mathematics.',
    action: 'tamper',
    source: `A = state([[1,1],[3,-2],[0,-4]], label="A")
B = phase_shift(A, pi/7)
`,
  },
  {
    id: 'proof-gate-rejection',
    title: 'Formal Eligibility Gate rejection',
    classification: 'model',
    summary: 'Imports an honestly hashed receipt carrying an INTERPRETIVE claim and a MODEL-derived promotion without a formal derivation id; the gate blocks both.',
    boundary: 'A valid receipt hash does not make an interpretive or model-derived claim formally eligible.',
    action: 'gate',
    source: `A = state([[1,1],[3,-2],[0,-4]], label="A")
B = phase_shift(A, pi/7)
`,
  },
  {
    id: 'multi-step-chain',
    title: 'Input-general multi-step chain',
    classification: 'computational',
    summary: 'Neutral complex state → phase shift → vector addition → attenuated phase shift → bridge, with per-operation receipts.',
    boundary: 'The final zero-cost bridge means zero new declared edge cost only. It does not erase the transformation history or imply zero path cost.',
    source: GOLDEN_PROGRAM,
  },
]
