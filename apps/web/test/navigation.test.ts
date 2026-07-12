import { describe, expect, it } from "vitest";

import { primaryNavigation } from "../src/lib/navigation";

describe("primaryNavigation", () => {
  it("starts with the dashboard route", () => {
    expect(primaryNavigation[0]).toEqual({ href: "/dashboard", label: "Панель" });
  });

  it("links to kana onboarding from primary navigation", () => {
    expect(primaryNavigation).toContainEqual({ href: "/kana", label: "Кана" });
  });

  it("links to optional practice from primary navigation", () => {
    expect(primaryNavigation).toContainEqual({ href: "/practice", label: "Практика" });
  });
});
