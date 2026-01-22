import Papa from "papaparse";
import * as XLSX from "xlsx";
import { normalizeTable } from "./normalize";

export type ParsedTable = {
  headers: string[];
  rows: Record<string, string>[];
};

function ensureHeaders(headers: string[]) {
  const clean = (headers || []).map((h) => (h ?? "").toString().trim());
  if (!clean.length || clean.every((x) => !x)) {
    throw new Error("В файле нет заголовков (первая строка должна быть шапкой таблицы).");
  }
  return clean.map((h, i) => (h ? h : `Колонка ${i + 1}`));
}

function scoreRowAsHeader(cells: string[]) {
  // Пытаемся понять, какая строка больше всего похожа на заголовки
  const vals = cells.map((c) => (c ?? "").toString().trim()).filter(Boolean);
  if (vals.length < 3) return -999;

  let score = 0;
  score += Math.min(new Set(vals).size, 24);

  for (const v of vals) {
    if (/(артикул|бренд|наимен|описан|цена|sku|barcode|штрих|цвет|материал|модель|совместим|фото|image)/i.test(v))
      score += 6;
    if (/^__empty/i.test(v)) score -= 10;
    if (v.length > 80) score -= 3;
  }
  return score;
}

function matrixToTable(matrix: any[][]): ParsedTable {
  // matrix: [ [A1,B1,C1...], [A2,B2,C2...], ... ]
  const rows = matrix
    .map((r) => (r || []).map((c) => (c ?? "").toString()))
    .filter((r) => r.some((c) => c.trim() !== ""));

  if (!rows.length) throw new Error("XLSX пустой: нет данных на листе.");

  // Ищем строку заголовков среди первых 40 непустых строк
  const scan = Math.min(rows.length, 40);
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < scan; i++) {
    const s = scoreRowAsHeader(rows[i]);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const headerRow = rows[bestIdx] || [];
  const headers = ensureHeaders(headerRow.map((x) => x.toString()));

  const dataRowsRaw = rows.slice(bestIdx + 1);

  const outRows: Record<string, string>[] = dataRowsRaw
    .map((r) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = (r[i] ?? "").toString();
      return obj;
    })
    // убираем полностью пустые строки
    .filter((obj) => Object.values(obj).some((v) => v.trim() !== ""));

  return { headers, rows: outRows };
}

export async function parseFile(file: File): Promise<ParsedTable> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  // --- CSV ---
  if (ext === "csv") {
    const text = await file.text();

    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true
    });

    if (parsed.errors?.length) {
      throw new Error(`Ошибка CSV: ${parsed.errors[0].message}`);
    }

    const headers = ensureHeaders(parsed.meta.fields || []);
    const rows = (parsed.data || []).map((obj) => {
      const r: Record<string, string> = {};
      for (const h of headers) r[h] = obj?.[h] != null ? String(obj[h]) : "";
      return r;
    });

    return normalizeTable({ headers, rows });
  }

  // --- XLSX ---
  if (ext === "xlsx") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("XLSX пустой: нет листов");

    const sheet = wb.Sheets[sheetName];

    // Читаем как матрицу (самый надежный способ для WB шаблонов)
    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
    const table = matrixToTable(matrix);

    return normalizeTable(table);
  }

  throw new Error("Неподдерживаемый формат. Загрузите CSV или XLSX.");
}
