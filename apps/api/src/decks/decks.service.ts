import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  type CreateTextDeckResponse,
  type DeckDetailsDto,
  type DeckDto,
  type DeckItemReasonDto,
  type DeckListResponse,
  type ItemSummary,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { DecksRepository } from "./decks.repository";
import {
  type ParsedCreateTextDeckRequest,
  type TextDeckItemRecord,
  type TextDeckListRecord,
  type TextDeckMatchRecord,
  type TextDeckPrerequisiteRecord,
  type TextDeckRecord,
} from "./decks.types";

const MAX_SOURCE_TEXT_LENGTH = 10_000;
const DEFAULT_MAX_ITEMS = 80;
const MAX_ALLOWED_ITEMS = 160;
const MAX_TOKEN_LENGTH = 8;
const HIGH_FREQUENCY_WORD_RANK = 5_000;
const HIGH_FREQUENCY_KANJI_RANK = 1_000;

@Injectable()
export class DecksService {
  constructor(@Inject(DecksRepository) private readonly decksRepository: DecksRepository) {}

  async createFromText(user: CurrentUserDto, body: unknown): Promise<CreateTextDeckResponse> {
    const request = parseCreateTextDeckRequest(body);
    const tokens = extractTextCandidates(request.text);

    if (tokens.wordCandidates.length === 0 && tokens.kanjiCharacters.length === 0) {
      throw new BadRequestException("Text must include Japanese kana or kanji.");
    }

    const textMatches = await this.decksRepository.findTextMatches({
      ...tokens,
      sourceText: request.text,
    });
    const selectedMatches = selectBestTextMatches(textMatches, request.maxItems);
    const itemPlans = new Map<string, DeckItemPlan>();

    for (const match of selectedMatches) {
      addMatchedItemPlan(itemPlans, match);
    }

    await this.addPrerequisitePlans(itemPlans, selectedMatches, request.maxItems);

    const sortedPlans = sortItemPlans([...itemPlans.values()]).slice(0, request.maxItems);
    const deck = await this.decksRepository.createTextDeck({
      ownerUserId: user.id,
      title: request.title,
      sourceText: request.text,
      items: sortedPlans.map((plan, index) => ({
        learningItemId: plan.item.id,
        sortOrder: index + 1,
        reasons: plan.reasons,
      })),
    });

    return {
      deck: toDeckDetailsDto(deck, getDisplayMode(user)),
      tokenization: {
        strategy: "substring-fallback",
        candidateCount: tokens.wordCandidates.length + tokens.kanjiCharacters.length,
        matchedItemCount: selectedMatches.length,
        unmatchedCandidateCount: Math.max(
          0,
          tokens.wordCandidates.length + tokens.kanjiCharacters.length - selectedMatches.length,
        ),
      },
    };
  }

  async listDecks(user: CurrentUserDto): Promise<DeckListResponse> {
    const decks = await this.decksRepository.listDecks(user.id);
    const displayMode = getDisplayMode(user);

    return {
      decks: decks.map((deck) => toDeckDto(deck, displayMode)),
    };
  }

  async getDeck(user: CurrentUserDto, deckId: string): Promise<DeckDetailsDto> {
    const deck = await this.decksRepository.findDeckForOwner(user.id, deckId);

    if (deck === null) {
      throw new NotFoundException("Deck not found.");
    }

    return toDeckDetailsDto(deck, getDisplayMode(user));
  }

  private async addPrerequisitePlans(
    itemPlans: Map<string, DeckItemPlan>,
    selectedMatches: readonly TextDeckMatchRecord[],
    maxItems: number,
  ): Promise<void> {
    let frontier = selectedMatches.map((match) => match.item.id);
    const visitedSources = new Set<string>();

    while (frontier.length > 0 && itemPlans.size < maxItems) {
      const sourceIds = frontier.filter((id) => !visitedSources.has(id));

      if (sourceIds.length === 0) {
        return;
      }

      for (const id of sourceIds) {
        visitedSources.add(id);
      }

      const prerequisites = await this.decksRepository.findPrerequisites(sourceIds);
      const nextFrontier: string[] = [];

      for (const prerequisite of prerequisites) {
        const added = addPrerequisitePlan(itemPlans, prerequisite);

        if (added) {
          nextFrontier.push(prerequisite.item.id);
        }
      }

      frontier = nextFrontier;
    }
  }
}

type ExtractedTextCandidates = {
  readonly wordCandidates: readonly string[];
  readonly kanjiCharacters: readonly string[];
};

type DeckItemPlan = {
  readonly item: TextDeckItemRecord;
  readonly reasons: DeckItemReasonDto[];
  sourceIndex: number;
  priority: number;
};

function parseCreateTextDeckRequest(body: unknown): ParsedCreateTextDeckRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  const record = body as {
    readonly text?: unknown;
    readonly title?: unknown;
    readonly maxItems?: unknown;
  };
  const text = typeof record.text === "string" ? record.text.trim() : "";

  if (text === "") {
    throw new BadRequestException("text must be a non-empty string.");
  }

  if (Array.from(text).length > MAX_SOURCE_TEXT_LENGTH) {
    throw new BadRequestException(`text must be ${MAX_SOURCE_TEXT_LENGTH} characters or fewer.`);
  }

  return {
    text,
    title: parseTitle(record.title),
    maxItems: parseMaxItems(record.maxItems),
  };
}

