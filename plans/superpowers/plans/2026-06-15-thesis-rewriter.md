# Thesis Rewriter CLI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-file Python CLI that clones a `.docx` graduation thesis and rewrites its content for the SmartCV project using Claude (via subprocess or Anthropic SDK).

**Architecture:** `rewriter.py` orchestrates the pipeline — load context → clone docx → detect chapters → route each chapter to its rewrite strategy → save. `context_loader.py`, `docx_parser.py`, and `llm_client.py` are single-responsibility modules with no cross-dependencies (except `llm_client` optionally importing `anthropic`).

**Tech Stack:** Python 3.10+, python-docx 1.1+, tqdm, anthropic (optional), pytest for tests, Claude Code CLI (`claude -p`) as primary LLM backend.

---

## File Map

```
plans/superpowers/thesis-rewriter/
├── context_loader.py          # load_context(path) → str
├── docx_parser.py             # detect_chapters, run-level text ops
├── llm_client.py              # LLMClient (subprocess or SDK)
├── rewriter.py                # argparse entry point + chapter strategies
├── requirements.txt
└── tests/
    ├── __init__.py
    ├── test_context_loader.py
    ├── test_docx_parser.py
    ├── test_llm_client.py
    └── test_rewriter.py
```

All implementation goes under `plans/superpowers/thesis-rewriter/`. Run all tests from that directory.

---

## Task 1: Scaffold — requirements.txt + test infrastructure

**Files:**
- Create: `plans/superpowers/thesis-rewriter/requirements.txt`
- Create: `plans/superpowers/thesis-rewriter/tests/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```
python-docx>=1.1.0
tqdm>=4.66.0
anthropic>=0.25.0
pytest>=8.0.0
```

- [ ] **Step 2: Create empty test init**

```bash
mkdir -p plans/superpowers/thesis-rewriter/tests
touch plans/superpowers/thesis-rewriter/tests/__init__.py
```

- [ ] **Step 3: Install dependencies**

```bash
cd plans/superpowers/thesis-rewriter
pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 4: Commit**

```bash
git add plans/superpowers/thesis-rewriter/requirements.txt plans/superpowers/thesis-rewriter/tests/__init__.py
git commit -m "chore: scaffold thesis-rewriter with requirements and test dir"
```

---

## Task 2: context_loader.py

**Files:**
- Create: `plans/superpowers/thesis-rewriter/context_loader.py`
- Create: `plans/superpowers/thesis-rewriter/tests/test_context_loader.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_context_loader.py
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
    assert "---" in result


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
    assert len(result) <= MAX_CONTEXT_CHARS + 50  # separator adds a few chars
    assert "TRUNCATED" in result
    assert any("truncating" in str(warning.message).lower() for warning in w)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd plans/superpowers/thesis-rewriter
pytest tests/test_context_loader.py -v
```

Expected: `ImportError: No module named 'context_loader'`

- [ ] **Step 3: Implement context_loader.py**

```python
# context_loader.py
import warnings
from pathlib import Path

MAX_CONTEXT_CHARS = 100_000


def load_context(path: str) -> str:
    p = Path(path)
    if p.is_file():
        return p.read_text(encoding="utf-8")
    if not p.is_dir():
        raise FileNotFoundError(f"Context path not found: {path}")

    files = sorted(p.glob("**/*.md"))
    if not files:
        warnings.warn(f"No .md files in {path}, trying .txt fallback")
        files = sorted(p.glob("**/*.txt"))
    if not files:
        raise ValueError(f"No readable files (.md or .txt) in {path}")

    parts = []
    for f in files:
        try:
            parts.append(f.read_text(encoding="utf-8"))
        except OSError as e:
            warnings.warn(f"Skipping {f}: {e}")

    if not parts:
        raise ValueError(f"No files could be read from {path}")

    combined = "\n\n---\n\n".join(parts)
    if len(combined) > MAX_CONTEXT_CHARS:
        warnings.warn(
            f"Context {len(combined)} chars exceeds {MAX_CONTEXT_CHARS}, truncating"
        )
        half = MAX_CONTEXT_CHARS // 2
        combined = combined[:half] + "\n\n[...TRUNCATED...]\n\n" + combined[-half:]

    return combined
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
cd plans/superpowers/thesis-rewriter
pytest tests/test_context_loader.py -v
```

