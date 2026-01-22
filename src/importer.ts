import Papa from "papaparse";
import * as XLSX from "xlsx";

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

    return { headers, rows: rows.length ? rows : [] };
  }

  if (ext === "xlsx") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("XLSX пустой: нет листов");

    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

    const headersRaw = Object.keys(json[0] || {});
    const headers = ensureHeaders(headersRaw);

    const rows = json.map((obj) => {
      const r: Record<string, string> = {};
      for (const h of headers) r[h] = obj?.[h] != null ? String(obj[h]) : "";
      return r;
    });

    return { headers, rows: rows.length ? rows : [] };
  }

  throw new Error("Неподдерживаемый формат. Загрузите CSV или XLSX.");
}
