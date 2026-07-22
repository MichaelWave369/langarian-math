"""Property-based tests for the Langarian finite kernel.

These tests encode the numerical and algebraic contracts that must hold
for the reference implementation. They do not invent new mathematics;
they check that the existing definitions behave as documented.
"""

from __future__ import annotations

import math

import numpy as np
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from langarian import (
    ResonantState,
    normalized_complex_similarity,
    phase_shift,
    phi_scale,
    harmonic_sum,
)
from langarian.state import KERNEL_VERSION


def complex_vector(dim: int, scale: float = 10.0):
    """Strategy helper: finite complex vectors of fixed dimension."""
    return st.lists(
        st.tuples(
            st.floats(min_value=-scale, max_value=scale, allow_nan=False, allow_infinity=False),
            st.floats(min_value=-scale, max_value=scale, allow_nan=False, allow_infinity=False),
        ),
        min_size=dim,
        max_size=dim,
    ).map(lambda pairs: np.array([complex(r, i) for r, i in pairs], dtype=np.complex128))


@settings(max_examples=80, deadline=None)
@given(vec=complex_vector(3), angle=st.floats(min_value=-4 * math.pi, max_value=4 * math.pi, allow_nan=False, allow_infinity=False))
def test_pure_phase_shift_preserves_resonance(vec, angle):
    state = ResonantState(vec)
    result = phase_shift(state, angle)
    assert abs(result.output.resonance - state.resonance) < 1e-9
    assert result.receipt.status.value in {"PASS", "WARN"}


@settings(max_examples=60, deadline=None)
@given(vec=complex_vector(4))
def test_similarity_self_is_one_for_nonzero(vec):
    state = ResonantState(vec)
    if state.resonance == 0.0:
        assert normalized_complex_similarity(state, state) == 1.0
    else:
        assert abs(normalized_complex_similarity(state, state) - 1.0) < 1e-12


@settings(max_examples=40, deadline=None)
@given(vec=complex_vector(2), n=st.integers(min_value=-3, max_value=5))
def test_phi_scale_projective_similarity(vec, n):
    state = ResonantState(vec)
    assume(state.resonance > 1e-12)  # avoid pure zero
    result = phi_scale(state, n)
    # Projective: direction (up to global phase) should be preserved after scale+phase
    sim = normalized_complex_similarity(state, result.output)
    assert abs(sim - 1.0) < 1e-9


@settings(max_examples=50, deadline=None)
@given(vec=complex_vector(3))
def test_state_hash_deterministic(vec):
    a = ResonantState(vec, label="t", glyph="g")
    b = ResonantState(vec.copy(), label="t", glyph="g")
    assert a.state_hash() == b.state_hash()
    assert a.state_hash().startswith("sha256:")


@settings(max_examples=30, deadline=None)
@given(dim=st.integers(min_value=1, max_value=8))
def test_zero_vector_conventions(dim):
    zero = ResonantState(np.zeros(dim, dtype=np.complex128))
    assert zero.resonance == 0.0
    assert zero.phase == 0.0
    assert normalized_complex_similarity(zero, zero) == 1.0

    nonzero = ResonantState(np.ones(dim, dtype=np.complex128))
    assert normalized_complex_similarity(zero, nonzero) == 0.0
    assert normalized_complex_similarity(nonzero, zero) == 0.0


def test_kernel_version_present():
    assert KERNEL_VERSION.startswith("langarian-python-ref-")
