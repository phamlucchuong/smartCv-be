# Thesis Rewriter CLI — Design Spec

**Date:** 2026-06-15
**Status:** Approved

---

## Overview

A Python CLI tool that clones a reference graduation thesis `.docx` and rewrites its content for the SmartCV project using Claude. Context is dynamically ingested from `.md` documentation files — no hardcoded content.

**LLM backend:** defaults to calling the `claude` CLI subprocess (reuses the active Claude Code session — no API key required). Falls back to the Anthropic SDK when `ANTHROPIC_API_KEY` is set.

---

## CLI Interface

```bash
python rewriter.py \
  --context /home/chuongpl/projects/smartCv/docs/VN \
  --template /home/chuongpl/projects/smartCv/docs/BAOCAODOANTOTNGHIEP.docx \
  --output /home/chuongpl/projects/smartCv/docs/phamlucchuong.docx
```

- `--context`: Path to a file or directory. Prioritizes `.md` files as source of truth.
- `--template`: Source `.docx` file to clone. Default: `docs/BAOCAODOANTOTNGHIEP.docx`.
- `--output`: Output `.docx` file path. Default: `docs/phamlucchuong.docx`.

---

## File Structure

```
thesis-rewriter/
├── rewriter.py          # Entry point, argparse, orchestrator
├── context_loader.py    # Reads --context dir, prioritizes .md files
├── docx_parser.py       # Chapter boundary detection, Run-level traversal
├── llm_client.py        # Anthropic API wrapper with retry logic
└── requirements.txt     # python-docx, anthropic, tqdm
```

---

## Architecture

### 1. Context Loading (`context_loader.py`)

1. Scan `--context` path — if directory, collect all `.md` files first, then `.txt` as fallback.
2. Read and concatenate into a single `PROJECT_KNOWLEDGE_BASE` string.
3. Truncate to ~100k characters if oversized: keep leading + trailing portions, drop the middle.

### 2. Document Cloning

Use `shutil.copy` to physically clone `--template` → `--output` before any modifications. All edits happen on the output copy.

### 3. Chapter Detection (`docx_parser.py`)

Detect chapter boundaries by finding paragraphs where:
- `paragraph.style.name` matches `Heading 1`, **or**
- `paragraph.text` matches regex `^CHƯƠNG\s+\d+`

Group all paragraphs between boundaries into named chapter buckets.

### 4. Per-Chapter Rewrite Strategy

| Chapter | Strategy |
|---|---|
| CHƯƠNG 1 | Keep all Heading 2/3 subheadings intact. LLM rewrites body paragraphs only, using the nearest heading above as context anchor. |
| CHƯƠNG 2 | LLM generates full academic content about the tech stack based on `PROJECT_KNOWLEDGE_BASE`. |
| CHƯƠNG 3 | LLM rewrites the chapter-level heading only to reflect SmartCV features. Body content is cleared. |
| CHƯƠNG 4 | Same as CHƯƠNG 3. |
| All other sections (cover, table of contents, references) | Keyword replacement only (project name, year, student name). |

### 5. Run-Level Text Replacement

To preserve all fonts, styles, and formatting:

1. Collect text from all `.runs` in a paragraph.
2. Send the concatenated text to the LLM.
3. Write the returned text into `run[0].text`.
4. Set `run.text = ""` for all subsequent runs in the same paragraph.
5. The style/font of `run[0]` is preserved intact.

### 6. LLM Call Flow (`llm_client.py`)

Two modes, auto-selected at `LLMClient` init. All callers use the same `rewrite(system, user) -> str` interface.

**Mode A — Claude Code subprocess (default):**
```
Activated when: ANTHROPIC_API_KEY is not set in environment
For each rewrite unit:
  1. Build combined prompt:
       full_prompt = ANTI_AI_SYSTEM_PROMPT + "\n\n" + user_content
  2. subprocess.run(['claude', '-p', full_prompt], capture_output=True, timeout=120)
  3. On non-zero returncode or empty stdout → log warning, skip unit, preserve original
  (claude CLI handles its own rate-limit retries internally)
```

**Mode B — Anthropic SDK (explicit API key):**
```
Activated when: ANTHROPIC_API_KEY is set in environment
For each rewrite unit:
  1. Build messages:
       system = ANTI_AI_SYSTEM_PROMPT
       user   = PROJECT_KNOWLEDGE_BASE + chapter_content + rewrite_instruction
  2. Call claude-opus-4-8 (thinking: adaptive, max_tokens=4096)
  3. On RateLimitError → exponential backoff: 1s → 2s → 4s (max 3 retries)
  4. On APIError → log warning, skip unit, preserve original text
```

### 7. Anti-AI System Prompt

Injected verbatim as the `system` role message for every LLM call:

```
Bạn là một sinh viên năm cuối ngành Công nghệ Thông tin. Nhiệm vụ của bạn là viết nội dung cho báo cáo đồ án tốt nghiệp chuyên nghiệp nhưng mang tính con người cao nhất để vượt qua AI Detector.
Quy tắc NGHIÊM NGẶT:
- TUYỆT ĐỐI KHÔNG dùng dấu ngoặc kép ("") trong văn bản.
- KHÔNG dùng từ ngữ khuôn mẫu AI: 'Nhìn chung', 'Tóm lại', 'Đáng chú ý', 'Trong bối cảnh'.
- Tạo human burstiness: đan xen liên tục giữa câu đơn siêu ngắn (5-7 chữ) và câu ghép phức tạp.
- Từ vựng kỹ thuật chính xác, nhưng văn phong trình bày mộc mạc, thực tế. Không lạm dụng tính từ mạnh.
- Viết đoạn văn ngắn, dùng gạch đầu dòng để liệt kê, tuyệt đối không tạo các khối văn bản tường trình quá dài.
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `--template` file not found | Exit with clear error message |
| `--context` dir/file not found | Exit with clear error message |
| No `.md` files found in context dir | Warn and attempt `.txt` fallback; abort if nothing readable |
| LLM rate limit | Exponential backoff, max 3 retries |
| LLM API error | Log warning, skip paragraph, preserve original |
| Context too large (>100k chars) | Truncate with logged warning |

---

## Dependencies

```
python-docx>=1.1.0
tqdm>=4.66.0
anthropic>=0.25.0   # optional — only needed for Mode B (SDK path)
```

The `claude` CLI must be installed and authenticated for Mode A (default). Verify with `which claude && claude --version`.

---

## Out of Scope

- Multi-provider support (OpenAI, etc.) — Anthropic only.
- GUI or web interface.
- PDF output.
- Automatic table-of-contents regeneration.
