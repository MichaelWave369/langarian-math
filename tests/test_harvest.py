import numpy as np
import pytest

from langarian import ResonantState, FiniteComplexSpace, UnitaryFlowDemo, normalized_complex_similarity
from langarian.glyphs import GlyphDictionary


def test_finite_complex_space_norm_inner_and_zero():
    space = FiniteComplexSpace(2)
    vector = np.array([3 + 4j, 0 + 0j])
    assert space.norm(vector) == 5.0
    assert space.inner(vector, vector).real == 25.0
    assert np.allclose(space.zero(), np.array([0 + 0j, 0 + 0j]))


def test_finite_complex_space_rejects_dimension_mismatch():
    space = FiniteComplexSpace(2)
    with pytest.raises(ValueError):
        space.coerce(np.array([1 + 0j, 2 + 0j, 3 + 0j]))


def test_unitary_flow_demo_preserves_resonance():
    state = ResonantState(np.array([1 + 2j, 3 - 4j]), glyph="seed")
    trajectory = UnitaryFlowDemo().evolve(state, angle_per_step=0.17, steps=25)
    assert UnitaryFlowDemo.preserves_resonance(trajectory)
    assert abs(normalized_complex_similarity(state, trajectory[-1].state) - 1.0) < 1e-12


def test_glyph_dictionary_nearest_with_score_is_finite_similarity_only():
    dictionary = GlyphDictionary()
    dictionary.add("east", np.array([1 + 0j, 0 + 0j]))
    dictionary.add("north", np.array([0 + 0j, 1 + 0j]))
    state = ResonantState(np.array([0.9 + 0j, 0.1 + 0j]))
    result = dictionary.nearest_with_score(state)
    assert result is not None
    entry, score = result
    assert entry.glyph == "east"
    assert 0.0 <= score <= 1.0
