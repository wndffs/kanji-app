import { describe, expect, it } from "vitest";
import { PlaybackStallWatch } from "../src/lib/playback-stall";
describe("bounded media stalling, not a duration cutoff", () => {
  it("allows healthy recordings past 31 seconds and longer", () => {
    const watch = new PlaybackStallWatch(0, 0);
    for (let second = 1; second <= 180; second++)
      expect(watch.stalled(second * 1000, second)).toBe(false);
  });
  it("detects metadata/start and mid-recording stalls, including invalid positions", () => {
    const watch = new PlaybackStallWatch(0, 0);
    expect(watch.stalled(11999, 0)).toBe(false);
    expect(watch.stalled(12000, 0)).toBe(true);
    const playing = new PlaybackStallWatch(0, 0);
    expect(playing.stalled(11000, 3)).toBe(false);
    expect(playing.stalled(23000, 3)).toBe(true);
    expect(playing.stalled(24000, NaN)).toBe(true);
  });
});