Expected: 8 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add plans/superpowers/thesis-rewriter/context_loader.py plans/superpowers/thesis-rewriter/tests/test_context_loader.py
git commit -m "feat: implement context_loader with md-first loading and truncation"
```

---

## Task 3: docx_parser.py

**Files:**
- Create: `plans/superpowers/thesis-rewriter/docx_parser.py`
- Create: `plans/superpowers/thesis-rewriter/tests/test_docx_parser.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_docx_parser.py
import pytest
from docx import Document
from docx_parser import (
    is_chapter_heading,
    detect_chapters,
    get_paragraph_text,
    replace_paragraph_text,
    clear_paragraph,
    ChapterBucket,
)


def _make_doc_with_styles():
    """Build a minimal Document with chapters for testing."""
    doc = Document()
    # Heading 1 → chapter
    h1 = doc.add_paragraph("CHƯƠNG 1: GIỚI THIỆU")
    h1.style = doc.styles["Heading 1"]
    doc.add_paragraph("Nội dung chương 1.")
    doc.add_paragraph("Đoạn 2 chương 1.")
    # Heading 1 → second chapter
    h2 = doc.add_paragraph("CHƯƠNG 2: CƠ SỞ LÝ THUYẾT")
    h2.style = doc.styles["Heading 1"]
    doc.add_paragraph("Nội dung lý thuyết.")
    return doc


def test_is_chapter_heading_by_style():
    doc = Document()
    p = doc.add_paragraph("Some heading")
    p.style = doc.styles["Heading 1"]
    assert is_chapter_heading(p) is True


def test_is_chapter_heading_by_regex():
    doc = Document()
    p = doc.add_paragraph("CHƯƠNG 3: PHÂN TÍCH THIẾT KẾ")
    assert is_chapter_heading(p) is True


def test_is_not_chapter_heading_for_body():
    doc = Document()
    p = doc.add_paragraph("Đây là đoạn văn thông thường.")
    assert is_chapter_heading(p) is False


def test_detect_chapters_finds_all():
    doc = _make_doc_with_styles()
    chapters = detect_chapters(doc)
    assert len(chapters) == 2
    assert chapters[0].title == "CHƯƠNG 1: GIỚI THIỆU"
    assert chapters[1].title == "CHƯƠNG 2: CƠ SỞ LÝ THUYẾT"


def test_detect_chapters_body_indices():
    doc = _make_doc_with_styles()
    chapters = detect_chapters(doc)
    # chapter 1 heading is index 0; body should be 1, 2
    assert len(chapters[0].body_indices) == 2


def test_get_paragraph_text_concatenates_runs():
    doc = Document()
    p = doc.add_paragraph("")
    p.runs[0].text = "Hello"
    p.add_run(" World")
    assert get_paragraph_text(p) == "Hello World"


def test_replace_paragraph_text_preserves_run0_format():
    doc = Document()
    p = doc.add_paragraph("")
    p.runs[0].text = "original"
    p.runs[0].bold = True
    p.add_run(" extra")
    replace_paragraph_text(p, "new text")
    assert get_paragraph_text(p) == "new text"
    assert p.runs[0].bold is True  # formatting preserved
    assert p.runs[1].text == ""    # subsequent run cleared


def test_replace_paragraph_text_single_run():
    doc = Document()
    p = doc.add_paragraph("original")
    replace_paragraph_text(p, "replaced")
    assert get_paragraph_text(p) == "replaced"


def test_replace_paragraph_text_no_runs_is_noop():
    doc = Document()
    p = doc.add_paragraph("")
    # Remove runs by clearing - this is an edge case where paragraph has no runs
    for run in p.runs:
        run.text = ""
    replace_paragraph_text(p, "new text")  # should not raise


def test_clear_paragraph_empties_all_text():
    doc = Document()
    p = doc.add_paragraph("some content")
    p.add_run(" more")
    clear_paragraph(p)
    assert get_paragraph_text(p) == ""
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd plans/superpowers/thesis-rewriter
pytest tests/test_docx_parser.py -v
```

Expected: `ImportError: No module named 'docx_parser'`

- [ ] **Step 3: Implement docx_parser.py**

```python
# docx_parser.py
import re
from dataclasses import dataclass, field
from typing import List

