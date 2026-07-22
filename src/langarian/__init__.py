"""Langarian Math Python reference kernel + Workbench foundations."""

from .state import ResonantState
from .metrics import normalized_complex_similarity, resonance, phase, system_coherence
from .operators import harmonic_sum, phase_shift, attenuated_phase_shift, phi_scale, bridge
from .epistemic import EpistemicTag, ResultStatus
from .spaces import FiniteComplexSpace
from .dynamics import UnitaryFlowDemo
from .proof_gate import ProofGateError, ProofGateReport, evaluate_claims, require_proof_eligible, promote_model_assumption
from .program import Program, ProgramStep, empty_program, PROGRAM_SCHEMA_VERSION

__all__ = [
    "ResonantState",
    "normalized_complex_similarity",
    "resonance",
    "phase",
    "system_coherence",
    "harmonic_sum",
    "phase_shift",
    "attenuated_phase_shift",
    "phi_scale",
    "bridge",
    "EpistemicTag",
    "ResultStatus",
    "FiniteComplexSpace",
    "UnitaryFlowDemo",
    "ProofGateError",
    "ProofGateReport",
    "evaluate_claims",
    "require_proof_eligible",
    "promote_model_assumption",
    "Program",
    "ProgramStep",
    "empty_program",
    "PROGRAM_SCHEMA_VERSION",
]
