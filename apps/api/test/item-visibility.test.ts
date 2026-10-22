import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { PrismaItemsRepository } from "../src/items/items.repository";
import { ItemsService } from "../src/items/items.service";

describe("public item visibility", () => {
  it.each(["DRAFT", "NEEDS_REVIEW", "ARCHIVED"])(
    "does not hydrate %s items by ID or kanji",
    async (status) => {
      const db = {
        learningItem: { findUnique: vi.fn().mockResolvedValue({ id: "item", status }) },
        kanji: { findUnique: vi.fn().mockResolvedValue({ id: "kanji" }) },
      };
      const repository = new PrismaItemsRepository({ db } as never);
      await expect(repository.findItemById("item", {})).resolves.toBeNull();
      await expect(repository.findKanjiItemByCharacter("米", {})).resolves.toBeNull();
      expect(db.learningItem.findUnique.mock.calls.map(([query]) => query.where)).toEqual([
        { id: "item", status: "PUBLISHED" },
        { targetType_targetId: { targetType: "KANJI", targetId: "kanji" }, status: "PUBLISHED" },
      ]);
    },
  );

  it("returns not-found for unpublished history without reading review or private data", async () => {
    const count = vi.fn().mockResolvedValue(0);
    const history = vi.fn();
    const repository = new PrismaItemsRepository({
      db: { learningItem: { count }, reviewAnswer: { findMany: history } },
    } as never);
    const service = new ItemsService(repository);
    await expect(service.getItemHistory("draft", {}, null)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(count).toHaveBeenCalledWith({ where: { id: "draft", status: "PUBLISHED" } });
    expect(history).not.toHaveBeenCalled();
  });
});