CHAPTER_HEADING_RE = re.compile(r"^CHƯƠNG\s+\d+", re.IGNORECASE)


@dataclass
class ChapterBucket:
    title: str
    heading_index: int
    body_indices: List[int] = field(default_factory=list)


def is_chapter_heading(para) -> bool:
    return (
        para.style.name.startswith("Heading 1")
        or bool(CHAPTER_HEADING_RE.match(para.text.strip()))
    )


def detect_chapters(doc) -> List[ChapterBucket]:
    chapters: List[ChapterBucket] = []
    current: ChapterBucket = None
    for i, para in enumerate(doc.paragraphs):
        if is_chapter_heading(para):
            current = ChapterBucket(title=para.text.strip(), heading_index=i)
            chapters.append(current)
        elif current is not None and para.text.strip():
            current.body_indices.append(i)
    return chapters


def get_paragraph_text(para) -> str:
    return "".join(run.text for run in para.runs)


def replace_paragraph_text(para, new_text: str) -> None:
    if not para.runs:
        return
    para.runs[0].text = new_text
    for run in para.runs[1:]:
        run.text = ""


def clear_paragraph(para) -> None:
    replace_paragraph_text(para, "")
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
cd plans/superpowers/thesis-rewriter
pytest tests/test_docx_parser.py -v
```

Expected: 10 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add plans/superpowers/thesis-rewriter/docx_parser.py plans/superpowers/thesis-rewriter/tests/test_docx_parser.py
git commit -m "feat: implement docx_parser with chapter detection and run-level text replacement"
```

---

## Task 4: llm_client.py

**Files:**
- Create: `plans/superpowers/thesis-rewriter/llm_client.py`
- Create: `plans/superpowers/thesis-rewriter/tests/test_llm_client.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_llm_client.py
import os
import warnings
from unittest.mock import MagicMock, patch
import pytest
from llm_client import LLMClient, ANTI_AI_SYSTEM_PROMPT


# ── Subprocess mode ──────────────────────────────────────────────────────────

def test_subprocess_mode_selected_when_no_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    client = LLMClient()
    assert client.mode == "subprocess"


def test_subprocess_returns_stdout(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    mock_result = MagicMock(returncode=0, stdout="rewritten text\n", stderr="")
    with patch("llm_client.subprocess.run", return_value=mock_result) as mock_run:
        client = LLMClient()
        result = client.rewrite("write something")
    assert result == "rewritten text"
    # Verify system prompt is embedded in the call
    call_args = mock_run.call_args
    prompt_sent = call_args[0][0][2]  # ['claude', '-p', <prompt>]
    assert ANTI_AI_SYSTEM_PROMPT[:50] in prompt_sent


def test_subprocess_returns_none_on_nonzero_exit(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    mock_result = MagicMock(returncode=1, stdout="", stderr="some error")
    with patch("llm_client.subprocess.run", return_value=mock_result):
        client = LLMClient()
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            result = client.rewrite("prompt")
    assert result is None
    assert any("failed" in str(warning.message).lower() for warning in w)


def test_subprocess_returns_none_on_timeout(monkeypatch):
    import subprocess
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with patch("llm_client.subprocess.run", side_effect=subprocess.TimeoutExpired("claude", 120)):
        client = LLMClient()
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            result = client.rewrite("prompt")
    assert result is None
    assert any("timed out" in str(warning.message).lower() for warning in w)


def test_subprocess_raises_when_claude_not_installed(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with patch("llm_client.subprocess.run", side_effect=FileNotFoundError()):
        client = LLMClient()
        with pytest.raises(RuntimeError, match="'claude' CLI not found"):
            client.rewrite("prompt")


# ── SDK mode ─────────────────────────────────────────────────────────────────

def test_sdk_mode_selected_when_api_key_set(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    with patch("llm_client.anthropic"):
        client = LLMClient()
    assert client.mode == "sdk"


def test_sdk_returns_text_from_response(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    mock_block = MagicMock()
    mock_block.text = "sdk response text"
    mock_response = MagicMock(content=[mock_block])
    mock_anthropic = MagicMock()
    mock_anthropic.Anthropic.return_value.messages.create.return_value = mock_response
    with patch("llm_client.anthropic", mock_anthropic):
        client = LLMClient()
        result = client.rewrite("write something")
    assert result == "sdk response text"


def test_sdk_retries_on_rate_limit(monkeypatch):
    import anthropic as real_anthropic
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    mock_block = MagicMock()
    mock_block.text = "ok after retry"
    mock_response = MagicMock(content=[mock_block])
    mock_anthropic = MagicMock()
    mock_create = mock_anthropic.Anthropic.return_value.messages.create
    mock_create.side_effect = [
        real_anthropic.RateLimitError.__new__(real_anthropic.RateLimitError),
        mock_response,
    ]
    mock_anthropic.RateLimitError = real_anthropic.RateLimitError
    mock_anthropic.APIError = real_anthropic.APIError
    with patch("llm_client.anthropic", mock_anthropic):
        with patch("llm_client.time.sleep"):
            client = LLMClient()
            result = client.rewrite("prompt")
    assert result == "ok after retry"
    assert mock_create.call_count == 2


def test_sdk_returns_none_on_api_error(monkeypatch):
    import anthropic as real_anthropic
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    mock_anthropic = MagicMock()
    mock_create = mock_anthropic.Anthropic.return_value.messages.create
    mock_create.side_effect = real_anthropic.APIError.__new__(real_anthropic.APIError)
    mock_anthropic.RateLimitError = real_anthropic.RateLimitError
    mock_anthropic.APIError = real_anthropic.APIError
    with patch("llm_client.anthropic", mock_anthropic):
        client = LLMClient()
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            result = client.rewrite("prompt")
    assert result is None
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd plans/superpowers/thesis-rewriter
pytest tests/test_llm_client.py -v
```

