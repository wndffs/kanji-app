import { describe, expect, it } from "vitest";

import { type AdminCurationItemDto } from "@kanji-srs/shared";

import { getAdminQualityIssues } from "../src/admin/curriculum-quality";
import {
  isEligibleListeningAudio,
  toAudioAssetDto,
  type AudioAssetRecord,
} from "../src/audio/audio-asset";
import { hasCompletedListeningPlayback } from "../src/audio/listening-playback";

describe("licensed listening audio", () => {
  it("accepts only published HTTPS assets for vocabulary and sentences", () => {
    const asset = buildAsset();

    expect(isEligibleListeningAudio(asset, "item-word", "word")).toBe(true);
    expect(isEligibleListeningAudio(asset, "item-word", "kanji")).toBe(false);
    expect(isEligibleListeningAudio({ ...asset, status: "DRAFT" }, "item-word", "word")).toBe(
      false,
    );
    expect(
      isEligibleListeningAudio(
        { ...asset, mediaUrl: "http://media.example.test/word.mp3" },
        "item-word",
        "word",
      ),
    ).toBe(false);
    expect(
      isEligibleListeningAudio({ ...asset, license: { name: "", url: null } }, "item-word", "word"),
    ).toBe(false);
  });

  it("exposes source, license, speaker, and attribution metadata", () => {
    expect(toAudioAssetDto(buildAsset())).toMatchObject({
      learningItemId: "item-word",
      speakerName: "Project speaker",
      sourceName: "Project recordings",
      licenseName: "Project-owned audio",
      attributionText: "Recorded for Kanji SRS.",
      status: "published",
    });
  });

  it("grades a listening answer only after successful playback", () => {
    const audio = toAudioAssetDto(buildAsset());

    expect(hasCompletedListeningPlayback("listening", audio, undefined)).toBe(false);
    expect(
      hasCompletedListeningPlayback("listening", audio, {
        completed: false,
        playCount: 1,
      }),
    ).toBe(false);
    expect(
      hasCompletedListeningPlayback("listening", audio, {
        completed: true,
        playCount: 1,
      }),
    ).toBe(true);
  });

  it("allows replay without changing listening eligibility", () => {
    const audio = toAudioAssetDto(buildAsset());

    expect(
      hasCompletedListeningPlayback("listening", audio, {
        completed: true,
        playCount: 3,
      }),
    ).toBe(true);
    expect(hasCompletedListeningPlayback("meaning", null, undefined)).toBe(true);
  });

  it("blocks publication without an eligible licensed asset", () => {
    const missingAsset = buildCurationItem(null);
    const draftAsset = buildCurationItem({
      ...toAudioAssetDto(buildAsset()),
      status: "draft",
    });
    const ineligibleTarget = {
      ...buildCurationItem(toAudioAssetDto(buildAsset())),
      itemType: "kanji" as const,
    };

    expect(audioIssueCodes(missingAsset)).toContain("missing-audio-asset");
    expect(audioIssueCodes(draftAsset)).toContain("unpublished-audio-asset");
    expect(audioIssueCodes(ineligibleTarget)).toContain("ineligible-audio-target");
  });

  it("accepts a published project recording for vocabulary publication", () => {
    expect(audioIssueCodes(buildCurationItem(toAudioAssetDto(buildAsset())))).toEqual([]);
  });
});

function buildAsset(): AudioAssetRecord {
  return {
    id: "audio-1",
    learningItemId: "item-word",
    mediaUrl: "https://media.example.test/word.mp3",
    storageKey: "audio/word.mp3",
    checksumSha256: "a".repeat(64),
    durationMs: 950,
    speakerName: "Project speaker",
    voiceMetadataJson: { recordingEnvironment: "studio" },
    locale: "ja-JP",
    attributionText: "Recorded for Kanji SRS.",
    importRunId: null,
    status: "PUBLISHED",
    dataSource: { name: "Project recordings", homepageUrl: null },
    license: { name: "Project-owned audio", url: null },
  };
}

function buildCurationItem(
  audio: AdminCurationItemDto["cards"][number]["audio"],
): AdminCurationItemDto {
  return {
    id: "item-word",
    itemType: "word",
    band: "n5",
    title: "一つ",
    japanese: "一つ",
    reading: "ひとつ",
    level: 1,
    jlptLevel: "N5",
    status: "needs-review",
    updatedAt: "2026-07-27T00:00:00.000Z",
    meanings: { ru: "один предмет", en: "one thing" },
    cards: [
      {
        id: "card-listening",
        promptType: "listening",
        answerType: "reading",
        locale: "ru-RU",
        sortOrder: 0,
        updatedAt: "2026-07-27T00:00:00.000Z",
        acceptedAnswers: [
          {
            id: "answer-reading",
            cardId: "card-listening",
            locale: "ru-RU",
            text: "ひとつ",
            normalizedText: "ひとつ",
            answerKind: "reading",
            isPrimary: true,
          },
        ],
        blockedAnswers: [],
        audio,
      },
    ],
    hints: [],
    mnemonics: [
      {
        id: "mnemonic-ru",
        locale: "ru-RU",
        type: "meaning",
        body: "Русская подсказка.",
        sourceKind: "curated",
        version: 1,
        updatedAt: "2026-07-27T00:00:00.000Z",
      },
      {
        id: "mnemonic-en",
        locale: "en-US",
        type: "meaning",
        body: "English hint.",
        sourceKind: "curated",
        version: 1,
        updatedAt: "2026-07-27T00:00:00.000Z",
      },
    ],
    dependencies: [],
    attributions: [
      {
        sourceName: "Project recordings",
        sourceUrl: null,
        licenseName: "Project-owned audio",
        attributionText: "Recorded for Kanji SRS.",
      },
    ],
    importRuns: [],
    qualityIssues: [],
  };
}

function audioIssueCodes(item: AdminCurationItemDto): readonly string[] {
  return getAdminQualityIssues(item)
    .filter((issue) => issue.code.includes("audio"))
    .map((issue) => issue.code);
}
