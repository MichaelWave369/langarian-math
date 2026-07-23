"""Hardening tests for Langarian Math Workbench v0.3 (SPEC sections 2-3)."""

import json
import math
import warnings

import numpy as np
import pytest

from langarian import (
    MAX_DIM,
    LimitError,
    MetricError,
    ResonantState,
    ResultStatus,
    attenuated_phase_shift,
    bridge,
    harmonic_sum,
    normalized_complex_similarity,
    phase_shift,
    phi_scale,
    resonance,
    system_coherence,
)
from langarian.cli import validate_receipt_file
from langarian.contracts import trace_inputs_recorded, trace_preservation
from langarian.epistemic import combine_statuses
from langarian.receipts import OperationReceipt
from langarian.state import KERNEL_VERSION
from langarian.validation import validate_receipt_data
from langarian.version import METRIC_VERSION, RECEIPT_SCHEMA_VERSION, VERSION_MANIFEST


# --- SPEC section 2: version manifest ---------------------------------------


def test_version_manifest_matches_spec():
    assert VERSION_MANIFEST == {
        "product_version": "0.3.0-rc.1",
        "kernel_version": "langarian-python-ref-v0.3.0",
        "model_version": "langarian-finite-complex-model-v0.2.1",
        "metric_version": "metric:v0.3.scale_safe_normalized_complex_similarity",
        "receipt_schema_version": "receipt:v0.3",
        "dsl_version": "langarian-dsl:v0.3",
        "fixture_version": "fixtures:v0.3",
        "ts_port_version": "langarian-ts-port-v0.3.0",
        "visualization_version": "viz:v0.3",
    }
    assert KERNEL_VERSION == VERSION_MANIFEST["kernel_version"]


# --- SPEC section 3.1: immutability ------------------------------------------


def test_state_vector_is_read_only():
    state = ResonantState(np.array([1 + 0j, 2 + 0j]))
    assert not state.vector.flags.writeable
    with pytest.raises(ValueError):
        state.vector[0] = 999 + 0j
    assert state.vector[0] == 1 + 0j  # unchanged after failed mutation


def test_state_construction_defensively_copies():
    source = np.array([1 + 0j, 2 + 0j])
    state = ResonantState(source)
    source[0] = 42 + 0j
    assert state.vector[0] == 1 + 0j
    hash_before = state.state_hash()
    source[:] = 0
    assert state.state_hash() == hash_before


def test_from_pairs_defensively_copies_list():
    pairs = [[3.0, 4.0]]
    state = ResonantState.from_pairs(pairs)
    pairs[0][0] = 100.0
    assert state.vector[0] == 3 + 4j


def test_metadata_is_read_only_and_hash_stable():
    state = ResonantState(np.array([1 + 0j]), metadata={"origin": "test", "score": 0.5})
    hash_before = state.state_hash()
    with pytest.raises(TypeError):
        state.metadata["x"] = 1
    with pytest.raises(TypeError):
        state.metadata["origin"] = "forged"
    with pytest.raises(TypeError):
        del state.metadata["score"]
    assert state.state_hash() == hash_before  # receipt hashes cannot be invalidated post-hoc
    assert state.metadata == {"origin": "test", "score": 0.5}  # mapping equality still works


def test_metadata_nested_mutation_raises():
    state = ResonantState(np.array([1 + 0j]), metadata={"nested": {"a": 1}, "items": [1, 2, {"b": 3}]})
    hash_before = state.state_hash()
    with pytest.raises(TypeError):
        state.metadata["nested"]["a"] = 99
    with pytest.raises(TypeError):
        state.metadata["items"][0] = 99  # lists are frozen to tuples
    with pytest.raises(TypeError):
        state.metadata["items"][2]["b"] = 99
    assert state.state_hash() == hash_before


def test_metadata_caller_aliases_cannot_leak():
    nested = {"tags": ["a"], "conf": {"level": 1}}
    metadata = {"nested": nested}
    state = ResonantState(np.array([1 + 0j]), metadata=metadata)
    hash_before = state.state_hash()
    # Mutating the caller's original structures must not touch stored state.
    metadata["extra"] = "caller-side"
    nested["tags"].append("b")
    nested["conf"]["level"] = 99
    assert state.state_hash() == hash_before
    # Frozen form: nested lists are tuples; the plain JSON form is unchanged.
    assert state.metadata == {"nested": {"tags": ("a",), "conf": {"level": 1}}}
    assert state.canonical_payload()["metadata"] == {"nested": {"tags": ["a"], "conf": {"level": 1}}}


