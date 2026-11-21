"use client";

import { type ComponentPropsWithRef, type RefObject, useRef } from "react";
import { romajiToKatakanaInput } from "@kanji-srs/japanese";
import { type CardAnswerType } from "@kanji-srs/shared";

type StudyAnswerInputProps = Omit<ComponentPropsWithRef<"input">, "onChange" | "value" | "type"> & {
  readonly answerType: CardAnswerType;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly composingRef?: RefObject<boolean>;
};

export function StudyAnswerInput({
  answerType,
  value,
  onValueChange,
  composingRef,
  ...props
}: StudyAnswerInputProps) {
  const internalComposition = useRef(false);
  const composing = composingRef ?? internalComposition;
  const isReading = answerType === "reading";

  function update(input: HTMLInputElement, isComposing: boolean) {
    const text = input.value;
    const converted = isReading && !isComposing ? romajiToKatakanaInput(text) : text;
    if (converted !== text) {
      // Keep the caret at the edit, rather than jumping to the end of a controlled input.
      const caret = input.selectionEnd ?? text.length;
      const convertedCaret = romajiToKatakanaInput(text.slice(0, caret)).length;
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
