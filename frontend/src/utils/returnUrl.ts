import Env from "./env";

const RETURN_URL_KEY = "pathAndQueryString";
const RETURN_URL_MAX_AGE = 30 * 60 * 1000;

// Old releases shared an unbounded return URL between tabs.
localStorage.removeItem(RETURN_URL_KEY);

export function clearReturnUrl(): void {
  sessionStorage.removeItem(RETURN_URL_KEY);
  localStorage.removeItem(RETURN_URL_KEY);
}

export function rememberReturnUrl(path: string): void {
  sessionStorage.setItem(RETURN_URL_KEY, JSON.stringify({ path, savedAt: Date.now() }));
}

export function consumeReturnUrl(): string {
  const saved = sessionStorage.getItem(RETURN_URL_KEY);
  clearReturnUrl();
  if (!saved) return Env.frontendRootPath;
  try {
    const { path, savedAt } = JSON.parse(saved);
    if (
      typeof path === "string" &&
      path.startsWith("/") &&
      !path.startsWith("//") &&
      new URL(path, location.origin).origin === location.origin &&
      typeof savedAt === "number" &&
      Date.now() >= savedAt &&
      Date.now() - savedAt < RETURN_URL_MAX_AGE
    ) {
      return path;
    }
  } catch {
    return Env.frontendRootPath;
  }
  return Env.frontendRootPath;
}
