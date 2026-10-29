import { describe, expect, it, vi } from "vitest";
import { planPronunciation } from "../prisma/publish-pronunciation";
import { PRONUNCIATION_RECORDINGS } from "@kanji-srs/shared";

describe("bounded pronunciation attachment preflight", () => {
  function harness() {
    const word = vi
      .fn()
      .mockResolvedValue({
        id: "word",
        importedRecord: {
          sourceRecordId: PRONUNCIATION_RECORDINGS[0].sourceRecordId,
          importRun: { status: "SUCCESS" },
        },
      });
    const item = vi.fn().mockResolvedValue({ id: "item", status: "PUBLISHED" });
    const asset = vi.fn().mockResolvedValue(null);
    const db = {
      word: { findUnique: word },
      learningItem: { findUnique: item },
      audioAsset: { findUnique: asset },
      license: { findUnique: vi.fn().mockResolvedValue(null) },
      dataSource: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    return { db, word, item, asset };
  }
  it("validates media and exact source binding with a read-only API surface", async () => {
    const h = harness();
    expect(await planPronunciation(h.db as never)).toMatchObject([
      { itemId: "item", existing: null },
    ]);
    expect(h.word.mock.calls[0]?.[0]).toMatchObject({
      where: { expression_reading: { expression: "食べる", reading: "たべる" } },
    });
  });
  it("rejects unpublished targets and foreign asset collisions before mutation", async () => {
    const h = harness();
    h.item.mockResolvedValueOnce({ id: "item", status: "DRAFT" });
    await expect(planPronunciation(h.db as never)).rejects.toThrow("published learning item");
    h.asset.mockResolvedValueOnce({ id: "foreign", learningItemId: "other", status: "PUBLISHED" });
    await expect(planPronunciation(h.db as never)).rejects.toThrow("collision");
  });
});
