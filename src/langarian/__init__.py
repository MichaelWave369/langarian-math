"""Langarian Math Python reference kernel."""

from .state import ResonantState
from .metrics import normalized_complex_similarity, resonance, phase, system_coherence
from .operators import harmonic_sum, phase_shift, attenuated_phase_shift, phi_scale, bridge
from .epistemic import EpistemicTag, ResultStatus
from .spaces import FiniteComplexSpace
from .dynamics import UnitaryFlowDemo
from .proof_gate import ProofGateError, ProofGateReport, evaluate_claims, require_proof_eligible, promote_model_assumption
from .saasy import BracketSample, BracketWallScan, bracket_wall_value, scan_bracket_wall

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
    "BracketSample",
    "BracketWallScan",
    "bracket_wall_value",
    "scan_bracket_wall",
]
