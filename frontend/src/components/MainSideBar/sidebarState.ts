const MAIN_NAV_COLLAPSED_STORAGE_KEY = "main-nav-collapsed";

export function isMainNavCollapsedInStorage(): boolean {
  try {
    return window.localStorage.getItem(MAIN_NAV_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMainNavCollapsed(isCollapsed: boolean): void {
  try {
    window.localStorage.setItem(
      MAIN_NAV_COLLAPSED_STORAGE_KEY,
      isCollapsed ? "1" : "0",
    );
  } catch {
    // The in-memory state remains effective until the page reloads.
  }
}

export function toggleMainNavCollapsed(isCollapsed: boolean): boolean {
  return !isCollapsed;
}
