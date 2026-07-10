import * as XLSX from 'xlsx';
import type { Question } from './generated/application/model';

export interface SkippedRow {
  rowNumber: number;
  reason: string;
}

export interface ParseResult {
  questions: Question[];
  skippedRows: SkippedRow[];
}

export async function parseAssessmentFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) return { questions: [], skippedRows: [] };

  const header = (rows[0] as string[]).map(h => String(h).trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());

  const qIdx = col('question');
  const optAIdx = col('option a');
  const optBIdx = col('option b');
  const optCIdx = col('option c');
  const optDIdx = col('option d');
  const correctIdx = col('correct');
  const typeIdx = col('type');

  if (qIdx === -1) {
    throw new Error('Không tìm thấy cột "Question". Vui lòng dùng file mẫu.');
  }

  const questions: Question[] = [];
  const skippedRows: SkippedRow[] = [];
  const ts = Date.now();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const rowNum = i;

    const questionText = String(row[qIdx] ?? '').trim();
    if (!questionText) {
      if (row.every(cell => !String(cell).trim())) continue;
      skippedRows.push({ rowNumber: rowNum, reason: 'Thiếu nội dung câu hỏi' });
      continue;
    }

    const typeRaw = typeIdx !== -1 ? String(row[typeIdx] ?? '').trim().toUpperCase() : '';
    if (typeRaw === 'TEXT') {
      skippedRows.push({ rowNumber: rowNum, reason: 'Chỉ hỗ trợ câu hỏi trắc nghiệm (MCQ), không hỗ trợ tự luận (TEXT)' });
      continue;
    }

    const optA = optAIdx !== -1 ? String(row[optAIdx] ?? '').trim() : '';
    const optB = optBIdx !== -1 ? String(row[optBIdx] ?? '').trim() : '';
    const optC = optCIdx !== -1 ? String(row[optCIdx] ?? '').trim() : '';
    const optD = optDIdx !== -1 ? String(row[optDIdx] ?? '').trim() : '';
    const correctRaw = correctIdx !== -1 ? String(row[correctIdx] ?? '').trim().toUpperCase() : '';

    if (!optA || !optB) {
      skippedRows.push({ rowNumber: rowNum, reason: 'Thiếu đáp án (cần ít nhất Option A và Option B)' });
      continue;
    }

    if (!['A', 'B', 'C', 'D'].includes(correctRaw)) {
      skippedRows.push({ rowNumber: rowNum, reason: `Đáp án đúng "${correctRaw}" không hợp lệ (phải là A, B, C hoặc D)` });
      continue;
    }

    const correctMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const options = [optA, optB, optC, optD].filter(Boolean);
    const correctOptionIndex = correctMap[correctRaw];

    if (correctOptionIndex >= options.length) {
      skippedRows.push({ rowNumber: rowNum, reason: `Đáp án đúng "${correctRaw}" vượt quá số lựa chọn (chỉ có ${options.length} lựa chọn)` });
      continue;
    }

    questions.push({
      id: `q_import_${i}_${ts}`,
      text: questionText,
      type: 'MCQ' as Question['type'],
      options,
      correctOptionIndex,
    });
  }

  return { questions, skippedRows };
}

export function downloadAssessmentTemplate(): void {
  const data = [
    ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct'],
    [
      'Java interface khác abstract class ở điểm nào?',
      'Interface hỗ trợ đa kế thừa',
      'Abstract class hỗ trợ đa kế thừa',
      'Cả hai như nhau',
      '',
      'A',
    ],
    [
      'Closure trong JavaScript là gì?',
      'Hàm nhớ scope bên ngoài',
      'Hàm chạy bất đồng bộ',
      'Một kiểu class',
      'Không có câu nào đúng',
      'A',
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'assessment-template.xlsx');
}
