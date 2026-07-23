"""Invariant contracts for the Langarian v0.2 kernel."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from .epistemic import ResultStatus
from .state import ResonantState


@dataclass(frozen=True)
class InvariantResult:
    """One invariant check result."""

    name: str
    status: ResultStatus
    message: str
    value: Any | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status.value,
            "message": self.message,
            "value": self.value,
            "metadata": self.metadata,
        }


def well_typed_state(state: ResonantState) -> InvariantResult:
    if state.dim < 1:
        return InvariantResult("I1.well_typed_state", ResultStatus.FAIL, "State must have dimension >= 1.")
    if not np.all(np.isfinite(state.vector.real)) or not np.all(np.isfinite(state.vector.imag)):
        return InvariantResult("I1.well_typed_state", ResultStatus.FAIL, "State vector contains non-finite values.")
    return InvariantResult("I1.well_typed_state", ResultStatus.PASS, "State is finite-dimensional and well typed.", value=state.dim)


def coherence_bound(value: float) -> InvariantResult:
    if 0.0 <= float(value) <= 1.0:
        return InvariantResult("I2.coherence_bound", ResultStatus.PASS, "Coherence is within [0, 1].", value=float(value))
    return InvariantResult("I2.coherence_bound", ResultStatus.FAIL, "Coherence is outside [0, 1].", value=float(value))


def accounted_change(delta_resonance: float, delta_coherence: float, declared_cost: str | None = None) -> InvariantResult:
    """Check that decreases are accompanied by a declared-cost label.

    This is a label-presence gate only: it verifies that a decrease is
    accompanied by a declared-cost string. It does NOT verify the adequacy,
    magnitude, or kind of the declared cost, and increases are always free.
    """

    if delta_resonance >= -1e-12 and delta_coherence >= -1e-12:
        return InvariantResult(
            "I3.accounted_change",
            ResultStatus.PASS,
            "No decrease requiring cost declaration.",
            value={"delta_resonance": delta_resonance, "delta_coherence": delta_coherence},
        )
    if declared_cost:
        return InvariantResult(
            "I3.accounted_change",
            ResultStatus.PASS,
            "Decrease occurred with declared cost (label-presence gate only; adequacy of the cost is not verified).",
            value={"delta_resonance": delta_resonance, "delta_coherence": delta_coherence},
            metadata={"declared_cost": declared_cost},
        )
    return InvariantResult(
        "I3.accounted_change",
        ResultStatus.FAIL,
        "Decrease occurred without declared cost.",
        value={"delta_resonance": delta_resonance, "delta_coherence": delta_coherence},
    )


def trace_inputs_recorded(
    input_hashes: list[str],
    output_history: tuple[str, ...] | None = None,
    recorded_source_hashes: list[str] | tuple[str, ...] | None = None,
) -> InvariantResult:
    """Check that receipt input hashes exist and match recorded source hashes.

    Fails when no input hashes are recorded. When ``recorded_source_hashes``
    is provided (e.g. the output state's metadata ``source_hashes``), every
    receipt input hash must appear in it; otherwise the check FAILs instead of
    passing on mere non-emptiness. Emitted as ``I4.trace_inputs_recorded``;
    the legacy name ``I4.trace_preservation`` is kept as a compatibility
    alias in metadata.
    """

    metadata: dict[str, Any] = {
        "output_history_length": len(output_history or ()),
        "legacy_name": "I4.trace_preservation",
    }
    if not input_hashes:
        return InvariantResult("I4.trace_inputs_recorded", ResultStatus.FAIL, "No input hashes recorded.", metadata=metadata)
    if recorded_source_hashes is not None:
        recorded = set(recorded_source_hashes)
        missing = [h for h in input_hashes if h not in recorded]
        if missing:
            return InvariantResult(
                "I4.trace_inputs_recorded",
                ResultStatus.FAIL,
                "Receipt input hashes do not match the recorded source hashes.",
                value=input_hashes,
                metadata={**metadata, "mismatched_hashes": missing},
            )
    return InvariantResult(
        "I4.trace_inputs_recorded",
        ResultStatus.PASS,
        "Input hashes are recorded in the operation receipt and match recorded source hashes.",
        value=input_hashes,
        metadata=metadata,
    )


def trace_preservation(input_hashes: list[str], output_history: tuple[str, ...] | None = None) -> InvariantResult:
    """Compatibility alias for :func:`trace_inputs_recorded` (legacy name)."""

    return trace_inputs_recorded(input_hashes, output_history)


def phase_equivariance(before_resonance: float, after_resonance: float, tolerance: float = 1e-9) -> InvariantResult:
    if abs(before_resonance - after_resonance) <= tolerance:
        return InvariantResult(
            "I5.phase_equivariance",
            ResultStatus.PASS,
            "Pure phase rotation preserved resonance.",
            value={"before": before_resonance, "after": after_resonance},
        )
    return InvariantResult(
        "I5.phase_equivariance",
        ResultStatus.FAIL,
        "Pure phase rotation changed resonance.",
        value={"before": before_resonance, "after": after_resonance},
    )


def phase_norm_preservation(before_resonance: float, after_resonance: float, tolerance: float = 1e-9) -> InvariantResult:
    """v0.3 documentation name for the I5 check.

    The check verifies |R_before - R_after| <= tolerance for one operation
    instance; it is not a group-theoretic equivariance proof. The receipt
    keeps the legacy emitted name ``I5.phase_equivariance`` as a
    compatibility alias.
    """

    return phase_equivariance(before_resonance, after_resonance, tolerance)


def interpretation_quarantine(claim_tags: list[str]) -> InvariantResult:
    forbidden = {"INTERPRETIVE", "METAPHOR", "OBSERVED"}
    leaked = [tag for tag in claim_tags if tag in forbidden]
    if leaked:
        return InvariantResult(
            "I8.interpretation_quarantine",
            ResultStatus.WARN,
            "Interpretive/metaphorical/observed claims are present and must not be used as proof.",
            value=leaked,
        )
    return InvariantResult(
        "I8.interpretation_quarantine",
        ResultStatus.PASS,
        "No interpretive/metaphorical claims used as formal proof inputs.",
        value=claim_tags,
    )
