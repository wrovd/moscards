import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedTable = {
  headers: string[];
  rows: Record<string, string>[];
};

export type XlsxMeta = {
  sheetNames: string[];
};

function ensureHeaders(headers: string[]) {
  const clean = (headers || []).map((h) => (h ?? "").toString().trim());
  if (!clean.length || clean.every((x) => !x)) {
    throw new Error("В файле нет заголовков (нужно выбрать строку заголовков).");
  }
  return clean.map((h, i) => (h ? h : `Колонка ${i + 1}`));
}

function scoreRowAsHeader(cells: string[]) {
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

function postProcessTable(table: ParsedTable): ParsedTable {
  // Уберём пустые заголовки и пустые строки
  const headers = table.headers.map((h) => h.trim());
  const keepIdx: number[] = [];
  for (let i = 0; i < headers.length; i++) if (headers[i]) keepIdx.push(i);

  const finalHeaders = keepIdx.map((i) => headers[i]);

  const finalRows = table.rows
    .map((r) => {
      const out: Record<string, string> = {};
      for (const i of keepIdx) out[headers[i]] = (r[headers[i]] ?? "").toString();
      return out;
    })
    .filter((r) => Object.values(r).some((v) => v.trim() !== ""));

  return { headers: finalHeaders, rows: finalRows };
}

export async function parseCsv(file: File): Promise<ParsedTable> {
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

  return postProcessTable({ headers, rows });
}

export async function getXlsxMeta(file: File): Promise<XlsxMeta> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return { sheetNames: wb.SheetNames || [] };
}

export async function readXlsxMatrix(file: File, sheetIndex: number): Promise<any[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const name = wb.SheetNames?.[sheetIndex];
  if (!name) throw new Error("Не найден лист XLSX");
  const sheet = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
  return matrix || [];
}

export function guessHeaderRowIndex(matrix: any[][]): number {
  // ищем лучшую строку заголовков среди первых 40 строк матрицы
  const scan = Math.min(matrix.length, 40);
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < scan; i++) {
    const row = (matrix[i] || []).map((c) => (c ?? "").toString());
    const s = scoreRowAsHeader(row);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function matrixToTable(matrix: any[][], headerRowIndex: number): ParsedTable {
  if (!matrix.length) throw new Error("XLSX пустой: нет данных на листе.");

  const headerRow = (matrix[headerRowIndex] || []).map((x) => (x ?? "").toString().trim());
  const headers = ensureHeaders(headerRow);

  const data = matrix.slice(headerRowIndex + 1);

  const rows: Record<string, string>[] = data
    .map((r) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = (r?.[i] ?? "").toString();
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v.trim() !== ""));

  return postProcessTable({ headers, rows });
}

export async function parseFileSmart(file: File): Promise<{
  table: ParsedTable;
  meta?: XlsxMeta;
  matrix?: any[][];
  sheetIndex?: number;
  headerRowIndex?: number;
}> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if (ext === "csv") {
    const table = await parseCsv(file);
    return { table };
  }

  if (ext === "xlsx") {
    const meta = await getXlsxMeta(file);
    const sheetIndex = 0;
    const matrix = await readXlsxMatrix(file, sheetIndex);
    const headerRowIndex = guessHeaderRowIndex(matrix);
    const table = matrixToTable(matrix, headerRowIndex);
    return { table, meta, matrix, sheetIndex, headerRowIndex };
  }

  throw new Error("Неподдерживаемый формат. Загрузите CSV или XLSX.");
}
