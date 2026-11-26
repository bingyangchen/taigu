import { act, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import {
  createMemoryRouter,
  Outlet,
  type RouteObject,
  RouterProvider,
} from "react-router-dom";
import { beforeEach, expect, type Mock, test, vi } from "vitest";

import { store } from "../redux/store";
import myRouter from "../router";
import Api from "./api";
import { requireLogin } from "./loginCheck";
import { consumeReturnUrl } from "./returnUrl";

vi.mock("./api", () => ({
  ApiError: class extends Error {},
  default: { sendRequest: vi.fn() },
}));

const sendRequest = Api.sendRequest as Mock;

function renderApp(): {
  router: ReturnType<typeof createMemoryRouter>;
  renderedSettings: Mock;
} {
  const renderedSettings = vi.fn(() => <p>設定頁</p>);
  const Settings = () => renderedSettings();
  const router = createMemoryRouter(
    [
      { path: "/welcome", element: <p>歡迎頁</p> },
      {
        loader: requireLogin,
        shouldRevalidate: () => false,
        HydrateFallback: () => <p>載入中</p>,
        element: <Outlet />,
        children: [
          { path: "/settings", element: <Settings /> },
          { path: "/records", element: <p>歷史紀錄頁</p> },
        ],
      },
    ],
    { initialEntries: ["/settings?tab=plan"] },
  );
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return { router, renderedSettings };
}

function getPaths(routes: RouteObject[] | undefined): string[] {
  return (routes ?? []).flatMap((route) => [
    ...(route.path === undefined ? [] : [route.path]),
    ...getPaths(route.children),
  ]);
}

beforeEach(() => {
  sessionStorage.clear();
});

test("[ACCT-R3.1] sends a logged-out user to the welcome page without drawing the page", async () => {
  // The backend's 401 resolves `undefined` once the login redirect is disabled.
  sendRequest.mockResolvedValue(undefined);

  const { router, renderedSettings } = renderApp();

  expect(screen.getByText("載入中")).toBeInTheDocument();
  expect(await screen.findByText("歡迎頁")).toBeInTheDocument();
  expect(renderedSettings).not.toHaveBeenCalled();
  expect(sendRequest).toHaveBeenCalledWith("account/me", "get", undefined, {
    redirectOnUnauthorized: false,
  });
  expect(consumeReturnUrl()).toBe("/settings?tab=plan");

  // A pushed entry would make the back button reopen the page and land on the
  // welcome page again, so the user could not go back past it.
  expect(router.state.historyAction).toBe("REPLACE");
});

test("shows the page once the check reads the account", async () => {
  sendRequest.mockResolvedValue({ id: "1", email: "a@example.com", username: "A" });

  renderApp();

  expect(await screen.findByText("設定頁")).toBeInTheDocument();
});

test("does not check the login again when moving between pages that need login", async () => {
  sendRequest.mockResolvedValue({ id: "1", email: "a@example.com", username: "A" });
  const { router } = renderApp();
  await screen.findByText("設定頁");

  await act(() => router.navigate("/records"));

  expect(screen.getByText("歷史紀錄頁")).toBeInTheDocument();
  expect(sendRequest).toHaveBeenCalledTimes(1);
});

test("opens the page when the check cannot reach the backend", async () => {
  // A failed connection does not confirm a logout (ACCT-R5), so the page reads the
  // account again itself.
  sendRequest.mockRejectedValue(new TypeError("Failed to fetch"));

  renderApp();

  expect(await screen.findByText("設定頁")).toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
});

test("puts every page that needs login under the login check", () => {
  const root = myRouter.routes[0];
  const checked = root.children?.find((route) => route.loader === requireLogin);
  const unchecked = root.children?.filter((route) => route !== checked);

  expect(getPaths(checked?.children)).toEqual(
    expect.arrayContaining(["settings", "", "records", "market", "plans", "admin/*"]),
  );
  expect(getPaths(unchecked)).toEqual([
    "welcome",
    "login",
    "privacy-policy",
    "terms-of-service",
    "*",
  ]);
});
