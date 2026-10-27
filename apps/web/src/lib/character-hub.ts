import {
  SUPPORTED_COURSE_BANDS,
  type CharacterHubKanjiItemDto,
  type CharacterHubKanjiStudyState,
  type CourseBand,
  type KanaVariant,
} from "@kanji-srs/shared";
import {
  KANA_GROUP_LABELS,
  KANA_UNIT_STATUS_LABELS,
  type KanaUnitStatus,
} from "./kana-unit-groups";

export type CharacterHubTab = "hiragana" | "katakana" | "kanji";
export type CharacterHubJlptLevel = NonNullable<CharacterHubKanjiItemDto["jlptLevel"]>;
export type CharacterHubStateFilter = CharacterHubKanjiStudyState | "weak";

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

  return {
    tab: includes(TABS, rawTab) ? rawTab : "hiragana",
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
): string {
  const params = new URLSearchParams({ tab });
  if (kanaGroup !== "basic") params.set("group", kanaGroup);
  if (kanaStatus !== "all") params.set("kanaState", kanaStatus);

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
): readonly CharacterHubKanjiItemDto[] {
  return items.filter(
    (item) =>
      (filters.level === null || item.level === filters.level) &&
      (filters.band === null || item.band === filters.band) &&
      (filters.jlpt === null || item.jlptLevel === filters.jlpt) &&
      (filters.state === null ||
        (filters.state === "weak" ? item.weak : item.studyState === filters.state)),
  );
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string | null,
): value is T[number] {
  return value !== null && (values as readonly string[]).includes(value);
}
