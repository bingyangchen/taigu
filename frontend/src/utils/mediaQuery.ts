import { useEffect, useState } from "react";

import breakpoints from "./breakpoints.module.scss";

export const NARROW_LAYOUT_QUERY = `(max-width: ${breakpoints.width960})`;

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
