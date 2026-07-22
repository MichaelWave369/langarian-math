"""Tests for the safe DSL parser and Program executor."""

from __future__ import annotations

import math

import pytest

from langarian.dsl import DSLError, parse_dsl
from langarian.executor import execute_program, ExecutionError
from langarian import ResultStatus


def test_simple_phase_program():
    text = """
state A = [1+0i, 0+1i] label "seed"
B = phase_shift(A, 1.5707963267948966)
"""
    prog = parse_dsl(text, program_id="test_phase")
    assert "A" in prog.initial_states
    assert len(prog.steps) == 1
    assert prog.steps[0].operator == "phase_shift"

    executed = execute_program(prog)
    assert executed.final_state is not None
    assert abs(executed.final_state.resonance - prog.initial_states["A"].resonance) < 1e-9
    assert len(executed.receipts) == 1
    assert executed.receipts[0].status == ResultStatus.PASS


def test_multi_step_with_attenuation():
    text = """
state S = [3+0i, 6+0i]
P = phase_shift(S, 0.5)
A = attenuated_phase_shift(P, 0.3, 0.8, "test cost")
"""
    prog = parse_dsl(text)
    executed = execute_program(prog)
    assert len(executed.receipts) == 2
    assert executed.receipts[1].status == ResultStatus.PASS


def test_undefined_reference_fails():
    text = "B = phase_shift(A, 1.0)"
    with pytest.raises(DSLError):
        parse_dsl(text)


def test_unknown_operator_fails():
    text = """
state A = [1+0i]
B = magic_op(A)
"""
    with pytest.raises(DSLError):
        parse_dsl(text)


def test_resource_limit_dimension():
    # 300 components > 256 limit
    comps = ", ".join(["1+0i"] * 300)
    text = f"state A = [{comps}]"
    with pytest.raises(DSLError):
        parse_dsl(text)


def test_harmonic_and_bridge():
    text = """
state X = [3+0i]
state Y = [6+0i]
Z = harmonic_sum(X, Y)
bridge(X, Z)
"""
    prog = parse_dsl(text)
    executed = execute_program(prog)
    assert len(executed.receipts) == 2
    assert executed.receipts[0].operator == "harmonic_sum"
    assert executed.receipts[1].operator == "bridge"
