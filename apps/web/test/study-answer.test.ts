import { expect, it } from "vitest";

import { prepareStudyAnswer } from "../src/lib/study-answer";

it("finalizes romaji only for reading answers", () => {
  expect(prepareStudyAnswer(" ニホn ", "reading")).toBe("ニホン");
  expect(prepareStudyAnswer(" にほん ", "reading")).toBe("にほん");
  expect(prepareStudyAnswer("   ", "reading")).toBe("");
  expect(prepareStudyAnswer(" Japan ", "meaning")).toBe("Japan");
  expect(prepareStudyAnswer(" Япония ", "meaning")).toBe("Япония");
});
