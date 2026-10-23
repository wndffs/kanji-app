import { describe, expect, it } from "vitest";

import { mainNavigation, primaryNavigation, secondaryNavigation } from "../src/lib/navigation";

describe("primaryNavigation", () => {
  it("keeps five daily destinations direct and every other destination in the overflow", () => {
    expect(mainNavigation.map((item) => item.href)).toEqual([
      "/dashboard",
      "/lessons",
      "/reviews",
      "/characters",
      "/search",
    ]);
    const all = [...mainNavigation, ...secondaryNavigation];
    expect(new Set(all.map((item) => item.href)).size).toBe(all.length);
    for (const item of primaryNavigation) expect(all).toContainEqual(item);
    expect(secondaryNavigation).toContainEqual({ href: "/courses", label: "Курсы" });
    expect(secondaryNavigation.find((item) => item.href === "/admin")?.adminOnly).toBe(true);
  });
  it("starts with the dashboard route", () => {
    expect(primaryNavigation[0]).toEqual({ href: "/dashboard", label: "Панель" });
  });

  it("links to the unified character hub from primary navigation", () => {
    expect(primaryNavigation).toContainEqual({ href: "/characters", label: "Символы" });
  });

  it("links to optional practice from primary navigation", () => {
    expect(primaryNavigation).toContainEqual({ href: "/practice", label: "Практика" });
  });
});
