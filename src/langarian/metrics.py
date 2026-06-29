"""Metric functions for the finite-dimensional Langarian kernel."""

from __future__ import annotations

from collections.abc import Sequence
import math

import numpy as np

from .state import ResonantState, pad_to_common_dim

METRIC_VERSION = "metric:v0.2.normalized_complex_similarity"


def resonance(state: ResonantState) -> float:
    """Resonance is vector norm."""

    return state.resonance


def phase(state: ResonantState) -> float:
    """Return the kernel's global phase convention in radians."""

    return state.phase


def normalized_complex_similarity(a: ResonantState, b: ResonantState) -> float:
    """Squared normalized inner-product similarity in [0, 1].

    Zero-state convention:
    - C(0, 0) = 1
    - C(0, x) = 0 for nonzero x
    """

    av, bv = pad_to_common_dim(a, b)
    na = float(np.linalg.norm(av))
    nb = float(np.linalg.norm(bv))
    if na == 0.0 and nb == 0.0:
        return 1.0
    if na == 0.0 or nb == 0.0:
        return 0.0
    inner = np.vdot(av, bv)
    value = (abs(inner) ** 2) / ((na**2) * (nb**2))
    return float(min(1.0, max(0.0, value.real)))


def system_coherence(states: Sequence[ResonantState], weights: np.ndarray | None = None) -> float:
    """Average pairwise coherence for a finite state system."""

    n = len(states)
    if n == 0:
        raise ValueError("system_coherence requires at least one state.")
    if weights is None:
        weights = np.ones((n, n), dtype=float)
    weights = np.asarray(weights, dtype=float)
    if weights.shape != (n, n):
        raise ValueError("weights must have shape (n, n).")
    total = 0.0
    weight_total = 0.0
    for i in range(n):
        for j in range(n):
            w = float(weights[i, j])
            total += normalized_complex_similarity(states[i], states[j]) * w
            weight_total += w
    if math.isclose(weight_total, 0.0):
        raise ValueError("weights must not sum to zero.")
    return float(total / weight_total)
