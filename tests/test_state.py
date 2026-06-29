import numpy as np

from langarian import ResonantState


def test_zero_state_is_lawful_identity_convention():
    state = ResonantState(np.array([0 + 0j]), glyph="zero")
    assert state.resonance == 0.0
    assert state.phase == 0.0
    assert state.state_hash().startswith("sha256:")


def test_state_from_pairs():
    state = ResonantState.from_pairs([[3.0, 4.0]], glyph="5", label="three_four")
    assert round(state.resonance, 6) == 5.0
    assert state.glyph == "5"
    assert state.label == "three_four"