Expected: `ImportError: No module named 'llm_client'`

- [ ] **Step 3: Implement llm_client.py**

```python
# llm_client.py
import os
import subprocess
import time
import warnings
from typing import Optional

ANTI_AI_SYSTEM_PROMPT = (
    "Bạn là một sinh viên năm cuối ngành Công nghệ Thông tin. Nhiệm vụ của bạn là viết nội dung "
    "cho báo cáo đồ án tốt nghiệp chuyên nghiệp nhưng mang tính con người cao nhất để vượt qua AI Detector.\n"
    "Quy tắc NGHIÊM NGẶT:\n"
    "- TUYỆT ĐỐI KHÔNG dùng dấu ngoặc kép (\"\") trong văn bản.\n"
    "- KHÔNG dùng từ ngữ khuôn mẫu AI: 'Nhìn chung', 'Tóm lại', 'Đáng chú ý', 'Trong bối cảnh'.\n"
    "- Tạo human burstiness: đan xen liên tục giữa câu đơn siêu ngắn (5-7 chữ) và câu ghép phức tạp.\n"
    "- Từ vựng kỹ thuật chính xác, nhưng văn phong trình bày mộc mạc, thực tế. Không lạm dụng tính từ mạnh.\n"
    "- Viết đoạn văn ngắn, dùng gạch đầu dòng để liệt kê, tuyệt đối không tạo các khối văn bản tường trình quá dài."
)

try:
    import anthropic
except ImportError:
    anthropic = None


class LLMClient:
    def __init__(self):
        if os.getenv("ANTHROPIC_API_KEY"):
            if anthropic is None:
                raise RuntimeError("ANTHROPIC_API_KEY set but 'anthropic' package not installed.")
            self.mode = "sdk"
            self._client = anthropic.Anthropic()
        else:
            self.mode = "subprocess"
            self._client = None

    def rewrite(self, user_prompt: str) -> Optional[str]:
        if self.mode == "subprocess":
            return self._call_subprocess(user_prompt)
        return self._call_sdk(user_prompt)

    def _call_subprocess(self, user_prompt: str) -> Optional[str]:
        full_prompt = f"{ANTI_AI_SYSTEM_PROMPT}\n\n{user_prompt}"
        try:
            result = subprocess.run(
                ["claude", "-p", full_prompt],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0 or not result.stdout.strip():
                warnings.warn(f"claude CLI failed: {result.stderr[:200]}")
                return None
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            warnings.warn("claude CLI timed out after 120s")
            return None
        except FileNotFoundError:
            raise RuntimeError(
                "'claude' CLI not found. Install Claude Code or set ANTHROPIC_API_KEY."
            )

    def _call_sdk(self, user_prompt: str, max_retries: int = 3) -> Optional[str]:
        for attempt in range(max_retries):
            try:
                response = self._client.messages.create(
                    model="claude-opus-4-8",
                    max_tokens=4096,
                    thinking={"type": "adaptive"},
                    system=ANTI_AI_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_prompt}],
                )
                for block in reversed(response.content):
                    if hasattr(block, "text"):
                        return block.text
                return None
            except anthropic.RateLimitError:
                wait = 2 ** attempt
                warnings.warn(f"Rate limit hit, retry in {wait}s")
                time.sleep(wait)
            except anthropic.APIError as e:
                warnings.warn(f"API error: {e}")
                return None
        warnings.warn("Max retries exceeded")
        return None
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
cd plans/superpowers/thesis-rewriter
pytest tests/test_llm_client.py -v
```