function parseTitle(value: unknown): string {
  if (value === undefined || value === null) {
    return `Text deck ${new Date().toISOString().slice(0, 10)}`;
  }

  if (typeof value !== "string") {
    throw new BadRequestException("title must be a string.");
  }

  const title = value.trim();

  if (title.length === 0) {
    return `Text deck ${new Date().toISOString().slice(0, 10)}`;
  }

  if (Array.from(title).length > 120) {
    throw new BadRequestException("title must be 120 characters or fewer.");
  }

  return title;
}

function parseMaxItems(value: unknown): number {
  if (value === undefined || value === null) {
    return DEFAULT_MAX_ITEMS;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_ALLOWED_ITEMS) {
    throw new BadRequestException(`maxItems must be an integer from 1 to ${MAX_ALLOWED_ITEMS}.`);
  }

  return parsed;
}

// MVP tokenizer fallback: split contiguous Japanese runs, emit exact substrings up to
// MAX_TOKEN_LENGTH, and match those substrings to existing Word.expression rows.
// It intentionally avoids external APIs and does not attempt morphological parsing.
function extractTextCandidates(text: string): ExtractedTextCandidates {
  const wordCandidates = new Set<string>();
  const kanjiCharacters = new Set<string>();
  let segment: string[] = [];

  function flushSegment(): void {
    if (segment.length === 0) {
      return;
    }

    for (let start = 0; start < segment.length; start += 1) {
      for (
        let length = 1;
        length <= MAX_TOKEN_LENGTH && start + length <= segment.length;
        length += 1
      ) {
        wordCandidates.add(segment.slice(start, start + length).join(""));
      }
    }

    segment = [];
  }

  for (const char of Array.from(text)) {
    if (isJapaneseTextChar(char)) {
      segment.push(char);

      if (isKanjiChar(char)) {
        kanjiCharacters.add(char);
      }
    } else {
      flushSegment();
    }
  }

  flushSegment();

  return {
    wordCandidates: [...wordCandidates],
    kanjiCharacters: [...kanjiCharacters],
  };
}

function selectBestTextMatches(
  matches: readonly TextDeckMatchRecord[],
  maxItems: number,
): readonly TextDeckMatchRecord[] {
  const bestByItem = new Map<string, TextDeckMatchRecord>();

  for (const match of matches) {
    const existing = bestByItem.get(match.item.id);

    if (
      existing === undefined ||
      match.sourceIndex < existing.sourceIndex ||
      (match.sourceIndex === existing.sourceIndex &&
        match.matchedText.length > existing.matchedText.length)
    ) {
      bestByItem.set(match.item.id, match);
    }
  }

  return [...bestByItem.values()].sort(compareTextMatches).slice(0, maxItems);
}

function compareTextMatches(left: TextDeckMatchRecord, right: TextDeckMatchRecord): number {
  return (
    left.sourceIndex - right.sourceIndex ||
    itemTypePriority(left.item.itemType) - itemTypePriority(right.item.itemType) ||
    (left.frequencyRank ?? Number.MAX_SAFE_INTEGER) -
      (right.frequencyRank ?? Number.MAX_SAFE_INTEGER) ||
    left.item.target.japanese.localeCompare(right.item.target.japanese) ||
    left.item.id.localeCompare(right.item.id)
  );
}

function addMatchedItemPlan(
  itemPlans: Map<string, DeckItemPlan>,
  match: TextDeckMatchRecord,
): void {
  const plan = getOrCreatePlan(itemPlans, match.item, match.sourceIndex);

  plan.sourceIndex = Math.min(plan.sourceIndex, match.sourceIndex);
  plan.priority = Math.min(plan.priority, 0);
  addReason(plan, {
    code: "appears-in-text",
    detail: `Matched "${match.matchedText}" in pasted text.`,
    matchedText: match.matchedText,
  });

  if (isHighFrequency(match.item, match.frequencyRank)) {
    addReason(plan, {
      code: "high-frequency",
      detail: "High-frequency item from the text.",
      matchedText: match.matchedText,
      rank: match.frequencyRank,
    });
  }
}

function addPrerequisitePlan(
  itemPlans: Map<string, DeckItemPlan>,
  prerequisite: TextDeckPrerequisiteRecord,
): boolean {
  const existed = itemPlans.has(prerequisite.item.id);
  const plan = getOrCreatePlan(itemPlans, prerequisite.item, Number.MAX_SAFE_INTEGER);
  const reason = toPrerequisiteReason(prerequisite);

  if (reason === null) {
    return false;
  }

  plan.priority = Math.min(plan.priority, prerequisite.item.itemType === "kanji" ? 1 : 2);
  addReason(plan, reason);

  return !existed;
}

