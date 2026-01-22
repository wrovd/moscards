import { useMemo, useRef, useState } from "react";
import { ParsedTable, parseFileSmart, XlsxMeta } from "../importer";

type Mode = "single" | "bulk" | "replace" | null;

export default function App() {
  const [mode, setMode] = useState<Mode>(null);

  const [table, setTable] = useState<ParsedTable | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const [xlsxMeta, setXlsxMeta] = useState<XlsxMeta | null>(null);

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
      if (res.meta) setXlsxMeta(res.meta);
    } catch (e: any) {
      setErr(e?.message || "Ошибка импорта");
    }
  }

  function updateCell(header: string, value: string) {
    if (!table) return;
    const rows = [...table.rows];
    rows[0] = { ...rows[0], [header]: value };
    setTable({ headers: table.headers, rows });
  }

  // -------- Screen 1: mode select --------
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

  // -------- Screen 2: import + edit --------
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

      {err ? (
        <div style={styles.errorBox}>
          <b>Ошибка:</b> {err}
        </div>
      ) : null}

      {table && table.rows.length > 0 ? (
        <div style={styles.split}>
          {/* LEFT: form */}
          <div style={styles.form}>
            <h3 style={{ marginTop: 0 }}>Поля товара</h3>

            {table.headers.map((h) => (
              <div key={h} style={styles.field}>
                <label style={styles.label}>{h}</label>
                <input
                  style={styles.input}
                  value={table.rows[0]?.[h] ?? ""}
                  onChange={(e) => updateCell(h, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* RIGHT: preview */}
          <div style={styles.preview}>
            <h3 style={{ marginTop: 0 }}>Предпросмотр</h3>
            <Table headers={table.headers} rows={table.rows} />
          </div>
        </div>
      ) : (
        <div style={styles.hintBox}>
          Загрузите файл, чтобы начать редактирование товара.
        </div>
      )}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Record<string, string>[] }) {
  const previewRows = rows.slice(0, 5);

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={styles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((r, i) => (
            <tr key={i}>
              {headers.map((h) => (
                <td key={h} style={styles.td}>
                  {r[h] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 40, fontFamily: "system-ui, sans-serif" },
  subtitle: { color: "#555", marginBottom: 24 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 16 },
  card: { padding: 24, borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer", textAlign: "left" },
  back: { marginBottom: 16 },
  actions: { display: "flex", gap: 12, alignItems: "center", marginBottom: 16 },
  primary: { padding: "10px 14px", borderRadius: 10, background: "#111", color: "#fff", border: "none", cursor: "pointer" },
  errorBox: { marginTop: 12, padding: 12, borderRadius: 10, background: "#fff5f5", border: "1px solid #ffb4b4" },
  split: { display: "grid", gridTemplateColumns: "420px 1fr", gap: 24, marginTop: 24 },
  form: { border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, background: "#fff", maxHeight: "75vh", overflow: "auto" },
  field: { marginBottom: 12 },
  label: { display: "block", fontSize: 12, color: "#555", marginBottom: 4 },
  input: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" },
  preview: { border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, background: "#fff" },
  tableWrap: { overflow: "auto", border: "1px solid #eee", borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 12, padding: 8, borderBottom: "1px solid #eee", background: "#fafafa" },
  td: { fontSize: 12, padding: 8, borderBottom: "1px solid #f0f0f0" },
  hintBox: { marginTop: 24, padding: 16, borderRadius: 12, border: "1px dashed #ddd", color: "#555" }
};