Expected: 10 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add plans/superpowers/thesis-rewriter/llm_client.py plans/superpowers/thesis-rewriter/tests/test_llm_client.py
git commit -m "feat: implement llm_client supporting claude subprocess and anthropic SDK modes"
```

---

## Task 5: rewriter.py — orchestrator + chapter strategies

**Files:**
- Create: `plans/superpowers/thesis-rewriter/rewriter.py`
- Create: `plans/superpowers/thesis-rewriter/tests/test_rewriter.py`

- [ ] **Step 1: Write failing tests**

The tests mock the `LLMClient` so they run without any LLM credentials.

```python
# tests/test_rewriter.py
import shutil
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from docx import Document
from rewriter import (
    rewrite_chapter1,
    rewrite_chapter2,
    rewrite_chapter_heading_only,
    apply_keyword_replacements,
    KEYWORD_MAP,
)
from docx_parser import ChapterBucket, detect_chapters, get_paragraph_text
from docx.shared import Pt


def _build_doc_chapter1():
    """Minimal doc for chapter 1 testing: heading, subheading, 2 body paragraphs."""
    doc = Document()
    h1 = doc.add_paragraph("CHƯƠNG 1: GIỚI THIỆU")
    h1.style = doc.styles["Heading 1"]
    h2 = doc.add_paragraph("1.1 Tổng quan")
    h2.style = doc.styles["Heading 2"]
    doc.add_paragraph("Đoạn nội dung 1.")
    doc.add_paragraph("Đoạn nội dung 2.")
    return doc


def _build_doc_chapter2():
    doc = Document()
    h1 = doc.add_paragraph("CHƯƠNG 2: CƠ SỞ LÝ THUYẾT")
    h1.style = doc.styles["Heading 1"]
    doc.add_paragraph("Lý thuyết ban đầu.")
    doc.add_paragraph("Lý thuyết thứ hai.")
    return doc


def test_rewrite_chapter1_skips_subheadings():
    """Heading 2/3 paragraphs should not be rewritten."""
    doc = _build_doc_chapter1()
    chapters = detect_chapters(doc)
    llm = MagicMock()
    llm.rewrite.return_value = "new body text"

    rewrite_chapter1(doc, chapters[0], llm, "kb")

    # The Heading 2 paragraph text should be unchanged
    h2_para = doc.paragraphs[1]
    assert "1.1 Tổng quan" in get_paragraph_text(h2_para)


def test_rewrite_chapter1_rewrites_body_paragraphs():
    doc = _build_doc_chapter1()
    chapters = detect_chapters(doc)
    llm = MagicMock()
    llm.rewrite.return_value = "rewritten paragraph"

    rewrite_chapter1(doc, chapters[0], llm, "kb")

    # Body paragraphs (indices 2 and 3) should now contain the LLM result
    assert get_paragraph_text(doc.paragraphs[2]) == "rewritten paragraph"
    assert get_paragraph_text(doc.paragraphs[3]) == "rewritten paragraph"


