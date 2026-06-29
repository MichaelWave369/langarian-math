"""Executable operators for the v0.2 finite-dimensional kernel."""

from __future__ import annotations

from dataclasses import dataclass
import math

import numpy as np

from .claims import Claim
from .contracts import (
    InvariantResult,
    accounted_change,
    coherence_bound,
    interpretation_quarantine,
    phase_equivariance,
    trace_preservation,
    well_typed_state,
)
from .epistemic import EpistemicTag
from .metrics import normalized_complex_similarity, system_coherence
from .receipts import OperationReceipt
from .state import ResonantState, pad_to_common_dim

PHI = (1.0 + math.sqrt(5.0)) / 2.0
GOLDEN_ANGLE = 2.0 * math.pi / PHI


@dataclass(frozen=True)
class OperationResult:
    """An operator output plus its receipt."""

    output: ResonantState
    receipt: OperationReceipt


@dataclass(frozen=True)
class BridgeResult:
    """A typed bridge/path result between two states."""

    source: ResonantState
    target: ResonantState
    coherence: float
    cost: float
    receipt: OperationReceipt


def _finalize_output(output: ResonantState, receipt: OperationReceipt) -> ResonantState:
    return output.with_history(receipt.receipt_id())


def harmonic_sum(a: ResonantState, b: ResonantState, *, glyph: str | None = None, label: str | None = None) -> OperationResult:
    """Combine two states by finite vector addition.

    This is intentionally simple for v0.2. More elaborate direct-sum or tensor
    operators belong in future lanes, not the first kernel.
    """

    av, bv = pad_to_common_dim(a, b)
    output = ResonantState(
        vector=av + bv,
        glyph=glyph or f"({a.glyph or '∅'}⊕{b.glyph or '∅'})",
        label=label or f"harmonic_sum({a.label or a.glyph},{b.label or b.glyph})",
        metadata={"operator": "harmonic_sum", "source_hashes": [a.state_hash(), b.state_hash()]},
    )
    before = normalized_complex_similarity(a, b)
    after = system_coherence([a, b, output])
    invariants = [
        well_typed_state(a),
        well_typed_state(b),
        well_typed_state(output),
        coherence_bound(before),
        coherence_bound(after),
        accounted_change(output.resonance - max(a.resonance, b.resonance), after - before, declared_cost="harmonic recomposition may reduce pairwise similarity"),
        trace_preservation([a.state_hash(), b.state_hash()], output.history),
        interpretation_quarantine([EpistemicTag.COMPUTED.value]),
    ]
    claims = [
        Claim("Harmonic sum computed by finite complex vector addition.", EpistemicTag.COMPUTED),
    ]
    receipt = OperationReceipt(
        operator="harmonic_sum",
        input_hashes=[a.state_hash(), b.state_hash()],
        output_hash=output.state_hash(),
        parameters={"glyph": output.glyph},
        coherence_before=before,
        coherence_after=after,
        invariant_results=invariants,
        epistemic_tag=EpistemicTag.COMPUTED,
        claims=claims,
    )
    return OperationResult(_finalize_output(output, receipt), receipt)


def phase_shift(state: ResonantState, angle_radians: float, *, label: str | None = None) -> OperationResult:
    """Pure global phase rotation. Resonance should be preserved."""

    scalar = np.exp(1j * float(angle_radians))
    output = ResonantState(
        vector=state.vector * scalar,
        glyph=state.glyph,
        label=label or f"phase_shift({state.label or state.glyph})",
        metadata={"operator": "phase_shift", "angle_radians": float(angle_radians), "source_hashes": [state.state_hash()]},
    )
    before = normalized_complex_similarity(state, state)
    after = normalized_complex_similarity(state, output)
    invariants: list[InvariantResult] = [
        well_typed_state(state),
        well_typed_state(output),
        coherence_bound(before),
        coherence_bound(after),
        phase_equivariance(state.resonance, output.resonance),
        trace_preservation([state.state_hash()], output.history),
        interpretation_quarantine([EpistemicTag.COMPUTED.value]),
    ]
    receipt = OperationReceipt(
        operator="phase_shift",
        input_hashes=[state.state_hash()],
        output_hash=output.state_hash(),
        parameters={"angle_radians": float(angle_radians)},
        coherence_before=before,
        coherence_after=after,
        invariant_results=invariants,
        epistemic_tag=EpistemicTag.COMPUTED,
        claims=[Claim("Pure phase shift preserves resonance under the v0.2 finite vector model.", EpistemicTag.COMPUTED)],
    )
    return OperationResult(_finalize_output(output, receipt), receipt)