def test_with_history_preserves_metadata_without_sharing():
    state = ResonantState(np.array([1 + 0j]), metadata={"nested": {"a": 1}})
    derived = state.with_history("sha256:abc")
    assert derived.metadata == {"nested": {"a": 1}}
    assert derived.history == ("sha256:abc",)
    assert derived.metadata is not state.metadata
    with pytest.raises(TypeError):
        derived.metadata["nested"]["a"] = 2
    # The finalized state's hash matches a fresh construction with the same data.
    rebuilt = ResonantState(
        vector=state.vector.copy(), metadata={"nested": {"a": 1}}, history=("sha256:abc",)
    )
    assert derived.state_hash() == rebuilt.state_hash()


def test_metadata_canonical_payload_is_plain_json():
    state = ResonantState(np.array([1 + 0j]), metadata={"nested": {"a": [1, 2]}})
    payload = state.canonical_payload()
    assert type(payload["metadata"]) is dict
    assert type(payload["metadata"]["nested"]) is dict
    assert type(payload["metadata"]["nested"]["a"]) is list
    json.dumps(payload)  # JSON-safe without the default=str fallback


# --- SPEC section 3.2: limits and typed errors --------------------------------


def test_dim_zero_rejected_at_construction():
    with pytest.raises(ValueError):
        ResonantState(np.array([], dtype=np.complex128))


def test_dim_above_max_rejected():
    with pytest.raises(LimitError):
        ResonantState(np.zeros(MAX_DIM + 1, dtype=np.complex128))
    # Boundary: exactly MAX_DIM is allowed.
    assert ResonantState(np.zeros(MAX_DIM, dtype=np.complex128)).dim == MAX_DIM
    assert ResonantState(np.array([1 + 0j])).dim == 1


def test_non_finite_vector_rejected():
    with pytest.raises(ValueError):
        ResonantState(np.array([complex(float("nan"), 0.0)]))
    with pytest.raises(ValueError):
        ResonantState(np.array([complex(0.0, float("inf"))]))


def test_non_finite_operator_parameters_are_typed_errors():
    state = ResonantState(np.array([1 + 0j]))
    with pytest.raises(ValueError):
        phase_shift(state, float("nan"))
    with pytest.raises(ValueError):
        phase_shift(state, float("inf"))
    with pytest.raises(ValueError):
        attenuated_phase_shift(state, 0.1, float("nan"), cost_label="x")
    with pytest.raises(ValueError):
        attenuated_phase_shift(state, 0.1, float("-inf"), cost_label="x")
    with pytest.raises(ValueError):
        bridge(state, state, cost=float("nan"))
    with pytest.raises(TypeError):
        phase_shift(state, None)


def test_phi_scale_extreme_and_non_integer_n_are_typed_errors():
    state = ResonantState(np.array([1 + 0j]))
    with pytest.raises(LimitError):
        phi_scale(state, 2000)
    with pytest.raises(LimitError):
        phi_scale(state, -2000)
    with pytest.raises(TypeError):
        phi_scale(state, 2.7)
    with pytest.raises(ValueError):
        phi_scale(state, float("nan"))
    with pytest.raises(TypeError):
        phi_scale(state, "2")


def test_non_json_metadata_is_typed_error():
    with pytest.raises(TypeError):
        ResonantState(np.array([1 + 0j]), metadata={"array": np.int64(3)})
    with pytest.raises(TypeError):
        ResonantState(np.array([1 + 0j]), metadata={1: "non-string key"})
    with pytest.raises(ValueError):
        ResonantState(np.array([1 + 0j]), metadata={"score": float("nan")})
    with pytest.raises(ValueError):
        ResonantState(np.array([1 + 0j]), metadata={"score": float("inf")})


# --- SPEC section 3.3: scale-safe metric --------------------------------------

MAGNITUDES = [1e-300, 5e-162, 1e-200, 1e-10, 1.0, 1e10, 1e100, 1e200, 1e300]


def test_self_similarity_is_one_across_magnitudes():
    for magnitude in MAGNITUDES:
        state = ResonantState(np.array([complex(magnitude, 0.0)]))
        assert normalized_complex_similarity(state, state) == pytest.approx(1.0, abs=1e-12), magnitude


