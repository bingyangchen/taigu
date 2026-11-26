import { useEffect, useState } from "react";

import { type Breakpoint, BREAKPOINTS } from "../styles/tokens";

// The same queries as the `ds.down()` and `ds.up()` Sass mixins, so TypeScript and
// the stylesheets switch at the same pixel.
export function makeWidthBelowQuery(breakpoint: Breakpoint): string {
  return `(width < ${BREAKPOINTS[breakpoint]}px)`;
}

export function makeWidthAtLeastQuery(breakpoint: Breakpoint): string {
  return `(width >= ${BREAKPOINTS[breakpoint]}px)`;
}

export const NARROW_LAYOUT_QUERY = makeWidthBelowQuery("lg");

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handleChange = (): void => setMatches(mediaQueryList.matches);
    handleChange();
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);
  return matches;
}
