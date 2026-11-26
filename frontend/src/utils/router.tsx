import type { Location, NavigateFunction } from "react-router-dom";

export const settingsPagePath = "settings";
export const adminPagePath = "admin";

export function navigateBack(
  { location, navigate }: { location: Location; navigate: NavigateFunction },
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
