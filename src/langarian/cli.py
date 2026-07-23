"""Small CLI for Langarian example runs and receipt inspection."""

from __future__ import annotations

import argparse
from pathlib import Path
import json
import math
import re
import sys
from typing import Any

import yaml

from .operators import attenuated_phase_shift, bridge, harmonic_sum, phi_scale
from .receipts import atomic_write_text
from .state import ResonantState
from .validation import (
    REQUIRED_RECEIPT_FIELDS,
    VALID_STATUSES,
    VALID_TAGS,
    ReceiptValidation,
)
from .validation import validate_receipt_data as _validate_receipt_levels


def _state_from_config(config: dict) -> ResonantState:
    return ResonantState.from_pairs(
        config["vector"],
        glyph=config.get("glyph"),
        label=config.get("name"),
        metadata=config.get("metadata", {}),
    )


_SAFE_FILENAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\.json")


def _sanitize_receipt_filename(name: str) -> str:
    """Defensive filename check for receipt writes (SPEC section 3.11).

    CLI receipt names are fixed constants today, but a name containing path
    separators, traversal segments, or unexpected characters is rejected
    rather than resolved outside the receipts directory.
    """

    if not isinstance(name, str) or not _SAFE_FILENAME.fullmatch(name) or ".." in name:
        raise ValueError(f"unsafe receipt filename: {name!r}")
    return name


def _write_receipt(receipts_dir: Path, name: str, json_text: str) -> Path:
    receipts_dir.mkdir(parents=True, exist_ok=True)
    return atomic_write_text(receipts_dir / _sanitize_receipt_filename(name), json_text + "\n")


def _load_receipt(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON receipt: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("Receipt must be a JSON object.")
    return data


def validate_receipt_data(data: dict[str, Any]) -> tuple[bool, list[str]]:
    """Compatibility wrapper returning (ok, flat errors) across all levels.

    The full multi-level result is available from
    :func:`langarian.validation.validate_receipt_data`. ``ok`` is True only
    when schema, hash, status, AND version levels all pass; a shape-only pass
    is never reported as verified.
    """

    result = _validate_receipt_levels(data)
    return (result.ok, result.errors_flat())


def validate_receipt_file(path: Path) -> int:
    data = _load_receipt(path)
    result = _validate_receipt_levels(data)
    _print_validation_levels(path, result)
    if result.ok:
        print(f"operator: {data.get('operator')}")
        print(f"status: {data.get('status')}")
        print("verification level: schema + hash + status + version all pass (local consistency; not operation recomputation)")
        return 0
    return 1


def _print_validation_levels(path: Path, result: ReceiptValidation) -> None:
    labels = {
        "schema": "receipt schema (shape only; never called verified)",
        "hash": "receipt hash integrity (content_hash + receipt_id recomputed)",
        "status": "receipt status consistency (collapsed from invariant_results)",
        "version": "receipt version allowlist",
    }
    for level in result.levels:
        label = labels.get(level.name, level.name)
        if level.ok:
            print(f"PASS {label}: {path}")
        else:
            print(f"FAIL {label}: {path}", file=sys.stderr)
            for error in level.errors:
                print(f"- {error}", file=sys.stderr)


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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="langarian")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="Run a YAML example and emit receipts.")
    run.add_argument("example", type=Path)
    run.add_argument("--receipts-dir", type=Path, default=Path("receipts"))

    validate = sub.add_parser("validate", help="Validate a receipt JSON file.")
    validate.add_argument("receipt", type=Path)

    explain = sub.add_parser("explain", help="Explain a receipt JSON file in plain language.")
    explain.add_argument("receipt", type=Path)

    args = parser.parse_args(argv)
    if args.command == "run":
        return run_example(args.example, args.receipts_dir)
    if args.command == "validate":
        try:
            return validate_receipt_file(args.receipt)
        except FileNotFoundError:
            print(f"error: receipt file not found: {args.receipt}", file=sys.stderr)
            return 2
        except (OSError, ValueError) as exc:
            print(f"error: cannot validate receipt {args.receipt}: {exc}", file=sys.stderr)
            return 2
    if args.command == "explain":
        try:
            return explain_receipt_file(args.receipt)
        except FileNotFoundError:
            print(f"error: receipt file not found: {args.receipt}", file=sys.stderr)
            return 2
        except (OSError, ValueError) as exc:
            print(f"error: cannot read receipt {args.receipt}: {exc}", file=sys.stderr)
            return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
