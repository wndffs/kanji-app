import { describe, expect, it, vi } from "vitest";
import { type Prisma } from "@prisma/client";

import { findPublishedItemSearchPage } from "../src/item-search";

describe("published search pages", () => {
  it("binds literal input and computes IDs/count in one stable page query", async () => {
    const $queryRaw = vi.fn().mockResolvedValue([{ ids: ["second"], total: 2300n }]);
    const query = "%'_\\'; DROP TABLE anything; --";
    expect(await findPublishedItemSearchPage({ $queryRaw } as never, { query, page: 2, limit: 20 })).toEqual({ ids: ["second"], total: 2300 });
    expect($queryRaw).toHaveBeenCalledOnce();
    const sql = $queryRaw.mock.calls[0]![0] as Prisma.Sql;
    expect(sql.sql).not.toContain(query);
    expect(sql.values).toContain(query);
    expect(sql.values.slice(-2)).toEqual([20, 20]);
    expect(sql.sql).toContain("li.status = 'PUBLISHED'");
    expect(sql.sql).toContain('ORDER BY "levelHint" ASC NULLS LAST, kind, title, id');
    expect(sql.sql).not.toContain("UserItemOverride");
  });

  it("preserves totals when a requested page is empty", async () => {
    const $queryRaw = vi.fn().mockResolvedValue([{ ids: [], total: 1n }]);
    expect(await findPublishedItemSearchPage({ $queryRaw } as never, { query: "one", page: 2, limit: 20 })).toEqual({ ids: [], total: 1 });
  });

  it.each([[0, 20], [1.5, 20], [10_001, 20], [1, 0], [1, 51]])("rejects invalid bounds (%s/%s) without querying", async (page, limit) => {
    const $queryRaw = vi.fn();
    await expect(findPublishedItemSearchPage({ $queryRaw } as never, { query: "one", page, limit })).rejects.toThrow("bounds");
    expect($queryRaw).not.toHaveBeenCalled();
  });
});
