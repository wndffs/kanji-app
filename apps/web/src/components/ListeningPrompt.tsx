"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type AudioAssetDto, type ListeningPlaybackEvidenceDto } from "@kanji-srs/shared";

import { useStudyAudioPreferences } from "../lib/use-study-audio-preferences";

type PlaybackStatus = "loading" | "ready" | "playing" | "completed" | "error";

export function ListeningPrompt({
  audio,
  onEvidenceChange,
}: {
  readonly audio: AudioAssetDto | null | undefined;
  readonly onEvidenceChange: (evidence: ListeningPlaybackEvidenceDto) => void;
}) {
  const preferences = useStudyAudioPreferences();
  const audioRef = useRef<HTMLAudioElement>(null);
  const onEvidenceChangeRef = useRef(onEvidenceChange);
  const autoplayAttemptedRef = useRef(false);
  const playCountRef = useRef(0);
  const completedRef = useRef(false);
  const [status, setStatus] = useState<PlaybackStatus>("loading");

  useEffect(() => {
    onEvidenceChangeRef.current = onEvidenceChange;
  }, [onEvidenceChange]);

  const resetEvidence = useCallback(() => {
    playCountRef.current = 0;
    completedRef.current = false;
    autoplayAttemptedRef.current = false;
    setStatus(audio?.mediaUrl === null || audio?.mediaUrl === undefined ? "error" : "loading");
    onEvidenceChangeRef.current({ completed: false, playCount: 0 });
  }, [audio?.id, audio?.mediaUrl]);

  useEffect(() => {
    resetEvidence();

    return () => {
      audioRef.current?.pause();
    };
  }, [resetEvidence]);

  const play = useCallback(
    async (autoplay = false): Promise<void> => {
      const element = audioRef.current;

      if (element === null || audio?.mediaUrl === null || audio?.mediaUrl === undefined) {
        setStatus("error");
        return;
      }

      try {
        element.currentTime = 0;
        await element.play();
      } catch {
        setStatus(autoplay ? "ready" : "error");
      }
    },
    [audio?.mediaUrl],
  );

  function handleCanPlay(): void {
    setStatus((current) => (current === "completed" ? current : "ready"));

    if (preferences.speechAutoplay && !autoplayAttemptedRef.current) {
      autoplayAttemptedRef.current = true;
      void play(true);
    }
  }

  function handlePlay(): void {
    playCountRef.current += 1;
    setStatus("playing");
    onEvidenceChangeRef.current({
      completed: completedRef.current,
      playCount: playCountRef.current,
    });
  }

  function handleEnded(): void {
    completedRef.current = true;
    setStatus("completed");
    onEvidenceChangeRef.current({ completed: true, playCount: playCountRef.current });
  }

  function handleError(): void {
    setStatus("error");
    onEvidenceChangeRef.current({
      completed: completedRef.current,
      playCount: playCountRef.current,
    });
  }

  return (
    <section className="listening-prompt" aria-label="Аудиозадание">
      {audio?.mediaUrl === null || audio?.mediaUrl === undefined ? null : (
        <audio
          key={audio.id}
          onCanPlay={handleCanPlay}
          onEnded={handleEnded}
          onError={handleError}
          onPlay={handlePlay}
          preload="auto"
          ref={audioRef}
          src={audio.mediaUrl}
        />
      )}
      <button
        aria-label={status === "completed" ? "Воспроизвести аудио ещё раз" : "Воспроизвести аудио"}
        className="listening-play-button"
        disabled={
          status === "loading" ||
          status === "playing" ||
          audio?.mediaUrl === null ||
          audio?.mediaUrl === undefined
        }
        onClick={() => void play()}
        type="button"
      >
        <span aria-hidden="true">▶</span>
        {status === "playing" ? "Слушайте" : status === "completed" ? "Повторить" : "Воспроизвести"}
      </button>
      <p aria-live="polite">
        {status === "loading"
          ? "Загружаем запись."
          : status === "playing"
            ? "Дослушайте запись до конца."
            : status === "completed"
              ? "Запись прослушана. Можно отвечать."
              : status === "error"
                ? completedRef.current
                  ? "Повтор не удался. Можно ответить по уже прослушанной записи."
                  : "Аудио недоступно. Ответ не будет оценён; попробуйте воспроизвести ещё раз."
                : "Воспроизведите запись перед ответом."}
      </p>
    </section>
  );
}

export function ListeningAttribution({ audio }: { readonly audio: AudioAssetDto }) {
  return (
    <dl className="listening-attribution">
      <div>
        <dt>Запись</dt>
        <dd>{audio.speakerName ?? "Автор записи не указан"}</dd>
      </div>
      <div>
        <dt>Источник</dt>
        <dd>
          {audio.sourceUrl === null ? (
            audio.sourceName
          ) : (
            <a href={audio.sourceUrl} rel="noreferrer" target="_blank">
              {audio.sourceName}
            </a>
          )}
        </dd>
      </div>
      <div>
        <dt>Лицензия</dt>
        <dd>
          {audio.licenseUrl === null ? (
            audio.licenseName
          ) : (
            <a href={audio.licenseUrl} rel="noreferrer" target="_blank">
              {audio.licenseName}
            </a>
          )}
        </dd>
      </div>
      <div>
        <dt>Атрибуция</dt>
        <dd>{audio.attributionText}</dd>
      </div>
    </dl>
  );
}
