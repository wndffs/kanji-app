import { SectionPage } from "../../components/SectionPage";

export default function LessonsPage() {
  return (
    <SectionPage title="Уроки" status="Очередь пуста.">
      <div className="notice-panel">
        <p>Новые карточки появятся после синхронизации курса.</p>
      </div>
    </SectionPage>
  );
}
