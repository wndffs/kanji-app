import { afterEach, describe, expect, it, vi } from "vitest";
import { readCourseMaterialView, storeCourseMaterialView } from "../src/lib/course-material-preferences";
afterEach(() => vi.unstubAllGlobals());
describe("owner-scoped material view", () => {
  it("does not borrow another user's preference and ignores unknown values", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) } });
    storeCourseMaterialView("one", "list");
    expect(readCourseMaterialView("one")).toBe("list");
    expect(readCourseMaterialView("two")).toBe("grid");
    values.set("kanji-srs.course-material-view:two", "invalid");
    expect(readCourseMaterialView("two")).toBe("grid");
  });
  it("works when storage is blocked", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("blocked"); } });
    expect(readCourseMaterialView("one")).toBe("grid");
    expect(() => storeCourseMaterialView("one", "list")).not.toThrow();
  });
});
