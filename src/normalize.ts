import type { ParsedTable } from "./importer";

function isMostlyEmptyRow(row: Record<string, string>, headers: string[]) {
  let filled = 0;
  for (const h of headers) {
    const v = (row[h] ?? "").toString().trim();
    if (v) filled++;
  }
  return filled <= Math.max(1, Math.floor(headers.length * 0.06));
}

function scoreHeaderRow(values: string[]) {
  let score = 0;

  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  const uniq = new Set(cleaned);
  score += Math.min(uniq.size, 24);

  for (const v of cleaned) {
    if (/(артикул|бренд|наимен|описан|цена|sku|barcode|штрих|цвет|материал|модель|совместим|фото|image)/i.test(v))
      score += 6;

    // слишком длинные тексты чаще бывают подсказками/описаниями
    if (v.length > 80) score -= 4;

    // __EMPTY - мусор
    if (/^__empty/i.test(v)) score -= 10;
  }

  return score;
}

function cleanHeader(h: string) {
  const s = (h ?? "").toString().trim();
  if (/^__empty/i.test(s)) return "";
  return s;
}

export function normalizeTable(input: ParsedTable): ParsedTable {
  const rawHeaders = input.headers.map(cleanHeader);
  const rawRows = input.rows;

  const headerMap: { title: string; idx: number }[] = rawHeaders
    .map((t, idx) => ({ title: t, idx }))
    .filter((x) => x.title);

  const headers = headerMap.map((x) => x.title);
  if (headers.length < 3) {
    // не ломаем редкие кейсы — возвращаем как есть
    return input;
  }

  // Пытаемся найти реальную строку заголовков среди первых 25 строк
  const scanCount = Math.min(rawRows.length, 25);
  let bestIndex = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < scanCount; i++) {
    const row = rawRows[i];
    const vals = headerMap.map((h) => (row[input.headers[h.idx]] ?? "").toString());
    const score = scoreHeaderRow(vals);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  // если похоже на “настоящую шапку” — используем её
  if (bestIndex >= 0 && bestScore >= 8) {
    const headerRow = rawRows[bestIndex];

    const newHeadersRaw = headerMap.map((h) => (headerRow[input.headers[h.idx]] ?? "").toString().trim());
    const newHeaders = newHeadersRaw
      .map(cleanHeader)
      .map((h, i) => (h ? h : `Колонка ${i + 1}`));

    const dataRows = rawRows
      .slice(bestIndex + 1)
      .filter((r) => !isMostlyEmptyRow(r, input.headers)); // только пустые убираем

    const finalRows = dataRows.map((r) => {
      const out: Record<string, string> = {};
      for (let j = 0; j < newHeaders.length; j++) {
        const srcHeader = input.headers[headerMap[j]?.idx ?? j];
        out[newHeaders[j]] = (r?.[srcHeader] ?? "").toString();
      }
      return out;
    });

    // ВАЖНО: больше не “убиваем” строки по длине текста.
    // У товаров описания могут быть длинные — это нормально.

    return { headers: newHeaders, rows: finalRows };
  }

  // fallback
  const compactRows = rawRows
    .filter((r) => !isMostlyEmptyRow(r, input.headers))
    .map((r) => {
      const out: Record<string, string> = {};
      for (const h of headerMap) out[input.headers[h.idx]] = (r[input.headers[h.idx]] ?? "").toString();
      return out;
    });

  return { headers, rows: compactRows };
}
