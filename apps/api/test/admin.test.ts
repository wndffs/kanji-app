import { describe, expect, it } from "vitest";

import {
  type AdminCurationItemDto,
  type AdminCurriculumScaleReadinessDto,
  type AdminImportRunSummaryDto,
  type AdminImportedCandidateDto,
  type AdminReviewQueueFilters,
  type AdminReviewQueueItemDto,
} from "@kanji-srs/shared";

import { AdminRepository } from "../src/admin/admin.repository";
import { AdminService } from "../src/admin/admin.service";
import {
  applyQualityIssues,
  buildCurriculumCompletenessReport,
} from "../src/admin/curriculum-quality";
import {
  type NormalizedAdminApproveImportedTranslationInput,
  type NormalizedAdminItemCurationInput,
  type NormalizedAdminPromoteCandidateInput,
} from "../src/admin/admin.types";
import { type OverridesRepository } from "../src/overrides/overrides.repository";
import { OverridesService } from "../src/overrides/overrides.service";
import {
  type CardAnswerValidationRecord,
  type UpsertAcceptedAnswerInput,
  type UpsertPrivateMnemonicInput,
  type UserAcceptedAnswerRecord,
  type UserMnemonicRecord,
} from "../src/overrides/overrides.types";

describe("AdminService", () => {
  it("lets an admin edit accepted answers used by validation", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);
    const overridesService = new OverridesService(repository);

    await expect(
      adminService.updateCardAnswers("card-meaning", {
        acceptedAnswers: [
          {
            locale: "en-US",
            text: "single line",
            answerKind: "meaning",
            isPrimary: true,
          },
        ],
        blockedAnswers: [],
      }),
    ).resolves.toMatchObject({
      cards: [
        {
          id: "card-meaning",
          acceptedAnswers: [{ text: "single line", normalizedText: "single line" }],
        },
      ],
    });

    await expect(
      overridesService.validateAnswerForUser({
        userId: "learner",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "single line",
      }),
    ).resolves.toMatchObject({
      accepted: true,
      result: "correct",
      matchedAnswer: "single line",
    });
    await expect(
      overridesService.validateAnswerForUser({
        userId: "learner",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "one",
      }),
    ).resolves.toMatchObject({
      accepted: false,
      result: "wrong",
    });
  });

  it("lists only items waiting for content review", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    const response = await adminService.listReviewItems();

    expect(response.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "item-kanji-one",
          status: "needs-review",
        }),
        expect.objectContaining({
          id: "item-word-empty",
          status: "needs-review",
        }),
      ]),
    );
    expect(response.items.every((item) => item.status === "needs-review")).toBe(true);
  });

  it("filters admin review queue by band and missing data", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.listReviewItems({
        band: "n5",
        missingAcceptedAnswers: "true",
        missingMnemonics: "true",
        status: "needs-review",
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: "item-word-empty",
          band: "n5",
          qualityIssues: expect.arrayContaining([
            expect.objectContaining({ code: "missing-accepted-answer" }),
            expect.objectContaining({ code: "missing-ru-mnemonic" }),
          ]),
        }),
      ],
    });
  });

  it("rejects publishing incomplete cards through quality gates", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.updateItem("item-word-empty", { status: "published" }),
    ).rejects.toThrow("Нельзя опубликовать материал");
  });

  it("rejects incomplete edits to already published items", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.updateItem("item-kanji-one", { status: "published" }),
    ).resolves.toMatchObject({
      id: "item-kanji-one",
      status: "published",
    });
    await expect(
      adminService.updateItem("item-kanji-one", {
        mnemonics: [{ locale: "en-US", type: "story", body: "" }],
      }),
    ).rejects.toThrow("Нельзя опубликовать материал");
  });

  it("counts missing data in curriculum completeness report", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    const report = await adminService.getCompletenessReport();
    const n5 = report.bands.find((band) => band.band === "n5");

    expect(n5).toMatchObject({
      totalItems: 1,
      missingAcceptedAnswers: 1,
      missingMnemonics: 1,
      missingAttribution: 1,
      invalidDependencies: 1,
    });
  });

  it("reports progress toward the full kanji and vocabulary course targets", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(adminService.getScaleReadiness()).resolves.toEqual({
      generatedAt: "2026-07-13T10:00:00.000Z",
      items: [
        expect.objectContaining({
          itemType: "kanji",
          targetItems: 2_300,
          publishedItems: 2,
          capacityShortfall: 0,
        }),
        expect.objectContaining({
          itemType: "word",
          targetItems: 8_000,
          publishedItems: 1,
          capacityShortfall: 500,
        }),
      ],
    });
  });

  it("promotes an import-derived target into a curated learning item", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.promoteImportedCandidate({
        targetType: "word",
        targetId: "target-imported-word",
        title: "Imported word",
        band: "n5",
        level: 6,
      }),
    ).resolves.toMatchObject({
      id: "item-target-imported-word",
      itemType: "word",
      band: "n5",
      title: "Imported word",
      level: 6,
      status: "needs-review",
      qualityIssues: expect.arrayContaining([
        expect.objectContaining({ code: "missing-accepted-answer" }),
      ]),
    });
  });

  it("returns ranked import-derived candidates", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(adminService.listImportedCandidates()).resolves.toEqual({
      candidates: [
        expect.objectContaining({
          rank: 1,
          score: 100,
          targetId: "target-imported-word",
          sourceName: "JMdict",
          suggestedBand: "n5",
        }),
      ],
    });
  });

  it("approves bilingual imported meanings into authored cards", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.approveImportedTranslation({
        targetType: "word",
        targetId: "target-imported-word",
        title: "Слово 水",
        band: "n5",
        level: 6,
        meanings: { ru: "вода", en: "water" },
        acceptedAnswers: { ru: ["Вода"], en: ["Water"] },
      }),
    ).resolves.toMatchObject({
      itemType: "word",
      meanings: { ru: "вода", en: "water" },
      status: "needs-review",
      cards: [
        {
          answerType: "meaning",
          acceptedAnswers: [
            { locale: "ru-RU", normalizedText: "вода", isPrimary: true },
            { locale: "en-US", normalizedText: "water", isPrimary: true },
          ],
        },
        {
          answerType: "reading",
          acceptedAnswers: [{ text: "みず", normalizedText: "みず" }],
        },
      ],
    });
  });

  it("requires non-empty RU and EN accepted answers for translation approval", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(
      adminService.approveImportedTranslation({
        targetType: "word",
        targetId: "target-imported-word",
        title: "Слово 水",
        band: "n5",
        meanings: { ru: "вода", en: "water" },
        acceptedAnswers: { ru: ["вода"], en: [] },
      }),
    ).rejects.toThrow("acceptedAnswers.en must contain at least one answer");
  });

  it("lists import runs with status, checksum, stats, and errors", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(adminService.listImportRuns()).resolves.toEqual({
      importRuns: [
        expect.objectContaining({
          id: "import-run-1",
          dataSourceName: "Project authored",
          checksumSha256: "sha256-test",
          status: "success",
          stats: { items: 1 },
          errorText: null,
        }),
        expect.objectContaining({
          id: "import-run-failed",
          dataSourceName: "JMdict",
          checksumSha256: "sha256-failed",
          status: "failed",
          stats: { entries: 0 },
          errorText: "Parser failed.",
        }),
      ],
    });
  });
});

