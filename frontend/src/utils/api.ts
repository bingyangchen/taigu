import { openPlanUpsell } from "../redux/slices/PlanUpsellSlice";
import { pushToast } from "../redux/slices/ToastSlice";
import { store } from "../redux/store";
import LocalDatabase from "../storage/localDatabase";
import type { PlanQuotaResource } from "../types";
import {
  AccountCacheError,
  ensureAccountCacheIsolation,
  invalidateAccountCache,
} from "./accountCache";
import { API_CACHE_NAME, API_CACHE_PATHS, LEGACY_API_CACHE_NAMES } from "./cache";
import Env from "./env";
import { requestCloseActiveModal } from "./modal";
import Nav from "./nav";
import { clearReturnUrl } from "./returnUrl";
import {
  acceptCurrentSession,
  ACCOUNT_DATA_CLEARED,
  assertCurrentSession,
  getDocumentSessionVersion,
  getSessionVersion,
  SESSION_CLEANUP_KEY,
  SESSION_VERSION_KEY,
  SessionChangedError,
  withAccountDataLock,
  withSessionLock,
} from "./session";

type ApiErrorPayload = {
  code?: string;
  resource?: PlanQuotaResource;
  message?: string;
};

const CSRF_FAILED_MESSAGE = "無法完成操作，請重新整理後再試一次。";

export class ApiError extends Error {
  public readonly code?: string;
  public readonly resource?: PlanQuotaResource;
  public readonly status?: number;

  public constructor(payload: ApiErrorPayload, status?: number) {
    super(payload.message ?? "Unknown error occurred");
    this.name = "ApiError";
    this.code = payload.code;
    this.resource = payload.resource;
    this.status = status;
  }
}

export default class Api {
  private static safeMethods = ["get", "head", "options"];
  private static refreshRequest: Promise<boolean> | null = null;
  private static cleanupRequest: Promise<void> | null = null;

  public static async clearCache(): Promise<void> {
    if ("caches" in window) {
      await Promise.all([
        caches.delete(API_CACHE_NAME),
        ...LEGACY_API_CACHE_NAMES.map((name) => caches.delete(name)),
      ]);
    }
  }

  public static async clearAccountData({
    preserveReturnUrl = false,
    onlyIfPending = false,
  }: { preserveReturnUrl?: boolean; onlyIfPending?: boolean } = {}): Promise<void> {
    if (Api.cleanupRequest === null) {
      Api.cleanupRequest = withAccountDataLock(async () => {
        const isPending = localStorage.getItem(SESSION_CLEANUP_KEY) !== null;
        if (onlyIfPending && !isPending) return;
        if (!isPending) {
          localStorage.setItem(SESSION_CLEANUP_KEY, "1");
          localStorage.setItem(SESSION_VERSION_KEY, crypto.randomUUID());
        }
        acceptCurrentSession();
        await Api.clearLocalAccountData(preserveReturnUrl);
        localStorage.removeItem(SESSION_CLEANUP_KEY);
      }).finally(() => {
        Api.cleanupRequest = null;
      });
    }
    await Api.cleanupRequest;
  }

  public static clearAccountMemory(preserveReturnUrl = false): void {
    LocalDatabase.invalidateAccount();
    store.dispatch({ type: ACCOUNT_DATA_CLEARED });
    if (!preserveReturnUrl) clearReturnUrl();
  }

  private static async clearLocalAccountData(
    preserveReturnUrl: boolean,
  ): Promise<void> {
    Api.clearAccountMemory(preserveReturnUrl);
    localStorage.removeItem("stock_search_lru_cache");
    localStorage.removeItem("accountId");
    try {
      await invalidateAccountCache();
    } finally {
      await Promise.all([Api.clearCache(), LocalDatabase.clearAll()]);
    }
  }

  public static get hasCsrfToken(): boolean {
    return Api.getCookie("csrftoken") !== null;
  }