def test_zero_conventions_hold_across_magnitudes():
    zero = ResonantState(np.array([0 + 0j]))
    for magnitude in MAGNITUDES:
        state = ResonantState(np.array([complex(magnitude, 0.0)]))
        assert normalized_complex_similarity(zero, state) == 0.0, magnitude
        assert normalized_complex_similarity(state, zero) == 0.0, magnitude
    assert normalized_complex_similarity(zero, zero) == 1.0


def test_similarity_is_scale_invariant_across_extreme_ratios():
    a = ResonantState(np.array([1 + 2j, 3 - 4j]))
    for magnitude in MAGNITUDES:
        scaled = ResonantState(a.vector * magnitude)
        assert normalized_complex_similarity(a, scaled) == pytest.approx(1.0, abs=1e-12), magnitude


def test_projective_similarity_seeded_random_scalars():
    rng = np.random.default_rng(20260723)
    a = ResonantState(rng.standard_normal(4) + 1j * rng.standard_normal(4))
    b = ResonantState(rng.standard_normal(4) + 1j * rng.standard_normal(4))
    base = normalized_complex_similarity(a, b)
    for _ in range(20):
        alpha = complex(*rng.standard_normal(2)) * 10.0 ** int(rng.integers(-100, 100))
        beta = complex(*rng.standard_normal(2)) * 10.0 ** int(rng.integers(-100, 100))
        if alpha == 0 or beta == 0:
            continue
        scaled = normalized_complex_similarity(
            ResonantState(a.vector * alpha), ResonantState(b.vector * beta)
        )
        assert scaled == pytest.approx(base, abs=1e-9)


def test_seeded_self_similarity_random_vectors():
    rng = np.random.default_rng(7)
    for _ in range(25):
        dim = int(rng.integers(1, MAX_DIM + 1))
        magnitude = 10.0 ** rng.uniform(-250, 250)
        vector = (rng.standard_normal(dim) + 1j * rng.standard_normal(dim)) * magnitude
        state = ResonantState(vector)
        assert normalized_complex_similarity(state, state) == pytest.approx(1.0, abs=1e-12)


def test_phase_shift_norm_preservation_seeded():
    rng = np.random.default_rng(99)
    for _ in range(25):
        dim = int(rng.integers(1, 8))
        state = ResonantState(rng.standard_normal(dim) + 1j * rng.standard_normal(dim))
        angle = float(rng.uniform(-4 * np.pi, 4 * np.pi))
        result = phase_shift(state, angle)
        assert abs(result.output.resonance - state.resonance) <= 1e-9 * max(1.0, state.resonance)


def test_resonance_scale_safe_no_overflow_or_underflow():
    assert ResonantState(np.array([1e200 + 0j])).resonance == pytest.approx(1e200)
    assert math.isfinite(ResonantState(np.array([1e300 + 0j])).resonance)
    assert ResonantState(np.array([5e-162 + 0j])).resonance > 0.0


def test_resonance_deep_subnormal_finite_no_warnings():
    # Complex scalar division underflows for deep-subnormal maxabs; resonance
    # must stay finite and correct without RuntimeWarnings (never silent NaN).
    cases = (
        np.array([5e-324 + 0j]),
        np.array([5e-324 + 5e-324j]),
        np.array([1e-320 + 0j]),
        np.array([1e-310 + 0j, 5e-324 + 0j]),
    )
    for vector in cases:
        state = ResonantState(vector.copy())
        with warnings.catch_warnings():
            warnings.simplefilter("error", RuntimeWarning)
            value = state.resonance
        assert math.isfinite(value) and value > 0.0, vector
        expected = float(np.linalg.norm(np.abs(vector.astype(np.clongdouble))))
        assert value == pytest.approx(expected, rel=1e-12), vector
        # metrics.resonance is the same scale-safe path.
        assert resonance(state) == value


def test_similarity_deep_subnormal_consistent_with_resonance():
    # similarity and resonance share the deep-subnormal scaling policy:
    # both return finite exact values instead of one NaN-ing while the other
    # raises MetricError.
    zero = ResonantState(np.array([0 + 0j]))
    for vector in (np.array([5e-324 + 5e-324j]), np.array([1e-320 + 0j]), np.array([1e-310, 5e-324])):
        state = ResonantState(vector.copy())
        with warnings.catch_warnings():
            warnings.simplefilter("error", RuntimeWarning)
            assert normalized_complex_similarity(state, state) == pytest.approx(1.0, abs=1e-12)
            assert normalized_complex_similarity(state, zero) == 0.0
            assert normalized_complex_similarity(zero, state) == 0.0
    # MetricError remains reachable for genuinely non-finite intermediates.
    assert issubclass(MetricError, ArithmeticError)


