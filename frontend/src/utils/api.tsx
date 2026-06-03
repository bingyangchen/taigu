import { openPlanUpsell } from "../redux/slices/PlanUpsellSlice";
import { pushToast } from "../redux/slices/ToastSlice";
import { store } from "../redux/store";
import type { PlanQuotaResource } from "../types";
import Env from "./env";
import { requestCloseActiveModal } from "./modalEvents";
import Nav from "./nav";

type ApiErrorPayload = {
  code?: string;
  resource?: PlanQuotaResource;
  message?: string;
};

export class ApiError extends Error {
  public readonly code?: string;
  public readonly resource?: PlanQuotaResource;

  public constructor(payload: ApiErrorPayload) {
    super(payload.message ?? "Unknown error occurred");
    this.name = "ApiError";
    this.code = payload.code;
    this.resource = payload.resource;
  }
}

export default class Api {
  private static safeMethods = ["get", "head", "options"];
  private static refreshRequest: Promise<boolean> | null = null;

  public static async clearCache(): Promise<void> {
    if ("caches" in window) {
      await caches.delete(Env.cacheKey);
    }
  }

  private static getCookie(name: string): string | null {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(name + "=")) {
        return decodeURIComponent(cookie.substring(name.length + 1));
      }
    }
    return null;
  }

  private static deleteCookie(name: string): void {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.taigu.tw`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  public static async sendRequest(
    endpoint: string,
    method: string,
    requestBody?: URLSearchParams | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    method = method.toLowerCase();
    if (method === "post" && requestBody === undefined) {
      throw Error("requestBody is needed in POST request");
    }

    const header = new Headers();
    header.append("Accept", "application/json");
    if (typeof requestBody === "string") {
      header.append("Content-Type", "application/json");
    }
    if (!Api.safeMethods.includes(method)) {
      const csrfToken = Api.getCookie("csrftoken") ?? "";
      if (csrfToken) header.append("X-CSRFToken", csrfToken);
    }

    const options: RequestInit = {
      method: method,
      headers: header,
      body: requestBody,
      credentials: "include",
    };
    try {
      let response = await fetch(`${Env.backendUrl}${endpoint}`, options);
      if (response.status === 401 && !Api.isSessionEndpoint(endpoint)) {
        if (await Api.refreshAccessToken()) {
          response = await fetch(`${Env.backendUrl}${endpoint}`, options);
        }
      }
      return await Api.handleResponse(response);
    } catch (error) {
      if (method !== "get") {
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

  private static isQuotaExceededError(
    error: unknown,
  ): error is ApiError & { resource: PlanQuotaResource } {
    return (
      error instanceof ApiError && error.code === "QUOTA_EXCEEDED" && !!error.resource
    );
  }

  private static isSessionEndpoint(endpoint: string): boolean {
    return ["account/refresh-token", "account/logout"].includes(
      endpoint.replace(/\/$/, ""),
    );
  }

  private static async refreshAccessToken(): Promise<boolean> {
    if (Api.refreshRequest === null) {
      Api.refreshRequest = Api.sendRefreshRequest().finally(() => {
        Api.refreshRequest = null;
      });
    }
    return await Api.refreshRequest;
  }

  private static async sendRefreshRequest(): Promise<boolean> {
    const header = new Headers({ Accept: "application/json" });
    const csrfToken = Api.getCookie("csrftoken") ?? "";
    if (csrfToken) header.append("X-CSRFToken", csrfToken);
    const response = await fetch(`${Env.backendUrl}account/refresh-token`, {
      method: "post",
      headers: header,
      body: new URLSearchParams(),
      credentials: "include",
    });
    if (response.status === 403) Api.deleteCookie("csrftoken");
    return response.ok;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async handleResponse(response: Response): Promise<any> {
    if (response.status === 404) Nav.goTo404Page();
    else if ([401, 403].includes(response.status)) {
      if (response.status === 403) Api.deleteCookie("csrftoken");
      const url = new URL(response.url);
      if (url.pathname !== "/api/account/logout") {
        await Api.sendRequest("account/logout", "post", new URLSearchParams());
      }
      await Api.clearCache();
      if (!Nav.isAtLoginPage) {
        Nav.goToWelcomePage(window.location.pathname + window.location.search);
      }
    } else if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiError(error ?? {});
    } else return await response.json();
  }
}
