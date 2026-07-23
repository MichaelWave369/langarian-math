"""Operation receipts and stable hashing."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import hashlib
import json
import os
import tempfile

from .claims import Claim
from .contracts import InvariantResult
from .epistemic import EpistemicTag, ResultStatus, combine_statuses
from .version import KERNEL_VERSION, METRIC_VERSION, RECEIPT_SCHEMA_VERSION


def canonical_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha256_json(data: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(data).encode("utf-8")).hexdigest()


def atomic_write_text(path: str | Path, text: str) -> Path:
    """Write ``text`` to ``path`` atomically (tmp file in the same directory + rename).

    A crash mid-write can never leave a truncated receipt at ``path``; the
    temporary file is cleaned up on failure. SPEC section 3.11.
    """

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_name, path)
    except BaseException:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
    return path


@dataclass(frozen=True)
class OperationReceipt:
    """Immutable record of one kernel operation.

    Two distinct identities are provided:

    - ``content_hash()``: deterministic mathematical identity of the
      operation record. It excludes ``timestamp_utc`` and ``receipt_id``, so
      identical operations at any time produce the same content hash. Lineage
      uses this for mathematical identity.
    - ``receipt_id()``: emission-event identity. It includes ``timestamp_utc``,
      so each emission is unique even for identical operations. Ledgers use
      this for audit events. It is not a content hash.
    """

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
            "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
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
            body["content_hash"] = self.content_hash()
            body["receipt_id"] = self.receipt_id()
        return body

    def content_hash(self) -> str:
        """Deterministic content identity; excludes timestamp and receipt_id."""

        body = self.body(include_receipt_id=False)
        body.pop("timestamp_utc", None)
        return _sha256_json(body)

    def receipt_id(self) -> str:
        """Emission-event identity; includes timestamp_utc (unique per emission)."""

        return _sha256_json(self.body(include_receipt_id=False))

    def to_json(self) -> str:
        return json.dumps(self.body(include_receipt_id=True), indent=2, sort_keys=True, ensure_ascii=False, default=str)

    def write_json(self, path: str) -> None:
        atomic_write_text(path, self.to_json() + "\n")
