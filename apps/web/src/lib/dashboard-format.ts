import { type ReviewForecastBucketDto, type TranslationDisplayMode } from "@kanji-srs/shared";

export function formatTranslationDisplayMode(mode: TranslationDisplayMode): string {
  switch (mode) {
    case "ru":
      return "Русский";
    case "en":
      return "English";
    case "ru-en":
      return "Русский + English";
  }
}

export function formatAccuracy(value: number | null): string {
  return value === null ? "нет данных" : `${Math.round(value * 100)}%`;
}

export function formatForecastBucket(bucket: ReviewForecastBucketDto): string {
  const [year, month, day] = bucket.localDate.split("-");
  const date = `${day}.${month}.${year}`;

  if (bucket.localHour === null) {
    return date;
  }

  return `${date}, ${String(bucket.localHour).padStart(2, "0")}:00`;
}

export function formatCount(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;

  return `${value} ${word}`;
}
