import { SectionPage } from "../../components/SectionPage";

export default function DecksPage() {
  return (
    <SectionPage title="Колоды" status="Активных колод нет.">
      <div className="notice-panel">
        <p>Сохранённые наборы будут отображаться здесь.</p>
      </div>
    </SectionPage>
  );
}
