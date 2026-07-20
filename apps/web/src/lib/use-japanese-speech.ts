"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getJapaneseVoices,
  normalizeSpeechRate,
  selectJapaneseVoice,
} from "./japanese-speech";
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

export function useJapaneseSpeech(options: JapaneseSpeechOptions = {}): JapaneseSpeech {
  const [available, setAvailable] = useState(false);
  const [voices, setVoices] = useState<readonly SpeechSynthesisVoice[]>([]);
  const preferences = useStudyAudioPreferences();
  const voiceUri =
    options.voiceUri === undefined ? preferences.speechVoiceUri : options.voiceUri;
  const rate = normalizeSpeechRate(options.rate ?? preferences.speechRate);
  const selectedVoice = useMemo(
    () => selectJapaneseVoice(voices, voiceUri),
    [voiceUri, voices],
  );
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(selectedVoice);
  const rateRef = useRef(rate);

  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
    rateRef.current = rate;
  }, [rate, selectedVoice]);

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return;
    }

    const synthesis = window.speechSynthesis;
    const updateVoice = () => {
      setVoices(getJapaneseVoices(synthesis.getVoices()));
    };

    updateVoice();
    synthesis.addEventListener("voiceschanged", updateVoice);
    setAvailable(true);

    return () => {
      synthesis.cancel();
      synthesis.removeEventListener("voiceschanged", updateVoice);
    };
  }, []);

  const speak = useCallback(
    (text: string): boolean => {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
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

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const cancel = useCallback((): void => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

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
