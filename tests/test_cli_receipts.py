import json
import numpy as np

from langarian import ResonantState, phase_shift
from langarian.cli import explain_receipt_file, validate_receipt_data, validate_receipt_file


def _write_sample_receipt(tmp_path):
    state = ResonantState(np.array([1 + 0j, 1 + 0j]), glyph="seed")
    result = phase_shift(state, 0.25)
    path = tmp_path / "sample_receipt.json"
    path.write_text(result.receipt.to_json(), encoding="utf-8")
    return path


def test_validate_receipt_data_passes_for_kernel_receipt(tmp_path):
    path = _write_sample_receipt(tmp_path)
    data = json.loads(path.read_text(encoding="utf-8"))
    ok, errors = validate_receipt_data(data)
    assert ok
    assert errors == []


def test_validate_receipt_file_prints_pass(tmp_path, capsys):
    path = _write_sample_receipt(tmp_path)
    exit_code = validate_receipt_file(path)
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "PASS receipt schema" in captured.out


def test_explain_receipt_file_prints_summary(tmp_path, capsys):
    path = _write_sample_receipt(tmp_path)
    exit_code = explain_receipt_file(path)
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Langarian Receipt Explanation" in captured.out
    assert "operator: phase_shift" in captured.out


def test_validate_receipt_data_fails_missing_required_fields():
    ok, errors = validate_receipt_data({"status": "MAYBE"})
    assert not ok
    assert errors
