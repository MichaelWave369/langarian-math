"""Deterministic JSON conformance fixtures for Langarian Math Workbench v0.3.

Generates ``fixtures/conformance/*.json``: states, all five operators, edge
cases (zero, cross-dim, underflow/overflow-safe magnitudes, error cases), and
a tampered-receipt case. All fixture receipts use a deterministic clock
(``timestamp_utc = "1970-01-01T00:00:00+00:00"``), so regeneration is
byte-for-byte reproducible on a given platform.

Usage: ``python -m langarian.fixtures --out fixtures/conformance``
"""

from __future__ import annotations

import argparse
from dataclasses import replace
import json
import math
from pathlib import Path
from typing import Any, Callable

import numpy as np

from .limits import LimitError, MetricError
from .metrics import normalized_complex_similarity, system_coherence
from .operators import attenuated_phase_shift, bridge, harmonic_sum, phase_shift, phi_scale
from .receipts import OperationReceipt
from .state import ResonantState
from .validation import validate_receipt_data
from .version import FIXTURE_VERSION, KERNEL_VERSION, METRIC_VERSION, RECEIPT_SCHEMA_VERSION

DETERMINISTIC_TIMESTAMP = "1970-01-01T00:00:00+00:00"

# Shared conformance states: name -> [[re, im], ...] pairs.
STATE_PAIRS: dict[str, list[list[float]]] = {
    "zero_1": [[0.0, 0.0]],
    "one_1": [[1.0, 0.0]],
    "basis_2_a": [[1.0, 0.0], [0.0, 0.0]],
    "basis_2_b": [[0.0, 0.0], [1.0, 0.0]],
    "mixed_2": [[1.0, 2.0], [3.0, -4.0]],
    "v_3_6_9": [[3.0, 0.0], [6.0, 0.0], [9.0, 0.0]],
    "small_1e-200": [[1e-200, 0.0]],
    "large_1e200": [[1e200, 0.0]],
    "subnormal_5e-162": [[5e-162, 0.0]],
}


def _pairs(vector: np.ndarray) -> list[list[float]]:
    return [[float(np.real(z)), float(np.imag(z))] for z in vector]


def _fixed_receipt(receipt: OperationReceipt) -> OperationReceipt:
    """Re-emit a receipt under the deterministic fixture clock."""

    return replace(receipt, timestamp_utc=DETERMINISTIC_TIMESTAMP)


def _state_fixtures() -> dict[str, Any]:
    states = []
    for name, pairs in STATE_PAIRS.items():
        state = ResonantState.from_pairs(pairs, label=name)
        states.append(
            {
                "name": name,
                "vector": pairs,
                "dim": state.dim,
                "resonance": state.resonance,
                "phase": state.phase,
                "state_hash": state.state_hash(),
            }
        )
    return {
        "fixture_version": FIXTURE_VERSION,
        "kernel_version": KERNEL_VERSION,
        "kind": "states",
        "states": states,
    }


def _receipt_expectation(receipt: OperationReceipt) -> dict[str, Any]:
    body = receipt.body(include_receipt_id=True)
    return {
        "status": receipt.status.value,
        "receipt_content_hash": receipt.content_hash(),
        "receipt_id": receipt.receipt_id(),
        "receipt": body,
    }


