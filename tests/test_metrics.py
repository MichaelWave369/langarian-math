import numpy as np

from langarian import ResonantState, normalized_complex_similarity, phase_shift


def test_similarity_bounds_and_identity():
    a = ResonantState(np.array([1 + 0j, 0 + 0j]))
    b = ResonantState(np.array([0 + 0j, 1 + 0j]))
    assert normalized_complex_similarity(a, a) == 1.0
    assert normalized_complex_similarity(a, b) == 0.0


def test_similarity_phase_invariant():
    a = ResonantState(np.array([1 + 2j, 3 - 4j]))
    shifted = phase_shift(a, np.pi / 3).output
    assert abs(normalized_complex_similarity(a, shifted) - 1.0) < 1e-12


def test_zero_similarity_convention():
    zero = ResonantState(np.array([0 + 0j]))
    nonzero = ResonantState(np.array([1 + 0j]))
    assert normalized_complex_similarity(zero, zero) == 1.0
    assert normalized_complex_similarity(zero, nonzero) == 0.0
