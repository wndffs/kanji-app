import { describe, expect, it } from "vitest";

import { createDatabaseConnectionConfig } from "../src";

describe("createDatabaseConnectionConfig", () => {
  it("keeps the database URL in a typed config object", () => {
    expect(createDatabaseConnectionConfig("postgresql://localhost/example")).toEqual({
      databaseUrl: "postgresql://localhost/example",
    });
  });
});
