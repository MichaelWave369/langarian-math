/** SPEC section 5 golden DSL example shared by DSL/executor/ledger tests. */
export const GOLDEN_PROGRAM = `A = state([[3,0],[6,0],[9,0]], label="A")
B = phase_shift(A, pi/3)
C = phi_scale(B, 2)
D = attenuated_phase_shift(C, pi/9, 0.75, cost="declared attenuation")
bridge(A, D, cost=0)
`

export const FIXED_TIMESTAMP = '1970-01-01T00:00:00+00:00'
