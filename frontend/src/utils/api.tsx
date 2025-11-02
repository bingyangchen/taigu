import { pushToast } from "../redux/slices/ToastSlice";
import { store } from "../redux/store";
import Env from "./env";
import Nav from "./nav";

export default class Api {
  private static safeMethods = ["get", "head", "options"];

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
      const response = await fetch(`${Env.backendUrl}${endpoint}`, options);
      return await Api.handleResponse(response);
    } catch (error) {
      if (method !== "get") {
        store.dispatch(
          pushToast({
            type: "error",
            text: error instanceof Error ? error.message : "Error when sending request",
          }),
        );
      }
      throw error;
    }
  }

  private static async handleResponse(response: Response): Promise<any> {
    if (response.status === 404) Nav.goTo404Page();
    else if ([401, 403].includes(response.status)) {
      if (response.status === 403) Api.deleteCookie("csrftoken");
      const url = new URL(response.url);
      if (url.pathname !== "/api/account/logout") {
        await Api.sendRequest("account/logout", "get");
      }
      caches.delete(Env.cacheKey);
      if (!Nav.isAtLoginPage) {
        Nav.goToWelcomePage(window.location.pathname + window.location.search);
      }
    } else if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw Error(error?.message || "Unknown error occurred");
    } else return await response.json();
  }
}
