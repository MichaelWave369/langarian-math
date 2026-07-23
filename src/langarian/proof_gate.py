"""Formal-eligibility gate for claim-safe Langarian reasoning.

The public concept is the **Formal Eligibility Gate**. The historical module,
class, and function names retain ``proof_gate`` / ``ProofGate`` for API and
receipt compatibility.

This gate does not prove mathematics by itself. It prevents unsupported
proposition types from entering formal mathematical review. It also makes no
claim that an internally valid formal system describes nature; that separate
question belongs to a future Reality Gate evidence layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from .claims import Claim
from .epistemic import EpistemicTag, ResultStatus


class ProofGateError(ValueError):
    """Raised when formal review receives an ineligible claim."""


@dataclass(frozen=True)
class ProofGateReport:
    """Result of checking claims for formal mathematical review eligibility."""

    status: ResultStatus
    allowed: tuple[Claim, ...] = field(default_factory=tuple)
    blocked: tuple[Claim, ...] = field(default_factory=tuple)

    @property
    def passed(self) -> bool:
        return self.status == ResultStatus.PASS

    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "allowed": [claim.to_dict() for claim in self.allowed],
            "blocked": [claim.to_dict() for claim in self.blocked],
        }


def _is_promoted_model_without_derivation(claim: Claim) -> bool:
    """A claim promoted from MODEL is not formally eligible on its own.

    Promotion via :func:`promote_model_assumption` records an accepted
    assumption; it does not make the content kernel-computed. Such claims are
    blocked from formal mathematical review unless the metadata also carries a
    ``formal_derivation_id`` pointing at an explicit formal derivation.
    (A distinct ASSUMPTION tag is a documented future addition.)
    """

    return claim.metadata.get("promoted_from") == EpistemicTag.MODEL.value and not claim.metadata.get("formal_derivation_id")


def evaluate_claims(claims: Iterable[Claim]) -> ProofGateReport:
    """Classify claims as allowed or blocked for formal mathematical review.

    Blocked: non-eligible tags, and any claim with
    ``metadata.promoted_from == "MODEL"`` that lacks a
    ``metadata.formal_derivation_id``.

    A PASS means only that the claims are eligible to enter formal review. It
    is not a proof result and is not evidence that the model describes nature.
    """

    allowed: list[Claim] = []
    blocked: list[Claim] = []
    for claim in claims:
        if claim.can_be_used_as_proof() and not _is_promoted_model_without_derivation(claim):
            allowed.append(claim)
        else:
            blocked.append(claim)
    return ProofGateReport(
        status=ResultStatus.FAIL if blocked else ResultStatus.PASS,
        allowed=tuple(allowed),
        blocked=tuple(blocked),
    )


def require_proof_eligible(claims: Iterable[Claim], *, context: str = "formal_proof") -> ProofGateReport:
    """Require all claims to be eligible for formal mathematical review.

    Allowed tags: FORMAL and COMPUTED.
    Blocked tags: MODEL, INTERPRETIVE, METAPHOR, OBSERVED, FAILED.
    Additionally blocked regardless of tag: claims with
    ``metadata.promoted_from == "MODEL"`` that lack a
    ``metadata.formal_derivation_id``.

    The historical function name remains for compatibility. Success means
    formal eligibility only; it does not mean that a theorem has been proved.
    """

    report = evaluate_claims(claims)
    if report.blocked:
        blocked_tags = ", ".join(sorted({claim.tag.value for claim in report.blocked}))
        raise ProofGateError(
            f"Formal Eligibility Gate blocked {len(report.blocked)} claim(s) in {context}: {blocked_tags}. "
            "Promote assumptions explicitly or keep them out of formal review."
        )
    return report


def promote_model_assumption(claim: Claim, *, assumption_id: str, justification: str) -> Claim:
    """Promote a MODEL claim into a COMPUTED/FORMAL-adjacent assumption record.

    This does not make the claim objectively proven or empirically supported.
    It records that a model assumption has been explicitly accepted for a
    bounded formal context.
    """

    if claim.tag != EpistemicTag.MODEL:
        raise ProofGateError("Only MODEL claims can be promoted as explicit assumptions.")
    if not assumption_id or not justification:
        raise ProofGateError("Promoted assumptions require assumption_id and justification.")
    return Claim(
        text=f"Assumption {assumption_id}: {claim.text}",
        tag=EpistemicTag.COMPUTED,
        evidence=claim.evidence,
        metadata={
            **claim.metadata,
            "promoted_from": claim.tag.value,
            "assumption_id": assumption_id,
            "justification": justification,
        },
    )
