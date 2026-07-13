import { type CurriculumCandidatePlan } from "./curriculum-candidate-plan";

export type CurriculumCandidatePlanCacheEntry = {
  readonly version: string;
  readonly generatedAt: string;
  readonly plan: CurriculumCandidatePlan;
};

export class CurriculumCandidatePlanCache {
  private readonly entries = new Map<string, CurriculumCandidatePlanCacheEntry>();
  private readonly pending = new Map<string, Promise<CurriculumCandidatePlanCacheEntry>>();

  constructor(
    private readonly maximumEntries = 2,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!Number.isInteger(maximumEntries) || maximumEntries < 1) {
      throw new Error("Candidate plan cache size must be a positive integer.");
    }
  }

  getCached(version: string): CurriculumCandidatePlanCacheEntry | null {
    const entry = this.entries.get(version);

    if (entry === undefined) {
      return null;
    }

    this.entries.delete(version);
    this.entries.set(version, entry);
    return entry;
  }

  getOrLoad(
    version: string,
    loader: () => Promise<CurriculumCandidatePlan>,
  ): Promise<CurriculumCandidatePlanCacheEntry> {
    const cached = this.getCached(version);

    if (cached !== null) {
      return Promise.resolve(cached);
    }

    const existingLoad = this.pending.get(version);

    if (existingLoad !== undefined) {
      return existingLoad;
    }

    const load = Promise.resolve()
      .then(loader)
      .then((plan) => {
        const entry = {
          version,
          generatedAt: this.now().toISOString(),
          plan,
        };

        this.remember(entry);
        return entry;
      })
      .finally(() => {
        this.pending.delete(version);
      });

    this.pending.set(version, load);
    return load;
  }

  private remember(entry: CurriculumCandidatePlanCacheEntry): void {
    this.entries.delete(entry.version);
    this.entries.set(entry.version, entry);

    while (this.entries.size > this.maximumEntries) {
      const oldestVersion = this.entries.keys().next().value as string | undefined;

      if (oldestVersion === undefined) {
        return;
      }

      this.entries.delete(oldestVersion);
    }
  }
}
