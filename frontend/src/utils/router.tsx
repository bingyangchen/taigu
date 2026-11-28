import type { Location, NavigateFunction } from "react-router-dom";

import Env from "./env";

export const settingsPagePath = "settings";
export const adminPagePath = "admin";

/** The state the settings page gives the subpages it opens. */
export const settingsSubpageNavigationState = { fromSettings: true } as const;

type RouterHooks = { location: Location; navigate: NavigateFunction };

export function navigateBack(
  { location, navigate }: RouterHooks,
  fallbackPath: string,
): void {
  const index = window.history.state?.idx;
  // Replacing a deep link creates a key but keeps the router at its initial index.
  if (location.key === "default" || !Number.isInteger(index) || index <= 0) {
    navigate(fallbackPath, { replace: true });
    return;
  }
  navigate(-1);
}

/**
 * Leaves a settings subpage for the settings page. A subpage the settings page
 * opened goes back to that history entry, because replacing the subpage with a new
 * settings entry would leave two in a row, and Back on the settings page would land
 * on the same page.
 */
export function returnToSettings({ location, navigate }: RouterHooks): void {
  const settingsPath = `${Env.frontendRootPath}${settingsPagePath}`;
  if (location.state?.fromSettings === true) {
    navigateBack({ location, navigate }, settingsPath);
  } else {
    navigate(settingsPath, { replace: true });
  }
}