  private static getCookie(name: string): string | null {
    const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(name + "=")) {
        return decodeURIComponent(cookie.substring(name.length + 1));
      }
    }
    return null;
  }

  /**
   * Silent failures suppress toasts and upsells, but confirmed login expiry still
   * clears account data and redirects. A disabled 404 redirect throws instead.
   */
  public static async sendRequest(
    endpoint: string,
    method: string,
    requestBody?: URLSearchParams | string,
    {
      silentOnFailure = false,
      redirectOnNotFound = true,
    }: { silentOnFailure?: boolean; redirectOnNotFound?: boolean } = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    method = method.toLowerCase();
    if (method === "post" && requestBody === undefined) {
      throw Error("requestBody is needed in POST request");
    }
    let sessionVersion = getDocumentSessionVersion();
    const sessionEndpoint = endpoint.replace(/\/$/, "");
    const needsLock = [
      "account/change-binding",
      "account/logout",
      "account/google-login",
    ].includes(sessionEndpoint);
    const operation = async () => {
      assertCurrentSession(sessionVersion);
      if (localStorage.getItem(SESSION_CLEANUP_KEY)) {
        await Api.clearAccountData({
          preserveReturnUrl: Nav.isAtLoginPage,
          onlyIfPending: true,
        });
        sessionVersion = getDocumentSessionVersion();
      }
      await ensureAccountCacheIsolation();
      const recovery = { attempted: false };
      let response = await Api.fetchWithCsrf(
        endpoint,
        method,
        requestBody,
        recovery,
        sessionVersion,
      );
      assertCurrentSession(sessionVersion);
      if (response.status === 401 && !Api.isSessionEndpoint(endpoint)) {
        if (await Api.refreshAccessToken(needsLock)) {
          assertCurrentSession(sessionVersion);
          response = await Api.fetchWithCsrf(
            endpoint,
            method,
            requestBody,
            recovery,
            sessionVersion,
          );
        }
      }
      assertCurrentSession(sessionVersion);
      const result = await Api.handleResponse(response, redirectOnNotFound);
      if (result !== undefined) assertCurrentSession(sessionVersion);
      if (sessionEndpoint === "account/me" && result?.id) {
        localStorage.setItem("accountId", result.id);
      }
      if (sessionEndpoint === "account/logout") await Api.clearAccountData();
      if (sessionEndpoint === "account/google-login")
        await Api.clearAccountData({ preserveReturnUrl: true });
      return result;
    };
    try {
      return needsLock ? await withSessionLock(operation) : await operation();
    } catch (error) {
      if (
        (method !== "get" || error instanceof AccountCacheError) &&
        !silentOnFailure &&
        !(error instanceof SessionChangedError)
      ) {
        if (Api.isQuotaExceededError(error)) {
          await requestCloseActiveModal();
          store.dispatch(
            openPlanUpsell({ resource: error.resource, message: error.message }),
          );
        } else {
          store.dispatch(
            pushToast({
              type: "error",
              text:
                error instanceof Error ? error.message : "Error when sending request",
            }),
          );
        }
      }
      throw error;
    }
  }

  private static async fetchWithCsrf(
    endpoint: string,
    method: string,
    requestBody: URLSearchParams | string | undefined,
    recovery: { attempted: boolean },
    sessionVersion: string,
  ): Promise<Response> {
    assertCurrentSession(sessionVersion);
    const headers = new Headers({ Accept: "application/json" });
    if (typeof requestBody === "string") {
      headers.set("Content-Type", "application/json");
    }
    if (!Api.safeMethods.includes(method)) {
      const csrfToken = Api.getCookie("csrftoken");
      if (csrfToken) headers.set("X-CSRFToken", csrfToken);
    }
    const url = new URL(`${Env.backendUrl}${endpoint}`);

    // A cache write started before cleanup may finish after the next login.
    if (
      method === "get" &&
      API_CACHE_PATHS.has(url.pathname.replace(/^\/api\/?/, ""))
    ) {
      url.searchParams.set("_account_session", sessionVersion);
    }
    const response = await fetch(url.href, {
      method,
      headers,
      body: requestBody,
      credentials: "include",
    });
    if (response.status === 403 && !recovery.attempted) {
      const error = await response
        .clone()
        .json()
        .catch(() => null);
      if (error?.code === "CSRF_TOKEN_RECOVERABLE") {
        recovery.attempted = true;
        try {
          const csrfResponse = await fetch(`${Env.backendUrl}account/csrf-token`, {
            credentials: "include",
            cache: "no-store",
          });
          if (!csrfResponse.ok) throw new Error(CSRF_FAILED_MESSAGE);
        } catch {
          throw new ApiError({ message: CSRF_FAILED_MESSAGE }, 403);
        }
        return await Api.fetchWithCsrf(
          endpoint,
          method,
          requestBody,
          recovery,
          sessionVersion,
        );
      }
    }
    return response;
  }

  private static isQuotaExceededError(
    error: unknown,
  ): error is ApiError & { resource: PlanQuotaResource } {
    return (
      error instanceof ApiError && error.code === "QUOTA_EXCEEDED" && !!error.resource
    );
  }

  private static isSessionEndpoint(endpoint: string): boolean {
    return ["account/refresh-token", "account/logout", "account/google-login"].includes(
      endpoint.replace(/\/$/, ""),
    );
  }

  private static async refreshAccessToken(alreadyLocked: boolean): Promise<boolean> {
    if (alreadyLocked) return await Api.sendRefreshRequest();
    if (Api.refreshRequest === null) {
      const version = getSessionVersion();
      Api.refreshRequest = withSessionLock(async () => {
        assertCurrentSession(version);
        return await Api.sendRefreshRequest();
      }).finally(() => {
        Api.refreshRequest = null;
      });
    }
    return await Api.refreshRequest;
  }

  private static async sendRefreshRequest(): Promise<boolean> {
    const version = getDocumentSessionVersion();

    // A previous 401 can predate another tab's refresh or binding cookie update.
    const current = await fetch(`${Env.backendUrl}account/me?check_session=1`, {
      credentials: "include",
      cache: "no-store",
    });
    if (current.ok) return true;
    if (current.status !== 401) {
      throw new ApiError({ message: CSRF_FAILED_MESSAGE }, current.status);
    }
    const response = await Api.fetchWithCsrf(
      "account/refresh-token",
      "post",
      new URLSearchParams(),
      { attempted: false },
      version,
    );
    if (response.status === 401) return false;
    if (!response.ok) {
      throw new ApiError({ message: CSRF_FAILED_MESSAGE }, response.status);
    }
    return true;
  }

  private static async handleResponse(
    response: Response,
    redirectOnNotFound: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    if (response.status === 404 && redirectOnNotFound) Nav.goTo404Page();
    else if (response.status === 401) {
      if (Nav.isAtLoginPage) {
        if (
          localStorage.getItem("accountId") ||
          localStorage.getItem("stock_search_lru_cache") ||
          (await LocalDatabase.hasAccountData())
        ) {
          await Api.clearAccountData();
        }
        return undefined;
      }
      const from = window.location.pathname + window.location.search;
      await Api.clearAccountData();
      Nav.goToWelcomePage(from);
      throw new SessionChangedError("Account session ended");
    } else if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiError(
        response.status === 403
          ? { ...error, message: CSRF_FAILED_MESSAGE }
          : (error ?? {}),
        response.status,
      );
    } else return await response.json();
  }
}
