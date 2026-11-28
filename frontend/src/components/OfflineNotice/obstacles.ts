import { type RefCallback, useCallback } from "react";

// Bottom buttons that ACCT-R18's notice must not cover, such as an edit page's submit
// button. Their place depends on each page's layout, so the notice measures them.
const obstacles = new Set<HTMLElement>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function getOfflineNoticeObstacles(): ReadonlySet<HTMLElement> {
  return obstacles;
}

export function addOfflineNoticeObstacleListener(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A ref that keeps ACCT-R18's notice above the element it is attached to. */
export function useOfflineNoticeObstacle(): RefCallback<HTMLElement> {
  return useCallback((element: HTMLElement | null) => {
    if (!element) return;
    obstacles.add(element);
    notify();
    return () => {
      obstacles.delete(element);
      notify();
    };
  }, []);
}
