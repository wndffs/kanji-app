import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "./main-course-content";
import { buildMainCourseWordBatches, wordHanCharacters } from "./main-course-word-content";
import { buildEditorialDraftPreview } from "./editorial-draft-preview";
import { nextEditorialWave, type EditorialWaveInput } from "./editorial-wave";

export function auditWavePlacement(input: EditorialWaveInput = nextEditorialWave()) {
  const base = buildMainCourseContentBatches();
  const batches = [...base, input.kanji];
  const preview = buildEditorialDraftPreview("ru-en", input.kanji, input.words);
  const issues = [...validateMainCourseContentBatches(batches), ...preview.validation.issues];
  const components = new Map(
    batches.flatMap((batch) =>
      batch.components.map((component) => [component.key, batch.componentLevelNumber] as const),
    ),
  );
  const kanji = new Map(
    batches.flatMap((batch) =>
      batch.kanji.map((item) => [item.character, item.levelNumber] as const),
    ),
  );
  const slots = new Set<string>();
  const addSlot = (level: number, order: number) => {
    const slot = `${level}:${order}`;
    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > 60 ||
      !Number.isInteger(order) ||
      order < 1 ||
      slots.has(slot)
    )
      issues.push("invalid-or-duplicate-placement");
    slots.add(slot);
  };
  for (const batch of base) {
    batch.components.forEach((_, index) =>
      addSlot(batch.componentLevelNumber, (batch.componentSortOrderStart ?? 1) + index),
    );
    batch.kanji.forEach((item) => addSlot(item.levelNumber, item.sortOrder));
  }
  for (const batch of buildMainCourseWordBatches())
    batch.words.forEach((item) => addSlot(batch.levelNumber, item.sortOrder));
  input.kanji.components.forEach((_, index) =>
    addSlot(input.kanji.componentLevelNumber, (input.kanji.componentSortOrderStart ?? 1) + index),
  );
  for (const item of input.kanji.kanji) {
    addSlot(item.levelNumber, item.sortOrder);
    for (const key of item.componentKeys) {
      const level = components.get(key);
      if (level === undefined || level >= item.levelNumber)
        issues.push("missing-earlier-component");
    }
  }
  for (const word of input.words.words) {
    addSlot(input.words.levelNumber, word.sortOrder);
    for (const character of wordHanCharacters(word.expression + word.example.japaneseText)) {
      const level = kanji.get(character);
      if (level === undefined || level >= input.words.levelNumber)
        issues.push("missing-earlier-kanji");
    }
  }
  const outsideCuratorRegistry =
    !base.some((batch) => batch.id === input.kanji.id) &&
    !buildMainCourseWordBatches().some((batch) => batch.id === input.words.id);
  return {
    valid: issues.length === 0 && outsideCuratorRegistry,
    placementIssueCount: issues.length,
    outsideCuratorRegistry,
    unresolvedWordSourceIds: input.words.words.filter((word) => word.jmdictEntryId === null).length,
    sourceEvidenceVerified: false as const,
    independentlyReviewed: false as const,
  };
}
