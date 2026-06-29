"""Operation receipts and stable hashing."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import hashlib
import json

from .claims import Claim
from .contracts import InvariantResult
from .epistemic import EpistemicTag, ResultStatus, combine_statuses
from .metrics import METRIC_VERSION
from .state import KERNEL_VERSION


def canonical_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


@dataclass(frozen=True)
class OperationReceipt:
    """Immutable record of one kernel operation."""

    operator: str
    input_hashes: list[str]
    output_hash: str
    parameters: dict[str, Any] = field(default_factory=dict)
    coherence_before: float | None = None
    coherence_after: float | None = None
    invariant_results: list[InvariantResult] = field(default_factory=list)
    epistemic_tag: EpistemicTag = EpistemicTag.COMPUTED
    claims: list[Claim] = field(default_factory=list)
    timestamp_utc: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def status(self) -> ResultStatus:
        if self.epistemic_tag == EpistemicTag.FAILED:
            return ResultStatus.FAIL
        return combine_statuses([result.status for result in self.invariant_results])

    def body(self, include_receipt_id: bool = False) -> dict[str, Any]:
        body = {
            "kernel_version": KERNEL_VERSION,
            "metric_version": METRIC_VERSION,
            "timestamp_utc": self.timestamp_utc,
            "operator": self.operator,
            "input_hashes": self.input_hashes,
            "output_hash": self.output_hash,
            "parameters": self.parameters,
            "coherence_before": self.coherence_before,
            "coherence_after": self.coherence_after,
            "invariant_results": [result.to_dict() for result in self.invariant_results],
            "status": self.status.value,
            "epistemic_tag": self.epistemic_tag.value,
            "claims": [claim.to_dict() for claim in self.claims],
        }
        if include_receipt_id:
            body["receipt_id"] = self.receipt_id()
        return body

    def receipt_id(self) -> str:
        payload = canonical_json(self.body(include_receipt_id=False)).encode("utf-8")
        return "sha256:" + hashlib.sha256(payload).hexdigest()

    def to_json(self) -> str:
        return json.dumps(self.body(include_receipt_id=True), indent=2, sort_keys=True, ensure_ascii=False, default=str)

    def write_json(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.to_json())
            f.write("\n")
