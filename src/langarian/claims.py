"""Tagged proposition records."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .epistemic import EpistemicTag


@dataclass(frozen=True)
class Claim:
    """A statement emitted by the kernel or attached by a domain layer."""

    text: str
    tag: EpistemicTag
    evidence: tuple[str, ...] = field(default_factory=tuple)
    metadata: dict[str, Any] = field(default_factory=dict)

    def can_be_used_as_proof(self) -> bool:
        """Only formal/computed claims can serve as proof inputs."""

        return self.tag.proof_eligible

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "tag": self.tag.value,
            "evidence": list(self.evidence),
            "metadata": self.metadata,
        }