def attenuated_phase_shift(
    state: ResonantState,
    angle_radians: float,
    attenuation: float,
    *,
    cost_label: str | None,
    label: str | None = None,
) -> OperationResult:
    """Phase rotation with explicit attenuation and cost accounting."""

    if attenuation < 0:
        raise ValueError("attenuation must be non-negative.")
    scalar = float(attenuation) * np.exp(1j * float(angle_radians))
    output = ResonantState(
        vector=state.vector * scalar,
        glyph=state.glyph,
        label=label or f"attenuated_phase_shift({state.label or state.glyph})",
        metadata={
            "operator": "attenuated_phase_shift",
            "angle_radians": float(angle_radians),
            "attenuation": float(attenuation),
            "declared_cost": cost_label,
            "source_hashes": [state.state_hash()],
        },
    )
    before = normalized_complex_similarity(state, state)
    after = normalized_complex_similarity(state, output)
    invariants = [
        well_typed_state(state),
        well_typed_state(output),
        coherence_bound(before),
        coherence_bound(after),
        accounted_change(output.resonance - state.resonance, after - before, declared_cost=cost_label),
        trace_preservation([state.state_hash()], output.history),
        interpretation_quarantine([EpistemicTag.COMPUTED.value]),
    ]
    receipt = OperationReceipt(
        operator="attenuated_phase_shift",
        input_hashes=[state.state_hash()],
        output_hash=output.state_hash(),
        parameters={"angle_radians": float(angle_radians), "attenuation": float(attenuation), "declared_cost": cost_label},
        coherence_before=before,
        coherence_after=after,
        invariant_results=invariants,
        epistemic_tag=EpistemicTag.COMPUTED,
        claims=[Claim("Attenuated phase shift computed with declared cost accounting.", EpistemicTag.COMPUTED)],
    )
    return OperationResult(_finalize_output(output, receipt), receipt)


def phi_scale(state: ResonantState, n: int = 1, *, label: str | None = None) -> OperationResult:
    """Scale resonance by Φ^n and advance phase by n golden angles."""

    scale = PHI ** int(n)
    angle = int(n) * GOLDEN_ANGLE
    output = ResonantState(
        vector=state.vector * scale * np.exp(1j * angle),
        glyph=state.glyph,
        label=label or f"phi_scale({state.label or state.glyph},{n})",
        metadata={"operator": "phi_scale", "n": int(n), "source_hashes": [state.state_hash()]},
    )
    before = normalized_complex_similarity(state, state)
    after = normalized_complex_similarity(state, output)
    invariants = [
        well_typed_state(state),
        well_typed_state(output),
        coherence_bound(before),
        coherence_bound(after),
        accounted_change(output.resonance - state.resonance, after - before),
        trace_preservation([state.state_hash()], output.history),
        interpretation_quarantine([EpistemicTag.COMPUTED.value]),
    ]
    receipt = OperationReceipt(
        operator="phi_scale",
        input_hashes=[state.state_hash()],
        output_hash=output.state_hash(),
        parameters={"n": int(n), "phi": PHI, "golden_angle_radians": GOLDEN_ANGLE},
        coherence_before=before,
        coherence_after=after,
        invariant_results=invariants,
        epistemic_tag=EpistemicTag.COMPUTED,
        claims=[Claim("Phi scaling applied as scalar dilation plus golden-angle phase advance.", EpistemicTag.COMPUTED)],
    )
    return OperationResult(_finalize_output(output, receipt), receipt)


def bridge(source: ResonantState, target: ResonantState, *, cost: float = 0.0, label: str | None = None) -> BridgeResult:
    """Create a typed bridge/path receipt from source to target.

    In v0.2 this does not claim category-theoretic naturality. It records a
    transition candidate with coherence, cost, and invariant status.
    """

    coh = normalized_complex_similarity(source, target)
    output_hash = target.state_hash()
    invariants = [
        well_typed_state(source),
        well_typed_state(target),
        coherence_bound(coh),
        trace_preservation([source.state_hash(), target.state_hash()], target.history),
        interpretation_quarantine([EpistemicTag.COMPUTED.value]),
    ]
    receipt = OperationReceipt(
        operator="bridge",
        input_hashes=[source.state_hash(), target.state_hash()],
        output_hash=output_hash,
        parameters={"cost": float(cost), "label": label},
        coherence_before=None,
        coherence_after=coh,
        invariant_results=invariants,
        epistemic_tag=EpistemicTag.COMPUTED,
        claims=[Claim("Bridge candidate recorded as a typed transition/path, not a category-theoretic proof.", EpistemicTag.COMPUTED)],
    )
    return BridgeResult(source=source, target=target, coherence=coh, cost=float(cost), receipt=receipt)
