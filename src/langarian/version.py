"""Single-source version manifest for Langarian Math Workbench v0.3.1.

All version strings used by the Python kernel, receipts, metrics, fixtures,
and the TypeScript mirror are declared here exactly once. If any value changes,
migration notes must say why.
"""

from __future__ import annotations

VERSION_MANIFEST: dict[str, str] = {
    "product_version": "0.3.1-rc.1",
    "kernel_version": "langarian-python-ref-v0.3.0",
    "model_version": "langarian-finite-complex-model-v0.2.1",
    "metric_version": "metric:v0.3.scale_safe_normalized_complex_similarity",
    "receipt_schema_version": "receipt:v0.3",
    "dsl_version": "langarian-dsl:v0.3",
    "fixture_version": "fixtures:v0.3",
    "ts_port_version": "langarian-ts-port-v0.3.0",
    "visualization_version": "viz:v0.3",
}

PRODUCT_VERSION = VERSION_MANIFEST["product_version"]
KERNEL_VERSION = VERSION_MANIFEST["kernel_version"]
MODEL_VERSION = VERSION_MANIFEST["model_version"]
METRIC_VERSION = VERSION_MANIFEST["metric_version"]
RECEIPT_SCHEMA_VERSION = VERSION_MANIFEST["receipt_schema_version"]
DSL_VERSION = VERSION_MANIFEST["dsl_version"]
FIXTURE_VERSION = VERSION_MANIFEST["fixture_version"]
TS_PORT_VERSION = VERSION_MANIFEST["ts_port_version"]
VISUALIZATION_VERSION = VERSION_MANIFEST["visualization_version"]

# Versions accepted on receipt import/validation. Older kernel or metric
# versions are rejected (no silent downgrade acceptance).
ALLOWED_KERNEL_VERSIONS = frozenset({KERNEL_VERSION})
ALLOWED_METRIC_VERSIONS = frozenset({METRIC_VERSION})
ALLOWED_RECEIPT_SCHEMA_VERSIONS = frozenset({RECEIPT_SCHEMA_VERSION})

__all__ = [
    "VERSION_MANIFEST",
    "PRODUCT_VERSION",
    "KERNEL_VERSION",
    "MODEL_VERSION",
    "METRIC_VERSION",
    "RECEIPT_SCHEMA_VERSION",
    "DSL_VERSION",
    "FIXTURE_VERSION",
    "TS_PORT_VERSION",
    "VISUALIZATION_VERSION",
    "ALLOWED_KERNEL_VERSIONS",
    "ALLOWED_METRIC_VERSIONS",
    "ALLOWED_RECEIPT_SCHEMA_VERSIONS",
]
