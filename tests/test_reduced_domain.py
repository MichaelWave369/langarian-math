import pytest

from langarian import EpistemicTag, ResultStatus, boundary_value, scan_boundary_domain


def test_boundary_value_uses_reduced_formula():
    assert boundary_value(kappa=1.0, c=0.1, curvature=0.5) == pytest.approx(0.97)


def test_scan_boundary_domain_passes_for_positive_samples():
    scan = scan_boundary_domain(
        [
            {"t": 0.0, "kappa": 1.0, "c": 0.1, "curvature": 0.5},
            {"t": 1.0, "kappa": 1.0, "c": 0.1, "curvature": 0.75},
        ],
        label="reduced_domain_demo",
    )

    assert scan.is_safe
    assert scan.min_boundary_value == pytest.approx(0.955)
    assert scan.receipt.status == ResultStatus.PASS
    assert scan.receipt.epistemic_tag == EpistemicTag.MODEL
    assert scan.receipt.receipt_id().startswith("sha256:")


def test_scan_boundary_domain_fails_for_domain_violation():
    scan = scan_boundary_domain([
        {"t": 0.0, "kappa": 1.0, "c": 1.0, "curvature": 1.0},
    ])

    assert not scan.is_safe
    assert scan.violating_indices == (0,)
    assert scan.receipt.status == ResultStatus.FAIL


def test_scan_boundary_domain_rejects_empty_input():
    with pytest.raises(ValueError, match="at least one sample"):
        scan_boundary_domain([])
