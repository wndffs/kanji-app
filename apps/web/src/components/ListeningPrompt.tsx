"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type AudioAssetDto, type ListeningPlaybackEvidenceDto } from "@kanji-srs/shared";

import { useStudyAudioPreferences } from "../lib/use-study-audio-preferences";

type PlaybackStatus = "loading" | "ready" | "playing" | "completed" | "error";

type ListeningPromptProps = {
  readonly audio: AudioAssetDto | null | undefined;
  readonly onEvidenceChange: (evidence: ListeningPlaybackEvidenceDto) => void;
};

export function ListeningPrompt(props: ListeningPromptProps) {
  return (
    <ListeningPlayback key={JSON.stringify([props.audio?.id, props.audio?.mediaUrl])} {...props} />
  );
}

function ListeningPlayback({ audio, onEvidenceChange }: ListeningPromptProps) {
  const preferences = useStudyAudioPreferences();
  const audioRef = useRef<HTMLAudioElement>(null);
  const onEvidenceChangeRef = useRef(onEvidenceChange);
  const activeRef = useRef(false);
  const generationRef = useRef(0);
  const playRequestedRef = useRef(false);
  const playingRef = useRef(false);
  const autoplayAttemptedRef = useRef(false);
  const playCountRef = useRef(0);
  const completedRef = useRef(false);
  const [status, setStatus] = useState<PlaybackStatus>(
    audio?.mediaUrl === null || audio?.mediaUrl === undefined ? "error" : "loading",
  );

  useEffect(() => {
    onEvidenceChangeRef.current = onEvidenceChange;
  }, [onEvidenceChange]);

  useEffect(() => {
    const element = audioRef.current;
    activeRef.current = true;
    onEvidenceChangeRef.current({ completed: false, playCount: 0 });

    const pause = () => {
      generationRef.current += 1;
      const wasRequested = playRequestedRef.current;
      playRequestedRef.current = false;
      playingRef.current = false;
      element?.pause();

      if (wasRequested) {
        setStatus(completedRef.current ? "completed" : "ready");
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") pause();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", pause);

    return () => {
      activeRef.current = false;
      generationRef.current += 1;
      playRequestedRef.current = false;
      playingRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", pause);
      element?.pause();
    };
  }, []);

  const play = useCallback(
    async (autoplay = false): Promise<void> => {
      const element = audioRef.current;

      if (!activeRef.current || document.visibilityState === "hidden") return;

      if (element === null || audio?.mediaUrl === null || audio?.mediaUrl === undefined) {
        setStatus("error");
        return;
      }

      const generation = ++generationRef.current;
      playRequestedRef.current = true;
      playingRef.current = false;
      setStatus("playing");

      try {
        element.currentTime = 0;
        await element.play();

        // A pending play can settle after this source was removed or hidden.
        if (!activeRef.current || !playRequestedRef.current) element.pause();
      } catch {
        if (!activeRef.current || generation !== generationRef.current) return;

        playRequestedRef.current = false;
        playingRef.current = false;
        setStatus(autoplay ? "ready" : "error");
      }
    },
    [audio?.mediaUrl],
  );

  const handleCanPlay = useCallback((): void => {
    if (!activeRef.current) return;

    setStatus((current) => (current === "completed" || current === "playing" ? current : "ready"));

    if (
      preferences.speechAutoplay &&
      document.visibilityState !== "hidden" &&
      !autoplayAttemptedRef.current
    ) {
      autoplayAttemptedRef.current = true;
      void play(true);
    }
  }, [play, preferences.speechAutoplay]);

  useEffect(() => {
    if (
      audioRef.current !== null &&
      audioRef.current.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      handleCanPlay();
    }
  }, [handleCanPlay]);

  function handlePlay(): void {
    if (!activeRef.current || !playRequestedRef.current || document.visibilityState === "hidden") {
      audioRef.current?.pause();
      return;
    }

    if (playingRef.current) return;

    playingRef.current = true;
    playCountRef.current += 1;
    setStatus("playing");
    onEvidenceChangeRef.current({
      completed: completedRef.current,
      playCount: playCountRef.current,
    });
  }

  function handleEnded(): void {
    if (
      !activeRef.current ||
      !playRequestedRef.current ||
      !playingRef.current ||
      !audioRef.current?.ended ||
      document.visibilityState === "hidden"
    ) {
      return;
    }

    generationRef.current += 1;
    playRequestedRef.current = false;
    playingRef.current = false;
    completedRef.current = true;
    setStatus("completed");
    onEvidenceChangeRef.current({ completed: true, playCount: playCountRef.current });
  }

  function handleError(): void {
    if (!activeRef.current) return;

    generationRef.current += 1;
    playRequestedRef.current = false;
    playingRef.current = false;
    setStatus("error");
    onEvidenceChangeRef.current({
      completed: completedRef.current,
      playCount: playCountRef.current,
    });
  }

  function handlePause(): void {
    if (!activeRef.current || audioRef.current?.ended || !playRequestedRef.current) return;

    generationRef.current += 1;
    playRequestedRef.current = false;
    playingRef.current = false;
    setStatus(completedRef.current ? "completed" : "ready");
  }

  return (
    <section className="listening-prompt" aria-label="Аудиозадание">
      {audio?.mediaUrl === null || audio?.mediaUrl === undefined ? null : (
        <audio
          onCanPlay={handleCanPlay}
          onEnded={handleEnded}
          onError={handleError}
          onPause={handlePause}
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
