import {
  SUPPORTED_COURSE_BANDS,
  type AdminContentStatus,
  type AdminCurriculumBandCompletenessDto,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurationItemDto,
  type AdminQualityIssueCode,
  type AdminQualityIssueDto,
  type CourseBand,
} from "@kanji-srs/shared";

export function getAdminQualityIssues(item: AdminCurationItemDto): readonly AdminQualityIssueDto[] {
  const issues: AdminQualityIssueDto[] = [];

  if (item.meanings.ru.trim() === "") {
    issues.push(issue("missing-ru-meaning", "Добавьте русское учебное значение."));
  }

  if (item.meanings.en.trim() === "") {
    issues.push(issue("missing-en-meaning", "Добавьте английское учебное значение."));
  }

  if (item.cards.length === 0) {
    issues.push(issue("missing-accepted-answer", "Добавьте хотя бы одну учебную карточку."));
  } else {
    for (const card of item.cards) {
      if (card.acceptedAnswers.length === 0) {
        issues.push(
          issue("missing-accepted-answer", "У карточки нет правильного ответа.", {
            cardId: card.id,
          }),
        );
        continue;
      }

      if (card.answerType === "meaning") {
        if (!card.acceptedAnswers.some((answer) => answer.locale === "ru-RU")) {
          issues.push(
            issue("missing-ru-accepted-answer", "У карточки значения нет русского ответа.", {
              cardId: card.id,
            }),
          );
        }

        if (!card.acceptedAnswers.some((answer) => answer.locale === "en-US")) {
          issues.push(
            issue("missing-en-accepted-answer", "У карточки значения нет английского ответа.", {
              cardId: card.id,
            }),
          );
        }
      }
    }
  }

  if (!item.mnemonics.some((text) => text.locale === "ru-RU" && text.body.trim() !== "")) {
    issues.push(issue("missing-ru-mnemonic", "Добавьте русскую мнемонику или заметку."));
  }

  if (!item.mnemonics.some((text) => text.locale === "en-US" && text.body.trim() !== "")) {
    issues.push(issue("missing-en-mnemonic", "Добавьте английскую мнемонику или заметку."));
  }

  if (item.attributions.length === 0) {
    issues.push(issue("missing-attribution", "Укажите источник или авторство материала."));
  }

  if (item.itemType !== "component" && item.dependencies.length === 0) {
    issues.push(issue("missing-dependency", "Укажите prerequisite-связь для учебного пути."));
  }

  for (const dependency of item.dependencies) {
    if (dependency.prerequisiteItemId === item.id) {
      issues.push(
        issue("self-dependency", "Материал не может зависеть от самого себя.", {
          dependencyItemId: dependency.prerequisiteItemId,
        }),
      );
    }

    if (dependency.prerequisiteStatus !== "published") {
      issues.push(
        issue("unpublished-dependency", "Prerequisite должен быть опубликован.", {
          dependencyItemId: dependency.prerequisiteItemId,
        }),
      );
    }
  }

  return issues;
}

export function applyQualityIssues(item: AdminCurationItemDto): AdminCurationItemDto {
  return {
    ...item,
    qualityIssues: getAdminQualityIssues(item),
  };
}

export function previewAdminItemUpdate(
  item: AdminCurationItemDto,
  update: {
    readonly band?: CourseBand | null;
    readonly meanings?: { readonly ru?: string; readonly en?: string };
    readonly mnemonics?: readonly {
      readonly locale: "ru-RU" | "en-US";
      readonly type: "meaning" | "reading" | "story" | "usage";
      readonly body: string;
    }[];
    readonly status?: AdminContentStatus;
  },
): AdminCurationItemDto {
  const mnemonics =
    update.mnemonics === undefined
      ? item.mnemonics
      : mergeTexts(
          item.mnemonics,
          update.mnemonics.map((text, index) => ({
            id: `preview-mnemonic-${index}`,
            locale: text.locale,
            type: text.type,
            body: text.body,
            sourceKind: "curated" as const,
            version: 1,
            updatedAt: item.updatedAt,
          })),
        );

  return {
    ...item,
    band: update.band === undefined ? item.band : update.band,
    status: update.status ?? item.status,
    meanings: {
      ru: update.meanings?.ru ?? item.meanings.ru,
      en: update.meanings?.en ?? item.meanings.en,
    },
    mnemonics,
    qualityIssues: [],
  };
}

