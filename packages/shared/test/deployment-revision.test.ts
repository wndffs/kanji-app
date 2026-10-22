import { describe, expect, it } from "vitest";

import { parseDeploymentRevision } from "../src/deployment-revision";

describe("public deployment revision", () => {
  it("normalizes only a complete hexadecimal commit identity", () => {
    expect(parseDeploymentRevision("ABCDEF0123456789ABCDEF0123456789ABCDEF01")).toBe(
      "abcdef0123456789abcdef0123456789abcdef01",
    );
  });

  it.each([
    undefined,
    null,
    "",
    "abc1234",
    "x".repeat(40),
    "a".repeat(41),
    " a".repeat(20),
    123,
    { secret: "private" },
    "postgresql://private:password@db.test/app",
  ])("does not expose malformed or unrelated metadata %#", (value) => {
    expect(parseDeploymentRevision(value)).toBeNull();
  });
});
