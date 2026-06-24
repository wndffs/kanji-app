import { describe, expect, it } from "vitest";

import { safeExternalUrl } from "../src/lib/safe-url";

describe("safeExternalUrl", () => {
  it("allows http and https URLs", () => {
    expect(safeExternalUrl("https://example.test/source")).toBe("https://example.test/source");
    expect(safeExternalUrl("http://example.test/source")).toBe("http://example.test/source");
  });

  it("rejects scriptable and non-absolute URLs", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("//example.test/source")).toBeNull();
    expect(safeExternalUrl("/source")).toBeNull();
  });
});
