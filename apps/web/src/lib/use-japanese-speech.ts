"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getJapaneseVoices, normalizeSpeechRate, selectJapaneseVoice } from "./japanese-speech";
import { useStudyAudioPreferences } from "./use-study-audio-preferences";

export type JapaneseSpeechVoiceOption = {
  readonly lang: string;
  readonly name: string;
  readonly voiceUri: string;
};

export type JapaneseSpeechOptions = {
  readonly rate?: number;
  readonly voiceUri?: string | null;
};

export type JapaneseSpeech = {
  readonly available: boolean;
  readonly autoplay: boolean;
  readonly cancel: () => void;
  readonly speak: (text: string) => boolean;
  readonly voices: readonly JapaneseSpeechVoiceOption[];
  readonly ready: boolean;
  readonly status: "idle" | "speaking" | "error";
};

let activeSpeech: {
  readonly owner: symbol;
  readonly utterance: SpeechSynthesisUtterance;
  timer: ReturnType<typeof setTimeout> | null;
} | null = null;

export function useJapaneseSpeech(options: JapaneseSpeechOptions = {}): JapaneseSpeech {
  const [available, setAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<JapaneseSpeech["status"]>("idle");
  const [voices, setVoices] = useState<readonly SpeechSynthesisVoice[]>([]);
  const preferences = useStudyAudioPreferences();
  const voiceUri = options.voiceUri === undefined ? preferences.speechVoiceUri : options.voiceUri;
  const rate = normalizeSpeechRate(options.rate ?? preferences.speechRate);
  const selectedVoice = useMemo(() => selectJapaneseVoice(voices, voiceUri), [voiceUri, voices]);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(selectedVoice);
  const rateRef = useRef(rate);
  const ownerRef = useRef(Symbol("japanese-speech"));
  const mountedRef = useRef(false);

  const cancel = useCallback((): void => {
    if (mountedRef.current) setStatus("idle");
    if (activeSpeech?.owner !== ownerRef.current) return;
    if (activeSpeech.timer !== null) clearTimeout(activeSpeech.timer);
    activeSpeech = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
    rateRef.current = rate;
    return cancel;
  }, [cancel, preferences.speechAutoplay, rate, selectedVoice, voiceUri]);

  useEffect(() => {
    mountedRef.current = true;
    setReady(true);

    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return () => {
        mountedRef.current = false;
      };
    }

    const synthesis = window.speechSynthesis;
    const updateVoice = () => {
      setVoices(getJapaneseVoices(synthesis.getVoices()));
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") cancel();
    };

    updateVoice();
    synthesis.addEventListener("voiceschanged", updateVoice);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", cancel);
    setAvailable(true);

    return () => {
      mountedRef.current = false;
      cancel();
      synthesis.removeEventListener("voiceschanged", updateVoice);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", cancel);
    };
  }, [cancel]);

  const speak = useCallback(
    (text: string): boolean => {
      if (
        !mountedRef.current ||
        document.visibilityState === "hidden" ||
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ) {
        return false;
      }

      try {
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = "ja-JP";
        utterance.rate = rateRef.current;
        utterance.pitch = 1;

        if (selectedVoiceRef.current !== null) {
          utterance.voice = selectedVoiceRef.current;
        }

        const release = (next: JapaneseSpeech["status"]) => {
          if (activeSpeech?.utterance !== utterance) return;
          if (activeSpeech.timer !== null) clearTimeout(activeSpeech.timer);
          activeSpeech = null;
          if (mountedRef.current) setStatus(next);
        };
        utterance.onend = () => release("idle");
        utterance.onerror = () => release("error");
        utterance.onstart = () => {
          if (activeSpeech?.utterance === utterance && activeSpeech.timer !== null) {
            clearTimeout(activeSpeech.timer);
            activeSpeech.timer = null;
          }
        };

        // Clear ownership before cancel dispatches events for the previous utterance.
        if (activeSpeech?.timer != null) clearTimeout(activeSpeech.timer);
        activeSpeech = null;
        window.speechSynthesis.cancel();
        activeSpeech = {
          owner: ownerRef.current,
          utterance,
          timer: setTimeout(() => {
            if (activeSpeech?.utterance !== utterance) return;
            release("error");
            window.speechSynthesis.cancel();
          }, 12_000),
        };
        setStatus("speaking");
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        cancel();
        setStatus("error");
        return false;
      }
    },
    [cancel],
  );

  return {
    available,
    ready,
    status,
    autoplay: preferences.speechAutoplay,
    cancel,
    speak,
    voices: voices.map((voice) => ({
      lang: voice.lang,
      name: voice.name,
      voiceUri: voice.voiceURI,
    })),
  };
}
