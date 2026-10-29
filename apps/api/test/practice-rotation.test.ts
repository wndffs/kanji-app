import { describe, expect, it } from "vitest";
import { rotatePracticeCandidates } from "../src/reviews/practice-rotation";
describe("bounded weak-card practice rotation", () => {
  it("reaches the twenty-first and all bounded candidates over consecutive sessions", () => {
    const pool = Array.from({ length: 65 }, (_, i) => `card-${i}`);
    let previous: readonly string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      previous = rotatePracticeCandidates(pool, (id) => id, previous, 20);
      previous.forEach((id) => seen.add(id));
    }
    expect(seen.size).toBe(65);
  });
  it("recovers from removed cursors, bounds and empty pools", () => {
    expect(rotatePracticeCandidates(["a", "b"], (id) => id, ["removed"], 1)).toEqual(["a"]);
    expect(rotatePracticeCandidates([], (id) => id, ["a"], 20)).toEqual([]);
    expect(rotatePracticeCandidates(["a"], (id) => id, [], 0)).toEqual([]);
  });
});