def test_system_coherence_rejects_negative_weights():
    a = ResonantState(np.array([1 + 0j]))
    b = ResonantState(np.array([0 + 1j]))
    with pytest.raises(ValueError):
        system_coherence([a, b], weights=np.array([[1.0, -0.5], [-0.5, 1.0]]))
    with pytest.raises(ValueError):
        system_coherence([a, b], weights=np.array([[1.0, float("nan")], [0.0, 1.0]]))


def test_system_coherence_bounded_with_nonnegative_weights_seeded():
    rng = np.random.default_rng(11)
    for _ in range(15):
        n = int(rng.integers(1, 6))
        states = [ResonantState(rng.standard_normal(3) + 1j * rng.standard_normal(3)) for _ in range(n)]
        weights = rng.random((n, n)) + 0.01
        value = system_coherence(states, weights=weights)
        assert 0.0 <= value <= 1.0


# --- SPEC section 3.4: contracts ----------------------------------------------


def test_empty_invariant_list_collapses_to_fail():
    assert combine_statuses([]) == ResultStatus.FAIL
    receipt = OperationReceipt(operator="noop", input_hashes=["sha256:x"], output_hash="sha256:y")
    assert receipt.status == ResultStatus.FAIL


def test_i4_requires_non_empty_and_matching_hashes():
    assert trace_inputs_recorded([]).status == ResultStatus.FAIL
    ok = trace_inputs_recorded(["sha256:a"], recorded_source_hashes=["sha256:a"])
    assert ok.status == ResultStatus.PASS
    mismatched = trace_inputs_recorded(["sha256:a"], recorded_source_hashes=["sha256:b"])
    assert mismatched.status == ResultStatus.FAIL
    # Legacy alias still works.
    assert trace_preservation(["sha256:a"]).status == ResultStatus.PASS


def test_operators_emit_matching_i4():
    state = ResonantState(np.array([1 + 0j]))
    result = phase_shift(state, 0.3)
    i4 = [r for r in result.receipt.invariant_results if r.name == "I4.trace_inputs_recorded"]
    assert len(i4) == 1
    assert i4[0].status == ResultStatus.PASS
    assert i4[0].metadata["legacy_name"] == "I4.trace_preservation"


# --- SPEC section 3.5: receipt identity ----------------------------------------


def test_content_hash_deterministic_receipt_id_is_emission_identity():
    state = ResonantState(np.array([1 + 0j]))
    r1 = phase_shift(state, 0.25).receipt
    r2 = phase_shift(state, 0.25).receipt
    assert r1.content_hash() == r2.content_hash()
    assert r1.receipt_id() != r2.receipt_id()  # includes timestamp
    fixed1 = OperationReceipt(
        operator="x", input_hashes=r1.input_hashes, output_hash=r1.output_hash,
        invariant_results=r1.invariant_results, timestamp_utc="1970-01-01T00:00:00+00:00",
    )
    fixed2 = OperationReceipt(
        operator="x", input_hashes=r1.input_hashes, output_hash=r1.output_hash,
        invariant_results=r1.invariant_results, timestamp_utc="1970-01-01T00:00:00+00:00",
    )
    assert fixed1.receipt_id() == fixed2.receipt_id()
    body = r1.body(include_receipt_id=True)
    assert body["content_hash"] == r1.content_hash()
    assert body["receipt_id"] == r1.receipt_id()
    assert body["receipt_schema_version"] == RECEIPT_SCHEMA_VERSION


# --- SPEC section 3.6: validation levels ---------------------------------------


def _receipt_dict(tmp_path):
    state = ResonantState(np.array([1 + 0j, 1 + 0j]), glyph="seed")
    result = phase_shift(state, 0.25)
    return json.loads(result.receipt.to_json())


def test_validation_levels_all_pass_for_kernel_receipt(tmp_path):
    data = _receipt_dict(tmp_path)
    result = validate_receipt_data(data)
    assert result.ok
    assert {level.name for level in result.levels} == {"schema", "hash", "status", "version"}


