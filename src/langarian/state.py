"""Finite complex vector states for the v0.2 formal kernel candidate."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable
import hashlib
import json

import numpy as np

KERNEL_VERSION = "langarian-python-ref-v0.1.1"


def _complex_to_pair(z: complex) -> list[float]:
    return [float(np.real(z)), float(np.imag(z))]


def _canonical_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


@dataclass(frozen=True)
class ResonantState:
    """A typed finite-dimensional state.

    The state vector is the formal object. Resonance, phase, and coherence are
    derived from it by functions in the kernel.
    """

    vector: np.ndarray
    glyph: str | None = None
    label: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    history: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        vector = np.asarray(self.vector, dtype=np.complex128).reshape(-1)
        object.__setattr__(self, "vector", vector)
        if not np.all(np.isfinite(vector.real)) or not np.all(np.isfinite(vector.imag)):
            raise ValueError("State vector must contain only finite complex values.")
        if self.glyph is not None and not isinstance(self.glyph, str):
            raise TypeError("glyph must be a string or None.")
        if self.label is not None and not isinstance(self.label, str):
            raise TypeError("label must be a string or None.")

    @property
    def dim(self) -> int:
        return int(self.vector.shape[0])

    @property
    def resonance(self) -> float:
        return float(np.linalg.norm(self.vector))

    @property
    def phase(self) -> float:
        """A simple global phase estimate.

        For the zero vector, phase is defined as 0 for totality and predictable
        receipts. This is a convention, not a physical claim.
        """

        if self.resonance == 0.0:
            return 0.0
        total = np.sum(self.vector)
        if abs(total) > 0:
            return float(np.angle(total) % (2 * np.pi))
        idx = int(np.argmax(np.abs(self.vector)))
        return float(np.angle(self.vector[idx]) % (2 * np.pi))

    def canonical_payload(self) -> dict[str, Any]:
        return {
            "kernel_version": KERNEL_VERSION,
            "label": self.label,
            "glyph": self.glyph,
            "vector": [_complex_to_pair(z) for z in self.vector],
            "metadata": self.metadata,
            "history": list(self.history),
        }

    def state_hash(self) -> str:
        payload = _canonical_json(self.canonical_payload()).encode("utf-8")
        return "sha256:" + hashlib.sha256(payload).hexdigest()

    def with_history(self, receipt_id: str) -> "ResonantState":
        return ResonantState(
            vector=self.vector.copy(),
            glyph=self.glyph,
            label=self.label,
            metadata=dict(self.metadata),
            history=self.history + (receipt_id,),
        )

    @classmethod
    def from_pairs(
        cls,
        pairs: Iterable[Iterable[float]],
        *,
        glyph: str | None = None,
        label: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "ResonantState":
        """Build from [[real, imag], ...] pairs."""

        vector = np.array([complex(float(r), float(i)) for r, i in pairs], dtype=np.complex128)
        return cls(vector=vector, glyph=glyph, label=label, metadata=metadata or {})


def pad_to_common_dim(a: ResonantState, b: ResonantState) -> tuple[np.ndarray, np.ndarray]:
    """Return copies of two vectors padded to a common dimension."""

    dim = max(a.dim, b.dim)
    av = np.zeros(dim, dtype=np.complex128)
    bv = np.zeros(dim, dtype=np.complex128)
    av[: a.dim] = a.vector
    bv[: b.dim] = b.vector
    return av, bv
