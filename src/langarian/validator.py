"""Validator helpers for receipts and states."""

from __future__ import annotations

from dataclasses import dataclass

from .contracts import InvariantResult, well_typed_state, coherence_bound, interpretation_quarantine
from .epistemic import ResultStatus, combine_statuses
from .metrics import normalized_complex_similarity
from .receipts import OperationReceipt
from .state import ResonantState


@dataclass(frozen=True)
class ValidationReport:
    status: ResultStatus
    checks: list[InvariantResult]

    def to_dict(self) -> dict:
        return {"status": self.status.value, "checks": [check.to_dict() for check in self.checks]}


def validate_state(state: ResonantState) -> ValidationReport:
    checks = [well_typed_state(state), coherence_bound(normalized_complex_similarity(state, state))]
    return ValidationReport(combine_statuses([check.status for check in checks]), checks)


def validate_receipt(receipt: OperationReceipt) -> ValidationReport:
    checks = list(receipt.invariant_results)
    checks.append(interpretation_quarantine([claim.tag.value for claim in receipt.claims if not claim.can_be_used_as_proof()]))
    return ValidationReport(combine_statuses([check.status for check in checks]), checks)
