export class PlaybackStallWatch {
  private lastProgressAt: number;
  private lastPosition: number;
  constructor(now: number, position: number) {
    this.lastProgressAt = now;
    this.lastPosition = position;
  }
  stalled(now: number, position: number): boolean {
    if (Number.isFinite(position) && position > this.lastPosition) {
      this.lastPosition = position;
      this.lastProgressAt = now;
    }
    return now - this.lastProgressAt >= 12_000;
  }
}
