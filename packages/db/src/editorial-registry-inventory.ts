import { createHash } from "node:crypto";

import { buildMainCourseBlueprint } from "./main-course";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
  type MainCourseContentBatch,
} from "./main-course-content";
import {
  buildMainCourseWordBatches,
  mainCourseWordBatchChecksum,
  validateMainCourseWordBatches,
  wordHanCharacters,
  type MainCourseWordBatch,
} from "./main-course-word-content";

export const EDITORIAL_REGISTRY_INVENTORY_VERSION = "editorial-registry-inventory-v1";

export type EditorialRegistryInventoryOptions = {
  readonly kanjiBatches?: readonly MainCourseContentBatch[];
  readonly wordBatches?: readonly MainCourseWordBatch[];
};

type TargetKind = "COMPONENT" | "KANJI" | "WORD";
type Target = {
  key: string;
  kind: TargetKind;
  levelNumber: number;
  sortOrder: number;
  prerequisiteKeys: readonly string[];
};

// Read-only V1/V2/V3 references from foundation-pilot.ts. Do not import its DB runtime
// or derive membership from the growing registry; later sources cannot enlarge these seals.
const SEALED_KANJI = [
  [
    "task-118-foundation-kanji-01",
    "34676566c590fd19d10349e6bb07c75d01471fc618872fa103db2e676fd138b8",
  ],
  [
    "task-118-foundation-kanji-02",
    "99268635c984603c30a1a53c2beb0bcd63a53316b9cb3a83b4e51c54e1c18714",
  ],
  [
    "task-118-foundation-kanji-03",
    "fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92",
  ],
  [
    "task-118-foundation-kanji-04",
    "5547b31673a20cffdfc817b0a95bd8b3e202108529c844f5090e0234fefa7850",
  ],
  [
    "task-118-foundation-kanji-05",
    "95a4b69a331f200caa5044717cde9d628c3d3ad1d79600000c142a55967a3c1b",
  ],
].map(([id, checksumSha256]) => ({ kind: "kanji" as const, id, checksumSha256, version: "1" }));
const SEALED_WORDS = [
  [
    "task-127-foundation-words-01",
    "1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf",
  ],
  [
    "task-127-foundation-words-02",
    "0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f",
  ],
  [
    "task-127-foundation-words-03",
    "ef7090a4cea8c4b74c04a3cebfe85dc9832d64e1b7d071e409232287e7cf2ff4",
  ],
  [
    "task-127-foundation-words-04",
    "81496c6ffcb91d0d7fa046b8f075b4b1aff6e2ccec7f69d48c48708bb043b5b6",
  ],
  ["task-127-course-words-05", "e1fd34111d46183f4376934d9d55429c191524e7d319ec367b8bdb2c4d972f36"],
].map(([id, checksumSha256]) => ({ kind: "word" as const, id, checksumSha256, version: "1" }));
const SOURCE_SEALS = [
  {
    id: "v1",
    version: "1",
    sources: [...SEALED_KANJI.slice(0, 2), ...SEALED_WORDS.slice(0, 1)],
    sealedDistinctTotals: { components: 40, kanji: 40, words: 20, items: 100 },
  },
  {
    id: "v2",
    version: "2",
    sources: [...SEALED_KANJI.slice(0, 4), ...SEALED_WORDS.slice(0, 3)],
    sealedDistinctTotals: { components: 53, kanji: 61, words: 60, items: 174 },
  },
  {
    id: "v3",
    version: "3",
    sources: [...SEALED_KANJI, ...SEALED_WORDS],
    sealedDistinctTotals: { components: 63, kanji: 81, words: 100, items: 244 },
  },
] as const;

