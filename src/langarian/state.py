"""Finite complex vector states for the v0.2 formal kernel candidate."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Iterable
import hashlib
import json
import math

import numpy as np

from .limits import MAX_DIM, MAX_GLYPH_CHARS, MAX_LABEL_CHARS, MAX_METADATA_BYTES, LimitError, MetricError
from .version import KERNEL_VERSION  # compatibility re-export; single source is version.py

__all__ = ["KERNEL_VERSION", "ResonantState", "pad_to_common_dim"]


def _complex_to_pair(z: complex) -> list[float]:
    return [float(np.real(z)), float(np.imag(z))]


def _canonical_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _thaw_metadata(value: Any) -> Any:
    """Recursively convert mappings/tuples to plain dict/list (deep copy).

    Used to build the canonical JSON payload from the internally frozen
    metadata structure and to detach caller-held aliases at construction.
    """

    if isinstance(value, Mapping):
        return {key: _thaw_metadata(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_thaw_metadata(item) for item in value]
    return value


def _freeze_metadata(value: Any) -> Any:
    """Recursively freeze metadata: mappings -> MappingProxyType, lists -> tuple.

    The frozen structure cannot be mutated by the caller or by the holder of
    the state, so metadata (and therefore ``state_hash``) is stable after
    receipt emission. ``_thaw_metadata`` reconstructs the JSON-safe plain form.
    """

    if isinstance(value, Mapping):
        return MappingProxyType({key: _freeze_metadata(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_metadata(item) for item in value)
    return value


def _validate_metadata(metadata: Mapping[str, Any]) -> None:
    """Require JSON-safe metadata with string keys and finite numbers.

    Non-JSON metadata (numpy scalars, arrays, non-finite floats, mixed-type
    keys) previously crashed inside hashing with an unhandled TypeError or
    produced invalid JSON. It is now a typed error at construction time.
    """

    if not isinstance(metadata, Mapping):
        raise TypeError("metadata must be a dict (string-keyed mapping).")
    for key in metadata:
        if not isinstance(key, str):
            raise TypeError("metadata keys must be strings.")

    def _check(value: Any, path: str) -> None:
        if value is None or isinstance(value, (str, bool, int)):
            return
        if isinstance(value, float):
            if not math.isfinite(value):
                raise ValueError(f"metadata value at {path} must be finite (no NaN/Infinity).")
            return
        if isinstance(value, (list, tuple)):
            for index, item in enumerate(value):
                _check(item, f"{path}[{index}]")
            return
        if isinstance(value, dict):
            for key2, item in value.items():
                if not isinstance(key2, str):
                    raise TypeError(f"metadata key at {path} must be a string.")
                _check(item, f"{path}.{key2}")
            return
        raise TypeError(
            f"metadata value at {path} has unsupported type {type(value).__name__}; "
            "metadata must be JSON-safe (str/int/float/bool/None/list/dict)."
        )

    for key, value in metadata.items():
        _check(value, key)

    size = len(_canonical_json(metadata).encode("utf-8"))
    if size > MAX_METADATA_BYTES:
        raise LimitError(f"metadata is {size} bytes; limit is {MAX_METADATA_BYTES}.")


@dataclass(frozen=True)
class ResonantState:
    """A typed finite-dimensional state.

    The state vector is the formal object. Resonance, phase, and coherence are
    derived from it by functions in the kernel.

    The vector is immutable: construction always takes a defensive copy and
    marks it read-only, so mutating a state after receipt emission raises
    instead of silently invalidating recorded hashes.

    Metadata is equally immutable: construction deep-copies the caller's
    mapping and stores a recursively frozen view (mappings become
    ``MappingProxyType``, lists become tuples). Mutation attempts — top-level
    or nested — raise ``TypeError``, caller-held aliases cannot leak into the
    stored state, and ``state_hash`` is stable after receipt emission.
    """

    vector: np.ndarray
    glyph: str | None = None
    label: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)
    history: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        # Defensive copy: ingest paths may pass aliased/mutable arrays.
        vector = np.array(self.vector, dtype=np.complex128, copy=True).reshape(-1)
        if vector.shape[0] < 1:
            raise ValueError("State dimension must be >= 1; dim==0 states are not constructible.")
        if vector.shape[0] > MAX_DIM:
            raise LimitError(f"State dimension {vector.shape[0]} exceeds MAX_DIM={MAX_DIM}.")
        if not np.all(np.isfinite(vector.real)) or not np.all(np.isfinite(vector.imag)):
            raise ValueError("State vector must contain only finite complex values.")
        vector.setflags(write=False)
        object.__setattr__(self, "vector", vector)
        if self.glyph is not None:
            if not isinstance(self.glyph, str):
                raise TypeError("glyph must be a string or None.")
            if len(self.glyph) > MAX_GLYPH_CHARS:
                raise LimitError(f"glyph length {len(self.glyph)} exceeds MAX_GLYPH_CHARS={MAX_GLYPH_CHARS}.")
        if self.label is not None:
            if not isinstance(self.label, str):
                raise TypeError("label must be a string or None.")
            if len(self.label) > MAX_LABEL_CHARS:
                raise LimitError(f"label length {len(self.label)} exceeds MAX_LABEL_CHARS={MAX_LABEL_CHARS}.")
        # Deep-copy (detach caller aliases), validate the JSON-safe plain
        # form, then store a recursively frozen read-only view.
        metadata = _thaw_metadata(self.metadata)
        _validate_metadata(metadata)
        object.__setattr__(self, "metadata", _freeze_metadata(metadata))

    @property
    def dim(self) -> int:
        return int(self.vector.shape[0])

    @property
    def resonance(self) -> float:
        """Euclidean (l2) norm, computed scale-safely.

        Scaling by the max component magnitude keeps finite states from
        overflowing to ``inf`` (or underflowing to 0) inside the norm.
        Supported policy: resonance is finite and correct for every finite
        float64 state. When ``maxabs * maxabs`` underflows to 0
        (deep-subnormal ``maxabs``, below ~2.3e-162), numpy complex scalar
        division divides by 0 and silently yields NaN/inf; in that case the
        real and imaginary parts are scaled separately, which is exact. A
        non-finite final intermediate is a ``MetricError``, never silent NaN.
        """

        maxabs = float(np.max(np.abs(self.vector)))
        if maxabs == 0.0:
            return 0.0
        if maxabs * maxabs > 0.0:
            value = float(maxabs * np.linalg.norm(self.vector / maxabs))
        else:
            # Deep-subnormal maxabs: complex division's c*c + d*d denominator
            # underflows to 0. Per-part real division stays exact.
            scaled_re = self.vector.real / maxabs
            scaled_im = self.vector.imag / maxabs
            value = float(maxabs * math.hypot(np.linalg.norm(scaled_re), np.linalg.norm(scaled_im)))
        if not math.isfinite(value):
            raise MetricError(
                f"resonance intermediate is non-finite ({value!r}) for a finite state; refusing to return NaN/inf."
            )
        return value

    @property
    def phase(self) -> float:
        """A simple global phase estimate.

        For the zero vector, phase is defined as 0 for totality and predictable
        receipts. This is a convention, not a physical claim: it is a
        deterministic, rotation-equivariant phase statistic of the chosen
        representative, not an invariant of the projective class.
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
            "metadata": _thaw_metadata(self.metadata),
            "history": list(self.history),
        }

    def state_hash(self) -> str:
        payload = _canonical_json(self.canonical_payload()).encode("utf-8")
        return "sha256:" + hashlib.sha256(payload).hexdigest()

    def with_history(self, receipt_id: str) -> "ResonantState":
        # Construction deep-copies and re-freezes metadata, so the derived
        # state shares no mutable structure with this one.
        return ResonantState(
            vector=self.vector.copy(),
            glyph=self.glyph,
            label=self.label,
            metadata=self.metadata,
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
        """Build from [[real, imag], ...] pairs (defensively copied)."""

        vector = np.array([complex(float(r), float(i)) for r, i in pairs], dtype=np.complex128)
        return cls(vector=vector, glyph=glyph, label=label, metadata=metadata or {})


def pad_to_common_dim(a: ResonantState, b: ResonantState) -> tuple[np.ndarray, np.ndarray]:
    """Return copies of two vectors padded to a common dimension.

    Embedding convention: the shorter vector occupies the leading coordinates;
    the zero padding block contributes nothing to norms or inner products.
    """

    dim = max(a.dim, b.dim)
    av = np.zeros(dim, dtype=np.complex128)
    bv = np.zeros(dim, dtype=np.complex128)
    av[: a.dim] = a.vector
    bv[: b.dim] = b.vector
    return av, bv
