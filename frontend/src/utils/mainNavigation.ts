import type { Location, NavigationType } from "react-router-dom";

export const mainTabNavigationState = { restoreMainTab: true } as const;

const mainTabPaths = new Set(["/", "/market", "/records", "/plans", "/settings"]);

export function getMainTabPath(
  location: Pick<Location, "pathname" | "search" | "hash">,
): string | undefined {
  const { pathname, search, hash } = location;
  if (search || (hash && !["##", "#@", "#!"].includes(hash))) return undefined;
  const tabPath = pathname.replace(/\/+$/u, "") || "/";
  return mainTabPaths.has(tabPath) ? tabPath : undefined;
}

export function isSameUrlHistoryTraversal(
  previous: Location,
  current: Location,
  navigationType: NavigationType,
): boolean {
  return (
    navigationType === "POP" &&
    previous.key !== current.key &&
    previous.pathname === current.pathname &&
    previous.search === current.search &&
    !previous.hash &&
    !current.hash
  );
}
