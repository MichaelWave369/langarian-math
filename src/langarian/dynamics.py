"""Experimental finite dynamics demos for Langarian Math.

This module is deliberately named as a demo/research lane. It does not certify
Hamiltonian mechanics, physics, or symplectic theorems. It only demonstrates
that multiplying a finite complex vector by a unit complex scalar preserves the
vector norm under the v0.2.1 kernel model.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .state import ResonantState


@dataclass(frozen=True)
class UnitaryFlowStep:
    """One norm-preserving global rotation step."""

    index: int
    angle_radians: float
    state: ResonantState


class UnitaryFlowDemo:
    """A tiny exact global U(1) rotation demo.

    For a state vector x, each step computes ``x' = exp(i * theta) * x``. This
    should preserve resonance because it is scalar multiplication by unit
    magnitude. The result is useful as an invariant test and a future dynamics
    seed, but it is not promoted to a full symplectic dynamics theorem.
    """

    def evolve(self, state: ResonantState, *, angle_per_step: float, steps: int) -> list[UnitaryFlowStep]:
        if steps < 0:
            raise ValueError("steps must be non-negative.")
        trajectory = [UnitaryFlowStep(0, 0.0, state)]
        current = state
        for index in range(1, steps + 1):
            angle = float(angle_per_step)
            vector = current.vector * np.exp(1j * angle)
            current = ResonantState(
                vector=vector,
                glyph=current.glyph,
                label=current.label,
                metadata={**current.metadata, "unitary_flow_demo_step": index, "angle_per_step": angle},
                history=current.history,
            )
            trajectory.append(UnitaryFlowStep(index, index * angle, current))
        return trajectory

    @staticmethod
    def preserves_resonance(trajectory: list[UnitaryFlowStep], *, tolerance: float = 1e-10) -> bool:
        if not trajectory:
            raise ValueError("trajectory must contain at least one step.")
        base = trajectory[0].state.resonance
        return all(abs(step.state.resonance - base) <= tolerance for step in trajectory)
