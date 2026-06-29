"""Tiny glyph dictionary stub for v0.2.

Glyphs are labels in the trunk kernel. A future research lane may promote them
into basis elements, dictionaries, or RKHS-style structures after tests justify it.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .state import ResonantState
from .metrics import normalized_complex_similarity


@dataclass(frozen=True)
class GlyphEntry:
    glyph: str
    state: ResonantState
    description: str = ""


class GlyphDictionary:
    def __init__(self) -> None:
        self._entries: dict[str, GlyphEntry] = {}

    def add(self, glyph: str, vector: np.ndarray, description: str = "") -> None:
        self._entries[glyph] = GlyphEntry(glyph, ResonantState(vector=vector, glyph=glyph, label=f"glyph:{glyph}"), description)

    def nearest(self, state: ResonantState) -> GlyphEntry | None:
        """Return the nearest glyph entry by v0.2 normalized complex similarity."""

        result = self.nearest_with_score(state)
        return None if result is None else result[0]

    def nearest_with_score(self, state: ResonantState) -> tuple[GlyphEntry, float] | None:
        """Return ``(entry, score)`` for the nearest glyph.

        This is a useful harvest from Kimi's dictionary idea, but it stays
        claim-safe: the score is only a finite-vector similarity calculation,
        not proof of RKHS completeness or symbolic truth.
        """

        if not self._entries:
            return None
        scored = [
            (entry, normalized_complex_similarity(state, entry.state))
            for entry in self._entries.values()
        ]
        return max(scored, key=lambda item: item[1])

    def labels(self) -> list[str]:
        return sorted(self._entries)
