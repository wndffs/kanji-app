import { Suspense } from "react";

import { CharactersClient } from "./CharactersClient";

export default function CharactersPage() {
  return (
    <Suspense
      fallback={
        <section className="page-stack" aria-busy="true">
          <div className="page-heading">
            <h1>Символы</h1>
            <p>Загружаем прогресс обучения.</p>
          </div>
          <div className="panel skeleton" />
        </section>
      }
    >
      <CharactersClient />
    </Suspense>
  );
}