export function buildEditorialRegistryInventory(options: EditorialRegistryInventoryOptions = {}) {
  const kanjiBatches = options.kanjiBatches ?? buildMainCourseContentBatches();
  const wordBatches = options.wordBatches ?? buildMainCourseWordBatches();
  const courseSlug = buildMainCourseBlueprint().course.slug;
  // The existing kanji validator resolves components in traversal order. Validate
  // all component declarations first, so inventory does not depend on input order.
  const issues = [
    ...validateMainCourseContentBatches([
      ...kanjiBatches.map((batch) => ({
        ...batch,
        id: `component-declarations:${batch.id}`,
        kanji: [],
      })),
      ...kanjiBatches.map((batch) => ({
        ...batch,
        id: `kanji-content:${batch.id}`,
        components: [],
      })),
    ]),
    ...validateMainCourseWordBatches(wordBatches),
  ];
  if (kanjiBatches.length === 0) issues.push("Kanji batch registry must not be empty.");
  const entries = [
    ...kanjiBatches.map((batch) => ({
      kind: "kanji" as const,
      batch,
      checksumSha256: hash(JSON.stringify(batch)),
      targets: [
        ...batch.components.map(
          (item, index): Target => ({
            key: `COMPONENT:${item.key}`,
            kind: "COMPONENT",
            levelNumber: batch.componentLevelNumber,
            sortOrder: (batch.componentSortOrderStart ?? 1) + index,
            prerequisiteKeys: [],
          }),
        ),
        ...batch.kanji.map(
          (item): Target => ({
            key: `KANJI:${item.character}`,
            kind: "KANJI",
            levelNumber: item.levelNumber,
            sortOrder: item.sortOrder,
            prerequisiteKeys: item.componentKeys.map((key) => `COMPONENT:${key}`),
          }),
        ),
      ],
    })),
    ...wordBatches.map((batch) => ({
      kind: "word" as const,
      batch,
      checksumSha256: mainCourseWordBatchChecksum(batch),
      targets: batch.words.map(
        (item): Target => ({
          key: `WORD:${item.expression}:${item.reading}`,
          kind: "WORD",
          levelNumber: batch.levelNumber,
          sortOrder: item.sortOrder,
          prerequisiteKeys: wordHanCharacters(item.expression + item.example.japaneseText).map(
            (character) => `KANJI:${character}`,
          ),
        }),
      ),
    })),
  ].sort((a, b) => compare(a.batch.id, b.batch.id) || compare(a.kind, b.kind));
  const batchIds = new Set<string>();
  const placements = new Map<string, string>();
  const targetsByKey = new Map(
    entries.flatMap((entry) =>
      entry.targets.map((target) => [target.key, { entry, target }] as const),
    ),
  );
  for (const { batch, targets } of entries) {
    if (batch.id.trim() === "") issues.push("Source batch ID must not be empty.");
    if (batchIds.has(batch.id)) issues.push(`Duplicate source batch ID ${batch.id}.`);
    batchIds.add(batch.id);
    if (batch.courseSlug !== courseSlug)
      issues.push(`${batch.id}: unexpected source course ${batch.courseSlug}.`);
    if (batch.reviewedAt !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(batch.reviewedAt))
      issues.push(`${batch.id}: review date must be YYYY-MM-DD or null.`);
    for (const target of targets) {
      const slot = `${batch.courseSlug}:${target.levelNumber}:${target.sortOrder}`;
      const previous = placements.get(slot);
      if (previous !== undefined)
        issues.push(
          `Duplicate registry placement ${slot}: ${previous}, ${batch.id}/${target.key}.`,
        );
      placements.set(slot, `${batch.id}/${target.key}`);
    }
  }

  const batches = entries.map((entry) => {
    const { batch, targets } = entry;
    const required = new Set<string>();
    const externalBatchIds = new Set<string>();
    const closureIssues: string[] = [];
    function visit(target: Target): void {
      for (const key of target.prerequisiteKeys) {
        const prerequisite = targetsByKey.get(key);
        if (
          prerequisite === undefined ||
          prerequisite.entry.batch.courseSlug !== batch.courseSlug
        ) {
          closureIssues.push(`${batch.id}/${target.key}: missing same-course prerequisite ${key}.`);
        } else {
          if (prerequisite.target.levelNumber >= target.levelNumber)
            closureIssues.push(
              `${batch.id}/${target.key}: prerequisite ${key} must be on an earlier level.`,
            );
          if (prerequisite.entry.batch.id !== batch.id)
            externalBatchIds.add(prerequisite.entry.batch.id);
        }
        if (!required.has(key)) {
          required.add(key);
          if (prerequisite !== undefined) visit(prerequisite.target);
        }
      }
    }
    targets.forEach(visit);
    issues.push(...closureIssues);
    const sourceSeals = SOURCE_SEALS.map((seal) => {
      const expected = seal.sources.find((source) => source.id === batch.id);
      return {
        id: seal.id,
        status:
          expected === undefined
            ? "not-in-seal"
            : expected.kind === entry.kind &&
                expected.version === batch.version &&
                expected.checksumSha256 === entry.checksumSha256
              ? "included"
              : "mismatch",
      };
    });
    if (sourceSeals.some((seal) => seal.status === "mismatch"))
      issues.push(`${batch.id}: immutable V1/V2/V3 source seal mismatch.`);
    return {
      kind: entry.kind,
      id: batch.id,
      version: batch.version,
      sourceFile: batch.sourceFile,
      courseSlug: batch.courseSlug,
      checksumSha256: entry.checksumSha256,
      reviewStatus: batch.reviewedAt === null ? "pending-review" : "reviewed",
      reviewedAt: batch.reviewedAt,
      counts: distinctTotals(targets),
      levelSlots: levelSlots(targets),
      prerequisiteClosure: {
        closed: closureIssues.length === 0,
        requiredTargetCount: required.size,
        externalBatchIds: [...externalBatchIds].sort(compare),
        issues: uniqueSorted(closureIssues),
      },
      sourceSeals,
    };
  });
  const allTargets = entries.flatMap((entry) => entry.targets);
  const sourceSeals = SOURCE_SEALS.map((seal) => {
    const sources = seal.sources.map((source) => {
      const present = batches.find((batch) => batch.id === source.id);
      return {
        ...source,
        status:
          present === undefined
            ? "missing"
            : present.sourceSeals.find((membership) => membership.id === seal.id)!.status,
      };
    });
    const includedIds = new Set(
      sources.filter((source) => source.status === "included").map((source) => source.id),
    );
    const includedTargets = entries
      .filter((entry) => includedIds.has(entry.batch.id))
      .flatMap((entry) => entry.targets);
    const includedKeys = new Set(includedTargets.map((target) => target.key));
    return {
      id: seal.id,
      version: seal.version,
      slug: `japanese-foundation-pilot-${seal.id}`,
      status: sources.some((source) => source.status === "mismatch")
        ? "mismatch"
        : sources.some((source) => source.status === "missing")
          ? "incomplete"
          : "complete",
      sealedDistinctTotals: { ...seal.sealedDistinctTotals },
      includedPreparedDistinctTotals: distinctTotals(includedTargets),
      preparedOutsideSealDistinctTotals: distinctTotals(
        allTargets.filter((target) => !includedKeys.has(target.key)),
      ),
      sources,
    };
  });
  const sortedIssues = uniqueSorted(issues);
  const manifest = {
    manifestVersion: EDITORIAL_REGISTRY_INVENTORY_VERSION,
    scope: "source-only",
    countSemantics:
      "Prepared source targets and finite source-seal inclusion only; not live, applied or published counts.",
    validation: { valid: sortedIssues.length === 0, issues: sortedIssues },
    prepared: {
      batchCounts: { kanji: kanjiBatches.length, word: wordBatches.length },
      distinctTotals: distinctTotals(allTargets),
      reviewedDistinctTotals: distinctTotals(
        entries
          .filter((entry) => entry.batch.reviewedAt !== null)
          .flatMap((entry) => entry.targets),
      ),
      pendingReviewDistinctTotals: distinctTotals(
        entries
          .filter((entry) => entry.batch.reviewedAt === null)
          .flatMap((entry) => entry.targets),
      ),
    },
    batches,
    sourceSeals,
  };
  return { ...manifest, manifestChecksumSha256: hash(canonical(manifest)) };
}

export type EditorialRegistryInventory = ReturnType<typeof buildEditorialRegistryInventory>;

function distinctTotals(targets: readonly Target[]) {
  const count = (kind: TargetKind) =>
    new Set(targets.filter((target) => target.kind === kind).map((target) => target.key)).size;
  const components = count("COMPONENT");
  const kanji = count("KANJI");
  const words = count("WORD");
  return { components, kanji, words, items: components + kanji + words };
}

function levelSlots(targets: readonly Target[]) {
  const slots = new Map<string, { kind: TargetKind; levelNumber: number; sortOrders: number[] }>();
  for (const target of targets) {
    const key = `${target.levelNumber}:${target.kind}`;
    const group = slots.get(key) ?? {
      kind: target.kind,
      levelNumber: target.levelNumber,
      sortOrders: [],
    };
    group.sortOrders.push(target.sortOrder);
    slots.set(key, group);
  }
  return [...slots.values()]
    .map((group) => ({ ...group, sortOrders: group.sortOrders.sort((a, b) => a - b) }))
    .sort((a, b) => a.levelNumber - b.levelNumber || compare(a.kind, b.kind));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compare);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => compare(a, b)))
      : entry,
  );
}
