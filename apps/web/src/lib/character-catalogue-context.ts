import { buildCharacterHubHref, parseCharacterHubQuery } from "./character-hub";

export function characterCatalogueReturnHref(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/characters?') || /[\\\u0000-\u001f]/u.test(value)) return null;
  try {
    const url = new URL(value, 'https://catalogue.invalid');
    if (url.origin !== 'https://catalogue.invalid' || url.pathname !== '/characters' || url.hash) return null;
    const route = parseCharacterHubQuery(url.searchParams);
    if (route.tab !== 'kanji') return null;
    return buildCharacterHubHref(route.tab, route.filters, route.kanaGroup, route.kanaStatus, route.catalogue);
  } catch { return null; }
}

export function characterCatalogueItemHref(character: string, catalogueHref: string) {
  const returnHref = characterCatalogueReturnHref(catalogueHref);
  const path = `/kanji/${encodeURIComponent(character)}`;
  return returnHref === null ? path : `${path}?${new URLSearchParams({ catalogue: returnHref })}`;
}
