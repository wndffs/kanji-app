import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { APP_NAME } from "@kanji-srs/shared";
import manifest from "../src/app/manifest";

describe("public installation metadata", () => {
  it("uses a stable same-origin identity and authenticated dashboard entry point", () => {
    expect(manifest()).toMatchObject({
      id: "/",
      name: APP_NAME,
      short_name: APP_NAME,
      lang: "ru",
      start_url: "/dashboard",
      scope: "/",
      display: "standalone",
      prefer_related_applications: false,
    });
    expect(JSON.stringify(manifest())).not.toMatch(/https?:|token|userId|email|\?/u);
  });

  it("provides both required opaque, mask-safe icon sizes from original artwork", () => {
    const icons = manifest().icons!;
    expect(icons).toHaveLength(4);
    for (const size of [192, 512]) {
      for (const purpose of ["any", "maskable"]) {
        expect(icons).toContainEqual({
          src: `/icons/app-${size}.png`,
          sizes: `${size}x${size}`,
          type: "image/png",
          purpose,
        });
      }
      assertPng(`../public/icons/app-${size}.png`, size);
    }
  });

  it("provides the dedicated Apple home-screen icon", () => {
    assertPng("../src/app/apple-icon.png", 180);
  });
});

function assertPng(path: string, size: number): void {
  const bytes = readFileSync(fileURLToPath(new URL(path, import.meta.url)));
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  expect(bytes.readUInt32BE(16)).toBe(size);
  expect(bytes.readUInt32BE(20)).toBe(size);
  expect(bytes[25]).toBe(2); // RGB, with no transparent corners for platform masks.
  expect(bytes.length).toBeGreaterThan(100);
}
