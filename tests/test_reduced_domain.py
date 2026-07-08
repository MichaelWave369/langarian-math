import pytest

from langarian import EpistemicTag, ResultStatus, bracket_wall_value, scan_bracket_wall


def test_bracket_wall_value_uses_reduced_formula():
    assert bracket_wall_value(kappa=1.0, c=0.1, v_gamma_gamma=0.5) == pytest.approx(0.97)


def test_scan_bracket_wall_passes_for_positive_samples():
    scan = scan_bracket_wall(
        [
            {"t": 0.0, "kappa": 1.0, "c": 0.1, "v_gamma_gamma": 0.5},
            {"t": 1.0, "kappa": 1.0, "c": 0.1, "v_gamma_gamma": 0.75},
        ],
        label="reduced_domain_demo",
    )

    assert scan.is_safe
    assert scan.min_bracket_value == pytest.approx(0.955)
    assert scan.receipt.status == ResultStatus.PASS
    assert scan.receipt.epistemic_tag == EpistemicTag.MODEL
    assert scan.receipt.receipt_id().startswith("sha256:")


def test_scan_bracket_wall_fails_for_domain_violation():
    scan = scan_bracket_wall([
        {"t": 0.0, "kappa": 1.0, "c": 1.0, "v_gamma_gamma": 1.0},
    ])

    assert not scan.is_safe
    assert scan.violating_indices == (0,)
    assert scan.receipt.status == ResultStatus.FAIL


def test_scan_bracket_wall_rejects_empty_input():
    with pytest.raises(ValueError, match="at least one sample"):
        scan_bracket_wall([])
