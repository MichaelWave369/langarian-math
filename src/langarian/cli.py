"""CLI for Langarian example runs, receipt inspection, and DSL programs."""

from __future__ import annotations

import argparse
from pathlib import Path
import json
import math
import sys
from typing import Any

import yaml

from .operators import attenuated_phase_shift, bridge, harmonic_sum, phi_scale
from .state import ResonantState
from .dsl import parse_dsl, DSLError
from .executor import execute_program, ExecutionError

REQUIRED_RECEIPT_FIELDS = {
    "receipt_id",
    "kernel_version",
    "metric_version",
    "operator",
    "input_hashes",
    "output_hash",
    "invariant_results",
    "status",
    "epistemic_tag",
}
VALID_STATUSES = {"PASS", "WARN", "FAIL"}
VALID_TAGS = {"FORMAL", "COMPUTED", "MODEL", "INTERPRETIVE", "METAPHOR", "OBSERVED", "FAILED"}


def _state_from_config(config: dict) -> ResonantState:
    return ResonantState.from_pairs(
        config["vector"],
        glyph=config.get("glyph"),
        label=config.get("name"),
        metadata=config.get("metadata", {}),
    )


def _write_receipt(receipts_dir: Path, name: str, json_text: str) -> Path:
    receipts_dir.mkdir(parents=True, exist_ok=True)
    path = receipts_dir / name
    path.write_text(json_text + "\n", encoding="utf-8")
    return path


