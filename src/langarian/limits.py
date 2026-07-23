"""Resource limits and typed kernel errors for Langarian Math Workbench v0.3.

Exceeding a limit is always a typed error (``LimitError``/``ValueError``),
never an unhandled traceback such as ``OverflowError`` or ``TypeError``.
"""

from __future__ import annotations

MAX_DIM = 64
MAX_STATES = 32
MAX_PROGRAM_STEPS = 64
MAX_DSL_TOKENS = 4096
MAX_AST_DEPTH = 32
MAX_METADATA_BYTES = 4096
MAX_LABEL_CHARS = 120
MAX_GLYPH_CHARS = 16
MAX_PHI_SCALE_POWER = 64


class LangarianError(Exception):
    """Base class for typed kernel errors."""


class LimitError(ValueError, LangarianError):
    """A declared resource limit was exceeded."""


class MetricError(ArithmeticError, LangarianError):
    """A metric computation produced a non-finite or invalid intermediate."""


__all__ = [
    "MAX_DIM",
    "MAX_STATES",
    "MAX_PROGRAM_STEPS",
    "MAX_DSL_TOKENS",
    "MAX_AST_DEPTH",
    "MAX_METADATA_BYTES",
    "MAX_LABEL_CHARS",
    "MAX_GLYPH_CHARS",
    "MAX_PHI_SCALE_POWER",
    "LangarianError",
    "LimitError",
    "MetricError",
]
