export type CsvOptions = {
  delimiter?: "," | ";" | "\t";
  includeBom?: boolean;
};

function escapeCsvCell(value: any, delimiter: string) {
  const s = (value ?? "").toString();
  const mustQuote =
    s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(delimiter);
  const escaped = s.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

export function tableToCsv(
  headers: string[],
  rows: Record<string, string>[],
  opts: CsvOptions = {}
) {
  const delimiter = opts.delimiter ?? ";";

  const lines: string[] = [];
  lines.push(headers.map((h) => escapeCsvCell(h, delimiter)).join(delimiter));

  for (const r of rows) {
    const line = headers.map((h) => escapeCsvCell(r?.[h] ?? "", delimiter)).join(delimiter);
    lines.push(line);
  }

  const csv = lines.join("\r\n");
  const bom = opts.includeBom ? "\uFEFF" : "";
  return bom + csv;
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
