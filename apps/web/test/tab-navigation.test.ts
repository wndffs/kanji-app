import { expect, it } from "vitest";
import { nextTabIndex } from "../src/lib/tab-navigation";

it("wraps phase arrows and bounds Home/End without treating Enter or IME as navigation", () => {
  expect(nextTabIndex(2,3,"ArrowRight")).toBe(0);
  expect(nextTabIndex(0,3,"ArrowLeft")).toBe(2);
  expect(nextTabIndex(1,3,"Home")).toBe(0);
  expect(nextTabIndex(0,3,"End")).toBe(2);
  expect(nextTabIndex(0,0,"End")).toBeNull();
  for (const key of ["Enter","Process","Tab","a"]) expect(nextTabIndex(0,3,key)).toBeNull();
});
