"""Small CLI for Langarian example runs."""

from __future__ import annotations

import argparse
from pathlib import Path
import math
import sys

import yaml

from .operators import attenuated_phase_shift, bridge, harmonic_sum, phi_scale
from .state import ResonantState


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
    run = sub.add_parser("run")
    run.add_argument("example", type=Path)
    run.add_argument("--receipts-dir", type=Path, default=Path("receipts"))
    args = parser.parse_args(argv)
    if args.command == "run":
        return run_example(args.example, args.receipts_dir)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
