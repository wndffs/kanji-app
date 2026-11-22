import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reviewedRefreshManifests, selectReviewedSourcePin } from "./reviewed-source-pins.mjs";

const id = (number: number) =>
  `full-course-vocabulary-deepening-${String(number).padStart(2, "0")}`;

describe("verified source archive pin selection", () => {
  it("uses the refreshed snapshot only for selections with exact reviewed evidence", () => {
    const checked = Array.from({ length: 29 }, (_, index) => index + 1).filter(
      (value) => ![15, 21, 24].includes(value),
    );
    expect(selectReviewedSourcePin(checked.map(id).join(","))).toMatchObject({
      version: "2026-11-22",
      jmdict: "fedf3314736c94e474ab3ce872d6c172b05c6cc0983f5a65b76b4cef49cea194",
      kanjidic2: "c5517ceca1de1bc43f59bd2ac9ce1fa6e6a6de0c34170137db027be82a29ad56",
    });
    for (const sealed of [id(21), id(24), "full-course-vocabulary-followthrough-07"]) {
      const pin = selectReviewedSourcePin(`${id(1)},${sealed}`);
      expect(pin.version).toBe("2026-11-22");
      expect(reviewedRefreshManifests(pin.version, pin.jmdict)).toHaveProperty(sealed);
    }
    for (const held of [id(15), "full-course-vocabulary-followthrough-01"]) {
      expect(selectReviewedSourcePin(held).version).toBe("2026-10-31");
      expect(selectReviewedSourcePin(`${id(1)},${held}`).version).toBe("2026-10-31");
    }
    expect(() => reviewedRefreshManifests("2026-11-22", "0".repeat(64))).toThrow("pins");
    expect(reviewedRefreshManifests("2026-10-31", "0".repeat(64))).toBeNull();
  });

  it("rejects missing, duplicate, unbounded and malformed selections", () => {
    for (const selection of [
      undefined,
      "",
      `${id(1)},`,
      `${id(1)},${id(1)}`,
      "foobar\nkey=oops",
      Array.from({ length: 41 }, (_, i) => `word-${i}`).join(","),
    ])
      expect(() => selectReviewedSourcePin(selection)).toThrow("Invalid reviewed word selection");
  });

  it("writes only fixed pin metadata to GitHub outputs", () => {
    const script = fileURLToPath(new URL("./reviewed-source-pins.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, WORD_BATCH: id(1), DATABASE_URL: "private-fixture" },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status).toBe(0);
    expect(
      result.stdout
        .trim()
        .split("\n")
        .map((line) => line.split("=")[0]),
    ).toEqual(["version", "jmdict", "kanjidic2", "kanjivg"]);
    expect(result.stdout).not.toContain(id(1));
    expect(result.stdout).not.toContain("private-fixture");
  });
});
