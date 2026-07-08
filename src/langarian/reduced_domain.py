"""Generic reduced-domain helpers for finite numerical boundary checks.

This module provides small receipt-bearing tools for checking finite samples
against explicit scalar domain rules. It is intentionally project-neutral: it
records computations and PASS/WARN/FAIL receipts, but it does not assert any
physics interpretation or promote a larger theory.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
import hashlib
import math
from typing import Any

from .claims import Claim
from .contracts import InvariantResult, interpretation_quarantine
from .epistemic import EpistemicTag, ResultStatus
from .receipts import OperationReceipt, canonical_json

REDUCED_DOMAIN_VERSION = "reduced-domain:v0.1"
REQUIRED_REDUCED_SYMBOLS = (
    "coordinate",
    "momentum",
    "angle",
    "angle_momentum",
    "lapse_like_parameter",
    "gamma_like_parameter",
    "reduced_constraint",
    "B(t)",
)


def _finite_float(value: Any, name: str) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a finite number.") from exc
    if not math.isfinite(out):
        raise ValueError(f"{name} must be finite.")
    return out


def _lookup(mapping: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in mapping:
            return mapping[key]
    joined = ", ".join(keys)
    raise ValueError(f"sample is missing one of: {joined}")


def _hash_payload(payload: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class BracketSample:
    """One finite sample for a bracket-wall domain screen."""

    t: float
    kappa: float
    c: float
    v_gamma_gamma: float

    def __post_init__(self) -> None:
        _finite_float(self.t, "t")
        _finite_float(self.kappa, "kappa")
        _finite_float(self.c, "c")
        _finite_float(self.v_gamma_gamma, "v_gamma_gamma")

    @property
    def bracket_value(self) -> float:
        return bracket_wall_value(self.kappa, self.c, self.v_gamma_gamma)

    def to_dict(self) -> dict[str, float]:
        return {
            "t": float(self.t),
            "kappa": float(self.kappa),
            "c": float(self.c),
            "v_gamma_gamma": float(self.v_gamma_gamma),
            "B_t": self.bracket_value,
        }

    @classmethod
    def from_mapping(cls, data: Mapping[str, Any]) -> "BracketSample":
        return cls(
            t=_finite_float(_lookup(data, "t", "time"), "t"),
            kappa=_finite_float(_lookup(data, "kappa", "κ"), "kappa"),
            c=_finite_float(_lookup(data, "c"), "c"),
            v_gamma_gamma=_finite_float(
                _lookup(data, "v_gamma_gamma", "V_gamma_gamma", "Vgg", "curvature"),
                "v_gamma_gamma",
            ),
        )


@dataclass(frozen=True)
class BracketWallScan:
    """Receipt-bearing result of a finite bracket-wall scan."""

    samples: tuple[BracketSample, ...]
    min_bracket_value: float
    violating_indices: tuple[int, ...]
    receipt: OperationReceipt

    @property
    def is_safe(self) -> bool:
        return len(self.violating_indices) == 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain_version": REDUCED_DOMAIN_VERSION,
            "sample_count": len(self.samples),
            "min_bracket_value": self.min_bracket_value,
            "violating_indices": list(self.violating_indices),
            "status": self.receipt.status.value,
            "receipt_id": self.receipt.receipt_id(),
        }


def bracket_wall_value(kappa: float, c: float, v_gamma_gamma: float) -> float:
    """Compute B(t) for supplied finite scalar values."""

    kappa_f = _finite_float(kappa, "kappa")
    c_f = _finite_float(c, "c")
    vgg_f = _finite_float(v_gamma_gamma, "v_gamma_gamma")
    return float(1.0 - 6.0 * (kappa_f**2) * (c_f**2) * vgg_f)


def _domain_invariant(values: tuple[float, ...], violations: tuple[int, ...], *, strict: bool) -> InvariantResult:
    rule = "B(t) > 0" if strict else "B(t) >= 0"
    if violations:
        return InvariantResult(
            "D3.bracket_wall_domain",
            ResultStatus.FAIL,
            f"One or more samples violate the requested domain rule {rule}.",
            value={"rule": rule, "min_B_t": min(values), "violating_indices": list(violations)},
        )
    if not strict and any(math.isclose(value, 0.0, abs_tol=1e-12) for value in values):
        return InvariantResult(
            "D3.bracket_wall_domain",
            ResultStatus.WARN,
            "At least one sample touches the bracket wall boundary B(t)=0.",
            value={"rule": rule, "min_B_t": min(values)},
        )
    return InvariantResult(
        "D3.bracket_wall_domain",
        ResultStatus.PASS,
        f"All supplied samples satisfy {rule}.",
        value={"rule": rule, "min_B_t": min(values)},
    )


def scan_bracket_wall(
    samples: Sequence[BracketSample | Mapping[str, Any]],
    *,
    strict: bool = True,
    label: str | None = None,
) -> BracketWallScan:
    """Scan finite samples for a reduced bracket-wall domain rule.

    A PASS receipt means the supplied finite samples satisfy the selected
    inequality. It does not prove a global theorem, validate a larger model, or
    certify physical dynamics.
    """

    parsed = tuple(sample if isinstance(sample, BracketSample) else BracketSample.from_mapping(sample) for sample in samples)
    if not parsed:
        raise ValueError("scan_bracket_wall requires at least one sample.")

    values = tuple(sample.bracket_value for sample in parsed)
    if strict:
        violations = tuple(index for index, value in enumerate(values) if value <= 0.0)
    else:
        violations = tuple(index for index, value in enumerate(values) if value < 0.0)

    sample_payload = [sample.to_dict() for sample in parsed]
    input_hash = _hash_payload(
        {
            "domain_version": REDUCED_DOMAIN_VERSION,
            "samples": sample_payload,
        }
    )
    output_payload = {
        "operator": "bracket_wall_scan",
        "strict": bool(strict),
        "label": label,
        "sample_count": len(parsed),
        "min_bracket_value": min(values),
        "violating_indices": list(violations),
    }
    output_hash = _hash_payload(output_payload)

    invariants = [
        InvariantResult(
            "D1.reduced_symbol_custody",
            ResultStatus.PASS,
            "Reduced-domain symbols are named under custody; no new degree of freedom is introduced by this scan.",
            value=list(REQUIRED_REDUCED_SYMBOLS),
        ),
        InvariantResult(
            "D2.finite_numeric_samples",
            ResultStatus.PASS,
            "All supplied samples are finite numeric scalars.",
            value=len(parsed),
        ),
        _domain_invariant(values, violations, strict=bool(strict)),
        interpretation_quarantine([EpistemicTag.MODEL.value]),
    ]

    receipt = OperationReceipt(
        operator="bracket_wall_scan",
        input_hashes=[input_hash],
        output_hash=output_hash,
        parameters={
            "domain_version": REDUCED_DOMAIN_VERSION,
            "strict": bool(strict),
            "label": label,
            "samples": sample_payload,
        },
        coherence_before=None,
        coherence_after=None,
        invariant_results=invariants,
        epistemic_tag=EpistemicTag.MODEL,
        claims=[
            Claim(
                "Bracket-wall values were computed from supplied finite samples as a reduced-domain screen, not as proof of a larger model.",
                EpistemicTag.MODEL,
            )
        ],
    )

    return BracketWallScan(
        samples=parsed,
        min_bracket_value=float(min(values)),
        violating_indices=violations,
        receipt=receipt,
    )