def _operation_fixtures() -> dict[str, dict[str, Any]]:
    zero = ResonantState.from_pairs(STATE_PAIRS["zero_1"], label="zero_1")
    one = ResonantState.from_pairs(STATE_PAIRS["one_1"], label="one_1")
    mixed = ResonantState.from_pairs(STATE_PAIRS["mixed_2"], label="mixed_2")
    a3 = ResonantState.from_pairs([[3.0, 0.0], [1.0, 0.0]], label="hs_a")
    b3 = ResonantState.from_pairs([[0.0, 0.0], [2.0, 0.0]], label="hs_b")
    cross_a = ResonantState.from_pairs([[1.0, 0.0]], label="cross_a")
    cross_b = ResonantState.from_pairs([[0.0, 0.0], [1.0, 0.0], [1.0, 1.0]], label="cross_b")

    cases: dict[str, list[dict[str, Any]]] = {op: [] for op in ("harmonic_sum", "phase_shift", "attenuated_phase_shift", "phi_scale", "bridge")}

    def record(op: str, name: str, inputs: dict[str, Any], output: ResonantState, receipt: OperationReceipt,
               coherence_before: float | None, coherence_after: float | None) -> None:
        receipt = _fixed_receipt(receipt)
        # The receipt's output_hash covers the mathematical output state
        # (before history append). ``output`` is the finalized state carrying
        # the wall-clock receipt_id in its history, so reconstruct the
        # pre-finalize state and re-finalize under the deterministic clock.
        pre_finalize = ResonantState(
            vector=output.vector,
            glyph=output.glyph,
            label=output.label,
            metadata=dict(output.metadata),
        )
        assert pre_finalize.state_hash() == receipt.output_hash
        finalized = pre_finalize.with_history(receipt.receipt_id())
        cases[op].append(
            {
                "name": name,
                "inputs": inputs,
                "expected": {
                    "output_vector": _pairs(output.vector),
                    "output_resonance": output.resonance,
                    "output_hash": receipt.output_hash,
                    "finalized_output_hash": finalized.state_hash(),
                    "coherence_before": coherence_before,
                    "coherence_after": coherence_after,
                    **_receipt_expectation(receipt),
                },
            }
        )

    r = harmonic_sum(a3, b3, label="hs_basic")
    record("harmonic_sum", "basic_same_dim", {"a": _pairs(a3.vector), "b": _pairs(b3.vector)},
           r.output, r.receipt, r.receipt.coherence_before, r.receipt.coherence_after)
    r = harmonic_sum(cross_a, cross_b, label="hs_cross_dim")
    record("harmonic_sum", "cross_dim_zero_padded", {"a": _pairs(cross_a.vector), "b": _pairs(cross_b.vector)},
           r.output, r.receipt, r.receipt.coherence_before, r.receipt.coherence_after)

    r = phase_shift(mixed, math.pi / 3)
    record("phase_shift", "rotate_pi_over_3", {"state": STATE_PAIRS["mixed_2"], "angle_radians": math.pi / 3},
           r.output, r.receipt, r.receipt.coherence_before, r.receipt.coherence_after)
    r = phase_shift(zero, 0.5)
    record("phase_shift", "zero_state", {"state": STATE_PAIRS["zero_1"], "angle_radians": 0.5},
           r.output, r.receipt, r.receipt.coherence_before, r.receipt.coherence_after)

    r = attenuated_phase_shift(mixed, math.pi / 9, 0.75, cost_label="declared attenuation")
    record("attenuated_phase_shift", "attenuate_075_with_cost",
           {"state": STATE_PAIRS["mixed_2"], "angle_radians": math.pi / 9, "attenuation": 0.75, "cost_label": "declared attenuation"},
           r.output, r.receipt, r.receipt.coherence_before, r.receipt.coherence_after)

    r = phi_scale(mixed, 2)
    record("phi_scale", "n_equals_2", {"state": STATE_PAIRS["mixed_2"], "n": 2},
           r.output, r.receipt, r.receipt.coherence_before, r.receipt.coherence_after)
    r = phi_scale(one, 0)
    record("phi_scale", "n_equals_0_identity", {"state": STATE_PAIRS["one_1"], "n": 0},
           r.output, r.receipt, r.receipt.coherence_before, r.receipt.coherence_after)

    br = bridge(cross_a, cross_b, cost=0.0)
    record("bridge", "cross_dim_bridge", {"source": _pairs(cross_a.vector), "target": _pairs(cross_b.vector), "cost": 0.0},
           br.target, br.receipt, br.receipt.coherence_before, br.receipt.coherence_after)

    return {
        op: {
            "fixture_version": FIXTURE_VERSION,
            "kernel_version": KERNEL_VERSION,
            "metric_version": METRIC_VERSION,
            "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
            "timestamp_utc": DETERMINISTIC_TIMESTAMP,
            "kind": "operation",
            "operator": op,
            "cases": op_cases,
        }
        for op, op_cases in cases.items()
    }


