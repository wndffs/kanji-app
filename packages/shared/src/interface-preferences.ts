export const INTERFACE_PREFERENCE_OPTIONS = {
  interfaceTheme: ["system", "light", "dark"],
  interfaceDensity: ["comfortable", "compact"],
  interfaceMotion: ["system", "reduced", "full"],
  studyTextSize: ["standard", "large", "extra-large"],
  studyInformationDensity: ["comfortable", "compact"],
} as const;

export type InterfacePreferences = {
  readonly [Key in keyof typeof INTERFACE_PREFERENCE_OPTIONS]: (typeof INTERFACE_PREFERENCE_OPTIONS)[Key][number];
};

export const DEFAULT_INTERFACE_PREFERENCES: InterfacePreferences = {
  interfaceTheme: "system",
  interfaceDensity: "comfortable",
  interfaceMotion: "system",
  studyTextSize: "standard",
  studyInformationDensity: "comfortable",
};

export function normalizeInterfacePreferences(input: unknown): InterfacePreferences {
  const record =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    interfaceTheme: normalizeOption(
      record.interfaceTheme,
      INTERFACE_PREFERENCE_OPTIONS.interfaceTheme,
      DEFAULT_INTERFACE_PREFERENCES.interfaceTheme,
    ),
    interfaceDensity: normalizeOption(
      record.interfaceDensity,
      INTERFACE_PREFERENCE_OPTIONS.interfaceDensity,
      DEFAULT_INTERFACE_PREFERENCES.interfaceDensity,
    ),
    interfaceMotion: normalizeOption(
      record.interfaceMotion,
      INTERFACE_PREFERENCE_OPTIONS.interfaceMotion,
      DEFAULT_INTERFACE_PREFERENCES.interfaceMotion,
    ),
    studyTextSize: normalizeOption(
      record.studyTextSize,
      INTERFACE_PREFERENCE_OPTIONS.studyTextSize,
      DEFAULT_INTERFACE_PREFERENCES.studyTextSize,
    ),
    studyInformationDensity: normalizeOption(
      record.studyInformationDensity,
      INTERFACE_PREFERENCE_OPTIONS.studyInformationDensity,
      DEFAULT_INTERFACE_PREFERENCES.studyInformationDensity,
    ),
  };
}

function normalizeOption<Value extends string>(
  input: unknown,
  options: readonly Value[],
  fallback: Value,
): Value {
  return options.find((option) => option === input) ?? fallback;
}
