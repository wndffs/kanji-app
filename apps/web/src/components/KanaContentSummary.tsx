import { type KanaAssessmentItemDto } from "@kanji-srs/shared";
import { summarizeKanaContent } from "../lib/kana-unit-groups";

export function KanaContentSummary({
  items,
}: {
  readonly items: readonly Pick<KanaAssessmentItemDto, "variant" | "mastered">[];
}) {
  return (
    <dl className="kana-content-summary" aria-label="Состав учебного набора">
      {summarizeKanaContent(items).map((category) => (
        <div key={category.id}>
          <dt>{category.label}</dt>
          <dd>
            <strong>{category.total}</strong>
            <span>освоено {category.mastered}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
