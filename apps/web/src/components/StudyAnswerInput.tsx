"use client";

import { type ComponentPropsWithRef, type RefObject, useRef } from "react";
import { romajiToKanaInput } from "@kanji-srs/japanese";
import { type StudyAnswerMode } from "../lib/study-answer";

type StudyAnswerInputProps = Omit<ComponentPropsWithRef<"input">, "onChange" | "value" | "type"> & {
  readonly mode: StudyAnswerMode;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly composingRef?: RefObject<boolean>;
};

export function StudyAnswerInput({
  mode,
  value,
  onValueChange,
  composingRef,
  ...props
}: StudyAnswerInputProps) {
  const internalComposition = useRef(false);
  const composing = composingRef ?? internalComposition;
  const isReading = mode !== "meaning";

  function update(input: HTMLInputElement, isComposing: boolean) {
    const text = input.value;
    if (mode === "meaning" || isComposing) {
      onValueChange(text);
      return;
    }
    const converted = romajiToKanaInput(text, mode);
    if (converted !== text) {
      // Keep the caret at the edit, rather than jumping to the end of a controlled input.
      const caret = input.selectionEnd ?? text.length;
      const convertedCaret = romajiToKanaInput(text.slice(0, caret), mode).length;
      input.value = converted;
      input.setSelectionRange(convertedCaret, convertedCaret);
    }
    onValueChange(converted);
  }

  return (
    <input
      {...props}
      type="text"
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect={isReading ? "off" : undefined}
      spellCheck={!isReading}
      value={value}
      onChange={(event) =>
        update(
          event.currentTarget,
          composing.current || (event.nativeEvent as InputEvent).isComposing,
        )
      }
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        update(event.currentTarget, false);
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
        ) {
          event.preventDefault();
        }
      }}
    />
  );
}
