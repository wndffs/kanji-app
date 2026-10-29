import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { extractJapaneseTextCandidates, JapaneseTextBudgetError, originalTextSpan } from "@kanji-srs/japanese";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  buildLearningTranslationBundle as toTranslationBundle,
  type CreateTextDeckResponse,
  type DeckDetailsDto,
  type DeckDto,
  type DeckItemReasonDto,
  type DeckListResponse,
  type ItemSummary,
  type TranslationDisplayMode,
  type TextDeckPreviewResponse,
  type UpdateDeckStatusRequest,
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
const HIGH_FREQUENCY_WORD_RANK = 5_000;
const HIGH_FREQUENCY_KANJI_RANK = 1_000;

@Injectable()
export class DecksService {
  constructor(@Inject(DecksRepository) private readonly decksRepository: DecksRepository) {}

  async createFromText(user: CurrentUserDto, body: unknown): Promise<CreateTextDeckResponse> {
    const request = parseCreateTextDeckRequest(body);
    const prepared = await this.prepareText(request);
    const deck = await this.decksRepository.createTextDeck({
      ownerUserId: user.id,
      title: request.title,
      sourceText: request.text,
      items: prepared.plans.map((plan, index) => ({
        learningItemId: plan.item.id, sortOrder: index + 1, reasons: plan.reasons,
      })),
    });
    return { deck: toDeckDetailsDto(deck, getDisplayMode(user)), tokenization: prepared.tokenization };
  }

  async previewFromText(user: CurrentUserDto, body: unknown): Promise<TextDeckPreviewResponse> {
    const prepared = await this.prepareText(parseCreateTextDeckRequest(body));
    return {
      candidates: prepared.candidates.map((match) => ({
        item: toItemSummary(match.item, getDisplayMode(user)), matchedText: match.matchedText,
        span: originalTextSpan(prepared.tokens, match.sourceIndex, match.matchedText.length),
      })),
      selectedItemIds: prepared.selectedIds,
      plannedItemCount: prepared.plans.length,
      externalPrerequisiteCount: prepared.tokenization.externalPrerequisiteCount,
      tokenization: prepared.tokenization,
    };
  }

