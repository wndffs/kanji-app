import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  type BilingualTextDto,
  type ItemDetails,
  type ItemRelationDto,
  type ItemSummary,
  type LearningCardDto,
  type SearchResponseDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
  type UserOverrideDto,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { ItemsRepository } from "./items.repository";
import {
  type ItemCardRecord,
  type ItemRecord,
  type ItemTextRecord,
  type ParsedSearchQuery,
  type SearchParams,
} from "./items.types";

const DEFAULT_SEARCH_PAGE = 1;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

@Injectable()
export class ItemsService {
  constructor(@Inject(ItemsRepository) private readonly itemsRepository: ItemsRepository) {}

  async getItemDetails(id: string, currentUser: CurrentUserDto | null): Promise<ItemDetails> {
    const item = await this.itemsRepository.findItemById(id, {
      userId: currentUser?.id,
    });

    if (item === null) {
      throw new NotFoundException("Item not found.");
    }

    return toItemDetails(item, getDisplayMode(currentUser));
  }

  async getKanjiDetails(
    character: string,
    currentUser: CurrentUserDto | null,
  ): Promise<ItemDetails> {
    const normalizedCharacter = character.trim();

    if (normalizedCharacter.length === 0) {
      throw new BadRequestException("Kanji character is required.");
    }

    const item = await this.itemsRepository.findKanjiItemByCharacter(normalizedCharacter, {
      userId: currentUser?.id,
    });

    if (item === null) {
      throw new NotFoundException("Kanji not found.");
    }

    return toItemDetails(item, getDisplayMode(currentUser));
  }

  async search(
    rawQuery: ParsedSearchQuery,
    currentUser: CurrentUserDto | null,
  ): Promise<SearchResponseDto> {
    const params = parseSearchParams(rawQuery);
    const displayMode = getDisplayMode(currentUser);
    const records = await this.itemsRepository.searchItems(params.query, {
      userId: currentUser?.id,
    });
    const offset = (params.page - 1) * params.limit;
    const paginatedRecords = records.slice(offset, offset + params.limit);

    return {
      query: params.query,
      items: paginatedRecords.map((item) => toItemSummary(item, displayMode)),
      pagination: {
        page: params.page,
        limit: params.limit,
        total: records.length,
        hasNextPage: offset + params.limit < records.length,
      },
    };
  }
}

function parseSearchParams(rawQuery: ParsedSearchQuery): SearchParams {
  const query = getSingleQueryValue(rawQuery.q)?.trim();

  if (query === undefined || query.length === 0) {
    throw new BadRequestException("Search query q is required.");
  }

  return {
    query,
    page: parsePositiveInteger(getSingleQueryValue(rawQuery.page), DEFAULT_SEARCH_PAGE, "page"),
    limit: parsePositiveInteger(
      getSingleQueryValue(rawQuery.limit),
      DEFAULT_SEARCH_LIMIT,
      "limit",
      MAX_SEARCH_LIMIT,
    ),
  };
}

function getSingleQueryValue(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === "string" || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  max?: number,
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) {
    const range = max === undefined ? "a positive integer" : `an integer between 1 and ${max}`;
    throw new BadRequestException(`${name} must be ${range}.`);
  }

  return parsed;
}

function toItemDetails(item: ItemRecord, displayMode: TranslationDisplayMode): ItemDetails {
  return {
    ...toItemSummary(item, displayMode),
    cards: item.cards.map((card) => toLearningCard(item, card, displayMode)),
    relations: item.relations.map((relation): ItemRelationDto => {
      return {
        relationType: relation.relationType,
        item: toItemSummary(relation.item, displayMode),
      };
    }),
    mnemonics: groupTextsByLocale(item.mnemonics),
    hints: groupTextsByLocale(item.hints),
    exampleSentences: [],
    attributions: item.attributions,
    userOverrides: item.userOverrides.map(toUserOverrideDto),
  };
}

function toItemSummary(item: ItemRecord, displayMode: TranslationDisplayMode): ItemSummary {
  return {
    id: item.id,
    itemType: item.itemType,
    slug: buildItemSlug(item),
    japanese: item.target.japanese,
    reading: item.target.reading,
    translations: toTranslationBundle(item.target.translations, displayMode),
    level: item.level,
    jlptLevel: item.target.jlptLevel,
    srs: null,
  };
}

function toLearningCard(
  item: ItemRecord,
  card: ItemCardRecord,
  displayMode: TranslationDisplayMode,
): LearningCardDto {
  return {
    id: card.id,
    learningItemId: item.id,
    itemType: item.itemType,
    cardType: card.cardType,
    promptType: card.promptType,
    answerType: card.answerType,
    translationDisplayMode: displayMode,
    prompt: {
      japanese: item.target.japanese,
      reading: item.target.reading,
    },
    translations: toTranslationBundle(item.target.translations, displayMode),
    acceptedAnswers: card.answers.map((answer) => ({
      locale: answer.locale,
      text: answer.text,
      isPrimary: answer.isPrimary,
      sourceKind: answer.sourceKind,
    })),
    blockedAnswers: card.blockedAnswers.map((answer) => ({
      locale: answer.locale,
      text: answer.text,
      sourceKind: answer.sourceKind,
    })),
    sortOrder: card.sortOrder,
  };
}

function toUserOverrideDto(override: ItemRecord["userOverrides"][number]): UserOverrideDto {
  return {
    id: override.id,
    learningCardId: override.learningCardId,
    kind: toUserOverrideKind(override.overrideType),
    locale: override.locale,
    text: override.text,
    normalizedText: override.normalizedText,
    note: override.note,
    createdAt: override.createdAt.toISOString(),
    updatedAt: override.updatedAt.toISOString(),
  };
}

function toUserOverrideKind(overrideType: ItemRecord["userOverrides"][number]["overrideType"]) {
  switch (overrideType) {
    case "blocked-personal":
      return "blocked-answer";
    case "note":
      return "note";
    default:
      return "accepted-answer";
  }
}

function toTranslationBundle(
  translations: BilingualTextDto,
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

function groupTextsByLocale(texts: readonly ItemTextRecord[]): BilingualTextDto {
  return {
    ru: texts
      .filter((text) => text.locale === "ru-RU")
      .map((text) => ({
        locale: text.locale,
        text: text.text,
        sourceKind: text.sourceKind,
      })),
    en: texts
      .filter((text) => text.locale === "en-US")
      .map((text) => ({
        locale: text.locale,
        text: text.text,
        sourceKind: text.sourceKind,
      })),
  };
}

function buildItemSlug(item: ItemRecord): string {
  return `${item.itemType}:${item.target.japanese}`;
}

function getDisplayMode(currentUser: CurrentUserDto | null): TranslationDisplayMode {
  return currentUser?.settings.translationDisplayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE;
}
