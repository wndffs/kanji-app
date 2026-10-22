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
};

let activeSpeech: {
  readonly owner: symbol;
  readonly utterance: SpeechSynthesisUtterance;
} | null = null;

export function useJapaneseSpeech(options: JapaneseSpeechOptions = {}): JapaneseSpeech {
  const [available, setAvailable] = useState(false);
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
    if (activeSpeech?.owner !== ownerRef.current) return;

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

        const release = () => {
          if (activeSpeech?.utterance === utterance) activeSpeech = null;
        };
        utterance.onend = release;
        utterance.onerror = release;

        // Clear ownership before cancel dispatches events for the previous utterance.
        activeSpeech = null;
        window.speechSynthesis.cancel();
        activeSpeech = { owner: ownerRef.current, utterance };
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        cancel();
        return false;
      }
    },
    [cancel],
  );

  return {
    available,
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
