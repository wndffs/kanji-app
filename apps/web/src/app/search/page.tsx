import { Suspense } from "react";

import { SearchClient } from "./SearchClient";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <section className="page-stack" aria-busy="true">
          <div className="page-heading">
            <h1>Поиск</h1>
            <p>Словарь</p>
          </div>
          <div className="search-panel skeleton" />
        </section>
      }
    >
      <SearchClient />
    </Suspense>
  );
}
