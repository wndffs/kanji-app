import { describe, expect, it, vi } from "vitest";

import { PrismaItemsRepository } from "../src/items/items.repository";

describe("search hydration boundaries", () => {
  it("hydrates only page IDs, without examples or related graphs", async () => {
    const $queryRaw = vi.fn().mockResolvedValue([{ ids: ["page-21", "page-22"], total: 2300n }]);
    const repository = new PrismaItemsRepository({ db: { $queryRaw } } as never);
    const hydrate = vi
      .spyOn(repository, "findItemById")
      .mockImplementation(async (id) => ({ id }) as never);
    const result = await repository.searchItems(
      { query: "one", page: 2, limit: 20 },
      { userId: "owner" },
    );
    expect(result).toEqual({ items: [{ id: "page-21" }, { id: "page-22" }], total: 2300 });
    expect(hydrate.mock.calls).toEqual([
      [
        "page-21",
        { userId: "owner", includeExamples: false, includeRelations: false, summaryOnly: true },
      ],
      [
        "page-22",
        { userId: "owner", includeExamples: false, includeRelations: false, summaryOnly: true },
      ],
    ]);
  });
});
