import { describe, expect, it } from "vitest";

import { withNeonConnectionDefaults } from "../src/connection-defaults";

describe("Neon connection defaults", () => {
  it.each(["ep-example", "ep-example-pooler"])("bounds cold starts for %s", (endpoint) => {
    const url = new URL(
      withNeonConnectionDefaults(
        `postgresql://user:p%40ss@${endpoint}.eu-central-1.aws.neon.tech/db?sslmode=require&channel_binding=require`,
      ),
    );
    expect(url.searchParams.get("connect_timeout")).toBe("15");
    expect(url.searchParams.get("pool_timeout")).toBe("15");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.password).toBe("p%40ss");
  });

  it("preserves explicit timeouts and is idempotent", () => {
    const input = "postgresql://u:p@ep-example.neon.tech/db?connect_timeout=30&pool_timeout=20";
    expect(withNeonConnectionDefaults(input)).toBe(input);
    const once = withNeonConnectionDefaults(input.replace("connect_timeout=30&", ""));
    expect(withNeonConnectionDefaults(once)).toBe(once);
    expect(new URL(once).searchParams.get("pool_timeout")).toBe("20");
  });

  it.each([
    "postgresql://u:p@localhost:5432/kanji_srs?schema=public",
    "postgresql://u:p@neon.tech.invalid/db",
    "postgresql://u:p@notneon.tech/db",
    "postgresql://u:p@other.example/db",
    "https://ep-example.neon.tech/",
    "invalid-url",
  ])("leaves non-Neon or invalid input unchanged %#", (input) => {
    expect(withNeonConnectionDefaults(input)).toBe(input);
  });
});
