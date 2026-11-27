import { useCallback, useSyncExternalStore } from "react";

import { type Breakpoint, BREAKPOINTS, NARROW_LAYOUT_SIZE } from "../styles/tokens";

// The same queries as the `ds.down()`, `ds.up()` and `ds.narrow-layout` Sass mixins,
// so TypeScript and the stylesheets switch at the same pixel.
export function makeWidthBelowQuery(breakpoint: Breakpoint): string {
  return `(width < ${BREAKPOINTS[breakpoint]}px)`;
}

export function makeWidthAtLeastQuery(breakpoint: Breakpoint): string {
  return `(width >= ${BREAKPOINTS[breakpoint]}px)`;
}

export const NARROW_LAYOUT_QUERY = `(width < ${NARROW_LAYOUT_SIZE.width}px), (height < ${NARROW_LAYOUT_SIZE.height}px)`;

export const CAN_HOVER_QUERY = "(hover: hover)";

export const PWA_QUERY = "(display-mode: standalone)";

/** Reads false while src/prerender.tsx renders a page in Node, which has no window. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsNarrowLayout(): boolean {
  return useMediaQuery(NARROW_LAYOUT_QUERY);
}
