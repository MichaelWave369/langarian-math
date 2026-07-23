"""Conformance fixture tests (SPEC section 3.8)."""

import json

import pytest

from langarian.fixtures import DETERMINISTIC_TIMESTAMP, build_fixtures, write_fixtures
from langarian.validation import validate_receipt_data
from langarian.version import FIXTURE_VERSION


def test_fixture_build_is_deterministic():
    first = build_fixtures()
    second = build_fixtures()
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


def test_fixture_write_produces_expected_files(tmp_path):
    written = write_fixtures(tmp_path / "conformance")
    names = {path.name for path in written}
    assert names == {
        "manifest.json",
        "states.json",
        "op_harmonic_sum.json",
        "op_phase_shift.json",
        "op_attenuated_phase_shift.json",
        "op_phi_scale.json",
        "op_bridge.json",
        "edge_cases.json",
        "tampered_receipt.json",
    }
    manifest = json.loads((tmp_path / "conformance" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["fixture_version"] == FIXTURE_VERSION
    assert manifest["timestamp_utc"] == DETERMINISTIC_TIMESTAMP


def test_fixture_receipts_use_deterministic_clock():
    fixtures = build_fixtures()
    for name, payload in fixtures.items():
        if not name.startswith("op_"):
            continue
        for case in payload["cases"]:
            receipt = case["expected"]["receipt"]
            assert receipt["timestamp_utc"] == DETERMINISTIC_TIMESTAMP
            assert receipt["content_hash"] == case["expected"]["receipt_content_hash"]


def test_fixture_operation_receipts_validate_at_all_levels():
    fixtures = build_fixtures()
    for name, payload in fixtures.items():
        if not name.startswith("op_"):
            continue
        for case in payload["cases"]:
            result = validate_receipt_data(case["expected"]["receipt"])
            assert result.ok, f"{name}/{case['name']}: {result.errors_flat()}"


def test_fixture_tamper_expectations_are_correct():
    fixtures = build_fixtures()
    tamper = fixtures["tampered_receipt.json"]
    assert all(tamper["expected_valid_levels"].values())
    for case in tamper["tampered_cases"]:
        result = validate_receipt_data(case["receipt"])
        actual = {level.name: level.ok for level in result.levels}
        assert actual == case["expected_levels"]
        assert not result.ok
        assert not result.level("hash").ok


def test_fixture_edge_error_cases_all_raise_expected_type():
    fixtures = build_fixtures()
    for case in fixtures["edge_cases.json"]["error_cases"]:
        assert case["observed_error_type"] == case["expected_error_type"], case["name"]


def test_fixture_similarity_edge_values():
    fixtures = build_fixtures()
    expected = {case["name"]: case.get("expected") for case in fixtures["edge_cases.json"]["similarity_cases"]}
    assert expected["zero_zero"] == 1.0
    assert expected["zero_nonzero"] == 0.0
    assert expected["underflow_self_similarity"] == pytest.approx(1.0)
    assert expected["overflow_self_similarity"] == pytest.approx(1.0)
    assert expected["subnormal_self_similarity"] == pytest.approx(1.0)
