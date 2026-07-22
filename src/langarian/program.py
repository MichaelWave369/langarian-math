"""Multi-step calculation programs for the Langarian Workbench.

A Program is an ordered sequence of typed steps. Each step that changes state
emits a receipt. The program itself can be serialized and re-executed under
the same kernel version to verify reproducibility.

This module is intentionally minimal for v0.3 foundation. The safe DSL will
compile into Program instances. No arbitrary code execution occurs here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Sequence
import json

from .receipts import OperationReceipt, canonical_json
from .state import ResonantState, KERNEL_VERSION

PROGRAM_SCHEMA_VERSION = "program-schema:v0.3.0"


@dataclass(frozen=True)
class ProgramStep:
    """One step in a calculation program."""

    step_id: str
    operator: str
    input_refs: list[str]          # prior step_ids or initial state labels
    parameters: dict[str, Any] = field(default_factory=dict)
    label: str | None = None
    notes: str | None = None       # free-text, never formal


@dataclass
class Program:
    """Ordered multi-step calculation with full lineage."""

    program_id: str
    title: str | None = None
    steps: list[ProgramStep] = field(default_factory=list)
    initial_states: dict[str, ResonantState] = field(default_factory=dict)
    # Runtime results (populated by execution)
    results: dict[str, ResonantState] = field(default_factory=dict)
    receipts: list[OperationReceipt] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    kernel_version: str = KERNEL_VERSION
    schema_version: str = PROGRAM_SCHEMA_VERSION

    def add_step(self, step: ProgramStep) -> None:
        if any(s.step_id == step.step_id for s in self.steps):
            raise ValueError(f"Duplicate step_id: {step.step_id}")
        self.steps.append(step)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "kernel_version": self.kernel_version,
            "program_id": self.program_id,
            "title": self.title,
            "initial_states": {
                label: state.canonical_payload()
                for label, state in self.initial_states.items()
            },
            "steps": [
                {
                    "step_id": s.step_id,
                    "operator": s.operator,
                    "input_refs": s.input_refs,
                    "parameters": s.parameters,
                    "label": s.label,
                    "notes": s.notes,
                }
                for s in self.steps
            ],
            "warnings": list(self.warnings),
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, sort_keys=True, ensure_ascii=False, default=str)

    @property
    def final_state(self) -> ResonantState | None:
        if not self.steps:
            return None
        last_id = self.steps[-1].step_id
        return self.results.get(last_id)


def empty_program(program_id: str, title: str | None = None) -> Program:
    return Program(program_id=program_id, title=title)
