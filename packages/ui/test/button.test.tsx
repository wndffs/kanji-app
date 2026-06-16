import { describe, expect, it } from "vitest";

import { Button } from "../src";

describe("Button", () => {
  it("is exported as a React component", () => {
    expect(Button.name).toBe("Button");
  });
});
