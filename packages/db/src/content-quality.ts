import { normalizeJapaneseReading, normalizeMeaning, validateAnswer } from "@kanji-srs/japanese";
import { type ContentQualityIssueDto } from "@kanji-srs/shared";
import { buildMainCourseBlueprint } from "./main-course";

type QualityAnswer = {
  readonly text: string;
  readonly normalizedText: string;
  readonly locale: string;
  readonly isPrimary: boolean;
  readonly sourceKind: string;
};
export type QualityCard = {
  readonly id: string;
  readonly promptType: string;
  readonly answerType: string;
  readonly locale: string;
  readonly answers: readonly QualityAnswer[];
  readonly blockedAnswers: readonly { readonly text: string; readonly normalizedText: string }[];
  readonly audioValid?: boolean;
};
export type QualitySource = {
  readonly sourceRecordId: string;
  readonly checksumSha256: string;
  readonly status: string;
  readonly sourceVersion: string | null;
  readonly sourceUrl: string | null;
  readonly licenseName: string;
  readonly attributionText: string;
};
export type QualityPlacement = {
  readonly levelNumber: number;
  readonly sortOrder: number;
  readonly band: string;
};
export type QualityItem = {
  readonly id: string;
  readonly kind: string;
  readonly targetType: string;
  readonly band: string | null;
  readonly targetExists: boolean;
  readonly source: QualitySource | null;
  readonly sourceReadings: readonly string[];
  readonly requiresImportedSource: boolean;
  readonly hasStrokes: boolean;
  readonly hasPartOfSpeech: boolean;
  readonly hasExample: boolean;
  readonly targetMeaningsValid?: boolean;
  readonly validStageIndices?: readonly number[];
  readonly cards: readonly QualityCard[];
  readonly mnemonics: readonly {
    readonly locale: string;
    readonly body: string;
    readonly sourceKind: string;
  }[];
  readonly placements: readonly QualityPlacement[];
  readonly hasPrerequisiteCycle: boolean;
  readonly requiredPrerequisiteTargetIds: readonly string[];
  readonly dependencies: readonly {
    readonly id: string;
    readonly targetId: string;
    readonly kind: string;
    readonly status: string;
    readonly requiredStage: number | null;
    readonly placements: readonly QualityPlacement[];
  }[];
};

const LOCALES: readonly string[] = ["ru-RU", "en-US"];
const PLACEHOLDER =
  /^(?:todo|tbd|placeholder|lorem ipsum|заглушка|перевод отсутствует|нет перевода)(?:\b|$)/iu;
const LEVEL_BANDS = new Map(
  buildMainCourseBlueprint().levels.map((level) => [level.levelNumber, level.band]),
);

export function normalizeQualityAnswer(text: string, answerType: string, locale: string): string {
  return answerType === "READING"
    ? normalizeJapaneseReading(text)
    : normalizeMeaning(text, locale === "en-US" ? "en-US" : "ru-RU");
}

