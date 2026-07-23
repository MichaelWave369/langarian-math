"""Epistemic tags for Langarian Math.

The kernel can compute, validate, and record symbolic transformations. It does
not allow interpretive or metaphorical claims to masquerade as formal proof.
"""

from __future__ import annotations

from enum import Enum


class EpistemicTag(str, Enum):
    """Per-proposition epistemic status."""

    FORMAL = "FORMAL"
    COMPUTED = "COMPUTED"
    MODEL = "MODEL"
    INTERPRETIVE = "INTERPRETIVE"
    METAPHOR = "METAPHOR"
    OBSERVED = "OBSERVED"
    FAILED = "FAILED"

    @property
    def proof_eligible(self) -> bool:
        """Whether this tag may be used as formal proof input."""

        return self in {EpistemicTag.FORMAL, EpistemicTag.COMPUTED}


class ResultStatus(str, Enum):
    """Receipt-level status."""

    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"


def combine_statuses(statuses: list[ResultStatus]) -> ResultStatus:
    """Collapse invariant statuses into one receipt status.

    An empty invariant list collapses to FAIL, not PASS: "no checks ran" must
    never read as "all checks passed".
    """

    if not statuses:
        return ResultStatus.FAIL
    if any(status == ResultStatus.FAIL for status in statuses):
        return ResultStatus.FAIL
    if any(status == ResultStatus.WARN for status in statuses):
        return ResultStatus.WARN
    return ResultStatus.PASS
