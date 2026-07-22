"""Deterministic Program executor for the Langarian kernel.

Runs a Program step-by-step, calling the authoritative operators and
collecting full receipts and lineage. No side effects beyond the returned
Program state.
"""

from __future__ import annotations

from typing import Any

from .operators import (
    attenuated_phase_shift,
    bridge,
    harmonic_sum,
    phase_shift,
    phi_scale,
)
from .program import Program
from .state import ResonantState


class ExecutionError(Exception):
    pass


def execute_program(prog: Program) -> Program:
    """Execute all steps in order. Mutates and returns the same Program instance."""

    # Seed results with initial states
    env: dict[str, ResonantState] = dict(prog.initial_states)
    prog.results = dict(env)
    prog.receipts = []
    prog.warnings = []

    for step in prog.steps:
        try:
            if step.operator == "phase_shift":
                src = _resolve(env, step.input_refs[0])
                angle = float(step.parameters["angle_radians"])
                result = phase_shift(src, angle, label=step.label)
                env[step.step_id] = result.output
                prog.receipts.append(result.receipt)

            elif step.operator == "phi_scale":
                src = _resolve(env, step.input_refs[0])
                n = int(step.parameters.get("n", 1))
                result = phi_scale(src, n, label=step.label)
                env[step.step_id] = result.output
                prog.receipts.append(result.receipt)

            elif step.operator == "attenuated_phase_shift":
                src = _resolve(env, step.input_refs[0])
                angle = float(step.parameters["angle_radians"])
                atten = float(step.parameters["attenuation"])
                cost = step.parameters.get("cost_label")
                result = attenuated_phase_shift(
                    src, angle, atten, cost_label=cost, label=step.label
                )
                env[step.step_id] = result.output
                prog.receipts.append(result.receipt)
                if result.receipt.status.value == "FAIL":
                    prog.warnings.append(
                        f"Step {step.step_id}: attenuated_phase_shift produced FAIL (missing cost?)"
                    )

            elif step.operator == "harmonic_sum":
                a = _resolve(env, step.input_refs[0])
                b = _resolve(env, step.input_refs[1])
                result = harmonic_sum(a, b, label=step.label)
                env[step.step_id] = result.output
                prog.receipts.append(result.receipt)

            elif step.operator == "bridge":
                a = _resolve(env, step.input_refs[0])
                b = _resolve(env, step.input_refs[1])
                cost = float(step.parameters.get("cost", 0.0))
                result = bridge(a, b, cost=cost, label=step.label)
                # bridge does not create a new state; record the target for lineage
                env[step.step_id] = b
                prog.receipts.append(result.receipt)

            else:
                raise ExecutionError(f"Unsupported operator in executor: {step.operator}")

            prog.results[step.step_id] = env[step.step_id]

        except Exception as exc:
            raise ExecutionError(f"Step {step.step_id} ({step.operator}): {exc}") from exc

    return prog


def _resolve(env: dict[str, ResonantState], ref: str) -> ResonantState:
    if ref not in env:
        raise ExecutionError(f"Undefined reference {ref!r}")
    return env[ref]
