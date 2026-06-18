import { describe, expect, it } from "vitest";

import { primaryNavigation } from "../src/lib/navigation";

describe("primaryNavigation", () => {
  it("starts with the dashboard route", () => {
    expect(primaryNavigation[0]).toEqual({ href: "/dashboard", label: "Панель" });
  });
});
