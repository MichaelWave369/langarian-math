"""Proof gate for claim-safe Langarian reasoning.

The proof gate is intentionally small. It does not prove mathematics by itself;
it prevents unsupported proposition types from entering a formal proof context.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from .claims import Claim
from .epistemic import EpistemicTag, ResultStatus


class ProofGateError(ValueError):
    """Raised when a proof context receives an ineligible claim."""


@dataclass(frozen=True)
class ProofGateReport:
    """Result of checking a list of claims for formal proof eligibility."""

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


def evaluate_claims(claims: Iterable[Claim]) -> ProofGateReport:
    """Classify claims as allowed or blocked for formal proof use."""

    allowed: list[Claim] = []
    blocked: list[Claim] = []
    for claim in claims:
        if claim.can_be_used_as_proof():
            allowed.append(claim)
        else:
            blocked.append(claim)
    return ProofGateReport(
        status=ResultStatus.FAIL if blocked else ResultStatus.PASS,
        allowed=tuple(allowed),
        blocked=tuple(blocked),
    )


def require_proof_eligible(claims: Iterable[Claim], *, context: str = "formal_proof") -> ProofGateReport:
    """Require all claims to be formal-proof eligible.

    Allowed tags: FORMAL and COMPUTED.
    Blocked tags: MODEL, INTERPRETIVE, METAPHOR, OBSERVED, FAILED.
    """

    report = evaluate_claims(claims)
    if report.blocked:
        blocked_tags = ", ".join(sorted({claim.tag.value for claim in report.blocked}))
        raise ProofGateError(
            f"Proof gate blocked {len(report.blocked)} claim(s) in {context}: {blocked_tags}. "
            "Promote assumptions explicitly or keep them out of proof context."
        )
    return report


def promote_model_assumption(claim: Claim, *, assumption_id: str, justification: str) -> Claim:
    """Promote a MODEL claim into a COMPUTED/FORMAL-adjacent assumption record.

    This does not make the claim objectively proven. It records that a model
    assumption has been explicitly accepted for a bounded context.
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
