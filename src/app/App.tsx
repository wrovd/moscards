import { useState } from "react";

type Mode = "single" | "bulk" | "replace" | null;

export default function App() {
  const [mode, setMode] = useState<Mode>(null);

  if (!mode) {
    return (
      <div style={styles.page}>
        <h1>MosCards</h1>
        <p style={styles.subtitle}>
          Конструктор карточек для Ozon и Wildberries
        </p>

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

  return (
    <div style={styles.page}>
      <button onClick={() => setMode(null)} style={styles.back}>
        ← Назад
      </button>

      <h2>Режим: {mode}</h2>
      <p>Дальше здесь будет загрузка файла и редактор</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 40,
    fontFamily: "system-ui, sans-serif",
  },
  subtitle: {
    color: "#555",
    marginBottom: 32,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  card: {
    padding: 24,
    borderRadius: 12,
    border: "1px solid #ddd",
    cursor: "pointer",
    background: "#fff",
    textAlign: "left",
  },
  back: {
    marginBottom: 16,
  },
};
