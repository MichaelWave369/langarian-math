"""Finite space helpers for Langarian Math.

This module harvests the useful part of Kimi's Hilbert-space abstraction while
keeping the v0.2.1 trunk claim-safe: this is a finite complex vector space
utility, not a proof of infinite-dimensional Hilbert, RKHS, or physics claims.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class FiniteComplexSpace:
    """A small wrapper for C^n with the standard complex inner product.

    The existing :class:`ResonantState` remains the trunk state object. This
    helper gives future operators a shared place for dimension checks, inner
    products, norms, and zero vectors without changing the stable API.
    """

    dim: int
    label: str = "finite_complex_space"

    def __post_init__(self) -> None:
        if self.dim < 1:
            raise ValueError("FiniteComplexSpace dim must be >= 1.")

    def zero(self) -> np.ndarray:
        """Return the lawful zero vector for this finite space."""

        return np.zeros(self.dim, dtype=np.complex128)

    def coerce(self, vector: np.ndarray) -> np.ndarray:
        """Coerce a vector to this space, rejecting dimension mismatch."""

        arr = np.asarray(vector, dtype=np.complex128).reshape(-1)
        if arr.shape[0] != self.dim:
            raise ValueError(f"Expected dimension {self.dim}, got {arr.shape[0]}.")
        if not np.all(np.isfinite(arr.real)) or not np.all(np.isfinite(arr.imag)):
            raise ValueError("Vector contains non-finite values.")
        return arr

    def inner(self, a: np.ndarray, b: np.ndarray) -> complex:
        """Standard complex inner product <a,b> = conjugate(a) dot b."""

        av = self.coerce(a)
        bv = self.coerce(b)
        return complex(np.vdot(av, bv))

    def norm(self, vector: np.ndarray) -> float:
        """Euclidean norm in C^n."""

        return float(np.linalg.norm(self.coerce(vector)))
