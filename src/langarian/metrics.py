"""Metric functions for the finite-dimensional Langarian kernel."""

from __future__ import annotations

from collections.abc import Sequence
import math

import numpy as np

from .limits import MAX_STATES, LimitError, MetricError
from .state import ResonantState, pad_to_common_dim
from .version import METRIC_VERSION  # compatibility re-export; single source is version.py

__all__ = [
    "METRIC_VERSION",
    "MetricError",
    "resonance",
    "phase",
    "normalized_complex_similarity",
    "system_coherence",
]


def resonance(state: ResonantState) -> float:
    """Resonance is vector norm."""

    return state.resonance


def phase(state: ResonantState) -> float:
    """Return the kernel's global phase convention in radians."""

    return state.phase


def normalized_complex_similarity(a: ResonantState, b: ResonantState) -> float:
    """Squared normalized inner-product similarity in [0, 1].

    Definition (exact arithmetic): C(a, b) = |<a, b>|^2 / (||a||^2 * ||b||^2),
    bounded in [0, 1] by the Cauchy-Schwarz inequality. This is the standard
    projective (ray) similarity and is invariant under any nonzero complex
    rescaling of either argument.

    Zero-state convention:
    - C(0, 0) = 1
    - C(0, x) = 0 for nonzero x

    Scale-safety (metric:v0.3): each vector is normalized by its max component
    magnitude before the inner product, so squared norms can neither underflow
    nor overflow. The value is mathematically unchanged in exact arithmetic;
    the zero-state conventions above hold for every finite float64 magnitude,
    including deep subnormals down to 5e-324. When ``maxabs * maxabs``
    underflows to 0 (deep-subnormal ``maxabs``, below ~2.3e-162), numpy
    complex scalar division divides by 0 and would produce NaN, so the real
    and imaginary parts are scaled separately instead (exact). A non-finite
    or non-positive intermediate is an explicit MetricError, never a silently
    clamped NaN.
    """

    av, bv = pad_to_common_dim(a, b)
    maxabs_a = float(np.max(np.abs(av)))
    maxabs_b = float(np.max(np.abs(bv)))
    a_is_zero = maxabs_a == 0.0
    b_is_zero = maxabs_b == 0.0
    if a_is_zero and b_is_zero:
        return 1.0
    if a_is_zero or b_is_zero:
        return 0.0
    # Scale into the unit ball: |component| <= 1, so norms and inner products
    # are finite and well-conditioned for any finite input magnitude. Complex
    # scalar division is used when its c*c + d*d denominator is nonzero; for
    # deep-subnormal maxabs it underflows to 0, so real/imaginary parts are
    # scaled separately (exact; see docstring).
    sa = av / maxabs_a if maxabs_a * maxabs_a > 0.0 else (av.real / maxabs_a) + 1j * (av.imag / maxabs_a)
    sb = bv / maxabs_b if maxabs_b * maxabs_b > 0.0 else (bv.real / maxabs_b) + 1j * (bv.imag / maxabs_b)
    inner = np.vdot(sa, sb)
    na2 = float(np.vdot(sa, sa).real)
    nb2 = float(np.vdot(sb, sb).real)
    if na2 <= 0.0 or nb2 <= 0.0:
        raise MetricError("scaled squared norm is non-positive for a nonzero state; refusing to clamp.")
    value = (abs(inner) ** 2) / (na2 * nb2)
    if not math.isfinite(value):
        raise MetricError(f"similarity intermediate is non-finite ({value!r}); refusing to clamp NaN/inf.")
    return float(min(1.0, max(0.0, value)))


def system_coherence(states: Sequence[ResonantState], weights: np.ndarray | None = None) -> float:
    """Average pairwise coherence for a finite state system.

    Convention: the diagonal (self-similarities, each equal to 1 by the
    zero-state convention) IS included in the weighted average. This is a
    deliberate averaging convention, not a mathematical requirement.

    Weights must be finite and non-negative; negative weights could push the
    result outside [0, 1] and are rejected with a typed error.
    """

    n = len(states)
    if n == 0:
        raise ValueError("system_coherence requires at least one state.")
    if n > MAX_STATES:
        raise LimitError(f"system_coherence received {n} states; limit is MAX_STATES={MAX_STATES}.")
    if weights is None:
        weights = np.ones((n, n), dtype=float)
    weights = np.asarray(weights, dtype=float)
    if weights.shape != (n, n):
        raise ValueError("weights must have shape (n, n).")
    if not np.all(np.isfinite(weights)):
        raise ValueError("weights must be finite.")
    if np.any(weights < 0):
        raise ValueError("weights must be non-negative; negative weights are not meaningful for coherence averaging.")
    total = 0.0
    weight_total = 0.0
    for i in range(n):
        for j in range(n):
            w = float(weights[i, j])
            total += normalized_complex_similarity(states[i], states[j]) * w
            weight_total += w
    if math.isclose(weight_total, 0.0):
        raise ValueError("weights must not sum to zero.")
    result = float(total / weight_total)
    if not math.isfinite(result):
        raise MetricError(f"system_coherence produced a non-finite value ({result!r}).")
    return result
