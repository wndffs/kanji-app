import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { DEFAULT_INTERFACE_PREFERENCES } from "@kanji-srs/shared";

import { INTERFACE_PREFERENCES_BOOTSTRAP } from "../src/lib/interface-preferences";

describe("prepaint interface preferences", () => {
  it.each([undefined, "invalid JSON", '{"interfaceTheme":"javascript:alert(1)"}'])(
    "uses safe defaults for unavailable or invalid storage (%s)",
    (stored) => {
      const dataset = {};
      runInNewContext(INTERFACE_PREFERENCES_BOOTSTRAP, {
        document: { documentElement: { dataset } },
        localStorage: { getItem: () => stored ?? null },
      });
      expect(dataset).toEqual(DEFAULT_INTERFACE_PREFERENCES);
    },
  );

  it("restores the signed-in account before paint and ignores unknown attributes", () => {
    const dataset = {};
    runInNewContext(INTERFACE_PREFERENCES_BOOTSTRAP, {
      document: { documentElement: { dataset } },
      localStorage: {
        getItem: (key: string) =>
          key === "kanji-srs.user"
            ? JSON.stringify({
                settings: { interfaceTheme: "dark", studyTextSize: "large", arbitrary: "unsafe" },
              })
            : null,
      },
    });
    expect(dataset).toEqual({
      ...DEFAULT_INTERFACE_PREFERENCES,
      interfaceTheme: "dark",
      studyTextSize: "large",
    });
  });

  it("does not prevent rendering when browser storage is disabled", () => {
    const dataset = {};
    runInNewContext(INTERFACE_PREFERENCES_BOOTSTRAP, {
      document: { documentElement: { dataset } },
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(dataset).toEqual(DEFAULT_INTERFACE_PREFERENCES);
  });
});
