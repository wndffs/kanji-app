"use client";

import { createContext, useContext, useEffect } from "react";

export const StudyFocusContext = createContext<((title: string) => () => void) | null>(null);

export function useStudyFocus(active: boolean, title: string): void {
  const enter = useContext(StudyFocusContext);
  useEffect(() => {
    if (active) return enter?.(title);
  }, [active, enter, title]);
}