export function validateQualityCard(
  itemId: string,
  card: QualityCard,
  sourceReadings?: readonly string[],
): readonly ContentQualityIssueDto[] {
  const issues: ContentQualityIssueDto[] = [];
  const add = (code: ContentQualityIssueDto["code"], message: string, remediation: string) =>
    issues.push({
      learningItemId: itemId,
      cardId: card.id,
      code,
      severity: "blocker",
      message,
      remediation,
    });
  if (!LOCALES.includes(card.locale)) {
    add(
      "unsupported-locale",
      "Карточка использует неподдерживаемый язык.",
      "Оставьте только ru-RU или en-US.",
    );
  }
  if (card.answers.length === 0)
    add("empty-answer", "У карточки нет допустимых ответов.", "Добавьте проверенные ответы.");
  const normalized = new Set<string>();
  for (const answer of card.answers) {
    const value = normalizeQualityAnswer(answer.text, card.answerType, answer.locale);
    if (value === "")
      add(
        "empty-answer",
        "Ответ пуст после нормализации.",
        "Замените ответ содержательным значением.",
      );
    if (value !== answer.normalizedText)
      add(
        "invalid-normalization",
        "Сохранённая нормализация ответа устарела.",
        "Пересохраните ответ общим нормализатором.",
      );
    if (!LOCALES.includes(answer.locale))
      add(
        "unsupported-locale",
        "Ответ использует неподдерживаемый язык.",
        "Оставьте только RU/EN ответы.",
      );
    if (answer.sourceKind === "IMPORTED")
      add(
        "unreviewed-content",
        "Сырой импорт используется как учебный ответ.",
        "Проверьте учебное значение и сохраните редакторский ответ.",
      );
    const key = `${answer.locale}:${value}`;
    if (normalized.has(key))
      add("duplicate-answer", "Ответ повторяется после нормализации.", "Объедините дубли ответов.");
    normalized.add(key);
    if (PLACEHOLDER.test(answer.text))
      add(
        "placeholder-content",
        "В учебном ответе найдена заглушка.",
        "Напишите проверенное учебное значение.",
      );
    if (
      card.answerType === "READING" &&
      sourceReadings !== undefined &&
      !sourceReadings.some((reading) => normalizeSourceReading(reading) === value)
    )
      add(
        "unsupported-reading",
        "Учебное чтение не подтверждено источником.",
        "Выберите подтверждённое чтение из словаря.",
      );
    const validation = validateAnswer({
      answerKind: card.answerType === "READING" ? "reading" : "meaning",
      answer: answer.text,
      acceptedAnswers: card.answers.map((a) => a.text),
      blockedAnswers: card.blockedAnswers.map((a) => a.text),
    });
    if (!validation.accepted)
      add(
        "blocked-answer-collision",
        "Правильный ответ отклоняется проверкой карточки.",
        "Устраните пересечение допустимых и заблокированных ответов.",
      );
  }
  const requiredLocales = card.answerType === "MEANING" ? LOCALES : [null];
  for (const locale of requiredLocales) {
    const primaryCount = card.answers.filter(
      (a) => a.isPrimary && (locale === null || a.locale === locale),
    ).length;
    if (primaryCount !== 1)
      add(
        "primary-answer-count",
        `Основных ответов (${locale ?? "чтение"}): ${primaryCount}.`,
        "Назначьте ровно один основной ответ для каждого учебного языка.",
      );
  }
  for (const answer of card.blockedAnswers) {
    if (normalizeQualityAnswer(answer.text, card.answerType, card.locale) !== answer.normalizedText)
      add(
        "invalid-normalization",
        "Заблокированный ответ неправильно нормализован.",
        "Пересохраните заблокированный ответ.",
      );
  }
  if (card.promptType === "LISTENING" && !card.audioValid)
    add(
      "invalid-media",
      "Аудиирование не имеет подходящего лицензированного файла.",
      "Привяжите опубликованный HTTPS-файл с checksum, лицензией и атрибуцией.",
    );
  return issues;
}