def test_rewrite_chapter1_preserves_original_when_llm_returns_none():
    doc = _build_doc_chapter1()
    chapters = detect_chapters(doc)
    llm = MagicMock()
    llm.rewrite.return_value = None

    rewrite_chapter1(doc, chapters[0], llm, "kb")

    assert get_paragraph_text(doc.paragraphs[2]) == "Đoạn nội dung 1."
    assert get_paragraph_text(doc.paragraphs[3]) == "Đoạn nội dung 2."


def test_rewrite_chapter2_fills_first_body_paragraph():
    doc = _build_doc_chapter2()
    chapters = detect_chapters(doc)
    llm = MagicMock()
    llm.rewrite.return_value = "academic content generated by llm"

    rewrite_chapter2(doc, chapters[0], llm, "kb")

    assert get_paragraph_text(doc.paragraphs[1]) == "academic content generated by llm"


def test_rewrite_chapter2_clears_remaining_body_paragraphs():
    doc = _build_doc_chapter2()
    chapters = detect_chapters(doc)
    llm = MagicMock()
    llm.rewrite.return_value = "content"

    rewrite_chapter2(doc, chapters[0], llm, "kb")

    assert get_paragraph_text(doc.paragraphs[2]) == ""


def test_rewrite_chapter_heading_only_rewrites_heading():
    doc = Document()
    h1 = doc.add_paragraph("CHƯƠNG 3: PHÂN TÍCH HỆ THỐNG CŨ")
    h1.style = doc.styles["Heading 1"]
    doc.add_paragraph("Nội dung cũ cần xóa.")
    chapters = detect_chapters(doc)
    llm = MagicMock()
    llm.rewrite.return_value = "CHƯƠNG 3: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG SMARTCV"

    rewrite_chapter_heading_only(doc, chapters[0], llm, "kb")

    assert "SMARTCV" in get_paragraph_text(doc.paragraphs[0])


def test_rewrite_chapter_heading_only_clears_body():
    doc = Document()
    h1 = doc.add_paragraph("CHƯƠNG 3: XYZ")
    h1.style = doc.styles["Heading 1"]
    doc.add_paragraph("body to be cleared")
    chapters = detect_chapters(doc)
    llm = MagicMock()
    llm.rewrite.return_value = "new heading"

    rewrite_chapter_heading_only(doc, chapters[0], llm, "kb")

    assert get_paragraph_text(doc.paragraphs[1]) == ""


def test_apply_keyword_replacements():
    doc = Document()
    old_key = list(KEYWORD_MAP.keys())[0]
    new_val = KEYWORD_MAP[old_key]
    doc.add_paragraph(f"Tên sinh viên: {old_key}")

    apply_keyword_replacements(doc)

    assert new_val in get_paragraph_text(doc.paragraphs[0])
    assert old_key not in get_paragraph_text(doc.paragraphs[0])
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd plans/superpowers/thesis-rewriter
pytest tests/test_rewriter.py -v
```

Expected: `ImportError: No module named 'rewriter'`

- [ ] **Step 3: Implement rewriter.py**

```python
# rewriter.py
import argparse
import re
import shutil
import sys
import warnings
from pathlib import Path

from docx import Document
from tqdm import tqdm

from context_loader import load_context
from docx_parser import (
    ChapterBucket,
    detect_chapters,
    get_paragraph_text,
    replace_paragraph_text,
    clear_paragraph,
)
from llm_client import LLMClient

KEYWORD_MAP = {
    "nhận dạng biển số xe": "phân tích CV và matching với Job Description",
    "YOLO": "SmartCV",
    "OpenCV": "Spring AI",
    "OCR": "LLM",
    "camera giao thông": "nền tảng tuyển dụng",
}

_SUBHEADING_RE = re.compile(r"^Heading [23]$")


def _is_subheading(para) -> bool:
    return bool(_SUBHEADING_RE.match(para.style.name))


