import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Returns a function that scrolls the element with the given id into view after the
 * next commit, so it also reaches an element that the same update draws, as when an
 * arrow key reopens a closed list. Callers request it only for keyboard moves and new
 * results: scrolling when the pointer highlights a partly visible option would slide
 * the list under the pointer.
 */
export function useScrollIntoViewAfterCommit(): (elementId: string) => void {
  const pendingElementIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (pendingElementIdRef.current === null) return;
    document
      .getElementById(pendingElementIdRef.current)
      ?.scrollIntoView({ block: "nearest" });
    pendingElementIdRef.current = null;
  });

  return useCallback((elementId: string) => {
    pendingElementIdRef.current = elementId;
  }, []);
}
