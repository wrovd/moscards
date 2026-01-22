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

    const table: ParsedTable = { headers, rows: rows.length ? rows : [] };
    return normalizeTable(table);
  }

  // --- XLSX ---
  if (ext === "xlsx") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("XLSX пустой: нет листов");

    const sheet = wb.Sheets[sheetName];

    // sheet_to_json берёт первую строку как заголовки, но WB часто имеет группы/подсказки,
    // поэтому мы нормализуем результат ниже.
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

    const headersRaw = Object.keys(json[0] || {});
    const headers = ensureHeaders(headersRaw);

    const rows = json.map((obj) => {
      const r: Record<string, string> = {};
      for (const h of headers) r[h] = obj?.[h] != null ? String(obj[h]) : "";
      return r;
    });

    const table: ParsedTable = { headers, rows: rows.length ? rows : [] };
    return normalizeTable(table);
  }

  throw new Error("Неподдерживаемый формат. Загрузите CSV или XLSX.");
}