def rewrite_chapter1(doc, chapter: ChapterBucket, llm: LLMClient, kb: str) -> None:
    current_section = chapter.title
    for idx in tqdm(chapter.body_indices, desc=f"  Ch1: {chapter.title[:25]}"):
        para = doc.paragraphs[idx]
        if _is_subheading(para):
            current_section = get_paragraph_text(para)
            continue
        original = get_paragraph_text(para).strip()
        if not original:
            continue
        prompt = (
            f"Ngữ cảnh dự án:\n{kb[:20_000]}\n\n"
            f"Mục hiện tại trong báo cáo: {current_section}\n\n"
            f"Đoạn văn gốc cần viết lại:\n{original}\n\n"
            "Viết lại đoạn văn này cho dự án SmartCV. "
            "Giữ nguyên độ dài tương đương. "
            "Chỉ trả về đoạn văn đã viết lại, không thêm giải thích hay tiêu đề."
        )
        result = llm.rewrite(prompt)
        if result:
            replace_paragraph_text(para, result)


def rewrite_chapter2(doc, chapter: ChapterBucket, llm: LLMClient, kb: str) -> None:
    prompt = (
        f"Ngữ cảnh kỹ thuật của dự án SmartCV:\n{kb}\n\n"
        "Viết nội dung học thuật cho chương 'Cơ Sở Lý Thuyết' của đồ án tốt nghiệp "
        "về dự án SmartCV - nền tảng tuyển dụng thông minh. "
        "Trình bày lý thuyết về: React 19, Spring Boot 3, kiến trúc Microservices, "
        "MongoDB, Redis, RabbitMQ, Elasticsearch, Spring AI với Llama 3, "
        "AWS S3, Docker, CI/CD với GitHub Actions, Golang cho Notification Service. "
        "Viết khoảng 800-1000 chữ, chia đoạn rõ ràng, dùng gạch đầu dòng khi liệt kê."
    )
    result = llm.rewrite(prompt)
    if not result or not chapter.body_indices:
        return
    replace_paragraph_text(doc.paragraphs[chapter.body_indices[0]], result)
    for idx in chapter.body_indices[1:]:
        clear_paragraph(doc.paragraphs[idx])


def rewrite_chapter_heading_only(
    doc, chapter: ChapterBucket, llm: LLMClient, kb: str
) -> None:
    heading_para = doc.paragraphs[chapter.heading_index]
    original = get_paragraph_text(heading_para).strip()
    prompt = (
        f"Ngữ cảnh SmartCV:\n{kb[:10_000]}\n\n"
        f"Tiêu đề gốc của chương: {original}\n\n"
        "Viết lại tiêu đề chương này sao cho phản ánh đúng nội dung dự án SmartCV. "
        "Giữ nguyên số chương (VD: CHƯƠNG 3). "
        "Chỉ trả về tiêu đề, không giải thích."
    )
    result = llm.rewrite(prompt)
    if result:
        replace_paragraph_text(heading_para, result.strip())
    for idx in chapter.body_indices:
        clear_paragraph(doc.paragraphs[idx])


def apply_keyword_replacements(doc) -> None:
    def _replace_in_para(para):
        text = get_paragraph_text(para)
        new_text = text
        for old, new in KEYWORD_MAP.items():
            new_text = new_text.replace(old, new)
        if new_text != text:
            replace_paragraph_text(para, new_text)

    for para in doc.paragraphs:
        _replace_in_para(para)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _replace_in_para(para)