def _load_receipt(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON receipt: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("Receipt must be a JSON object.")
    return data


def validate_receipt_data(data: dict[str, Any]) -> tuple[bool, list[str]]:
    errors: list[str] = []
    missing = sorted(REQUIRED_RECEIPT_FIELDS - set(data))
    if missing:
        errors.append(f"missing required field(s): {', '.join(missing)}")

    if "receipt_id" in data and not str(data["receipt_id"]).startswith("sha256:"):
        errors.append("receipt_id must start with sha256:")

    if data.get("status") not in VALID_STATUSES:
        errors.append(f"status must be one of {sorted(VALID_STATUSES)}")

    if data.get("epistemic_tag") not in VALID_TAGS:
        errors.append(f"epistemic_tag must be one of {sorted(VALID_TAGS)}")

    input_hashes = data.get("input_hashes")
    if "input_hashes" in data and not isinstance(input_hashes, list):
        errors.append("input_hashes must be a list")

    invariants = data.get("invariant_results")
    if "invariant_results" in data:
        if not isinstance(invariants, list):
            errors.append("invariant_results must be a list")
        else:
            for index, invariant in enumerate(invariants):
                if not isinstance(invariant, dict):
                    errors.append(f"invariant_results[{index}] must be an object")
                    continue
                if invariant.get("status") not in VALID_STATUSES:
                    errors.append(f"invariant_results[{index}].status must be PASS, WARN, or FAIL")
                if not invariant.get("name"):
                    errors.append(f"invariant_results[{index}].name is required")

    return (not errors, errors)


def validate_receipt_file(path: Path) -> int:
    data = _load_receipt(path)
    ok, errors = validate_receipt_data(data)
    if ok:
        print(f"PASS receipt schema: {path}")
        print(f"operator: {data.get('operator')}")
        print(f"status: {data.get('status')}")
        return 0
    print(f"FAIL receipt schema: {path}", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    return 1


def explain_receipt_file(path: Path) -> int:
    data = _load_receipt(path)
    ok, errors = validate_receipt_data(data)
    if not ok:
        print(f"Cannot explain invalid receipt: {path}", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    invariants = data.get("invariant_results", [])
    passed = sum(1 for item in invariants if item.get("status") == "PASS")
    warned = sum(1 for item in invariants if item.get("status") == "WARN")
    failed = sum(1 for item in invariants if item.get("status") == "FAIL")

    print("Langarian Receipt Explanation")
    print("-----------------------------")
    print(f"receipt: {data.get('receipt_id')}")
    print(f"operator: {data.get('operator')}")
    print(f"status: {data.get('status')}")
    print(f"epistemic tag: {data.get('epistemic_tag')}")
    print(f"metric: {data.get('metric_version')}")
    print(f"inputs: {len(data.get('input_hashes', []))}")
    print(f"output: {data.get('output_hash')}")
    print(f"coherence before: {data.get('coherence_before')}")
    print(f"coherence after: {data.get('coherence_after')}")
    print(f"invariants: {passed} PASS, {warned} WARN, {failed} FAIL")
    print("rule: interpretive claims may appear in receipts, but cannot certify proof")
    return 0


def run_example(path: Path, receipts_dir: Path) -> int:
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    operation = config.get("operation")

    if operation == "basic_369":
        states = [_state_from_config(item) for item in config["states"]]
        sigma3, sigma6, sigma9 = states
        sum_result = harmonic_sum(sigma3, sigma6, glyph="3⊕6", label="sigma_3_6")
        bridge_result = bridge(sum_result.output, sigma9, label="bridge_3_6_to_9")
        phi_result = phi_scale(sum_result.output, n=1, label="sigma_3_6_phi")
        paths = [
            _write_receipt(receipts_dir, "basic_369_harmonic_sum.json", sum_result.receipt.to_json()),
            _write_receipt(receipts_dir, "basic_369_bridge.json", bridge_result.receipt.to_json()),
            _write_receipt(receipts_dir, "basic_369_phi_scale.json", phi_result.receipt.to_json()),
        ]
        print("basic_369 complete")
        for receipt_path in paths:
            print(f"wrote {receipt_path}")
        print(f"bridge coherence: {bridge_result.coherence:.6f}")
        return 0

    if operation == "attenuated_phase_shift":
        state = _state_from_config(config["state"])
        angle = math.radians(float(config.get("angle_degrees", 0.0)))
        result = attenuated_phase_shift(
            state,
            angle,
            attenuation=float(config["attenuation"]),
            cost_label=config.get("cost_label"),
        )
        receipt_path = _write_receipt(receipts_dir, "phase_shift_cost.json", result.receipt.to_json())
        print("attenuated_phase_shift complete")
        print(f"wrote {receipt_path}")
        return 0

    print(f"Unsupported operation: {operation}", file=sys.stderr)
    return 2


def run_program(path: Path, receipts_dir: Path) -> int:
    """Parse and execute a .lang DSL program, writing all receipts."""
    try:
        text = path.read_text(encoding="utf-8")
        prog = parse_dsl(text, program_id=path.stem)
        executed = execute_program(prog)
    except (DSLError, ExecutionError) as exc:
        print(f"Program failed: {exc}", file=sys.stderr)
        return 1

    receipts_dir.mkdir(parents=True, exist_ok=True)
    for i, receipt in enumerate(executed.receipts):
        name = f"{path.stem}_{receipt.operator}_{i:02d}.json"
        out = _write_receipt(receipts_dir, name, receipt.to_json())
        print(f"wrote {out}  [{receipt.status.value}] {receipt.operator}")

    if executed.warnings:
        print("Warnings:")
        for w in executed.warnings:
            print(f"  - {w}")

    if executed.final_state is not None:
        print(f"final resonance: {executed.final_state.resonance:.6f}")
        print(f"final state hash: {executed.final_state.state_hash()}")
    print(f"program {path.name} complete ({len(executed.receipts)} receipts)")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="langarian")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="Run a YAML example and emit receipts.")
    run.add_argument("example", type=Path)
    run.add_argument("--receipts-dir", type=Path, default=Path("receipts"))

    prog_cmd = sub.add_parser("program", help="Parse and execute a Langarian DSL (.lang) program.")
    prog_cmd.add_argument("program", type=Path)
    prog_cmd.add_argument("--receipts-dir", type=Path, default=Path("receipts"))

    validate = sub.add_parser("validate", help="Validate a receipt JSON file.")
    validate.add_argument("receipt", type=Path)

    explain = sub.add_parser("explain", help="Explain a receipt JSON file in plain language.")
    explain.add_argument("receipt", type=Path)

    args = parser.parse_args(argv)
    if args.command == "run":
        return run_example(args.example, args.receipts_dir)
    if args.command == "program":
        return run_program(args.program, args.receipts_dir)
    if args.command == "validate":
        return validate_receipt_file(args.receipt)
    if args.command == "explain":
        return explain_receipt_file(args.receipt)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
