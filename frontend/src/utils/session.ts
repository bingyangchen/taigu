export const SESSION_VERSION_KEY = "accountSessionVersion";
export const SESSION_CLEANUP_KEY = "accountSessionCleanupPending";
export const ACCOUNT_DATA_CLEARED = "account/dataCleared";

export class SessionChangedError extends Error {}

let documentSessionVersion = getSessionVersion();

export function getDocumentSessionVersion(): string {
  return documentSessionVersion;
}

export function acceptCurrentSession(): void {
  documentSessionVersion = getSessionVersion();
}

export function getSessionVersion(): string {
  return localStorage.getItem(SESSION_VERSION_KEY) ?? "";
}

export function assertCurrentSession(version: string): void {
  if (getSessionVersion() !== version) {
    throw new SessionChangedError("Account session changed");
  }
}

async function withLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks) {
    throw new Error("無法完成操作，請重新整理後再試一次。");
  }
  return await navigator.locks.request(name, operation);
}

export async function withSessionLock<T>(operation: () => Promise<T>): Promise<T> {
  return await withLock("taigu-account-session", operation);
}

export async function withAccountDataLock<T>(operation: () => Promise<T>): Promise<T> {
  return await withLock("taigu-account-data-cleanup", operation);
}
