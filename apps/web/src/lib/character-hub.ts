import {
  SUPPORTED_COURSE_BANDS,
  type CharacterHubKanjiItemDto,
  type CharacterHubKanjiStudyState,
  type CourseBand,
  type KanaVariant,
} from "@kanji-srs/shared";
import { normalizeKana, normalizeRussianMeaning, romanizeKana } from "@kanji-srs/japanese";
import { normalizeCourseSearch } from "./course-browser-route";
export { normalizeCourseSearch as normalizeCharacterSearch } from "./course-browser-route";
import {
  KANA_GROUP_LABELS,
  KANA_UNIT_STATUS_LABELS,
  type KanaUnitStatus,
} from "./kana-unit-groups";

export type CharacterHubTab = "hiragana" | "katakana" | "kanji";
export type CharacterHubJlptLevel = NonNullable<CharacterHubKanjiItemDto["jlptLevel"]>;
export type CharacterHubStateFilter = CharacterHubKanjiStudyState | "weak";
export type CharacterCatalogueOptions = { readonly page: number; readonly q: string };
export const DEFAULT_CHARACTER_CATALOGUE: CharacterCatalogueOptions = { page: 1, q: "" };
export const CHARACTER_CATALOGUE_PAGE_SIZE = 60;

export type CharacterHubKanjiFilters = {
  readonly level: number | null;
  readonly band: CourseBand | null;
  readonly jlpt: CharacterHubJlptLevel | null;
  readonly state: CharacterHubStateFilter | null;
};

export type CharacterHubQuery = {
  readonly tab: CharacterHubTab;
  readonly filters: CharacterHubKanjiFilters;
  readonly kanaGroup: KanaVariant | "all";
  readonly kanaStatus: KanaUnitStatus;
  readonly catalogue: CharacterCatalogueOptions;
};

export const EMPTY_CHARACTER_HUB_FILTERS: CharacterHubKanjiFilters = {
  level: null,
  band: null,
  jlpt: null,
  state: null,
};

const TABS = ["hiragana", "katakana", "kanji"] as const;
const JLPT_LEVELS = ["n5", "n4", "n3", "n2", "n1"] as const;
const STATE_FILTERS = ["not-started", "learning", "passed", "burned", "weak"] as const;

export function parseCharacterHubQuery(params: Pick<URLSearchParams, "get">): CharacterHubQuery {
  const rawTab = params.get("tab");
  const rawLevel = params.get("level");
  const rawBand = params.get("band");
  const rawJlpt = params.get("jlpt");
  const rawState = params.get("state");
  const rawGroup = params.get("group");
  const rawKanaStatus = params.get("kanaState");
  const parsedLevel = rawLevel === null ? Number.NaN : Number(rawLevel);
  const rawPage = params.get("page");

  return {
    tab: includes(TABS, rawTab) ? rawTab : "hiragana",
    catalogue: { page: rawPage !== null && /^[1-9]\d{0,4}$/u.test(rawPage) && Number(rawPage) <= 10_000 ? Number(rawPage) : 1, q: normalizeCourseSearch(params.get("q") ?? "") },
    kanaGroup: includes(Object.keys(KANA_GROUP_LABELS) as (KanaVariant | "all")[], rawGroup)
      ? rawGroup
      : "basic",
    kanaStatus: includes(Object.keys(KANA_UNIT_STATUS_LABELS) as KanaUnitStatus[], rawKanaStatus)
      ? rawKanaStatus
      : "all",
    filters: {
      level: Number.isInteger(parsedLevel) && parsedLevel > 0 ? parsedLevel : null,
      band: includes(SUPPORTED_COURSE_BANDS, rawBand) ? rawBand : null,
      jlpt: includes(JLPT_LEVELS, rawJlpt) ? rawJlpt : null,
      state: includes(STATE_FILTERS, rawState) ? rawState : null,
    },
  };
}

export function buildCharacterHubHref(
  tab: CharacterHubTab,
  filters: CharacterHubKanjiFilters = EMPTY_CHARACTER_HUB_FILTERS,
  kanaGroup: KanaVariant | "all" = "basic",
  kanaStatus: KanaUnitStatus = "all",
  catalogue: CharacterCatalogueOptions = DEFAULT_CHARACTER_CATALOGUE,
): string {
  const params = new URLSearchParams({ tab });
  if (kanaGroup !== "basic") params.set("group", kanaGroup);
  if (kanaStatus !== "all") params.set("kanaState", kanaStatus);
  if (catalogue.page > 1) params.set("page", String(catalogue.page));
  if (catalogue.q) params.set("q", normalizeCourseSearch(catalogue.q));

  if (filters.level !== null) {
    params.set("level", String(filters.level));
  }

  if (filters.band !== null) {
    params.set("band", filters.band);
  }

  if (filters.jlpt !== null) {
    params.set("jlpt", filters.jlpt);
  }

  if (filters.state !== null) {
    params.set("state", filters.state);
  }

  return `/characters?${params.toString()}`;
}

export function filterCharacterHubKanji(
  items: readonly CharacterHubKanjiItemDto[],
  filters: CharacterHubKanjiFilters,
  query = "",
): readonly CharacterHubKanjiItemDto[] {
  const normalize = (text: string) => normalizeRussianMeaning(normalizeKana(text));
  const words = normalize(query).split(" ").filter(Boolean);
  return items.filter(
    (item) =>
      (filters.level === null || item.level === filters.level) &&
      (filters.band === null || item.band === filters.band) &&
      (filters.jlpt === null || item.jlptLevel === filters.jlpt) &&
      (filters.state === null ||
        (filters.state === "weak" ? item.weak : item.studyState === filters.state)) &&
      words.every((word) => [item.character, item.reading, item.meaningRu, item.meaningEn, item.reading ? romanizeKana(item.reading) : null]
        .some((text) => text !== null && normalize(text).includes(word))),
  );
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string | null,
): value is T[number] {
  return value !== null && (values as readonly string[]).includes(value);
}
