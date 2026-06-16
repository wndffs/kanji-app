import Link from "next/link";

import { APP_NAME, WORKSPACE_STATUS } from "@kanji-srs/shared";
import { Button } from "@kanji-srs/ui";

import { primaryNavigation } from "../lib/navigation";

const panels = [
  {
    title: "Уроки",
    text: "Очередь уроков будет подключена после API, модели данных и стартового курса.",
  },
  {
    title: "Повторения",
    text: "Быстрый режим повторений появится после реализации SRS-пакета и review API.",
  },
  {
    title: "Поиск",
    text: "Словарный поиск будет работать по кандзи, словам, чтениям и русским значениям.",
  },
];

export default function HomePage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            {APP_NAME}
          </Link>
          <nav aria-label="Основная навигация" className="nav">
            {primaryNavigation.map((item) => (
              <Link
                aria-current={item.href === "/" ? "page" : undefined}
                className="nav-link"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="main">
        <div className="toolbar">
          <div>
            <h1>Панель</h1>
            <p>
              Монорепозиторий готов к разработке: веб-приложение, API и доменные пакеты подключены
              через npm workspace.
            </p>
          </div>
          <Button aria-label="Статус рабочего пространства">{WORKSPACE_STATUS}</Button>
        </div>
        <section aria-label="Разделы приложения" className="dashboard-grid">
          {panels.map((panel) => (
            <article className="panel" key={panel.title}>
              <h2>{panel.title}</h2>
              <p>{panel.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
