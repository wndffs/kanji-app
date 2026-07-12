"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { selectJapaneseVoice } from "./japanese-speech";

export type JapaneseSpeech = {
  readonly available: boolean;
  readonly cancel: () => void;
  readonly speak: (text: string) => boolean;
};

export function useJapaneseSpeech(): JapaneseSpeech {
  const [available, setAvailable] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return;
    }

    const synthesis = window.speechSynthesis;
    const updateVoice = () => {
      voiceRef.current = selectJapaneseVoice(synthesis.getVoices());
    };

    updateVoice();
    synthesis.addEventListener("voiceschanged", updateVoice);
    setAvailable(true);

    return () => {
      synthesis.cancel();
      synthesis.removeEventListener("voiceschanged", updateVoice);
    };
  }, []);

  const speak = useCallback((text: string): boolean => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return false;
    }

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.78;
    utterance.pitch = 1;

    if (voiceRef.current !== null) {
      utterance.voice = voiceRef.current;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const cancel = useCallback((): void => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { available, cancel, speak };
}