function toPrerequisiteReason(prerequisite: TextDeckPrerequisiteRecord): DeckItemReasonDto | null {
  if (prerequisite.item.itemType === "kanji") {
    return {
      code: "prerequisite-kanji",
      detail: "Prerequisite kanji for an item from the text.",
      sourceItemId: prerequisite.sourceItemId,
    };
  }

  if (prerequisite.item.itemType === "component") {
    return {
      code: "prerequisite-component",
      detail: "Prerequisite component for kanji in this deck.",
      sourceItemId: prerequisite.sourceItemId,
    };
  }

  return null;
}

function getOrCreatePlan(
  itemPlans: Map<string, DeckItemPlan>,
  item: TextDeckItemRecord,
  sourceIndex: number,
): DeckItemPlan {
  const existing = itemPlans.get(item.id);

  if (existing !== undefined) {
    return existing;
  }

  const plan = {
    item,
    reasons: [],
    sourceIndex,
    priority: Number.MAX_SAFE_INTEGER,
  };

  itemPlans.set(item.id, plan);

  return plan;
}

function addReason(plan: DeckItemPlan, reason: DeckItemReasonDto): void {
  const key = `${reason.code}:${reason.matchedText ?? ""}:${reason.sourceItemId ?? ""}`;
  const exists = plan.reasons.some(
    (candidate) =>
      `${candidate.code}:${candidate.matchedText ?? ""}:${candidate.sourceItemId ?? ""}` === key,
  );

  if (!exists) {
    plan.reasons.push(reason);
  }
}

function sortItemPlans(plans: readonly DeckItemPlan[]): readonly DeckItemPlan[] {
  return [...plans].sort(
    (left, right) =>
      left.sourceIndex - right.sourceIndex ||
      left.priority - right.priority ||
      itemTypePriority(left.item.itemType) - itemTypePriority(right.item.itemType) ||
      (left.item.target.frequencyRank ?? Number.MAX_SAFE_INTEGER) -
        (right.item.target.frequencyRank ?? Number.MAX_SAFE_INTEGER) ||
      left.item.target.japanese.localeCompare(right.item.target.japanese) ||
      left.item.id.localeCompare(right.item.id),
  );
}

function isHighFrequency(item: TextDeckItemRecord, rank: number | null): boolean {
  if (rank === null) {
    return false;
  }

  return item.itemType === "word"
    ? rank <= HIGH_FREQUENCY_WORD_RANK
    : item.itemType === "kanji" && rank <= HIGH_FREQUENCY_KANJI_RANK;
}

function toDeckDetailsDto(
  deck: TextDeckRecord,
  displayMode: TranslationDisplayMode,
): DeckDetailsDto {
  return {
    ...toDeckDto(deck, displayMode),
    items: deck.items.map((item) => ({
      item: toItemSummary(item.item, displayMode),
      sortOrder: item.sortOrder,
      reasons: item.reasons,
      isNewForUser: item.isNewForUser,
    })),
  };
}

function toDeckDto(
  deck: TextDeckRecord | TextDeckListRecord,
  displayMode: TranslationDisplayMode,
): DeckDto {
  return {
    id: deck.id,
    title: deck.title,
    description: "Dynamic text deck",
    status: deck.status,
    itemCount: deck.itemCount,
    newItemCount: deck.newItemCount,
    translationDisplayMode: displayMode,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  };
}

function toItemSummary(item: TextDeckItemRecord, displayMode: TranslationDisplayMode): ItemSummary {
  return {
    id: item.id,
    itemType: item.itemType,
    slug: `${item.itemType}:${item.target.japanese}`,
    japanese: item.target.japanese,
    reading: item.target.reading,
    translations: toTranslationBundle(item.target.translations, displayMode),
    level: item.level,
    jlptLevel: item.target.jlptLevel,
    srs: null,
  };
}

function toTranslationBundle(
  translations: TextDeckItemRecord["target"]["translations"],
  displayMode: TranslationDisplayMode,
): TranslationBundleDto {
  return {
    ...translations,
    displayMode,
    primaryRu:
      translations.ru.find((text) => text.isPrimary)?.text ?? translations.ru[0]?.text ?? null,
    primaryEn:
      translations.en.find((text) => text.isPrimary)?.text ?? translations.en[0]?.text ?? null,
  };
}

function getDisplayMode(user: CurrentUserDto): TranslationDisplayMode {
  return user.settings.translationDisplayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE;
}

function itemTypePriority(itemType: TextDeckItemRecord["itemType"]): number {
  switch (itemType) {
    case "word":
      return 0;
    case "kanji":
      return 1;
    case "component":
      return 2;
    case "sentence":
      return 3;
  }
}

function isJapaneseTextChar(char: string): boolean {
  return (
    /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(char) ||
    char === "々" ||
    char === "〆" ||
    char === "ー" ||
    char === "ヵ" ||
    char === "ヶ"
  );
}

function isKanjiChar(char: string): boolean {
  return /[\p{Script=Han}]/u.test(char) || char === "々" || char === "〆";
}
