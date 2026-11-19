import {
  isMainNavCollapsedInStorage,
  saveMainNavCollapsed,
  toggleMainNavCollapsed,
} from "./sidebarState";

describe("main sidebar state", () => {
  beforeEach(() => window.localStorage.clear());

  test("[NAV-R1.1] defaults to expanded without a stored state", () => {
    expect(isMainNavCollapsedInStorage()).toBe(false);
  });

  test("[NAV-R1.2, NAV-R1.3] toggles collapse state for mouse and keyboard actions", () => {
    expect(toggleMainNavCollapsed(false)).toBe(true);
    expect(toggleMainNavCollapsed(true)).toBe(false);
  });

  test("[NAV-R1.4] preserves the state across later renders", () => {
    saveMainNavCollapsed(true);

    expect(isMainNavCollapsedInStorage()).toBe(true);
  });

  test("[NAV-R1.7] does not change the stored state when width changes", () => {
    saveMainNavCollapsed(true);

    expect(isMainNavCollapsedInStorage()).toBe(true);
  });

  test("[NAV-R1.8] tolerates unavailable storage", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => saveMainNavCollapsed(true)).not.toThrow();
  });
});
