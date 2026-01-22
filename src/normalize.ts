import type { ParsedTable } from "./importer";

function isMostlyEmptyRow(row: Record<string, string>, headers: string[]) {
  let filled = 0;
  for (const h of headers) {
    const v = (row[h] ?? "").toString().trim();
    if (v) filled++;
  }
  return filled <= Math.max(1, Math.floor(headers.length * 0.08));
}

function scoreHeaderRow(values: string[]) {
  // Чем больше "похоже на заголовки" — тем выше score
  let score = 0;

  const uniq = new Set(values.map((v) => v.trim()).filter(Boolean));
  score += Math.min(uniq.size, 20);

  for (const v of values) {
    const s = v.trim();
    if (!s) continue;

    // типичные поля WB/Ozon
    if (/(артикул|бренд|наимен|описан|цена|sku|barcode|штрих|цвет|материал|модель|совместим|фото|image)/i.test(s))
      score += 6;

    // слишком длинное — скорее описание, не заголовок
    if (s.length > 60) score -= 6;

    // если похоже на предложение (точки/много пробелов) — описание
    if ((s.match(/\s/g) || []).length >= 6) score -= 3;
    if (s.includes(".")) score -= 2;

    // если __EMPTY — это мусорный заголовок
    if (/^__empty/i.test(s)) score -= 10;
  }

  return score;
}

function cleanHeader(h: string) {
  const s = (h ?? "").toString().trim();

  // часто SheetJS даёт __EMPTY / __EMPTY_1 ...
  if (/^__empty/i.test(s)) return "";

  // иногда заголовок — это "группа" типа "Основная информация"
  // не выкидываем автоматически, но он будет отфильтрован по скорингу

  return s;
}

export function normalizeTable(input: ParsedTable): ParsedTable {
  const rawHeaders = input.headers.map(cleanHeader);
  const rawRows = input.rows;

  // 1) выкинем пустые заголовки
  const headerMap: { title: string; idx: number }[] = rawHeaders
    .map((t, idx) => ({ title: t, idx }))
    .filter((x) => x.title);

  const headers = headerMap.map((x) => x.title);

  // Если после чистки заголовков почти ничего не осталось — вернём как есть
  if (headers.length < 3) return input;

  // 2) попытаемся найти "настоящую шапку" среди первых строк
  // В WB часто первая строка - группы, вторая - реальные заголовки, третья - подсказки.
  const scanCount = Math.min(rawRows.length, 12);
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

  // Если нашли адекватную шапку — используем её значения как headers (после чистки)
  // При этом данные начинаются со следующей строки
  if (bestIndex >= 0 && bestScore >= 8) {
    const headerRow = rawRows[bestIndex];

    const newHeadersRaw = headerMap.map((h) => (headerRow[input.headers[h.idx]] ?? "").toString().trim());
    const newHeaders = newHeadersRaw
      .map(cleanHeader)
      .map((h, i) => (h ? h : `Колонка ${i + 1}`));

    // уберём совсем мусорные "колонка N" если их слишком много
    const meaningful = newHeaders.filter((h) => !/^Колонка\s+\d+$/i.test(h)).length;
    const finalHeaders = meaningful >= 3 ? newHeaders : headers;

    // строки данных: всё после bestIndex
    const dataRows = rawRows.slice(bestIndex + 1).filter((r) => !isMostlyEmptyRow(r, input.headers));

    // сконструируем rows уже под finalHeaders, беря значения из исходных колонок по позиции
    const finalRows = dataRows.map((r) => {
      const out: Record<string, string> = {};
      for (let j = 0; j < finalHeaders.length; j++) {
        const srcHeader = input.headers[headerMap[j]?.idx ?? j];
        out[finalHeaders[j]] = (r?.[srcHeader] ?? "").toString();
      }
      return out;
    });

    // 3) если последняя строка выглядит как подсказки (“это номер или название…”) — уберём её
    const cleanedRows = finalRows.filter((row) => {
      const text = Object.values(row).join(" ").toLowerCase();
      const looksLikeHelp =
        text.includes("это номер") ||
        text.includes("уникальный идентификатор") ||
        text.includes("заполните") ||
        text.includes("вы сможете") ||
        text.length > 400; // очень длинная строка обычно описание
      return !looksLikeHelp;
    });

    return {
      headers: finalHeaders,
      rows: cleanedRows
    };
  }

  // fallback: просто фильтруем пустые/мусорные заголовки и пустые строки
  const compactRows = rawRows
    .filter((r) => !isMostlyEmptyRow(r, input.headers))
    .map((r) => {
      const out: Record<string, string> = {};
      for (const h of headerMap) out[input.headers[h.idx]] = (r[input.headers[h.idx]] ?? "").toString();
      return out;
    });

  return {
    headers,
    rows: compactRows
  };
}