  private async prepareText(request: ParsedCreateTextDeckRequest) {
    const tokens = analyzeText(request.text);

    if (tokens.wordCandidates.length === 0 && tokens.kanjiCharacters.length === 0) {
      throw new BadRequestException("Text must include Japanese kana or kanji.");
    }

    const textMatches = await this.decksRepository.findTextMatches({
      ...tokens,
      sourceText: tokens.normalizedText,
    });
    const matchSelection = selectBestTextMatches(textMatches, tokens.normalizedText, request.maxItems);
    const candidates = [...new Map(textMatches.map((match) => [match.item.id, match])).values()];
    if (candidates.length > 320) throw new BadRequestException("Too many matching materials; shorten the text.");
    const selectedIds = request.selectedItemIds;
    if (selectedIds !== undefined && selectedIds.some((id) => !candidates.some((match) => match.item.id === id))) {
      throw new BadRequestException("Selected materials must be published matches of this text.");
    }
    if (selectedIds !== undefined && selectedIds.length > request.maxItems) {
      throw new BadRequestException("Selected materials exceed maxItems.");
    }
    const selectedMatches = selectedIds === undefined ? matchSelection.matches : candidates.filter((match) => selectedIds.includes(match.item.id));
    const itemPlans = new Map<string, DeckItemPlan>();

    for (const match of selectedMatches) {
      addMatchedItemPlan(itemPlans, match);
    }

    await this.addPrerequisitePlans(itemPlans, selectedMatches);

    const sortedPlans = sortItemPlans([...itemPlans.values()]).slice(0, request.maxItems);
    return {
      plans: sortedPlans, candidates, tokens, selectedIds: selectedMatches.map((match) => match.item.id),
      tokenization: {
        strategy: "dictionary-longest-match" as const,
        analyzer:tokens.analyzer,
        candidateCount: tokens.wordCandidates.length + tokens.kanjiCharacters.length,
        matchedItemCount: selectedMatches.length,
        discardedOverlapCount: matchSelection.discardedOverlapCount,
        externalPrerequisiteCount: itemPlans.size - sortedPlans.length,
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

  async updateStatus(user: CurrentUserDto, deckId: string, body: unknown): Promise<DeckDetailsDto> {
    const request = parseUpdateDeckStatusRequest(body);
    const deck = await this.decksRepository.updateDeckStatus(user.id, deckId, request.status);

    if (deck === null) {
      throw new NotFoundException("Deck not found.");
    }

    return toDeckDetailsDto(deck, getDisplayMode(user));
  }

  private async addPrerequisitePlans(
    itemPlans: Map<string, DeckItemPlan>,
    selectedMatches: readonly TextDeckMatchRecord[],
  ): Promise<void> {
    let frontier = selectedMatches.map((match) => match.item.id);
    const visitedSources = new Set<string>();

    let depth = 0;
    while (frontier.length > 0) {
      if (++depth > 16 || itemPlans.size > 512) throw new BadRequestException("Prerequisite budget exceeded.");
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

type DeckItemPlan = {
  readonly item: TextDeckItemRecord;
  readonly reasons: DeckItemReasonDto[];
  sourceIndex: number;
  priority: number;
};

type TextMatchSelection = {
  readonly matches: readonly TextDeckMatchRecord[];
  readonly discardedOverlapCount: number;
};

function parseCreateTextDeckRequest(body: unknown): ParsedCreateTextDeckRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  const record = body as {
    readonly text?: unknown;
    readonly title?: unknown;
    readonly maxItems?: unknown;
    readonly selectedItemIds?: unknown;
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
    ...(record.selectedItemIds === undefined ? {} : { selectedItemIds: parseItemIds(record.selectedItemIds) }),
  };
}

export function parseItemIds(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 160 || value.some((id) => typeof id !== "string" || id.length === 0 || id.length > 128) || new Set(value).size !== value.length) {
    throw new BadRequestException("itemIds must contain at most 160 unique material IDs.");
  }
  return value as string[];
}

function parseUpdateDeckStatusRequest(body: unknown): UpdateDeckStatusRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  const status = (body as Record<string, unknown>).status;

  if (status !== "active" && status !== "archived") {
    throw new BadRequestException("status must be active or archived.");
  }

  return { status };
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

function analyzeText(text:string) {
  try{return extractJapaneseTextCandidates(text);}
  catch(error){if(error instanceof JapaneseTextBudgetError)throw new BadRequestException(error.message);throw error;}
}

function selectBestTextMatches(
  matches: readonly TextDeckMatchRecord[],
  sourceText: string,
  maxItems: number,
): TextMatchSelection {
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

  const uniqueMatches = [...bestByItem.values()];
  const wordMatches = uniqueMatches.filter((match) => match.item.itemType === "word");
  const selectedWords = selectLongestNonOverlappingWords(wordMatches, sourceText);
  const nonWordMatches = uniqueMatches.filter((match) => match.item.itemType !== "word");

  return {
    matches: [...selectedWords, ...nonWordMatches].sort(compareTextMatches).slice(0, maxItems),
    discardedOverlapCount: wordMatches.length - selectedWords.length,
  };
}

function selectLongestNonOverlappingWords(
  matches: readonly TextDeckMatchRecord[],
  sourceText: string,
): readonly TextDeckMatchRecord[] {
  const candidates = matches.flatMap((match) =>
    findTextOccurrences(sourceText, match.matchedText).map((sourceIndex) => ({
      ...match,
      sourceIndex,
    })),
  );
  candidates.sort(
    (left, right) =>
      left.sourceIndex - right.sourceIndex ||
      right.matchedText.length - left.matchedText.length ||
      (left.frequencyRank ?? Number.MAX_SAFE_INTEGER) -
        (right.frequencyRank ?? Number.MAX_SAFE_INTEGER) ||
      left.item.id.localeCompare(right.item.id),
  );
  const selected: TextDeckMatchRecord[] = [];
  const selectedItemIds = new Set<string>();
  let occupiedUntil = -1;

  for (const candidate of candidates) {
    if (candidate.sourceIndex < occupiedUntil) {
      continue;
    }

    occupiedUntil = candidate.sourceIndex + candidate.matchedText.length;

    if (!selectedItemIds.has(candidate.item.id)) {
      selected.push(candidate);
      selectedItemIds.add(candidate.item.id);
    }
  }

  return selected;
}

function findTextOccurrences(sourceText: string, matchedText: string): readonly number[] {
  const occurrences: number[] = [];
  let searchFrom = 0;

  while (searchFrom < sourceText.length) {
    const sourceIndex = sourceText.indexOf(matchedText, searchFrom);

    if (sourceIndex === -1) {
      break;
    }

    occurrences.push(sourceIndex);
    searchFrom = sourceIndex + 1;
  }

  return occurrences;
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

