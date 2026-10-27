import {
  SUPPORTED_COURSE_BANDS,
  getContentLocalesForDisplayMode,
  type CharacterHubKanjiItemDto,
  type CharacterHubKanjiStudyState,
  type CourseBand,
  type KanaVariant,
  type TranslationDisplayMode,
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
export const CHARACTER_CATALOGUE_SORTS = {
  course: "Порядок курса",
  reading: "По чтению",
  meaning: "По значению",
  weakness: "Сначала слабые",
} as const;
export type CharacterCatalogueSort = keyof typeof CHARACTER_CATALOGUE_SORTS;
export type CharacterCatalogueOptions = {
  readonly page: number;
  readonly q: string;
  readonly sort: CharacterCatalogueSort;
  readonly view: "grid" | "list";
  readonly showReadings: boolean;
};
export const DEFAULT_CHARACTER_CATALOGUE: CharacterCatalogueOptions = {
  page: 1,
  q: "",
  sort: "course",
  view: "grid",
  showReadings: true,
};
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
    catalogue: {
      page:
        rawPage !== null && /^[1-9]\d{0,4}$/u.test(rawPage) && Number(rawPage) <= 10_000
          ? Number(rawPage)
          : 1,
      q: normalizeCourseSearch(params.get("q") ?? ""),
      sort: includes(
        Object.keys(CHARACTER_CATALOGUE_SORTS) as CharacterCatalogueSort[],
        params.get("sort"),
      )
        ? (params.get("sort") as CharacterCatalogueSort)
        : "course",
      view: params.get("view") === "list" ? "list" : "grid",
      showReadings: params.get("readings") !== "hidden",
    },
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
  if (catalogue.sort !== "course") params.set("sort", catalogue.sort);
  if (catalogue.view === "list") params.set("view", "list");
  if (!catalogue.showReadings) params.set("readings", "hidden");

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
      words.every((word) =>
        [
          item.character,
          item.reading,
          item.meaningRu,
          item.meaningEn,
          item.reading ? romanizeKana(item.reading) : null,
        ].some((text) => text !== null && normalize(text).includes(word)),
      ),
  );
}

export function characterMeaningRows(
  item: Pick<CharacterHubKanjiItemDto, "meaningRu" | "meaningEn">,
  mode: TranslationDisplayMode,
) {
  return getContentLocalesForDisplayMode(mode).map((locale) => ({
    lang: locale === "ru-RU" ? "ru" : "en",
    label: locale === "ru-RU" ? "RU" : "EN",
    text: (locale === "ru-RU" ? item.meaningRu : item.meaningEn)?.trim() || null,
  }));
}

export function sortCharacterHubKanji(
  items: readonly CharacterHubKanjiItemDto[],
  sort: CharacterCatalogueSort,
  mode: TranslationDisplayMode,
) {
  if (sort === "course") return items;
  const meaning = (item: CharacterHubKanjiItemDto) =>
    mode === "en"
      ? item.meaningEn
      : mode === "ru"
        ? item.meaningRu
        : item.meaningRu || item.meaningEn;
  const value = (item: CharacterHubKanjiItemDto) =>
    (sort === "reading" ? item.reading : meaning(item))?.trim() || null;
  const collator = new Intl.Collator(sort === "reading" ? "ja" : mode === "en" ? "en" : "ru", {
    numeric: true,
    sensitivity: "base",
  });
  return [...items].sort((left, right) => {
    let comparison: number;
    if (sort === "weakness") comparison = right.weaknessScore - left.weaknessScore;
    else {
      const a = value(left),
        b = value(right);
      comparison = a === null ? (b === null ? 0 : 1) : b === null ? -1 : collator.compare(a, b);
    }
    return comparison || left.level - right.level || left.id.localeCompare(right.id, "en");
  });
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string | null,
): value is T[number] {
  return value !== null && (values as readonly string[]).includes(value);
}
