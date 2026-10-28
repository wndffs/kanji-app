"use client";

import { createContext, useContext, useEffect } from "react";

export const StudyFocusContext = createContext<
  ((title: string, returnHref?: string) => () => void) | null
>(null);

export function useStudyFocus(active: boolean, title: string, returnHref = "/dashboard"): void {
  const enter = useContext(StudyFocusContext);
  useEffect(() => {
    if (active) return enter?.(title, returnHref);
  }, [active, enter, title, returnHref]);
}