export function validateQualityItem(item: QualityItem): readonly ContentQualityIssueDto[] {
  const issues: ContentQualityIssueDto[] = [];
  const add = (
    code: ContentQualityIssueDto["code"],
    message: string,
    remediation: string,
    severity: "blocker" | "warning" = "blocker",
  ) => issues.push({ learningItemId: item.id, cardId: null, code, severity, message, remediation });
  if (!item.targetExists || item.kind !== item.targetType)
    add(
      "missing-target",
      "Учебный материал не ссылается на существующий объект нужного типа.",
      "Восстановите целевой объект или снимите материал с публикации.",
    );
  if (item.targetMeaningsValid === false)
    add(
      "unreviewed-content",
      "У целевого объекта нет проверенных RU/EN учебных значений.",
      "Укажите редакторские значения в обоих языках, с одним основным значением кандзи.",
    );
  if (item.requiresImportedSource && item.source === null)
    add(
      "missing-source",
      "Не найдено происхождение импортированного материала.",
      "Восстановите связь с исходной записью и запуском импорта.",
    );
  if (item.source !== null && !isValidQualitySource(item.source))
    add(
      "invalid-source",
      "Происхождение материала неполно или импорт не завершён.",
      "Проверьте URL, версию, checksum, лицензию, атрибуцию и успешный импорт.",
    );
  if (
    !item.cards.some((c) => c.promptType === "MEANING" && c.answerType === "MEANING") ||
    ((item.kind === "KANJI" || item.kind === "WORD") &&
      !item.cards.some((c) => c.promptType === "READING" && c.answerType === "READING"))
  )
    add(
      "missing-card",
      "Отсутствуют обязательные карточки значения или чтения.",
      "Добавьте отдельные карточки значения и чтения для кандзи/слов.",
    );
  for (const card of item.cards)
    issues.push(
      ...validateQualityCard(
        item.id,
        card,
        card.answerType === "READING" ? item.sourceReadings : undefined,
      ),
    );
  for (const locale of LOCALES) {
    if (
      !item.mnemonics.some(
        (m) => m.locale === locale && m.body.trim() !== "" && m.sourceKind !== "IMPORTED",
      )
    )
      add(
        "missing-mnemonic",
        `Не хватает редакторской мнемоники/объяснения ${locale}.`,
        "Добавьте собственное объяснение.",
      );
  }
  for (const mnemonic of item.mnemonics) {
    if (!LOCALES.includes(mnemonic.locale))
      add(
        "unsupported-locale",
        "Учебное объяснение использует неподдерживаемый язык.",
        "Оставьте учебный контент только на русском и английском.",
      );
    if (PLACEHOLDER.test(mnemonic.body))
      add(
        "placeholder-content",
        "В объяснении найдена заглушка.",
        "Замените её полноценным объяснением.",
      );
  }
  if (item.kind === "KANJI" && !item.hasStrokes)
    add("missing-strokes", "Нет проверенного порядка черт.", "Импортируйте KanjiVG.");
  if (item.kind === "WORD" && !item.hasPartOfSpeech)
    add(
      "missing-word-evidence",
      "У слова нет данных о части речи.",
      "Проверьте точную пару написание–чтение в словаре.",
    );
  if (item.kind === "WORD" && !item.hasExample)
    add(
      "missing-example",
      "У слова пока нет опубликованного примера.",
      "Добавьте атрибутированный пример или зарегистрируйте редакторское исключение.",
      "blocker",
    );
  const placement = item.placements[0];
  if (
    item.placements.length !== 1 ||
    placement === undefined ||
    LEVEL_BANDS.get(placement.levelNumber) !== item.band ||
    placement.band !== item.band ||
    !Number.isInteger(placement.sortOrder) ||
    placement.sortOrder < 1
  )
    add(
      "invalid-placement",
      "Размещение не соответствует единственному уровню и диапазону курса.",
      "Разместите материал ровно один раз в правильном диапазоне 1–60.",
    );
  if (item.hasPrerequisiteCycle)
    add(
      "prerequisite-cycle",
      "В prerequisite-пути найден цикл.",
      "Разорвите циклическую зависимость.",
    );
  for (const targetId of item.requiredPrerequisiteTargetIds) {
    if (!item.dependencies.some((d) => d.targetId === targetId))
      add(
        "missing-prerequisite",
        "Отсутствует обязательный компонент/кандзи из состава материала.",
        "Добавьте все prerequisites, подтверждённые составом материала.",
      );
  }
  for (const dependency of item.dependencies) {
    const expectedKind =
      item.kind === "KANJI" ? "COMPONENT" : item.kind === "WORD" ? "KANJI" : null;
    const previous = dependency.placements[0];
    if (
      dependency.id === item.id ||
      dependency.status !== "PUBLISHED" ||
      (expectedKind !== null && dependency.kind !== expectedKind) ||
      dependency.placements.length !== 1 ||
      previous === undefined ||
      placement === undefined ||
      previous.levelNumber > placement.levelNumber ||
      (previous.levelNumber === placement.levelNumber &&
        previous.sortOrder >= placement.sortOrder) ||
      (dependency.requiredStage !== null &&
        (!Number.isInteger(dependency.requiredStage) ||
          dependency.requiredStage < 1 ||
          (item.validStageIndices !== undefined &&
            !item.validStageIndices.includes(dependency.requiredStage))))
    )
      add(
        "invalid-prerequisite",
        "Prerequisite не опубликован, имеет неверный тип, этап или порядок.",
        "Разместите опубликованный prerequisite перед материалом и задайте допустимый этап SRS.",
      );
  }
  return issues;
}

export function isValidQualitySource(source: QualitySource): boolean {
  return (
    source.sourceRecordId.trim() !== "" &&
    /^[a-f0-9]{64}$/i.test(source.checksumSha256) &&
    source.status === "SUCCESS" &&
    source.sourceVersion !== null &&
    source.sourceVersion.trim() !== "" &&
    isHttps(source.sourceUrl) &&
    source.licenseName.trim() !== "" &&
    source.attributionText.trim() !== ""
  );
}

export function isHttps(value: string | null): boolean {
  try {
    return value !== null && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSourceReading(value: string): string {
  return normalizeJapaneseReading(value.replace(/[.-]/gu, ""));
}
