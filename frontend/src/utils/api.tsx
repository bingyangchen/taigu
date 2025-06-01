import { pushToast } from "../redux/slices/ToastSlice";
import { store } from "../redux/store";
import Env from "./env";
import Nav from "./nav";

export default class Api {
  public static async sendRequest(
    endpoint: string,
    method: string,
    requestBody?: URLSearchParams | string
  ): Promise<any> {
    if (method === "post" && requestBody === undefined) {
      throw Error("requestBody is needed in POST request");
    }

    const header = new Headers();
    header.append("Accept", "application/json");
    if (typeof requestBody === "string") {
      header.append("Content-Type", "application/json");
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
          })
        );
      }
      throw error;
    }
  }

  private static async handleResponse(response: Response): Promise<any> {
    if (response.status === 404) Nav.goTo404Page();
    else if (response.status === 401) {
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