class InMemoryAdminRepository extends AdminRepository implements OverridesRepository {
  private readonly importedCandidates: readonly AdminImportedCandidateDto[] = [
    {
      rank: 1,
      score: 100,
      targetId: "target-imported-word",
      itemType: "word",
      japanese: "水",
      reading: "みず",
      meanings: { ru: ["вода"], en: ["water"] },
      jlptLevel: null,
      sourcePriority: 1_000,
      sourceName: "JMdict",
      suggestedBand: "n5",
      suggestedTitle: "Слово 水",
      reasons: [
        { code: "source-priority", points: 55 },
        { code: "ru-coverage", points: 15 },
        { code: "en-coverage", points: 15 },
        { code: "reading", points: 10 },
        { code: "kanji-orthography", points: 5 },
      ],
    },
  ];
  private readonly importRuns: readonly AdminImportRunSummaryDto[] = [
    {
      id: "import-run-1",
      dataSourceName: "Project authored",
      licenseName: "Project content",
      sourceVersion: "bootstrap-1",
      sourceFileName: "seed.ts",
      checksumSha256: "sha256-test",
      status: "success",
      startedAt: "2026-06-22T07:00:00.000Z",
      finishedAt: "2026-06-22T07:01:00.000Z",
      recordCount: 1,
      stats: { items: 1 },
      errorText: null,
    },
    {
      id: "import-run-failed",
      dataSourceName: "JMdict",
      licenseName: "EDRDG License",
      sourceVersion: "2026-06",
      sourceFileName: "JMdict_e.gz",
      checksumSha256: "sha256-failed",
      status: "failed",
      startedAt: "2026-06-23T07:00:00.000Z",
      finishedAt: "2026-06-23T07:00:30.000Z",
      recordCount: 0,
      stats: { entries: 0 },
      errorText: "Parser failed.",
    },
  ];

