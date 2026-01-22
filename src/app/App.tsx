import { useMemo, useRef, useState } from "react";
import { parseFile, ParsedTable } from "../importer";

type Mode = "single" | "bulk" | "replace" | null;

export default function App() {
  const [mode, setMode] = useState<Mode>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  const title = useMemo(() => {
    if (!mode) return "MosCards";
    if (mode === "single") return "1 товар";
    if (mode === "bulk") return "Много товаров";
    return "Изменить модель";
  }, [mode]);

  async function onPickFile(file: File) {
    setErr("");
    setTable(null);
    setFileName(file.name);

    try {
      const res = await parseFile(file);
      setTable(res);
    } catch (e: any) {
      setErr(e?.message || "Ошибка импорта");
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function resetToMode() {
    setTable(null);
    setFileName("");
    setErr("");
  }

  // SCREEN 1: mode select
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

  // SCREEN 2: import + preview
  return (
    <div style={styles.page}>
      <button
        onClick={() => {
          if (table) resetToMode();
          else setMode(null);
        }}
        style={styles.back}
      >
        ← Назад
      </button>

      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={styles.subtitle}>
        Загрузите шаблон <b>CSV</b> или <b>XLSX</b>. Мы покажем колонки и предпросмотр.
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
            // сброс input чтобы можно было выбрать тот же файл ещё раз
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>

      {err ? (
        <div style={styles.errorBox}>
          <b>Ошибка:</b> {err}
        </div>
      ) : null}

      {table ? (
        <Preview headers={table.headers} rows={table.rows} />
      ) : (
        <div style={styles.hintBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Подсказка</div>
          <div style={{ color: "#555", fontSize: 14, lineHeight: 1.5 }}>
            • В CSV первая строка должна быть заголовками колонок.<br />
            • XLSX берём первый лист.<br />
            • Пока это предпросмотр — дальше добавим редактор и экспорт.
          </div>
        </div>
      )}
    </div>
  );
}

function Preview({ headers, rows }: { headers: string[]; rows: Record<string, string>[] }) {
  const previewRows = rows.slice(0, 10);

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>Колонки: {headers.length}</div>
        <div style={{ color: "#666", fontSize: 14 }}>Строк: {rows.length}</div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} style={styles.th} title={h}>
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

      {rows.length > 10 ? (
        <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
          Показаны первые 10 строк.
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 40,
    fontFamily: "system-ui, sans-serif"
  },
  subtitle: {
    color: "#555",
    marginBottom: 18,
    lineHeight: 1.5
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16
  },
  card: {
    padding: 24,
    borderRadius: 12,
    border: "1px solid #ddd",
    cursor: "pointer",
    background: "#fff",
    textAlign: "left"
  },
  back: {
    marginBottom: 16
  },
  actions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap"
  },
  primary: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer"
  },
  hintBox: {
    marginTop: 18,
    borderRadius: 12,
    border: "1px solid #e5e5e5",
    padding: 16,
    background: "#fff"
  },
  errorBox: {
    marginTop: 14,
    borderRadius: 12,
    border: "1px solid #ffb4b4",
    padding: 14,
    background: "#fff5f5",
    color: "#7a1b1b"
  },
  tableWrap: {
    border: "1px solid #e5e5e5",
    borderRadius: 12,
    overflow: "auto",
    background: "#fff"
  },
  table: {
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: 900,
    width: "100%"
  },
  th: {
    position: "sticky",
    top: 0,
    background: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
    padding: "10px 12px",
    fontSize: 13,
    textAlign: "left",
    whiteSpace: "nowrap"
  },
  td: {
    borderBottom: "1px solid #f0f0f0",
    padding: "10px 12px",
    fontSize: 13,
    whiteSpace: "nowrap"
  }
};
