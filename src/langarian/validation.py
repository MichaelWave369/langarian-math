"""Shared receipt validation levels for Langarian Math Workbench v0.3.

Receipt validation is split into four distinct, separately reported levels:

- ``schema``: the receipt is shaped like a Langarian receipt (required fields,
  types, known enum values, at least one invariant result). When present,
  ``timestamp_utc`` must be an ISO-8601 UTC timestamp
  (``YYYY-MM-DDTHH:MM:SS[.ffffff](Z|+HH:MM)``); a non-ISO timestamp fails this
  level on import/validation (the TS ledger quarantines the same condition —
  Python treats it as a schema-level failure so CLI ``validate`` rejects it).
  Passing this level alone is a *shape-only* check and must never be labeled
  "verified".
- ``hash``: ``content_hash`` and ``receipt_id`` are recomputed from the body
  and must match the recorded values (tamper detection).
- ``status``: the recorded ``status`` must equal the status recomputed by
  collapsing ``invariant_results`` (with the empty-invariants => FAIL rule and
  the FAILED epistemic tag override).
- ``version``: ``kernel_version``, ``metric_version``, and
  ``receipt_schema_version`` must be in the current allowlists; older or
  unknown versions are rejected (no silent downgrade acceptance).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .epistemic import EpistemicTag, ResultStatus, combine_statuses
from .receipts import canonical_json
from .version import (
    ALLOWED_KERNEL_VERSIONS,
    ALLOWED_METRIC_VERSIONS,
    ALLOWED_RECEIPT_SCHEMA_VERSIONS,
)
import hashlib
import re

# Same pattern as the TS ledger (web/src/ledger/ledger.ts ISO_8601_UTC):
# ISO-8601 with seconds precision and an explicit UTC offset or Z.
ISO_8601_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")

REQUIRED_RECEIPT_FIELDS = {
    "receipt_id",
    "content_hash",
    "kernel_version",
    "metric_version",
    "receipt_schema_version",
    "operator",
    "input_hashes",
    "output_hash",
    "invariant_results",
    "status",
    "epistemic_tag",
}
VALID_STATUSES = {"PASS", "WARN", "FAIL"}
VALID_TAGS = {"FORMAL", "COMPUTED", "MODEL", "INTERPRETIVE", "METAPHOR", "OBSERVED", "FAILED"}

LEVEL_SCHEMA = "schema"
LEVEL_HASH = "hash"
LEVEL_STATUS = "status"
LEVEL_VERSION = "version"
LEVEL_ORDER = (LEVEL_SCHEMA, LEVEL_HASH, LEVEL_STATUS, LEVEL_VERSION)

_IDENTITY_FIELDS = {"receipt_id", "content_hash"}


@dataclass(frozen=True)
class ValidationLevel:
    """Outcome of one validation level."""

    name: str
    ok: bool
    errors: tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "ok": self.ok, "errors": list(self.errors)}


@dataclass(frozen=True)
class ReceiptValidation:
    """Full multi-level validation result for one receipt."""

    levels: tuple[ValidationLevel, ...]

    @property
    def ok(self) -> bool:
        return all(level.ok for level in self.levels)

    @property
    def schema_only_ok(self) -> bool:
        """True when only the schema level passed — NOT verification."""

        by_name = {level.name: level.ok for level in self.levels}
        return by_name.get(LEVEL_SCHEMA, False) and not self.ok

    def level(self, name: str) -> ValidationLevel:
        for level in self.levels:
            if level.name == name:
                return level
        raise KeyError(name)

    def errors_flat(self) -> list[str]:
        return [f"{level.name}: {error}" for level in self.levels for error in level.errors]

    def to_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "levels": [level.to_dict() for level in self.levels]}


def _hash_json(data: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(data).encode("utf-8")).hexdigest()


def recompute_content_hash(data: dict[str, Any]) -> str:
    """Recompute the deterministic content hash from a parsed receipt body."""

    body = {key: value for key, value in data.items() if key not in _IDENTITY_FIELDS and key != "timestamp_utc"}
    return _hash_json(body)


def recompute_receipt_id(data: dict[str, Any]) -> str:
    """Recompute the emission identity (includes timestamp_utc)."""

    body = {key: value for key, value in data.items() if key not in _IDENTITY_FIELDS}
    return _hash_json(body)


def recompute_status(data: dict[str, Any]) -> str | None:
    """Recompute the collapsed status from invariant_results, or None if unshaped."""

    invariants = data.get("invariant_results")
    if not isinstance(invariants, list) or any(not isinstance(item, dict) for item in invariants):
        return None
    if data.get("epistemic_tag") == EpistemicTag.FAILED.value:
        return ResultStatus.FAIL.value
    statuses: list[ResultStatus] = []
    for item in invariants:
        raw = item.get("status")
        if raw not in VALID_STATUSES:
            return None
        statuses.append(ResultStatus(raw))
    return combine_statuses(statuses).value


def _schema_level(data: dict[str, Any]) -> ValidationLevel:
    errors: list[str] = []
    missing = sorted(REQUIRED_RECEIPT_FIELDS - set(data))
    if missing:
        errors.append(f"missing required field(s): {', '.join(missing)}")

    if "receipt_id" in data and not str(data["receipt_id"]).startswith("sha256:"):
        errors.append("receipt_id must start with sha256:")
    if "content_hash" in data and not str(data["content_hash"]).startswith("sha256:"):
        errors.append("content_hash must start with sha256:")

    if data.get("status") not in VALID_STATUSES:
        errors.append(f"status must be one of {sorted(VALID_STATUSES)}")

    if data.get("epistemic_tag") not in VALID_TAGS:
        errors.append(f"epistemic_tag must be one of {sorted(VALID_TAGS)}")

    if "timestamp_utc" in data:
        timestamp = data["timestamp_utc"]
        if not isinstance(timestamp, str) or not ISO_8601_UTC.match(timestamp):
            errors.append(
                "timestamp_utc must be ISO-8601 UTC format "
                "(YYYY-MM-DDTHH:MM:SS[.ffffff](Z|+HH:MM)); "
                "ledger ordering by time is unverified"
            )

    input_hashes = data.get("input_hashes")
    if "input_hashes" in data:
        if not isinstance(input_hashes, list):
            errors.append("input_hashes must be a list")
        elif not input_hashes:
            errors.append("input_hashes must be non-empty")

    invariants = data.get("invariant_results")
    if "invariant_results" in data:
        if not isinstance(invariants, list):
            errors.append("invariant_results must be a list")
        elif not invariants:
            errors.append("invariant_results must contain at least one check; empty invariants never mean PASS")
        else:
            for index, invariant in enumerate(invariants):
                if not isinstance(invariant, dict):
                    errors.append(f"invariant_results[{index}] must be an object")
                    continue
                if invariant.get("status") not in VALID_STATUSES:
                    errors.append(f"invariant_results[{index}].status must be PASS, WARN, or FAIL")
                if not invariant.get("name"):
                    errors.append(f"invariant_results[{index}].name is required")

    return ValidationLevel(LEVEL_SCHEMA, not errors, tuple(errors))


def _hash_level(data: dict[str, Any]) -> ValidationLevel:
    errors: list[str] = []
    try:
        expected_content = recompute_content_hash(data)
    except (TypeError, ValueError) as exc:
        errors.append(f"body cannot be canonically hashed: {exc}")
        return ValidationLevel(LEVEL_HASH, False, tuple(errors))
    recorded_content = data.get("content_hash")
    if recorded_content is None:
        errors.append("content_hash is missing; cannot verify body integrity")
    elif recorded_content != expected_content:
        errors.append("content_hash mismatch: body was tampered with or not kernel-generated")
    recorded_id = data.get("receipt_id")
    if recorded_id is None:
        errors.append("receipt_id is missing")
    else:
        expected_id = recompute_receipt_id(data)
        if recorded_id != expected_id:
            errors.append("receipt_id mismatch: emission identity does not match body + timestamp")
    return ValidationLevel(LEVEL_HASH, not errors, tuple(errors))


def _status_level(data: dict[str, Any]) -> ValidationLevel:
    recomputed = recompute_status(data)
    if recomputed is None:
        return ValidationLevel(LEVEL_STATUS, False, ("invariant_results are not shaped well enough to recompute status",))
    recorded = data.get("status")
    if recorded != recomputed:
        return ValidationLevel(
            LEVEL_STATUS,
            False,
            (f"status mismatch: recorded {recorded!r} but invariant_results collapse to {recomputed!r}",),
        )
    return ValidationLevel(LEVEL_STATUS, True, ())


def _version_level(data: dict[str, Any]) -> ValidationLevel:
    errors: list[str] = []
    kernel_version = data.get("kernel_version")
    if kernel_version not in ALLOWED_KERNEL_VERSIONS:
        errors.append(f"kernel_version {kernel_version!r} is not in the allowlist {sorted(ALLOWED_KERNEL_VERSIONS)}")
    metric_version = data.get("metric_version")
    if metric_version not in ALLOWED_METRIC_VERSIONS:
        errors.append(f"metric_version {metric_version!r} is not in the allowlist {sorted(ALLOWED_METRIC_VERSIONS)}")
    schema_version = data.get("receipt_schema_version")
    if schema_version not in ALLOWED_RECEIPT_SCHEMA_VERSIONS:
        errors.append(
            f"receipt_schema_version {schema_version!r} is not in the allowlist {sorted(ALLOWED_RECEIPT_SCHEMA_VERSIONS)}"
        )
    return ValidationLevel(LEVEL_VERSION, not errors, tuple(errors))


def validate_receipt_data(data: dict[str, Any]) -> ReceiptValidation:
    """Validate a parsed receipt at all four levels (schema/hash/status/version).

    Note: even full success is local consistency verification, not
    recomputation of the underlying mathematical operation.
    """

    if not isinstance(data, dict):
        level = ValidationLevel(LEVEL_SCHEMA, False, ("receipt must be a JSON object",))
        return ReceiptValidation((level,))
    return ReceiptValidation(
        (
            _schema_level(data),
            _hash_level(data),
            _status_level(data),
            _version_level(data),
        )
    )


__all__ = [
    "ISO_8601_UTC",
    "REQUIRED_RECEIPT_FIELDS",
    "VALID_STATUSES",
    "VALID_TAGS",
    "LEVEL_SCHEMA",
    "LEVEL_HASH",
    "LEVEL_STATUS",
    "LEVEL_VERSION",
    "LEVEL_ORDER",
    "ValidationLevel",
    "ReceiptValidation",
    "recompute_content_hash",
    "recompute_receipt_id",
    "recompute_status",
    "validate_receipt_data",
]
