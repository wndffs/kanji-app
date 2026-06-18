import { SectionPage } from "../../components/SectionPage";

export default function ReviewsPage() {
  return (
    <SectionPage title="Повторения" status="Нет карточек к повторению.">
      <div className="notice-panel">
        <p>Следующая сессия появится по расписанию SRS.</p>
      </div>
    </SectionPage>
  );
}
