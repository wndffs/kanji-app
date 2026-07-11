import { type KanaLessonItemDto } from "@kanji-srs/shared";

export const KANJIVG_RELEASE = "r20250816";

export type TracePoint = {
  readonly x: number;
  readonly y: number;
};

export type TraceValidationOptions = {
  readonly endpointTolerance?: number;
  readonly pathTolerance?: number;
};

export function canTraceKana(character: string): boolean {
  const characters = Array.from(character.normalize("NFC"));

  if (characters.length !== 1) {
    return false;
  }

  const codepoint = characters[0]!.codePointAt(0)!;

  return (
    (codepoint >= 0x3041 && codepoint <= 0x3096) || (codepoint >= 0x30a1 && codepoint <= 0x30fa)
  );
}

export function buildKanjiVgFileName(character: string): string | null {
  if (!canTraceKana(character)) {
    return null;
  }

  return `${character.codePointAt(0)!.toString(16).padStart(5, "0")}.svg`;
}

export function buildKanjiVgSourceUrl(character: string): string | null {
  const fileName = buildKanjiVgFileName(character);

  return fileName === null
    ? null
    : `https://raw.githubusercontent.com/KanjiVG/kanjivg/${KANJIVG_RELEASE}/kanji/${fileName}`;
}

export function isTraceStrokeAccepted(
  userPoints: readonly TracePoint[],
  guidePoints: readonly TracePoint[],
  options: TraceValidationOptions = {},
): boolean {
  if (userPoints.length < 2 || guidePoints.length < 2) {
    return false;
  }

  const endpointTolerance = options.endpointTolerance ?? 18;
  const pathTolerance = options.pathTolerance ?? 13;

  if (
    pointDistance(userPoints[0]!, guidePoints[0]!) > endpointTolerance ||
    pointDistance(userPoints.at(-1)!, guidePoints.at(-1)!) > endpointTolerance
  ) {
    return false;
  }

  return (
    averageNearestDistance(userPoints, guidePoints) <= pathTolerance &&
    averageNearestDistance(guidePoints, userPoints) <= pathTolerance
  );
}

export function isKanaTracingCandidate(
  item: Pick<KanaLessonItemDto, "character" | "variant">,
): boolean {
  return item.variant !== "long-vowel" && canTraceKana(item.character);
}

function averageNearestDistance(
  points: readonly TracePoint[],
  candidates: readonly TracePoint[],
): number {
  const total = points.reduce((sum, point) => {
    const nearest = candidates.reduce(
      (minimum, candidate) => Math.min(minimum, pointDistance(point, candidate)),
      Number.POSITIVE_INFINITY,
    );

    return sum + nearest;
  }, 0);

  return total / points.length;
}

function pointDistance(left: TracePoint, right: TracePoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
