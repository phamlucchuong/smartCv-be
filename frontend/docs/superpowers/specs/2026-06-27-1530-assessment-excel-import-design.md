# Assessment Excel/CSV Import — Design Spec

**Date:** 2026-06-27  
**Scope:** `web-candidate` and `web-recruiter` apps — add Excel/CSV import for assessment questions

---

## 1. Overview

Add an **Import from Excel** button next to the existing "Create Assessment" button in both apps. Users can upload a `.xlsx` or `.csv` file where each row is one question. After parsing, the questions are injected into the existing create-assessment modal so the user can fill in metadata (title, time limit, etc.) and submit.

---

## 2. Affected Files

| File | Change |
|---|---|
| `pnpm-workspace.yaml` / root `package.json` | Add `xlsx` dependency |
| `packages/api/src/excel-import.ts` | New — shared parse + template utility |
| `packages/api/src/index.ts` | Export new utility |
| `apps/web-candidate/src/routes/_account/assessments.tsx` | Add Import button + tooltip + download template |
| `apps/web-recruiter/src/routes/employer/assessments.tsx` | Same as candidate |

---

## 3. Excel/CSV Column Format

Each row represents one question. Header row (row 1) must match these names (case-insensitive, trimmed):

| Column | Required | Values |
|---|---|---|
| `Question` | Yes | Question text |
| `Option A` | Yes (for MCQ) | Answer option text |
| `Option B` | Yes (for MCQ) | Answer option text |
| `Option C` | No | Blank → option omitted |
| `Option D` | No | Blank → option omitted |
| `Correct` | Yes (for MCQ) | `A`, `B`, `C`, or `D` |
| `Type` | No | `MCQ` (default) or `TEXT` |

**TEXT type rows:** `Option A–D` and `Correct` are ignored; the question is imported as open-ended.

**Minimum valid MCQ row:** `Question` + `Option A` + `Option B` + `Correct` must all be non-empty.

---

## 4. Parsing Logic — `packages/api/src/excel-import.ts`

### `parseAssessmentFile(file: File): Promise<ParseResult>`

```typescript
interface ParseResult {
  questions: Question[]   // valid parsed questions
  skippedRows: SkippedRow[]  // rows that failed validation
}

interface SkippedRow {
  rowNumber: number  // 1-based, excluding header
  reason: string     // human-readable explanation
}
```

**Steps:**
1. Read file as `ArrayBuffer`
2. Use SheetJS `XLSX.read()` with `{ type: 'array' }` — handles both `.xlsx` and `.csv`
3. Take first sheet
4. Convert to row objects via `XLSX.utils.sheet_to_json({ header: 1 })` + normalize column names
5. For each data row:
   - Skip if `Question` is blank → `skippedRows` entry "Thiếu nội dung câu hỏi"
   - If `Type` is `TEXT` or blank with no options → create TEXT question
   - For MCQ: skip if `Option A` or `Option B` is blank → "Thiếu đáp án"
   - For MCQ: skip if `Correct` is not A/B/C/D → "Đáp án đúng không hợp lệ (phải là A, B, C hoặc D)"
   - For MCQ: map `Correct` letter to `correctOptionIndex` (A→0, B→1, C→2, D→3)
   - Generate a client-side `id`: `q_import_${rowIndex}_${timestamp}`
6. Return `{ questions, skippedRows }`

### `downloadAssessmentTemplate(): void`

Creates and downloads `assessment-template.xlsx` with:
- Header row with all 7 columns
- 3 example rows (2 MCQ, 1 TEXT)
- Column widths set for readability

---

## 5. UI — Both Apps

### Header area layout

```
[+ Tạo bài test]  [↑ Import Excel]  [? Hướng dẫn]  [↓ Tải file mẫu]
```

- `Import Excel` button: `variant="outline"`, icon `Upload`, triggers hidden `<input type="file" accept=".xlsx,.csv">` via `useRef`
- `?` button: `variant="ghost"` icon-only (`HelpCircle`), shows tooltip on hover listing the 7 columns
- `Tải file mẫu` button: `variant="ghost"` icon-only (`Download`) or text link, calls `downloadAssessmentTemplate()`

### Tooltip content (? button)

```
Format mỗi dòng:
• Question (bắt buộc)
• Option A, Option B (bắt buộc với MCQ)
• Option C, Option D (tuỳ chọn)
• Correct: A / B / C / D
• Type: MCQ (mặc định) hoặc TEXT
```

### Import flow

1. User clicks "Import Excel" → file picker opens
2. User selects file → `parseAssessmentFile(file)` runs
3. **On success (questions > 0):**
   - Toast success: `"Đã import X câu hỏi"` (+ warning if skipped rows exist)
   - If `skippedRows.length > 0`: secondary toast warning: `"Bỏ qua X dòng không hợp lệ: Dòng 3 – Thiếu đáp án, Dòng 7 – ..."`
   - Open create-assessment modal with `questions` pre-filled
   - User fills in title, time limit, description → submit
4. **On success (questions = 0):**
   - Toast error: `"Không tìm thấy câu hỏi hợp lệ. Vui lòng kiểm tra lại file."`
   - List all skipped reasons
5. **On parse error (bad file / corrupt):**
   - Toast error: `"File không đọc được. Vui lòng dùng file .xlsx hoặc .csv hợp lệ."`

### State integration

Both apps already have a `questions: Question[]` state and a `isFormOpen: boolean` state controlling the create modal. On successful import:

```typescript
setQuestions(parsed.questions)
setIsFormOpen(true)
```

No new state needed — the existing modal handles everything else.

---

## 6. Dependency

**Library:** `xlsx` (SheetJS) — `^0.18.5`

Install at monorepo root so both apps share it:
```bash
pnpm add xlsx -w
```

SheetJS supports `.xlsx`, `.csv`, `.xls`, `.ods` automatically — no separate CSV parser needed.

---

## 7. Error Handling Summary

| Scenario | Behavior |
|---|---|
| File type not `.xlsx`/`.csv` | Rejected by `accept` attribute on input; no parse attempted |
| Corrupt/unreadable file | Catch error, toast "File không đọc được" |
| Row missing `Question` | Skip row, add to `skippedRows` with reason |
| MCQ row missing Option A or B | Skip row, add to `skippedRows` |
| MCQ row with invalid `Correct` value | Skip row, add to `skippedRows` |
| All rows skipped | Toast error listing all reasons |
| Mix of valid + invalid rows | Import valid, warn about skipped with row numbers and reasons |

---

## 8. Out of Scope

- Server-side parsing (all parsing is client-side)
- Saving the template file to the repo (generated on-the-fly)
- Bulk-import directly to backend without modal review
- Excel formula evaluation (only cell values are read)