def _edge_case_fixtures() -> dict[str, Any]:
    zero = ResonantState.from_pairs(STATE_PAIRS["zero_1"])
    one = ResonantState.from_pairs(STATE_PAIRS["one_1"])
    small = ResonantState.from_pairs(STATE_PAIRS["small_1e-200"])
    large = ResonantState.from_pairs(STATE_PAIRS["large_1e200"])
    subnormal = ResonantState.from_pairs(STATE_PAIRS["subnormal_5e-162"])
    basis_a = ResonantState.from_pairs(STATE_PAIRS["basis_2_a"])
    v369 = ResonantState.from_pairs(STATE_PAIRS["v_3_6_9"])

    similarity_cases = [
        {"name": "zero_zero", "a": "zero_1", "b": "zero_1", "expected": normalized_complex_similarity(zero, zero)},
        {"name": "zero_nonzero", "a": "zero_1", "b": "one_1", "expected": normalized_complex_similarity(zero, one)},
        {"name": "underflow_self_similarity", "a": "small_1e-200", "b": "small_1e-200",
         "expected": normalized_complex_similarity(small, small)},
        {"name": "underflow_zero_convention", "a": "small_1e-200", "b": "zero_1",
         "expected": normalized_complex_similarity(small, zero)},
        {"name": "subnormal_self_similarity", "a": "subnormal_5e-162", "b": "subnormal_5e-162",
         "expected": normalized_complex_similarity(subnormal, subnormal)},
        {"name": "overflow_self_similarity", "a": "large_1e200", "b": "large_1e200",
         "expected": normalized_complex_similarity(large, large)},
        {"name": "cross_dim_padded", "a": "basis_2_a", "b": "v_3_6_9",
         "expected": normalized_complex_similarity(basis_a, v369)},
        {"name": "large_resonance_finite", "a": "large_1e200", "b": "large_1e200",
         "expected_resonance": large.resonance},
    ]

    error_cases: list[dict[str, Any]] = []

    def expect_error(name: str, thunk: Callable[[], Any], error_type: str) -> None:
        try:
            thunk()
        except (ValueError, TypeError, LimitError, MetricError) as exc:
            actual = type(exc).__name__
            entry = {"name": name, "expected_error_type": error_type, "observed_error_type": actual}
            error_cases.append(entry)
            return
        error_cases.append({"name": name, "expected_error_type": error_type, "observed_error_type": None})

    expect_error("dim_zero_rejected", lambda: ResonantState(np.array([], dtype=np.complex128)), "ValueError")
    expect_error("dim_above_max_rejected", lambda: ResonantState(np.zeros(65, dtype=np.complex128)), "LimitError")
    expect_error("nan_vector_rejected", lambda: ResonantState(np.array([complex(float("nan"), 0.0)])), "ValueError")
    expect_error("phase_shift_nan_angle", lambda: phase_shift(one, float("nan")), "ValueError")
    expect_error("phase_shift_inf_angle", lambda: phase_shift(one, float("inf")), "ValueError")
    expect_error("attenuation_nan", lambda: attenuated_phase_shift(one, 0.1, float("nan"), cost_label="x"), "ValueError")
    expect_error("attenuation_negative", lambda: attenuated_phase_shift(one, 0.1, -0.5, cost_label="x"), "ValueError")
    expect_error("bridge_cost_inf", lambda: bridge(one, one, cost=float("inf")), "ValueError")
    expect_error("phi_scale_overflow_n", lambda: phi_scale(one, 2000), "LimitError")
    expect_error("phi_scale_non_integer_n", lambda: phi_scale(one, 2.7), "TypeError")
    expect_error("phi_scale_nan_n", lambda: phi_scale(one, float("nan")), "ValueError")
    expect_error(
        "negative_weights_rejected",
        lambda: system_coherence([one, basis_a], weights=np.array([[1.0, -0.5], [-0.5, 1.0]])),
        "ValueError",
    )
    expect_error("non_json_metadata_rejected", lambda: ResonantState(np.array([1 + 0j]), metadata={"arr": np.int64(3)}), "TypeError")
    expect_error("non_finite_metadata_rejected", lambda: ResonantState(np.array([1 + 0j]), metadata={"x": float("nan")}), "ValueError")

    return {
        "fixture_version": FIXTURE_VERSION,
        "kernel_version": KERNEL_VERSION,
        "metric_version": METRIC_VERSION,
        "kind": "edge_cases",
        "similarity_cases": similarity_cases,
        "error_cases": error_cases,
    }


def _tamper_fixture() -> dict[str, Any]:
    mixed = ResonantState.from_pairs(STATE_PAIRS["mixed_2"], label="mixed_2")
    receipt = _fixed_receipt(phase_shift(mixed, 0.25).receipt)
    valid_body = receipt.body(include_receipt_id=True)

    tampered_hash = dict(valid_body)
    tampered_hash["output_hash"] = "sha256:" + "0" * 64

    tampered_status = dict(valid_body)
    tampered_status["status"] = "FAIL"

    def levels_for(body: dict[str, Any]) -> dict[str, bool]:
        result = validate_receipt_data(body)
        return {level.name: level.ok for level in result.levels}

    return {
        "fixture_version": FIXTURE_VERSION,
        "kernel_version": KERNEL_VERSION,
        "kind": "tamper",
        "valid_receipt": valid_body,
        "expected_valid_levels": levels_for(valid_body),
        "tampered_cases": [
            {
                "name": "output_hash_tampered",
                "receipt": tampered_hash,
                "expected_levels": levels_for(tampered_hash),
            },
            {
                "name": "status_tampered",
                "receipt": tampered_status,
                "expected_levels": levels_for(tampered_status),
            },
        ],
    }


def build_fixtures() -> dict[str, dict[str, Any]]:
    """Build the full conformance fixture corpus (deterministic)."""

    files: dict[str, dict[str, Any]] = {"states.json": _state_fixtures()}
    for op, payload in _operation_fixtures().items():
        files[f"op_{op}.json"] = payload
    files["edge_cases.json"] = _edge_case_fixtures()
    files["tampered_receipt.json"] = _tamper_fixture()
    files["manifest.json"] = {
        "fixture_version": FIXTURE_VERSION,
        "kernel_version": KERNEL_VERSION,
        "metric_version": METRIC_VERSION,
        "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
        "timestamp_utc": DETERMINISTIC_TIMESTAMP,
        "files": sorted(files),
        "note": "Deterministic-clock conformance fixtures; receipt timestamps are fixed, so content_hash and receipt_id are reproducible.",
    }
    return files


def write_fixtures(out_dir: Path) -> list[Path]:
    files = build_fixtures()
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, payload in sorted(files.items()):
        path = out_dir / name
        path.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
        written.append(path)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="langarian.fixtures", description="Generate deterministic conformance fixtures.")
    parser.add_argument("--out", type=Path, default=Path("fixtures/conformance"), help="Output directory.")
    args = parser.parse_args(argv)
    written = write_fixtures(args.out)
    print(f"wrote {len(written)} fixture files to {args.out}")
    for path in written:
        print(f"- {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
