import { beforeEach, expect, test, vi } from "vitest";

import Api from "./api";
import Nav from "./nav";
import { SessionChangedError } from "./session";

vi.mock("../storage/localDatabase");
vi.mock("./session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./session")>()),
  withAccountDataLock: <T,>(operation: () => Promise<T>) => operation(),
  withSessionLock: <T,>(operation: () => Promise<T>) => operation(),
}));

beforeEach(() => {
  Api.connectStore(vi.fn());
  window.history.replaceState({}, "", "/records?sid=2330");
  localStorage.setItem("accountId", "1");

  // The access token and the refresh token have both expired.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 401 })),
  );
  vi.spyOn(Nav, "goToWelcomePage").mockImplementation(() => {});
});

test("clears the account and resolves without leaving the page when the login redirect is disabled", async () => {
  // The login check of the pages that need login redirects through the router,
  // so the page is never drawn before the welcome page shows.
  await expect(
    Api.sendRequest("account/me", "get", undefined, { redirectOnUnauthorized: false }),
  ).resolves.toBeUndefined();

  expect(Nav.goToWelcomePage).not.toHaveBeenCalled();
  expect(localStorage.getItem("accountId")).toBeNull();
});

test("clears the account and sends the user to the welcome page by default", async () => {
  await expect(Api.sendRequest("account/me", "get")).rejects.toBeInstanceOf(
    SessionChangedError,
  );

  expect(Nav.goToWelcomePage).toHaveBeenCalledWith("/records?sid=2330");
  expect(localStorage.getItem("accountId")).toBeNull();
});
