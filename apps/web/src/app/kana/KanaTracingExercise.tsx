"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

import { type KanaLessonItemDto } from "@kanji-srs/shared";

import { isTraceStrokeAccepted, type TracePoint } from "../../lib/kana-tracing";

type StrokeGuide = {
  readonly id: string;
  readonly path: string;
};

type StrokeGuideData = {
  readonly minX: number;
  readonly minY: number;
  readonly strokes: readonly StrokeGuide[];
  readonly viewBox: string;
  readonly width: number;
  readonly height: number;
};

export function KanaTracingExercise({
  disabled,
  item,
  onComplete,
  onUnavailable,
}: {
  readonly disabled: boolean;
  readonly item: KanaLessonItemDto;
  readonly onComplete: () => Promise<void>;
  readonly onUnavailable: () => void;
}) {
  const [guide, setGuide] = useState<StrokeGuideData | null>(null);
  const [completedStrokes, setCompletedStrokes] = useState<readonly (readonly TracePoint[])[]>([]);
  const [activeStroke, setActiveStroke] = useState<readonly TracePoint[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [status, setStatus] = useState("Загрузка порядка черт");
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);

  useEffect(() => {
    let cancelled = false;

    void loadStrokeGuide(item.character)
      .then((loadedGuide) => {
        if (cancelled) {
          return;
        }

        setGuide(loadedGuide);
        setStatus(`Черта 1 из ${loadedGuide.strokes.length}`);
      })
      .catch(() => {
        if (!cancelled) {
          onUnavailable();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.character, onUnavailable]);

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (guide === null || disabled || completing) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
    setActiveStroke([toGuidePoint(event, guide)]);
    setStatus(`Черта ${completedStrokes.length + 1} из ${guide.strokes.length}`);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!drawing || guide === null) {
      return;
    }

    const point = toGuidePoint(event, guide);
    setActiveStroke((points) => appendDistinctPoint(points, point));
  }

  async function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>): Promise<void> {
    if (!drawing || guide === null) {
      return;
    }

    setDrawing(false);
    const userStroke = appendDistinctPoint(activeStroke, toGuidePoint(event, guide));
    const path = pathRefs.current[completedStrokes.length];

    if (path === null || path === undefined) {
      setActiveStroke([]);
      onUnavailable();
      return;
    }

    const accepted = isTraceStrokeAccepted(userStroke, samplePath(path));

    if (!accepted) {
      setActiveStroke([]);
      setStatus("Не совпало, повторите текущую черту");
      return;
    }

    const nextCompleted = [...completedStrokes, userStroke];
    setCompletedStrokes(nextCompleted);
    setActiveStroke([]);

    if (nextCompleted.length < guide.strokes.length) {
      setStatus(`Черта ${nextCompleted.length + 1} из ${guide.strokes.length}`);
      return;
    }

    setStatus("Знак обведён");
    setCompleting(true);
    await onComplete();
    setCompleting(false);
  }

  function undoStroke(): void {
    if (disabled || completing || completedStrokes.length === 0 || guide === null) {
      return;
    }

    const nextCompleted = completedStrokes.slice(0, -1);
    setCompletedStrokes(nextCompleted);
    setActiveStroke([]);
    setStatus(`Черта ${nextCompleted.length + 1} из ${guide.strokes.length}`);
  }

  function resetTracing(): void {
    if (disabled || completing || guide === null) {
      return;
    }

    setCompletedStrokes([]);
    setActiveStroke([]);
    setStatus(`Черта 1 из ${guide.strokes.length}`);
  }

  return (
    <div className="kana-tracing">
      <span className="eyebrow">Обводка</span>
      {guide === null ? (
        <div aria-busy="true" className="kana-trace-loading">
          {status}
        </div>
      ) : (
        <>
          <div className="kana-trace-heading">
            <strong lang="ja">{item.character}</strong>
            <span>{status}</span>
          </div>
          <svg
            aria-label={`Обведите ${item.character} по порядку черт`}
            className="kana-trace-surface"
            data-testid="kana-trace-surface"
            onPointerCancel={() => {
              setDrawing(false);
              setActiveStroke([]);
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => void handlePointerUp(event)}
            role="img"
            viewBox={guide.viewBox}
          >
            <rect
              className="kana-trace-background"
              height={guide.height}
              width={guide.width}
              x={guide.minX}
              y={guide.minY}
            />
            <line
              className="kana-trace-grid"
              x1={guide.minX + guide.width / 2}
              x2={guide.minX + guide.width / 2}
              y1={guide.minY}
              y2={guide.minY + guide.height}
            />
            <line
              className="kana-trace-grid"
              x1={guide.minX}
              x2={guide.minX + guide.width}
              y1={guide.minY + guide.height / 2}
              y2={guide.minY + guide.height / 2}
            />
            {guide.strokes.map((stroke, index) => (
              <path
                className={
                  index < completedStrokes.length
                    ? "is-complete"
                    : index === completedStrokes.length
                      ? "is-current"
                      : ""
                }
                d={stroke.path}
                key={stroke.id}
                ref={(element) => {
                  pathRefs.current[index] = element;
                }}
              />
            ))}
            {completedStrokes.map((stroke, index) => (
              <polyline
                className="kana-trace-user is-complete"
                key={index}
                points={formatPoints(stroke)}
              />
            ))}
            {activeStroke.length > 0 ? (
              <polyline className="kana-trace-user" points={formatPoints(activeStroke)} />
            ) : null}
          </svg>
          <div className="kana-trace-actions">
            <button
              aria-label="Отменить последнюю черту"
              disabled={disabled || completing || completedStrokes.length === 0}
              onClick={undoStroke}
              title="Отменить последнюю черту"
              type="button"
            >
              ↶
            </button>
            <button
              aria-label="Начать обводку заново"
              disabled={disabled || completing}
              onClick={resetTracing}
              title="Начать заново"
              type="button"
            >
              ×
            </button>
            <button
              className="kana-trace-skip"
              disabled={disabled || completing}
              onClick={onUnavailable}
              type="button"
            >
              Другой формат
            </button>
          </div>
          <small className="kana-trace-attribution">
            Данные:{" "}
            <a href="https://kanjivg.tagaini.net/" rel="noreferrer" target="_blank">
              KanjiVG
            </a>{" "}
            · CC BY-SA 3.0
          </small>
        </>
      )}
    </div>
  );
}

async function loadStrokeGuide(character: string): Promise<StrokeGuideData> {
  const response = await fetch(`/api/kana-strokes/${encodeURIComponent(character)}`);

  if (!response.ok) {
    throw new Error("Stroke guide is unavailable.");
  }

  const document = new DOMParser().parseFromString(await response.text(), "image/svg+xml");

  if (document.querySelector("parsererror") !== null) {
    throw new Error("Stroke guide SVG is invalid.");
  }

  const root = document.documentElement;
  const viewBox = root.getAttribute("viewBox") ?? "0 0 109 109";
  const [minX, minY, width, height] = viewBox.split(/\s+/u).map(Number);
  const strokes = Array.from(document.getElementsByTagName("path"))
    .map((path, index) => ({
      id: path.getAttribute("id") ?? `stroke-${index + 1}`,
      path: path.getAttribute("d") ?? "",
    }))
    .filter((stroke) => stroke.path !== "")
    .sort((left, right) => strokeOrder(left.id) - strokeOrder(right.id));

  if (
    ![minX, minY, width, height].every(Number.isFinite) ||
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0 ||
    strokes.length === 0
  ) {
    throw new Error("Stroke guide SVG has no usable paths.");
  }

  return { minX: minX!, minY: minY!, width, height, viewBox, strokes };
}

function toGuidePoint(event: ReactPointerEvent<SVGSVGElement>, guide: StrokeGuideData): TracePoint {
  const bounds = event.currentTarget.getBoundingClientRect();

  return {
    x: guide.minX + ((event.clientX - bounds.left) / bounds.width) * guide.width,
    y: guide.minY + ((event.clientY - bounds.top) / bounds.height) * guide.height,
  };
}

function appendDistinctPoint(
  points: readonly TracePoint[],
  point: TracePoint,
): readonly TracePoint[] {
  const previous = points.at(-1);

  return previous === undefined || Math.hypot(previous.x - point.x, previous.y - point.y) >= 1
    ? [...points, point]
    : points;
}

function samplePath(path: SVGPathElement): readonly TracePoint[] {
  const length = path.getTotalLength();
  const sampleCount = Math.max(12, Math.ceil(length / 4));

  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const point = path.getPointAtLength((length * index) / sampleCount);
    return { x: point.x, y: point.y };
  });
}

function strokeOrder(id: string): number {
  return Number(id.match(/-s(\d+)$/u)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function formatPoints(points: readonly TracePoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}
