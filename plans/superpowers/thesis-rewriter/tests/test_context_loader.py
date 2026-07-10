import os
import warnings
import pytest
from pathlib import Path
from context_loader import load_context, MAX_CONTEXT_CHARS


def test_loads_single_file(tmp_path):
    f = tmp_path / "doc.md"
    f.write_text("hello world", encoding="utf-8")
    assert load_context(str(f)) == "hello world"


def test_loads_md_files_from_directory(tmp_path):
    (tmp_path / "a.md").write_text("alpha", encoding="utf-8")
    (tmp_path / "b.md").write_text("beta", encoding="utf-8")
    result = load_context(str(tmp_path))
    assert "alpha" in result
    assert "beta" in result


def test_md_files_joined_with_separator(tmp_path):
    (tmp_path / "a.md").write_text("AAA", encoding="utf-8")
    (tmp_path / "b.md").write_text("BBB", encoding="utf-8")
    result = load_context(str(tmp_path))
    assert "\n\n---\n\n" in result


def test_falls_back_to_txt_when_no_md(tmp_path):
    (tmp_path / "notes.txt").write_text("fallback content", encoding="utf-8")
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        result = load_context(str(tmp_path))
    assert "fallback content" in result
    assert any("No .md files" in str(warning.message) for warning in w)


def test_raises_when_no_readable_files(tmp_path):
    with pytest.raises(ValueError, match="No readable files"):
        load_context(str(tmp_path))


def test_raises_when_path_missing():
    with pytest.raises(FileNotFoundError):
        load_context("/nonexistent/path/abc123")


def test_truncates_oversized_context(tmp_path):
    big = "x" * (MAX_CONTEXT_CHARS + 10_000)
    (tmp_path / "big.md").write_text(big, encoding="utf-8")
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        result = load_context(str(tmp_path))
    sep = "\n\n[...TRUNCATED...]\n\n"
    assert len(result) <= MAX_CONTEXT_CHARS + len(sep)
    assert "TRUNCATED" in result
    assert any("truncating" in str(warning.message).lower() for warning in w)
