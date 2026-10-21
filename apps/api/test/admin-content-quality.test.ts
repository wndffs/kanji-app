import { describe, expect, it, vi } from "vitest";
import { AdminService } from "../src/admin/admin.service";
import { type AdminRepository } from "../src/admin/admin.repository";

describe("admin content-quality pagination", () => {
  it("forwards a bounded validated cursor and issue-code filter", async () => {
    const getContentQualityPage = vi
      .fn()
      .mockResolvedValue({ scannedItems: 2, issues: [], nextCursor: null });
    const service = new AdminService({ getContentQualityPage } as unknown as AdminRepository);
    const cursor = "00000000-0000-0000-0000-000000000001";
    await expect(
      service.getContentQualityPage({ cursor, limit: "25", code: "unsupported-reading" }),
    ).resolves.toMatchObject({ scannedItems: 2 });
    expect(getContentQualityPage).toHaveBeenCalledWith({
      cursor,
      limit: 25,
      code: "unsupported-reading",
    });
  });
  it.each([
    { limit: "101" },
    { limit: "0" },
    { cursor: "not-a-uuid" },
    { code: "skip-all-checks" },
  ])("rejects invalid query %j", async (query) => {
    const getContentQualityPage = vi.fn();
    const service = new AdminService({ getContentQualityPage } as unknown as AdminRepository);
    await expect(service.getContentQualityPage(query)).rejects.toThrow("размер страницы");
    expect(getContentQualityPage).not.toHaveBeenCalled();
  });
});
