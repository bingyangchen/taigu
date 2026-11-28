import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import Overview from "../../pages/Settings/Overview/Overview";
import { store } from "../../redux/store";
import { mockViewport, PHONE_PORTRAIT } from "../../testing/viewport";
import HeaderForSettings from "./HeaderForSettings";

vi.mock("../../utils/api", () => ({
  ApiError: class extends Error {},
  default: { sendRequest: vi.fn() },
}));

const user = userEvent.setup();

function renderSettings(): ReturnType<typeof createBrowserRouter> {
  const router = createBrowserRouter([
    { path: "/", element: <p>儀表板</p> },
    { path: "/settings", element: <Overview /> },
    { path: "/settings/data-controls", element: <HeaderForSettings /> },
  ]);
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return router;
}

/** A settings row takes clicks on the layer in front of its content. */
function getRowClickLayer(text: string): Element {
  const layer = screen.getByText(text).parentElement?.previousElementSibling;
  if (!layer) throw new Error(`The row of ${text} has no click layer`);
  return layer;
}

async function goBackInBrowser(): Promise<void> {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) =>
      window.addEventListener("popstate", resolve, { once: true }),
    );
  });
}

beforeEach(() => {
  mockViewport(PHONE_PORTRAIT);
  window.history.replaceState(null, "", "/");
});

test("Back on the settings page leaves it after returning from a subpage", async () => {
  // The user went to settings from the dashboard, so Back on the settings page has
  // to return there rather than show the settings page again.
  const router = renderSettings();
  await act(() => router.navigate("/settings"));
  await user.click(getRowClickLayer("資料控制"));

  await user.click(await screen.findByRole("button", { name: "上一頁" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/settings"));

  await goBackInBrowser();
  expect(router.state.location.pathname).toBe("/");
});

test("a subpage opened directly returns to the settings page in its place", async () => {
  window.history.replaceState(null, "", "/settings/data-controls");
  const router = renderSettings();
  const historyLength = window.history.length;

  await user.click(screen.getByRole("button", { name: "上一頁" }));

  expect(router.state.location.pathname).toBe("/settings");
  expect(window.history.length).toBe(historyLength);
});
