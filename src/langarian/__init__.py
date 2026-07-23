"""Langarian Math Python reference kernel."""

from .version import VERSION_MANIFEST, KERNEL_VERSION, METRIC_VERSION, RECEIPT_SCHEMA_VERSION, FIXTURE_VERSION
from .limits import LimitError, MetricError, MAX_DIM, MAX_STATES
from .state import ResonantState
from .metrics import normalized_complex_similarity, resonance, phase, system_coherence
from .operators import harmonic_sum, phase_shift, attenuated_phase_shift, phi_scale, bridge
from .epistemic import EpistemicTag, ResultStatus
from .spaces import FiniteComplexSpace
from .dynamics import UnitaryFlowDemo
from .proof_gate import ProofGateError, ProofGateReport, evaluate_claims, require_proof_eligible, promote_model_assumption

__all__ = [
    "VERSION_MANIFEST",
    "KERNEL_VERSION",
    "METRIC_VERSION",
    "RECEIPT_SCHEMA_VERSION",
    "FIXTURE_VERSION",
    "LimitError",
    "MetricError",
    "MAX_DIM",
    "MAX_STATES",
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
]
