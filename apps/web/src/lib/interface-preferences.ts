import {
  DEFAULT_INTERFACE_PREFERENCES,
  INTERFACE_PREFERENCE_OPTIONS,
  normalizeInterfacePreferences,
  type InterfacePreferences,
} from "@kanji-srs/shared";

export const INTERFACE_PREFERENCES_KEY = "kanji-srs.interface-preferences";

export function readInterfacePreferences(): InterfacePreferences {
  try {
    const user = JSON.parse(window.localStorage.getItem("kanji-srs.user") ?? "null");
    return normalizeInterfacePreferences(
      user?.settings ??
        JSON.parse(window.localStorage.getItem(INTERFACE_PREFERENCES_KEY) ?? "null"),
    );
  } catch {
    return DEFAULT_INTERFACE_PREFERENCES;
  }
}

export function applyInterfacePreferences(input: unknown): void {
  const preferences = normalizeInterfacePreferences(input);
  for (const [key, value] of Object.entries(preferences)) {
    document.documentElement.dataset[key] = value;
  }
}

export function storeInterfacePreferences(input: unknown): void {
  const preferences = normalizeInterfacePreferences(input);
  try {
    window.localStorage.setItem(INTERFACE_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Presentation remains usable when browser storage is unavailable.
  }
  applyInterfacePreferences(preferences);
}

// Only validated enum values reach the DOM; no user-provided text is injected into this script.
export const INTERFACE_PREFERENCES_BOOTSTRAP = `(() => {
  const defaults = ${JSON.stringify(DEFAULT_INTERFACE_PREFERENCES)};
  const options = ${JSON.stringify(INTERFACE_PREFERENCE_OPTIONS)};
  let saved;
  try {
    const user = JSON.parse(localStorage.getItem("kanji-srs.user") || "null");
    saved = user?.settings || JSON.parse(localStorage.getItem(${JSON.stringify(INTERFACE_PREFERENCES_KEY)}) || "null");
  } catch {}
  for (const key of Object.keys(defaults)) {
    const value = saved?.[key];
    document.documentElement.dataset[key] = options[key].includes(value) ? value : defaults[key];
  }
})();`;