  private items: AdminCurationItemDto[] = [
    {
      id: "item-kanji-one",
      itemType: "kanji",
      band: "foundation",
      title: "Кандзи 一",
      japanese: "一",
      reading: "いち",
      level: 1,
      jlptLevel: "N5",
      status: "needs-review",
      updatedAt: "2026-06-22T08:00:00.000Z",
      meanings: { ru: "один", en: "one" },
      cards: [
        {
          id: "card-meaning",
          promptType: "meaning",
          answerType: "meaning",
          locale: "ru-RU",
          sortOrder: 1,
          updatedAt: "2026-06-22T08:00:00.000Z",
          acceptedAnswers: [
            {
              id: "answer-1",
              cardId: "card-meaning",
              locale: "ru-RU",
              text: "один",
              normalizedText: "один",
              answerKind: "meaning",
              isPrimary: true,
            },
            {
              id: "answer-2",
              cardId: "card-meaning",
              locale: "en-US",
              text: "one",
              normalizedText: "one",
              answerKind: "meaning",
              isPrimary: true,
            },
          ],
          blockedAnswers: [],
        },
      ],
      hints: [],
      mnemonics: [
        {
          id: "mnemonic-ru",
          locale: "ru-RU",
          type: "story",
          body: "Одна черта задает идею единицы.",
          sourceKind: "curated",
          version: 1,
          updatedAt: "2026-06-22T08:00:00.000Z",
        },
        {
          id: "mnemonic-en",
          locale: "en-US",
          type: "story",
          body: "One stroke gives the idea of one.",
          sourceKind: "curated",
          version: 1,
          updatedAt: "2026-06-22T08:00:00.000Z",
        },
      ],
      dependencies: [
        {
          id: "dependency-component",
          prerequisiteItemId: "item-component-one",
          prerequisiteTitle: "Компонент 一",
          prerequisiteStatus: "published",
          dependencyType: "prerequisite",
          requiredStage: 1,
        },
      ],
      attributions: [
        {
          sourceName: "Project authored",
          licenseName: "Project content",
          attributionText: "Project-authored sample data.",
          sourceUrl: null,
        },
      ],
      importRuns: [
        {
          id: "import-run-1",
          dataSourceName: "Project authored",
          licenseName: "Project content",
          sourceVersion: "bootstrap-1",
          sourceFileName: "seed.ts",
          checksumSha256: "sha256-test",
          status: "success",
          startedAt: "2026-06-22T07:00:00.000Z",
          finishedAt: "2026-06-22T07:01:00.000Z",
          recordCount: 1,
          stats: { items: 1 },
          errorText: null,
        },
      ],
      qualityIssues: [],
    },
    {
      id: "item-word-empty",
      itemType: "word",
      band: "n5",
      title: "Слово 空",
      japanese: "空",
      reading: "そら",
      level: 8,
      jlptLevel: "N5",
      status: "needs-review",
      updatedAt: "2026-06-22T08:30:00.000Z",
      meanings: { ru: "", en: "" },
      cards: [
        {
          id: "card-empty",
          promptType: "meaning",
          answerType: "meaning",
          locale: "ru-RU",
          sortOrder: 1,
          updatedAt: "2026-06-22T08:30:00.000Z",
          acceptedAnswers: [],
          blockedAnswers: [],
        },
      ],
      hints: [],
      mnemonics: [],
      dependencies: [],
      attributions: [],
      importRuns: [],
      qualityIssues: [],
    },
  ];

  async listImportRuns(): Promise<readonly AdminImportRunSummaryDto[]> {
    return this.importRuns;
  }

  async listImportedCandidates(): Promise<readonly AdminImportedCandidateDto[]> {
    return this.importedCandidates;
  }