export function previewAdminCardAnswersUpdate(
  item: AdminCurationItemDto,
  cardId: string,
  acceptedAnswers: AdminCurationItemDto["cards"][number]["acceptedAnswers"],
  blockedAnswers: AdminCurationItemDto["cards"][number]["blockedAnswers"],
): AdminCurationItemDto {
  return {
    ...item,
    cards: item.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            acceptedAnswers,
            blockedAnswers,
          }
        : card,
    ),
    qualityIssues: [],
  };
}

export function buildCurriculumCompletenessReport(
  items: readonly AdminCurationItemDto[],
  now: Date,
): AdminCurriculumCompletenessReportDto {
  return {
    generatedAt: now.toISOString(),
    bands: SUPPORTED_COURSE_BANDS.map((band) => summarizeBand(band, items)),
  };
}

function summarizeBand(
  band: CourseBand,
  items: readonly AdminCurationItemDto[],
): AdminCurriculumBandCompletenessDto {
  const bandItems = items.filter((item) => (item.band ?? "foundation") === band);
  const issueSets = bandItems.map(
    (item) => new Set(getAdminQualityIssues(item).map(({ code }) => code)),
  );

  return {
    band,
    totalItems: bandItems.length,
    publishedItems: countByStatus(bandItems, "published"),
    draftItems: countByStatus(bandItems, "draft"),
    needsReviewItems: countByStatus(bandItems, "needs-review"),
    archivedItems: countByStatus(bandItems, "archived"),
    importDerivedCandidates: bandItems.filter(isImportDerivedCandidate).length,
    missingAcceptedAnswers: countIssue(issueSets, "missing-accepted-answer"),
    missingMnemonics: countAnyIssue(issueSets, ["missing-ru-mnemonic", "missing-en-mnemonic"]),
    missingLocaleCoverage: countAnyIssue(issueSets, [
      "missing-ru-meaning",
      "missing-en-meaning",
      "missing-ru-accepted-answer",
      "missing-en-accepted-answer",
    ]),
    missingAttribution: countIssue(issueSets, "missing-attribution"),
    invalidDependencies: countAnyIssue(issueSets, [
      "missing-dependency",
      "self-dependency",
      "unpublished-dependency",
    ]),
  };
}

function issue(
  code: AdminQualityIssueCode,
  message: string,
  extra: {
    readonly cardId?: string;
    readonly dependencyItemId?: string;
  } = {},
): AdminQualityIssueDto {
  return {
    code,
    message,
    cardId: extra.cardId ?? null,
    dependencyItemId: extra.dependencyItemId ?? null,
  };
}

function mergeTexts(
  existing: AdminCurationItemDto["mnemonics"],
  next: AdminCurationItemDto["mnemonics"],
): AdminCurationItemDto["mnemonics"] {
  const merged = existing.filter(
    (text) =>
      !next.some((candidate) => candidate.locale === text.locale && candidate.type === text.type),
  );

  return [...merged, ...next.filter((text) => text.body.trim() !== "")];
}

function countByStatus(items: readonly AdminCurationItemDto[], status: AdminContentStatus): number {
  return items.filter((item) => item.status === status).length;
}

function countIssue(
  issueSets: readonly ReadonlySet<AdminQualityIssueCode>[],
  code: AdminQualityIssueCode,
): number {
  return issueSets.filter((issues) => issues.has(code)).length;
}

function countAnyIssue(
  issueSets: readonly ReadonlySet<AdminQualityIssueCode>[],
  codes: readonly AdminQualityIssueCode[],
): number {
  return issueSets.filter((issues) => codes.some((code) => issues.has(code))).length;
}

function isImportDerivedCandidate(item: AdminCurationItemDto): boolean {
  return (
    item.status !== "published" &&
    item.importRuns.some((run) => run.dataSourceName.toLowerCase() !== "project authored")
  );
}