def main():
    parser = argparse.ArgumentParser(
        description="Rewrite a graduation thesis .docx for the SmartCV project"
    )
    parser.add_argument("--context", required=True, help="Path to context dir or .md file")
    parser.add_argument(
        "--template",
        default="docs/BAOCAODOANTOTNGHIEP.docx",
        help="Source .docx template",
    )
    parser.add_argument(
        "--output",
        default="docs/phamlucchuong.docx",
        help="Output .docx path",
    )
    args = parser.parse_args()

    template = Path(args.template)
    output = Path(args.output)

    if not template.exists():
        print(f"Error: template not found: {template}", file=sys.stderr)
        sys.exit(1)

    print("Loading context...")
    try:
        kb = load_context(args.context)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"Context: {len(kb):,} chars loaded")

    output.parent.mkdir(parents=True, exist_ok=True)
    print(f"Cloning {template.name} → {output}")
    shutil.copy(template, output)

    doc = Document(str(output))
    chapters = detect_chapters(doc)
    print(f"Detected {len(chapters)} chapter(s):")
    for c in chapters:
        print(f"  [{c.heading_index}] {c.title[:60]} ({len(c.body_indices)} body paragraphs)")

    llm = LLMClient()
    print(f"LLM mode: {llm.mode}")

    print("Applying keyword replacements...")
    apply_keyword_replacements(doc)

    for chapter in chapters:
        title_upper = chapter.title.upper()
        if re.match(r"CHƯƠNG\s+1\b", title_upper):
            print(f"→ CHƯƠNG 1: keep subheadings, rewrite body paragraphs")
            rewrite_chapter1(doc, chapter, llm, kb)
        elif re.match(r"CHƯƠNG\s+2\b", title_upper):
            print(f"→ CHƯƠNG 2: generate full academic content")
            rewrite_chapter2(doc, chapter, llm, kb)
        elif re.match(r"CHƯƠNG\s+[34]\b", title_upper):
            print(f"→ {chapter.title[:40]}: rewrite heading, clear body")
            rewrite_chapter_heading_only(doc, chapter, llm, kb)

    print(f"Saving → {output}")
    doc.save(str(output))
    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
cd plans/superpowers/thesis-rewriter
pytest tests/test_rewriter.py -v
```

Expected: 9 tests PASSED.

- [ ] **Step 5: Run full test suite**

```bash
cd plans/superpowers/thesis-rewriter
pytest -v
```

Expected: all tests across all 4 test files PASSED, no failures.

- [ ] **Step 6: Commit**

```bash
git add plans/superpowers/thesis-rewriter/rewriter.py plans/superpowers/thesis-rewriter/tests/test_rewriter.py
git commit -m "feat: implement rewriter orchestrator with chapter strategies"
```

---

## Task 6: Smoke test against the real template

No automated test — manual verification against the actual `.docx` and context files.

- [ ] **Step 1: Verify claude CLI is authenticated**

```bash
claude --version
echo "test" | claude -p "respond with: ok"
```

Expected: version string printed, then `ok` (or similar acknowledgement).

- [ ] **Step 2: Run the tool with a dry-run on a small context file**

```bash
cd plans/superpowers/thesis-rewriter
python rewriter.py \
  --context /home/chuongpl/projects/smartCv/docs/VN/1_BRD.md \
  --template /home/chuongpl/projects/smartCv/docs/BAOCAODOANTOTNGHIEP.docx \
  --output /tmp/smartcv-test-run.docx
```

Expected output:
```
Loading context...
Context: N chars loaded
Cloning BAOCAODOANTOTNGHIEP.docx → /tmp/smartcv-test-run.docx
Detected N chapter(s): ...
LLM mode: subprocess
Applying keyword replacements...
→ CHƯƠNG 1: keep subheadings, rewrite body paragraphs
...
Saving → /tmp/smartcv-test-run.docx
Done.
```

- [ ] **Step 3: Run with full context**

```bash
cd plans/superpowers/thesis-rewriter
python rewriter.py \
  --context /home/chuongpl/projects/smartCv/docs/VN \
  --template /home/chuongpl/projects/smartCv/docs/BAOCAODOANTOTNGHIEP.docx \
  --output /home/chuongpl/projects/smartCv/docs/phamlucchuong.docx
```

- [ ] **Step 4: Open and inspect phamlucchuong.docx**

Open the output file in LibreOffice or Word and verify:
- Cover page: name/project updated (keyword replacements applied)
- CHƯƠNG 1: subheadings preserved, body paragraphs rewritten in Vietnamese
- CHƯƠNG 2: filled with academic tech-stack content mentioning SmartCV technologies
- CHƯƠNG 3 & 4: headings updated to SmartCV context, body cleared
- Formatting (fonts, sizes, styles) preserved throughout

- [ ] **Step 5: Final commit**

```bash
git add plans/superpowers/thesis-rewriter/
git commit -m "feat: complete thesis-rewriter CLI implementation"
```
