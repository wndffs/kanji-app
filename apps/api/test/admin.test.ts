import { describe, expect, it } from "vitest";

import {
  type AdminCurationItemDto,
  type AdminImportRunSummaryDto,
  type AdminReviewQueueItemDto,
} from "@kanji-srs/shared";

import { AdminRepository } from "../src/admin/admin.repository";
import { AdminService } from "../src/admin/admin.service";
import { type NormalizedAdminItemCurationInput } from "../src/admin/admin.types";
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

    await expect(adminService.listReviewItems()).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: "item-kanji-one",
          status: "needs-review",
        }),
      ],
    });
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

  private item: AdminCurationItemDto = {
    id: "item-kanji-one",
    itemType: "kanji",
    title: "Кандзи 一",
    japanese: "一",
    reading: "いち",
    level: 1,
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
    mnemonics: [],
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
  };

  async listImportRuns(): Promise<readonly AdminImportRunSummaryDto[]> {
    return this.importRuns;
  }

  async listReviewItems(): Promise<readonly AdminReviewQueueItemDto[]> {
    return [
      {
        id: this.item.id,
        itemType: this.item.itemType,
        title: this.item.title,
        japanese: this.item.japanese,
        reading: this.item.reading,
        level: this.item.level,
        status: this.item.status,
        updatedAt: this.item.updatedAt,
        sourceNames: this.item.attributions.map((source) => source.sourceName),
      },
    ];
  }

  async findCurationItem(itemId: string): Promise<AdminCurationItemDto | null> {
    return itemId === this.item.id ? this.item : null;
  }

  async updateItemCuration(
    itemId: string,
    input: NormalizedAdminItemCurationInput,
  ): Promise<AdminCurationItemDto | null> {
    if (itemId !== this.item.id) {
      return null;
    }

    this.item = {
      ...this.item,
      status: input.status ?? this.item.status,
      meanings: {
        ru: input.meanings?.ru ?? this.item.meanings.ru,
        en: input.meanings?.en ?? this.item.meanings.en,
      },
      updatedAt: "2026-06-22T09:00:00.000Z",
    };

    return this.item;
  }

  async updateCardAnswers(
    cardId: string,
    input: Parameters<AdminRepository["updateCardAnswers"]>[1],
  ): Promise<AdminCurationItemDto | null> {
    const card = this.item.cards.find((candidate) => candidate.id === cardId);

    if (card === undefined) {
      return null;
    }

    this.item = {
      ...this.item,
      cards: this.item.cards.map((candidate) =>
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

    return this.item;
  }

  async findCardForValidation(cardId: string): Promise<CardAnswerValidationRecord | null> {
    const card = this.item.cards.find((candidate) => candidate.id === cardId);

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
