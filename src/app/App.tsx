import { useMemo, useRef, useState } from "react";
import {
  ParsedTable,
  parseFileSmart,
  readXlsxMatrix,
  matrixToTable,
  guessHeaderRowIndex,
  XlsxMeta
} from "../importer";
import { downloadTextFile, tableToCsv } from "../exporter";

type Mode = "single" | "bulk" | "replace" | null;

export default function App() {
  const [mode, setMode] = useState<Mode>(null);

  const [table, setTable] = useState<ParsedTable | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // XLSX controls
  const [xlsxMeta, setXlsxMeta] = useState<XlsxMeta | null>(null);
  const [xlsxMatrix, setXlsxMatrix] = useState<any[][] | null>(null);
  const [sheetIndex, setSheetIndex] = useState<number>(0);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);

  // export settings
  const [csvDelimiter, setCsvDelimiter] = useState<"," | ";" | "\t">(";");
  const [csvBom, setCsvBom] = useState<boolean>(true);

  // SINGLE editor
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<File | null>(null);

  const title = useMemo(() => {
    if (!mode) return "MosCards";
    if (mode === "single") return "1 товар";
    if (mode === "bulk") return "Много товаров";
    return "Изменить модель";
  }, [mode]);

  function openPicker() {
    inputRef.current?.click();
  }

  function resetToMode() {
    setTable(null);
    setFileName("");
    setErr("");
    setXlsxMeta(null);
    setXlsxMatrix(null);
    setSheetIndex(0);
    setHeaderRowIndex(0);
    setSelectedRowIndex(0);
    fileRef.current = null;
  }

  async function onPickFile(file: File) {
    setErr("");
    resetToMode();
    setFileName(file.name);
    fileRef.current = file;

    try {
      const res = await parseFileSmart(file);
      setTable(res.table);

      if (res.meta && res.matrix != null) {
        setXlsxMeta(res.meta);
        setXlsxMatrix(res.matrix);
        setSheetIndex(res.sheetIndex ?? 0);
        setHeaderRowIndex(res.headerRowIndex ?? 0);
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка импорта");
    }
  }

  async function changeSheet(nextSheetIndex: number) {
    try {
      setErr("");
      setTable(null);
      setSheetIndex(nextSheetIndex);
      setSelectedRowIndex(0);

      const f = fileRef.current;
      if (!f) return;

      const matrix = await readXlsxMatrix(f, nextSheetIndex);
      setXlsxMatrix(matrix);

      const guessed = guessHeaderRowIndex(matrix);
      setHeaderRowIndex(guessed);

      const t = matrixToTable(matrix, guessed);
      setTable(t);
    } catch (e: any) {
      setErr(e?.message || "Ошибка чтения листа");
    }
  }

  function changeHeaderRow(nextHeaderRowIndex: number) {
    try {
      setErr("");
      setHeaderRowIndex(nextHeaderRowIndex);
      setSelectedRowIndex(0);

      if (!xlsxMatrix) return;
      const t = matrixToTable(xlsxMatrix, nextHeaderRowIndex);
      setTable(t);
    } catch (e: any) {
      setErr(e?.message || "Ошибка выбора строки заголовков");
    }
  }

  function updateSingleField(key: string, value: string) {
    if (!table) return;
    if (!table.rows.length) return;

    const idx = Math.min(selectedRowIndex, table.rows.length - 1);
    const rows = table.rows.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, [key]: value };
    });

    setTable({ ...table, rows });
  }

  function doExportCsv() {
    if (!table) return;
    const base = (fileName || "moscards").replace(/\.(xlsx|csv)$/i, "");
    const outName = `${base}.export.csv`;

    const csv = tableToCsv(table.headers, table.rows, {
      delimiter: csvDelimiter,
      includeBom: csvBom
    });

    downloadTextFile(outName, csv, "text/csv;charset=utf-8");
  }

  // Screen 1: mode select
  if (!mode) {
    return (
      <div style={styles.page}>
        <h1>MosCards</h1>
        <p style={styles.subtitle}>Конструктор карточек для Ozon и Wildberries</p>

        <div style={styles.grid}>
          <button style={styles.card} onClick={() => setMode("single")}>
            <h3>1 товар</h3>
            <p>Создание и редактирование одной карточки</p>
          </button>

          <button style={styles.card} onClick={() => setMode("bulk")}>
            <h3>Много товаров</h3>
            <p>Массовое заполнение таблицы</p>
          </button>

          <button style={styles.card} onClick={() => setMode("replace")}>
            <h3>Изменить модель</h3>
            <p>Заменить модель смартфона в готовом шаблоне</p>
          </button>
        </div>
      </div>
    );
  }

  const hasData = !!table?.headers?.length;

  return (
    <div style={styles.page}>
      <button
        onClick={() => {
          if (table || fileName) resetToMode();
          else setMode(null);
        }}
        style={styles.back}
      >
        ← Назад
      </button>

      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={styles.subtitle}>
        Загрузите шаблон <b>CSV</b> или <b>XLSX</b>. Для XLSX можно выбрать лист и строку заголовков.
      </p>

      <div style={styles.actions}>
        <button style={styles.primary} onClick={openPicker}>
          Загрузить файл
        </button>

        {fileName ? (
          <span style={{ color: "#666", fontSize: 14 }}>
            Файл: <b>{fileName}</b>
          </span>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>

      {/* XLSX controls */}
      {xlsxMeta && xlsxMatrix ? (
        <div style={styles.controls}>
          <div style={styles.controlItem}>
            <div style={styles.controlLabel}>Лист</div>
            <select value={sheetIndex} onChange={(e) => changeSheet(Number(e.target.value))} style={styles.select}>
              {xlsxMeta.sheetNames.map((name, idx) => (
                <option value={idx} key={name + idx}>
                  {idx + 1}. {name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.controlItem}>
            <div style={styles.controlLabel}>Строка заголовков</div>
            <select value={headerRowIndex} onChange={(e) => changeHeaderRow(Number(e.target.value))} style={styles.select}>
              {Array.from({ length: Math.min(30, xlsxMatrix.length) }).map((_, i) => (
                <option value={i} key={i}>
                  {i + 1}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              Если видишь “товар” в заголовках — переключи строку заголовков выше/ниже.
            </div>
          </div>

          {/* EXPORT */}
          <div style={styles.controlItem}>
            <div style={styles.controlLabel}>Экспорт CSV</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={csvDelimiter} onChange={(e) => setCsvDelimiter(e.target.value as any)} style={{ ...styles.select, width: 170 }}>
                <option value=";">Разделитель ;</option>
                <option value=",">Разделитель ,</option>
                <option value="\t">Разделитель TAB</option>
              </select>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#555" }}>
                <input type="checkbox" checked={csvBom} onChange={(e) => setCsvBom(e.target.checked)} />
                UTF-8 BOM (для Excel)
              </label>
            </div>

            <button
              style={{ ...styles.primary, marginTop: 10, opacity: table ? 1 : 0.5 }}
              disabled={!table}
              onClick={doExportCsv}
            >
              Экспорт CSV
            </button>

            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              Экспортирует текущую таблицу: заголовки сохраняются как есть.
            </div>
          </div>
        </div>
      ) : null}

      {err ? (
        <div style={styles.errorBox}>
          <b>Ошибка:</b> {err}
        </div>
      ) : null}

      {!hasData ? (
        <div style={styles.hintBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Подсказка</div>
          <div style={{ color: "#555", fontSize: 14, lineHeight: 1.5 }}>
            • CSV: первая строка — заголовки колонок.<br />
            • XLSX: можно выбрать лист и строку заголовков.<br />
            • Далее: редактирование + экспорт.
          </div>
        </div>
      ) : mode === "single" ? (
        <SingleEditor
          table={table!}
          selectedRowIndex={selectedRowIndex}
          setSelectedRowIndex={setSelectedRowIndex}
          onChangeField={updateSingleField}
        />
      ) : (
        <Preview headers={table!.headers} rows={table!.rows} />
      )}
    </div>
  );
}

function SingleEditor({
  table,
  selectedRowIndex,
  setSelectedRowIndex,
  onChangeField
}: {
  table: ParsedTable;
  selectedRowIndex: number;
  setSelectedRowIndex: (n: number) => void;
  onChangeField: (key: string, value: string) => void;
}) {
  const headers = table.headers;
  const rows = table.rows || [];
  const idx = Math.min(selectedRowIndex, Math.max(0, rows.length - 1));
  const row = rows[idx] || {};

  // “окно” полей (потом добавим поиск по полям)
  const visibleHeaders = headers.slice(0, 60);

  // подсказки, если они есть (не ломаемся, если нет)
  const hints = (table as any).hints as Record<string, string> | undefined;

  return (
    <div style={styles.editorLayout}>
      <div style={styles.panel}>
        <div style={styles.panelTitle}>Редактор (1 товар)</div>

        <div style={styles.smallRow}>
          <div style={{ fontSize: 13, color: "#666" }}>Строка товара</div>
          <select
            value={idx}
            onChange={(e) => setSelectedRowIndex(Number(e.target.value))}
            style={{ ...styles.select, width: 220 }}
          >
            {rows.map((_, i) => (
              <option key={i} value={i}>
                Товар #{i + 1}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: 12, color: "#666", margin: "10px 0 14px" }}>
          Показаны первые <b>{visibleHeaders.length}</b> полей (из {headers.length}).
        </div>

        <div style={styles.form}>
          {visibleHeaders.map((h) => (
            <label key={h} style={styles.field}>
              <div style={styles.fieldLabel} title={h}>
                {h}
              </div>

              {hints?.[h] ? <div style={styles.hintText}>{hints[h]}</div> : null}

              <input
                style={styles.input}
                value={(row[h] ?? "").toString()}
                onChange={(e) => onChangeField(h, e.target.value)}
                placeholder="—"
              />
            </label>
          ))}
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Предпросмотр таблицы</div>
        <Preview headers={headers} rows={rows} highlightRowIndex={idx} />
      </div>
    </div>
  );
}

function Preview({
  headers,
  rows,
  highlightRowIndex
}: {
  headers: string[];
  rows: Record<string, string>[];
  highlightRowIndex?: number;
}) {
  const previewRows = rows.slice(0, 10);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>Колонки: {headers.length}</div>
        <div style={{ color: "#666", fontSize: 14 }}>Строк: {rows.length}</div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {headers.slice(0, 20).map((h) => (
                <th key={h} style={styles.th} title={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((r, i) => {
              const isHL = highlightRowIndex != null && i === highlightRowIndex;
              return (
                <tr key={i} style={isHL ? styles.rowHL : undefined}>
                  {headers.slice(0, 20).map((h) => (
                    <td key={h} style={styles.td}>
                      {r[h] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
        Показаны первые <b>20</b> колонок и первые <b>10</b> строк.
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 40, fontFamily: "system-ui, sans-serif" },
  subtitle: { color: "#555", marginBottom: 18, lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 },
  card: { padding: 24, borderRadius: 12, border: "1px solid #ddd", cursor: "pointer", background: "#fff", textAlign: "left" },
  back: { marginBottom: 16 },
  actions: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  primary: { padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" },

  controls: { marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" },
  controlItem: { border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, background: "#fff", minWidth: 280 },
  controlLabel: { fontSize: 12, color: "#666", marginBottom: 6 },
  select: { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", width: "100%" },

  hintBox: { marginTop: 18, borderRadius: 12, border: "1px solid #e5e5e5", padding: 16, background: "#fff" },
  errorBox: { marginTop: 14, borderRadius: 12, border: "1px solid #ffb4b4", padding: 14, background: "#fff5f5", color: "#7a1b1b" },

  editorLayout: { marginTop: 18, display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, alignItems: "start" },
  panel: { border: "1px solid #e5e5e5", borderRadius: 12, padding: 14, background: "#fff" },
  panelTitle: { fontWeight: 800, marginBottom: 12 },
  smallRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },

  form: { display: "grid", gap: 10 },
  field: { display: "grid", gap: 6 },
  fieldLabel: { fontSize: 12, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  hintText: { fontSize: 12, color: "#888", lineHeight: 1.35 },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", width: "100%" },

  tableWrap: { border: "1px solid #e5e5e5", borderRadius: 12, overflow: "auto", background: "#fff" },
  table: { borderCollapse: "separate", borderSpacing: 0, minWidth: 900, width: "100%" },
  th: { position: "sticky", top: 0, background: "#fafafa", borderBottom: "1px solid #e5e5e5", padding: "10px 12px", fontSize: 13, textAlign: "left", whiteSpace: "nowrap" },
  td: { borderBottom: "1px solid #f0f0f0", padding: "10px 12px", fontSize: 13, whiteSpace: "nowrap" },
  rowHL: { outline: "2px solid #111", outlineOffset: "-2px" }
};