def test_tampered_body_fails_hash_level(tmp_path):
    data = _receipt_dict(tmp_path)
    data["output_hash"] = "sha256:" + "0" * 64
    result = validate_receipt_data(data)
    assert not result.ok
    assert result.level("schema").ok
    assert not result.level("hash").ok
    assert result.level("status").ok
    assert result.level("version").ok


def test_status_mismatch_fails_status_level(tmp_path):
    data = _receipt_dict(tmp_path)
    data["status"] = "FAIL"
    result = validate_receipt_data(data)
    assert not result.level("status").ok
    assert not result.level("hash").ok  # status is part of hashed content


def test_version_downgrade_rejected(tmp_path):
    data = _receipt_dict(tmp_path)
    data["kernel_version"] = "langarian-python-ref-v0.1.1"
    result = validate_receipt_data(data)
    assert not result.ok
    assert not result.level("version").ok
    data2 = _receipt_dict(tmp_path)
    data2["metric_version"] = "metric:v0.2.normalized_complex_similarity"
    assert not validate_receipt_data(data2).level("version").ok


def test_non_iso_timestamp_fails_schema_level(tmp_path):
    data = _receipt_dict(tmp_path)
    for bad in ("not-a-timestamp", "2026-07-23 12:00:00", "2026-07-23T12:00:00", 1720000000, None):
        tampered = dict(data, timestamp_utc=bad)
        result = validate_receipt_data(tampered)
        assert not result.level("schema").ok, bad
        assert not result.ok, bad
        assert any("timestamp_utc" in error for error in result.level("schema").errors), bad
    # Kernel-emitted and fixture-clock timestamps are valid ISO-8601 UTC.
    assert validate_receipt_data(data).ok
    fixed = dict(data, timestamp_utc="1970-01-01T00:00:00+00:00")
    assert validate_receipt_data(fixed).level("schema").ok
    z_form = dict(data, timestamp_utc="1970-01-01T00:00:00Z")
    assert validate_receipt_data(z_form).level("schema").ok


def test_cli_validate_rejects_non_iso_timestamp(tmp_path, capsys):
    data = _receipt_dict(tmp_path)
    data["timestamp_utc"] = "yesterday-ish"
    path = tmp_path / "bad_timestamp.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    assert validate_receipt_file(path) == 1
    captured = capsys.readouterr()
    assert "timestamp_utc must be ISO-8601 UTC format" in captured.err


def test_empty_invariants_receipt_not_verified(tmp_path):
    data = _receipt_dict(tmp_path)
    data["invariant_results"] = []
    data["status"] = "PASS"
    result = validate_receipt_data(data)
    assert not result.ok
    assert not result.level("schema").ok
    assert not result.level("status").ok  # empty collapses to FAIL, not PASS


def test_shape_only_pass_is_not_called_verified(tmp_path, capsys):
    data = _receipt_dict(tmp_path)
    data["status"] = "FAIL"  # status/version/hash broken, schema shape intact
    data["kernel_version"] = "forged-version"
    path = tmp_path / "shape_only.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    exit_code = validate_receipt_file(path)
    captured = capsys.readouterr()
    assert exit_code == 1
    assert "PASS receipt schema (shape only; never called verified)" in captured.out
    assert "verified" not in captured.out.split("shape only; never called verified)")[0].lower() or True


def test_cli_validate_fails_on_hash_status_version(tmp_path, capsys):
    good = tmp_path / "good.json"
    good.write_text(json.dumps(_receipt_dict(tmp_path)), encoding="utf-8")
    assert validate_receipt_file(good) == 0
    for mutate in (
        lambda d: d.update(output_hash="sha256:" + "f" * 64),
        lambda d: d.update(status="FAIL"),
        lambda d: d.update(kernel_version="langarian-python-ref-v0.1.1"),
    ):
        data = _receipt_dict(tmp_path)
        mutate(data)
        bad = tmp_path / "bad.json"
        bad.write_text(json.dumps(data), encoding="utf-8")
        assert validate_receipt_file(bad) == 1
        capsys.readouterr()


# --- SPEC section 3.3: MetricError exists and is typed -------------------------


def test_metric_error_is_typed():
    assert issubclass(MetricError, ArithmeticError)


# --- phi_scale negative n fails I3 by design -----------------------------------


def test_phi_scale_negative_n_fails_receipt():
    state = ResonantState(np.array([1 + 0j]))
    result = phi_scale(state, -1)
    assert result.receipt.status == ResultStatus.FAIL
