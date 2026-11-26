import { useLayoutEffect, useState } from "react";

import Api from "./api";

/**
 * Sends the browser to Google to sign in, and reports whether it is waiting for the
 * authorization URL. Google sends the browser back to `redirectPath` with a `code`.
 */
export function useGoogleAuthorization(redirectPath: string) {
  const [isRequestingAuthorizationUrl, setIsRequestingAuthorizationUrl] =
    useState(false);

  useLayoutEffect(() => {
    const handlePageShow = (event: PageTransitionEvent): void => {
      // Going back from Google may restore the page as it was left, still waiting.
      if (event.persisted) setIsRequestingAuthorizationUrl(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const startGoogleAuthorization = async (): Promise<void> => {
    setIsRequestingAuthorizationUrl(true);
    let response;
    try {
      response = await Api.sendRequest(
        `account/authorization-url?redirect_uri=${window.location.origin}${redirectPath}`,
        "get",
      );
    } catch (error) {
      setIsRequestingAuthorizationUrl(false);
      throw error;
    }
    window.location = response.authorization_url;
  };

  return { isRequestingAuthorizationUrl, startGoogleAuthorization };
}

/** Builds the body that hands the `code` Google sent back to the backend. */
export function makeGoogleCodeRequestBody(
  searchParams: URLSearchParams,
  redirectPath: string,
): URLSearchParams {
  const requestBody = new URLSearchParams();
  requestBody.append("code", searchParams.get("code") as string);
  requestBody.append("state", searchParams.get("state") ?? "");
  requestBody.append("redirect_uri", `${window.location.origin}${redirectPath}`);
  return requestBody;
}
