import { describe, expect, it } from "vitest";
import { decodeItemRouteParameter } from "../src/lib/item-route";

describe("item route parameters", () => {
  it.each([
    ["一", "一"],
    ["%E4%B8%80", "一"],
    ["%e5%8f%a3", "口"],
    ["%25E4%25B8%2580", "%E4%B8%80"],
    ["%broken", "%broken"],
    ["%E4%B8", "%E4%B8"],
  ])("decodes %s at most once without crashing on malformed input", (input, expected) => {
    expect(decodeItemRouteParameter(input)).toBe(expected);
  });
});
