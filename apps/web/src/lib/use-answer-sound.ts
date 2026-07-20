"use client";

import { useCallback, useEffect, useRef } from "react";

import { useStudyAudioPreferences } from "./use-study-audio-preferences";

type WebkitAudioWindow = Window &
  typeof globalThis & {
    readonly webkitAudioContext?: typeof AudioContext;
  };

export type AnswerSound = {
  readonly play: (accepted: boolean) => boolean;
};

export function useAnswerSound(): AnswerSound {
  const { soundFeedback } = useStudyAudioPreferences();
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      const context = contextRef.current;
      contextRef.current = null;

      if (context !== null) {
        void context.close();
      }
    },
    [],
  );

  const play = useCallback(
    (accepted: boolean): boolean => {
      if (!soundFeedback) {
        return false;
      }

      try {
        const audioWindow = window as WebkitAudioWindow;
        const AudioContextConstructor =
          audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

        if (AudioContextConstructor === undefined) {
          return false;
        }

        const context = contextRef.current ?? new AudioContextConstructor();
        contextRef.current = context;

        if (context.state === "suspended") {
          void context.resume().catch(() => undefined);
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        const startFrequency = accepted ? 660 : 220;
        const endFrequency = accepted ? 880 : 165;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(startFrequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + 0.14);
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.17);
        return true;
      } catch {
        return false;
      }
    },
    [soundFeedback],
  );

  return { play };
}
