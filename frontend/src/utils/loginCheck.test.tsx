import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import {
  createMemoryRouter,
  Outlet,
  type RouteObject,
  RouterProvider,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";

import LoginCheckScreen, {
  LoginCheckLayout,
} from "../components/LoadingScreen/LoginCheckScreen";
import OfflineNotice from "../components/OfflineNotice/OfflineNotice";
import { store } from "../redux/store";
import myRouter from "../router";
import { mockNetworkStatus } from "../testing/network";
import Api, { ApiError, ConnectionError } from "./api";
import { requireLogin } from "./loginCheck";
import { consumeReturnUrl } from "./returnUrl";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  default: { sendRequest: vi.fn() },
}));

const sendRequest = Api.sendRequest as Mock;
const ACCOUNT = { id: "1", email: "a@example.com", username: "A" };

let router: ReturnType<typeof createMemoryRouter> | null = null;
let network: ReturnType<typeof mockNetworkStatus>;

function failToConnect(): Promise<never> {
  return Promise.reject(new ConnectionError(new TypeError("Failed to fetch")));
}

async function advance(milliseconds: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(milliseconds));
}

async function flush(): Promise<void> {
  await advance(0);
}

function renderApp(initialPath: string): {
  router: ReturnType<typeof createMemoryRouter>;
  renderedSettings: Mock;
} {
  const renderedSettings = vi.fn(() => <p>設定頁</p>);
  const Settings = () => renderedSettings();
  router = createMemoryRouter(
    [
      {
        element: <LoginCheckLayout />,
        children: [
          { path: "/welcome", element: <p>歡迎頁</p> },
          {
            loader: requireLogin,
            shouldRevalidate: () => false,
            HydrateFallback: LoginCheckScreen,
            element: <Outlet />,
            children: [
              {
                path: "/",
                element: (
                  <>
                    <p>儀表板</p>
                    <OfflineNotice narrowPlacement="aboveNavigationBar" />
                  </>
                ),
              },
              { path: "/settings", element: <Settings /> },
              { path: "/records", element: <p>歷史紀錄頁</p> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return { router, renderedSettings };
}

const retryButton = (): HTMLElement => screen.getByRole("button", { name: "重試" });

function expectSpinner(): void {
  expect(document.querySelector('[class*="loading_spinner"]')).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "重試" })).not.toBeInTheDocument();
  expect(screen.queryByText("無法連上 Taigu")).not.toBeInTheDocument();
  expect(screen.queryByText("沒有網路連線")).not.toBeInTheDocument();
}

function expectUnreachable(): void {
  expect(screen.getByText("無法連上 Taigu")).toBeInTheDocument();
  expect(retryButton()).toBeInTheDocument();
}

function expectOffline(): void {
  expect(screen.getByText("沒有網路連線")).toBeInTheDocument();
  expect(screen.queryByText("無法連上 Taigu")).not.toBeInTheDocument();
  expect(retryButton()).toBeInTheDocument();
}

function getPaths(routes: RouteObject[] | undefined): string[] {
  return (routes ?? []).flatMap((route) => [
    ...(route.path === undefined ? [] : [route.path]),
    ...getPaths(route.children),
  ]);
}

beforeEach(() => {
  vi.useFakeTimers();
  network = mockNetworkStatus();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  network.setOnline(true);
  sessionStorage.clear();
  sendRequest.mockReset();
});

afterEach(() => {
  router?.dispose();
  router = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("[ACCT-R3.1] sends a logged-out user to the welcome page without drawing the page", async () => {
  // The backend's 401 resolves `undefined` once the login redirect is disabled.
  sendRequest.mockResolvedValue(undefined);

  const { router, renderedSettings } = renderApp("/settings?tab=plan");
  await flush();

  expect(screen.getByText("歡迎頁")).toBeInTheDocument();
  expect(renderedSettings).not.toHaveBeenCalled();
  expect(sendRequest).toHaveBeenCalledWith("account/me", "get", undefined, {
    redirectOnUnauthorized: false,
    silentOnFailure: true,
  });
  expect(consumeReturnUrl()).toBe("/settings?tab=plan");

  // A pushed entry would make the back button reopen the page and land on the
  // welcome page again, so the user could not go back past it.
  expect(router.state.historyAction).toBe("REPLACE");
});

test("shows the page once the check reads the account", async () => {
  sendRequest.mockResolvedValue(ACCOUNT);

  renderApp("/settings");
  await flush();

  expect(screen.getByText("設定頁")).toBeInTheDocument();
});

test("does not check the login again when moving between pages that need login", async () => {
  sendRequest.mockResolvedValue(ACCOUNT);
  const { router } = renderApp("/settings");
  await flush();

  await act(() => router.navigate("/records"));

  expect(screen.getByText("歷史紀錄頁")).toBeInTheDocument();
  expect(sendRequest).toHaveBeenCalledTimes(1);
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

describe("before the page is drawn", () => {
  test("[ACCT-R18.1] shows that there is no network when opened offline", async () => {
    network.setOnline(false);
    sendRequest.mockResolvedValue(ACCOUNT);

    renderApp("/");
    await flush();

    expectOffline();
    expect(screen.queryByText("儀表板")).not.toBeInTheDocument();
  });

  test("[ACCT-R18.2] continues once the network is back", async () => {
    network.setOnline(false);
    let respond: (account: typeof ACCOUNT) => void = () => {};
    sendRequest.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    renderApp("/");
    await flush();

    network.setOnline(true);
    await flush();
    expectSpinner();

    await act(async () => respond(ACCOUNT));
    expect(screen.getByText("儀表板")).toBeInTheDocument();
  });

  test("[ACCT-R18.3] tries for 10 seconds when the backend cannot be reached", async () => {
    sendRequest.mockImplementation(failToConnect);

    renderApp("/records");
    await advance(9999);
    expectSpinner();

    await advance(1);
    expectUnreachable();
    expect(screen.queryByText("歷史紀錄頁")).not.toBeInTheDocument();
  });

  test("[ACCT-R18.4] draws the page after a retry that reads the account", async () => {
    sendRequest.mockImplementation(failToConnect);
    renderApp("/records");
    await advance(10_000);

    sendRequest.mockResolvedValue(ACCOUNT);
    fireEvent.click(retryButton());
    await flush();

    expect(screen.getByText("歷史紀錄頁")).toBeInTheDocument();
  });

  test("[ACCT-R18.5] shows the failure without waiting when the backend returns an error", async () => {
    sendRequest.mockRejectedValue(new ApiError({}, 500));

    renderApp("/");
    await flush();

    expectUnreachable();
    expect(screen.queryByText("儀表板")).not.toBeInTheDocument();
  });

  test("[ACCT-R18.6] draws the page when a slow response arrives after 10 seconds", async () => {
    let respond: (account: typeof ACCOUNT) => void = () => {};
    sendRequest.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    renderApp("/");

    await advance(10_000);
    expectUnreachable();

    await advance(5000);
    await act(async () => respond(ACCOUNT));
    expect(screen.getByText("儀表板")).toBeInTheDocument();
  });

  test("[ACCT-R18.7] keeps trying while the network comes back", async () => {
    network.setOnline(false);
    sendRequest.mockImplementation(failToConnect);
    renderApp("/");
    await flush();

    network.setOnline(true);
    for (let elapsed = 0; elapsed < 3500; elapsed += 500) {
      await advance(500);
      expectSpinner();
    }
    sendRequest.mockResolvedValue(ACCOUNT);
    await advance(1000);

    expect(screen.getByText("儀表板")).toBeInTheDocument();
  });

  test("[ACCT-R18.8] blocks another retry for 10 seconds while the retry waits", async () => {
    sendRequest.mockImplementation(failToConnect);
    renderApp("/records");
    await advance(10_000);

    sendRequest.mockReturnValue(new Promise(() => {}));
    fireEvent.click(retryButton());
    await advance(9999);
    expectUnreachable();
    expect(retryButton()).toHaveAttribute("aria-busy", "true");

    await advance(1);
    expect(retryButton()).not.toHaveAttribute("aria-busy");
  });

  test("[ACCT-R18.9] stays on the offline screen when a retry fails offline", async () => {
    network.setOnline(false);
    sendRequest.mockImplementation(failToConnect);
    renderApp("/");
    await flush();

    fireEvent.click(retryButton());
    await flush();

    expectOffline();
  });

  test("[ACCT-R18.10] draws the page after a retry while the browser misreports no network", async () => {
    network.setOnline(false);
    sendRequest.mockResolvedValue(ACCOUNT);
    renderApp("/");
    await flush();
    expectOffline();

    fireEvent.click(retryButton());
    await flush();
    expect(screen.getByText("儀表板")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await advance(3000);
    expect(screen.getByRole("status")).toHaveTextContent("沒有網路連線");
  });

  test("[ACCT-R18.11] continues the check after the network drops while reading", async () => {
    let respond: (account: typeof ACCOUNT) => void = () => {};
    const response = new Promise((resolve) => (respond = resolve));
    sendRequest.mockReturnValue(response);
    renderApp("/");

    await advance(8000);
    network.setOnline(false);
    expectOffline();

    await advance(12_000);
    network.setOnline(true);
    await flush();
    expectSpinner();
    await advance(3000);
    expectSpinner();

    await act(async () => respond(ACCOUNT));
    expect(screen.getByText("儀表板")).toBeInTheDocument();
  });

  test("[ACCT-R18.12] shows that there is no network when coming back from the welcome page", async () => {
    sendRequest.mockResolvedValue(ACCOUNT);
    const { router, renderedSettings } = renderApp("/settings");
    await flush();
    await act(() => router.navigate("/welcome"));
    renderedSettings.mockClear();
    network.setOnline(false);

    await act(async () => {
      void router.navigate(-1);
    });
    await flush();

    expectOffline();
    expect(renderedSettings).not.toHaveBeenCalled();
  });

  test("[ACCT-R18.13] tries for 10 seconds when coming back from the welcome page", async () => {
    sendRequest.mockResolvedValue(ACCOUNT);
    const { router } = renderApp("/settings");
    await flush();
    await act(() => router.navigate("/welcome"));
    sendRequest.mockImplementation(failToConnect);

    await act(async () => {
      void router.navigate(-1);
    });
    await advance(9999);
    expectSpinner();

    await advance(1);
    expectUnreachable();
  });

  test("[ACCT-R18.17] lets the user retry at once when a retry fails to connect", async () => {
    sendRequest.mockImplementation(failToConnect);
    renderApp("/records");
    await advance(10_000);
    sendRequest.mockClear();

    fireEvent.click(retryButton());
    await flush();

    expectUnreachable();
    expect(retryButton()).not.toHaveAttribute("aria-busy");
    await advance(5000);
    expect(sendRequest).toHaveBeenCalledTimes(1);
  });
});
