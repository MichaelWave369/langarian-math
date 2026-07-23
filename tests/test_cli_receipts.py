import json
import os

import numpy as np
import pytest

from langarian import ResonantState, phase_shift
from langarian.cli import (
    _sanitize_receipt_filename,
    _write_receipt,
    explain_receipt_file,
    validate_receipt_data,
    validate_receipt_file,
)


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


# --- SPEC section 3.11: atomic receipt writes + filename sanitization ---------


def test_write_receipt_is_atomic_and_leaves_no_tmp(tmp_path):
    path = _write_receipt(tmp_path / "receipts", "op_x.json", '{"ok": true}')
    assert path.read_text(encoding="utf-8") == '{"ok": true}\n'
    # No temporary files remain alongside the receipt.
    assert [p.name for p in path.parent.iterdir()] == ["op_x.json"]


def test_receipt_write_json_uses_atomic_replace(tmp_path, monkeypatch):
    state = ResonantState(np.array([1 + 0j]))
    receipt = phase_shift(state, 0.25).receipt
    target = tmp_path / "receipt.json"
    target.write_text("previous complete content\n", encoding="utf-8")

    # A failure during rename must not corrupt the pre-existing receipt and
    # must clean up the temporary file.
    def failing_replace(src, dst):
        raise OSError("simulated crash before rename")

    monkeypatch.setattr(os, "replace", failing_replace)
    with pytest.raises(OSError, match="simulated crash"):
        receipt.write_json(str(target))
    assert target.read_text(encoding="utf-8") == "previous complete content\n"
    assert [p.name for p in tmp_path.iterdir()] == ["receipt.json"]

    monkeypatch.undo()
    receipt.write_json(str(target))
    assert json.loads(target.read_text(encoding="utf-8"))["receipt_id"] == receipt.receipt_id()


def test_sanitize_receipt_filename_rejects_unsafe_names():
    assert _sanitize_receipt_filename("phase_shift_cost.json") == "phase_shift_cost.json"
    for bad in ("../escape.json", "a/b.json", "/abs.json", "..json", "bad;.json", "", "noext", ".hidden.json"):
        with pytest.raises(ValueError, match="unsafe receipt filename"):
            _sanitize_receipt_filename(bad)


# --- CLI error handling: missing/unreadable files are clean errors -----------


def test_cli_validate_missing_file_is_clean_error(tmp_path, capsys):
    from langarian.cli import main

    missing = tmp_path / "does_not_exist.json"
    exit_code = main(["validate", str(missing)])
    captured = capsys.readouterr()
    assert exit_code == 2
    assert "receipt file not found" in captured.err
    assert "Traceback" not in captured.err
    assert captured.out == ""


def test_cli_explain_missing_file_is_clean_error(tmp_path, capsys):
    from langarian.cli import main

    exit_code = main(["explain", str(tmp_path / "nope.json")])
    captured = capsys.readouterr()
    assert exit_code == 2
    assert "receipt file not found" in captured.err
    assert "Traceback" not in captured.err


def test_cli_validate_invalid_json_is_clean_error(tmp_path, capsys):
    from langarian.cli import main

    bad = tmp_path / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    exit_code = main(["validate", str(bad)])
    captured = capsys.readouterr()
    assert exit_code == 2
    assert "cannot validate receipt" in captured.err
    assert "Traceback" not in captured.err
