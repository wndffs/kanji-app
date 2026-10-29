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
    ![endpointTolerance, pathTolerance].every((value) => Number.isFinite(value) && value > 0) ||
    [...userPoints, ...guidePoints].some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
    ) ||
    userPoints.length > 2048 ||
    guidePoints.length > 2048
  )
    return false;

  if (
    pointDistance(userPoints[0]!, guidePoints[0]!) > endpointTolerance ||
    pointDistance(userPoints.at(-1)!, guidePoints.at(-1)!) > endpointTolerance
  ) {
    return false;
  }

  const userLength = traceLength(userPoints),
    guideLength = traceLength(guidePoints);
  const guideSpan = pointDistance(guidePoints[0]!, guidePoints.at(-1)!);
  const forward =
    pointDistance(userPoints[0]!, guidePoints[0]!) +
    pointDistance(userPoints.at(-1)!, guidePoints.at(-1)!);
  const reversed =
    pointDistance(userPoints[0]!, guidePoints.at(-1)!) +
    pointDistance(userPoints.at(-1)!, guidePoints[0]!);
  if (guideSpan > 2 && forward > reversed) return false;
  if (guideLength < 1 || userLength < guideLength * 0.45 || userLength > guideLength * 2)
    return false;
  const user = sampleTrace(userPoints, userLength),
    guide = sampleTrace(guidePoints, guideLength);
  const distances = user.map((point, index) => pointDistance(point, guide[index]!));
  return (
    distances.reduce((sum, d) => sum + d, 0) / distances.length <= pathTolerance &&
    [...distances].sort((a, b) => a - b)[Math.floor(distances.length * 0.9)]! <= pathTolerance * 2
  );
}

export function isKanaTracingCandidate(
  item: Pick<KanaLessonItemDto, "character" | "variant">,
): boolean {
  return item.variant !== "long-vowel" && canTraceKana(item.character);
}

function traceLength(points: readonly TracePoint[]): number {
  return points
    .slice(1)
    .reduce((sum, point, index) => sum + pointDistance(points[index]!, point), 0);
}

// Arc-length sampling keeps touch-event density and drawing speed out of the score.
function sampleTrace(points: readonly TracePoint[], length: number): readonly TracePoint[] {
  let segment = 1,
    covered = 0;
  return Array.from({ length: 33 }, (_, index) => {
    const target = (length * index) / 32;
    while (
      segment < points.length - 1 &&
      covered + pointDistance(points[segment - 1]!, points[segment]!) < target
    ) {
      covered += pointDistance(points[segment - 1]!, points[segment]!);
      segment++;
    }
    const left = points[segment - 1]!,
      right = points[segment]!;
    const size = pointDistance(left, right),
      ratio = size === 0 ? 0 : Math.min(1, Math.max(0, (target - covered) / size));
    return { x: left.x + (right.x - left.x) * ratio, y: left.y + (right.y - left.y) * ratio };
  });
}

function pointDistance(left: TracePoint, right: TracePoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