  async listReviewItems(
    filters: AdminReviewQueueFilters = {},
  ): Promise<readonly AdminReviewQueueItemDto[]> {
    return this.items
      .map(applyQualityIssues)
      .filter((item) => (filters.status ?? "needs-review") === item.status)
      .filter((item) => filters.band === undefined || item.band === filters.band)
      .filter((item) => filters.jlptLevel === undefined || item.jlptLevel === filters.jlptLevel)
      .filter(
        (item) =>
          filters.missingAcceptedAnswers !== true ||
          item.qualityIssues.some((issue) => issue.code === "missing-accepted-answer"),
      )
      .filter(
        (item) =>
          filters.missingMnemonics !== true ||
          item.qualityIssues.some(
            (issue) => issue.code === "missing-ru-mnemonic" || issue.code === "missing-en-mnemonic",
          ),
      )
      .map((item) => ({
        id: item.id,
        itemType: item.itemType,
        band: item.band,
        title: item.title,
        japanese: item.japanese,
        reading: item.reading,
        level: item.level,
        jlptLevel: item.jlptLevel,
        status: item.status,
        updatedAt: item.updatedAt,
        sourceNames: item.attributions.map((source) => source.sourceName),
        qualityIssues: item.qualityIssues,
      }));
  }

  async findCurationItem(itemId: string): Promise<AdminCurationItemDto | null> {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  async findItemByCardId(cardId: string): Promise<AdminCurationItemDto | null> {
    return this.items.find((item) => item.cards.some((card) => card.id === cardId)) ?? null;
  }

  async getCompletenessReport() {
    return buildCurriculumCompletenessReport(this.items, new Date("2026-06-22T09:30:00.000Z"));
  }

  async getScaleReadiness(): Promise<AdminCurriculumScaleReadinessDto> {
    return {
      generatedAt: "2026-07-13T10:00:00.000Z",
      items: [
        {
          itemType: "kanji",
          targetItems: 2_300,
          publishedItems: 2,
          inCurationItems: 1,
          importedCandidates: 2_500,
          remainingToPublish: 2_298,
          candidatesNeeded: 2_297,
          fillableCandidateSlots: 2_297,
          capacityShortfall: 0,
          candidateCoverage: {
            withReading: 2_490,
            withRussianMeaning: 10,
            withEnglishMeaning: 2_500,
            withBilingualMeanings: 10,
            withStrokeData: 2_450,
          },
        },
        {
          itemType: "word",
          targetItems: 8_000,
          publishedItems: 1,
          inCurationItems: 499,
          importedCandidates: 7_000,
          remainingToPublish: 7_999,
          candidatesNeeded: 7_500,
          fillableCandidateSlots: 7_000,
          capacityShortfall: 500,
          candidateCoverage: {
            withReading: 7_000,
            withRussianMeaning: 6_500,
            withEnglishMeaning: 7_000,
            withBilingualMeanings: 6_500,
            withStrokeData: null,
          },
        },
      ],
    };
  }

  async promoteImportedCandidate(
    input: NormalizedAdminPromoteCandidateInput,
  ): Promise<AdminCurationItemDto | null> {
    if (input.targetId !== "target-imported-word") {
      return null;
    }

    const item = applyQualityIssues({
      id: "item-target-imported-word",
      itemType: input.targetType,
      band: input.band,
      title: input.title,
      japanese: "水",
      reading: "みず",
      level: input.level,
      jlptLevel: "N5",
      status: "needs-review",
      updatedAt: "2026-06-22T09:20:00.000Z",
      meanings: { ru: "", en: "" },
      cards: [],
      hints: [],
      mnemonics: [],
      dependencies: [],
      attributions: [
        {
          sourceName: "JMdict",
          licenseName: "EDRDG License",
          attributionText: "EDRDG dictionary data.",
          sourceUrl: null,
        },
      ],
      importRuns: this.importRuns.slice(1, 2),
      qualityIssues: [],
    });

    this.items = [...this.items, item];

    return item;
  }

  async approveImportedTranslation(
    input: NormalizedAdminApproveImportedTranslationInput,
  ): Promise<AdminCurationItemDto | null> {
    if (input.targetType !== "word" || input.targetId !== "target-imported-word") {
      return null;
    }

    const meaningCardId = "card-target-imported-word-meaning";
    const readingCardId = "card-target-imported-word-reading";
    const item = applyQualityIssues({
      id: "item-target-imported-word",
      itemType: input.targetType,
      band: input.band,
      title: input.title,
      japanese: "水",
      reading: "みず",
      level: input.level,
      jlptLevel: null,
      status: "needs-review",
      updatedAt: "2026-06-22T09:25:00.000Z",
      meanings: input.meanings,
      cards: [
        {
          id: meaningCardId,
          promptType: "meaning",
          answerType: "meaning",
          locale: "ru-RU",
          sortOrder: 1,
          updatedAt: "2026-06-22T09:25:00.000Z",
          acceptedAnswers: input.acceptedAnswers.map((answer, index) => ({
            id: `approved-answer-${index}`,
            cardId: meaningCardId,
            ...answer,
          })),
          blockedAnswers: [],
        },
        {
          id: readingCardId,
          promptType: "reading",
          answerType: "reading",
          locale: "ru-RU",
          sortOrder: 2,
          updatedAt: "2026-06-22T09:25:00.000Z",
          acceptedAnswers: [
            {
              id: "approved-reading",
              cardId: readingCardId,
              locale: "ru-RU",
              text: "みず",
              normalizedText: "みず",
              answerKind: "reading",
              isPrimary: true,
            },
          ],
          blockedAnswers: [],
        },
      ],
      hints: [],
      mnemonics: [],
      dependencies: [],
      attributions: [
        {
          sourceName: "JMdict",
          licenseName: "EDRDG License",
          attributionText: "EDRDG dictionary data.",
          sourceUrl: null,
        },
      ],
      importRuns: this.importRuns.slice(1, 2),
      qualityIssues: [],
    });

    this.items = [...this.items.filter((candidate) => candidate.id !== item.id), item];

    return item;
  }

  async updateItemCuration(
    itemId: string,
    input: NormalizedAdminItemCurationInput,
  ): Promise<AdminCurationItemDto | null> {
    const item = this.items.find((candidate) => candidate.id === itemId);

    if (item === undefined) {
      return null;
    }

    const nextItem: AdminCurationItemDto = {
      ...item,
      band: input.band === undefined ? item.band : input.band,
      status: input.status ?? item.status,
      meanings: {
        ru: input.meanings?.ru ?? item.meanings.ru,
        en: input.meanings?.en ?? item.meanings.en,
      },
      updatedAt: "2026-06-22T09:00:00.000Z",
    };
    this.items = this.items.map((candidate) => (candidate.id === itemId ? nextItem : candidate));

    return nextItem;
  }

  async updateCardAnswers(
    cardId: string,
    input: Parameters<AdminRepository["updateCardAnswers"]>[1],
  ): Promise<AdminCurationItemDto | null> {
    const item = this.items.find((candidate) => candidate.cards.some((card) => card.id === cardId));
    const card = item?.cards.find((candidate) => candidate.id === cardId);

    if (item === undefined || card === undefined) {
      return null;
    }

    const nextItem: AdminCurationItemDto = {
      ...item,
      cards: item.cards.map((candidate) =>
        candidate.id === cardId
          ? {
              ...candidate,
              updatedAt: "2026-06-22T09:10:00.000Z",
              acceptedAnswers: input.acceptedAnswers.map((answer, index) => ({
                id: `answer-${index + 1}`,
                cardId,
                locale: answer.locale,
                text: answer.text,
                normalizedText: answer.normalizedText,
                answerKind: answer.answerKind,
                isPrimary: answer.isPrimary,
              })),
              blockedAnswers: input.blockedAnswers.map((answer, index) => ({
                id: `blocked-${index + 1}`,
                cardId,
                text: answer.text,
                normalizedText: answer.normalizedText,
                reason: answer.reason,
              })),
            }
          : candidate,
      ),
      updatedAt: "2026-06-22T09:10:00.000Z",
    };
    this.items = this.items.map((candidate) => (candidate.id === item.id ? nextItem : candidate));

    return nextItem;
  }

  async findCardForValidation(cardId: string): Promise<CardAnswerValidationRecord | null> {
    const card = this.items
      .flatMap((item) => item.cards)
      .find((candidate) => candidate.id === cardId);

    if (card === undefined) {
      return null;
    }

    return {
      cardId,
      answerKind: card.answerType,
      acceptedAnswers: card.acceptedAnswers.map((answer) => answer.normalizedText),
      blockedAnswers: card.blockedAnswers.map((answer) => answer.normalizedText),
    };
  }

  async listKanjiReadings(): Promise<readonly string[]> {
    return [];
  }

  async listAcceptedAnswers(): Promise<readonly UserAcceptedAnswerRecord[]> {
    return [];
  }

  async upsertAcceptedAnswer(_input: UpsertAcceptedAnswerInput): Promise<UserAcceptedAnswerRecord> {
    throw new Error("Not implemented in admin tests.");
  }

  async deleteAcceptedAnswer(): Promise<boolean> {
    return false;
  }

  async upsertPrivateMnemonic(_input: UpsertPrivateMnemonicInput): Promise<UserMnemonicRecord> {
    throw new Error("Not implemented in admin tests.");
  }

  async deletePrivateMnemonic(): Promise<boolean> {
    return false;
  }
}
