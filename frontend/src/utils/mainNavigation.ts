import type { Location, NavigationType } from "react-router-dom";

import Env from "./env";

export const mainTabNavigationState = { restoreMainTab: true } as const;

const mainTabPaths = new Set(["/", "/market", "/records", "/plans", "/settings"]);

const dashboardSubpagePaths = [
  `${Env.frontendRootPath}handling-fee`,
  `${Env.frontendRootPath}earning-analysis`,
  `${Env.frontendRootPath}market-index`,
];

/** Whether the navigation highlights the tab of `tabPath` while `pathname` is open. */
export function isMainTabActive(pathname: string, tabPath: string): boolean {
  if (tabPath === Env.frontendRootPath) {
    return pathname === tabPath || dashboardSubpagePaths.includes(pathname);
  }
  return pathname === tabPath || pathname.startsWith(`${tabPath}/`);
}

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
