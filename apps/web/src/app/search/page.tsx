import { SectionPage } from "../../components/SectionPage";

export default function SearchPage() {
  return (
    <SectionPage title="Поиск" status="Введите японский текст, чтение или перевод.">
      <form className="search-panel">
        <label>
          Запрос
          <input name="q" type="search" />
        </label>
      </form>
    </SectionPage>
  );
}
