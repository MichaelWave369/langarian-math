import numpy as np

from langarian import (
    ResonantState,
    ResultStatus,
    attenuated_phase_shift,
    bridge,
    harmonic_sum,
    normalized_complex_similarity,
    phase_shift,
    phi_scale,
)


def test_phase_shift_preserves_resonance_and_receipts():
    state = ResonantState(np.array([1 + 0j, 1 + 0j]), glyph="seed")
    result = phase_shift(state, np.pi / 2)
    assert abs(result.output.resonance - state.resonance) < 1e-12
    assert result.receipt.status == ResultStatus.PASS
    assert result.receipt.receipt_id() in result.output.history


def test_attenuated_phase_shift_requires_cost_for_decrease():
    state = ResonantState(np.array([1 + 0j]), glyph="seed")
    result = attenuated_phase_shift(state, np.pi / 2, 0.5, cost_label="declared attenuation")
    assert result.output.resonance < state.resonance
    assert result.receipt.status == ResultStatus.PASS


def test_attenuated_phase_shift_without_cost_fails():
    state = ResonantState(np.array([1 + 0j]), glyph="seed")
    result = attenuated_phase_shift(state, np.pi / 2, 0.5, cost_label=None)
    assert result.receipt.status == ResultStatus.FAIL


def test_harmonic_sum_outputs_state_and_receipt():
    a = ResonantState(np.array([3 + 0j]), glyph="3")
    b = ResonantState(np.array([6 + 0j]), glyph="6")
    result = harmonic_sum(a, b)
    assert result.output.resonance == 9.0
    assert result.receipt.output_hash.startswith("sha256:")


def test_phi_scale_preserves_projective_coherence():
    state = ResonantState(np.array([1 + 2j]))
    result = phi_scale(state, 2)
    assert abs(normalized_complex_similarity(state, result.output) - 1.0) < 1e-12


def test_bridge_records_coherence():
    a = ResonantState(np.array([1 + 0j, 0 + 0j]))
    b = ResonantState(np.array([1 + 0j, 0 + 0j]))
    result = bridge(a, b)
    assert result.coherence == 1.0
    assert result.receipt.status == ResultStatus.PASS
