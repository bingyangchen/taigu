import { configureStore } from "@reduxjs/toolkit";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import {
  MemoryRouter,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { expect, test, vi } from "vitest";

import toastReducer from "../../../redux/slices/ToastSlice";
import { IssueReportEditor } from "./IssueReport";

const user = userEvent.setup();

vi.mock("../../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));

test("[ISSUE-R6.2] asks before Escape closes a report with content", async () => {
  const hideModal = vi.fn();
  render(
    <Provider store={configureStore({ reducer: { toast: toastReducer } })}>
      <MemoryRouter>
        <IssueReportEditor hideModal={hideModal} />
      </MemoryRouter>
    </Provider>,
  );
  await user.type(screen.getByRole("textbox"), "畫面一直轉圈");

  await user.keyboard("{Escape}");

  const confirmation = screen.getByRole("dialog", { name: "捨棄變更？" });
  await user.click(within(confirmation).getByRole("button", { name: "繼續編輯" }));

  expect(screen.queryByRole("dialog", { name: "捨棄變更？" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "問題回報" })).toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("畫面一直轉圈");
  expect(hideModal).not.toHaveBeenCalled();
});

let navigate: NavigateFunction = () => {};
let currentPath = "";

function RouterCapture(): null {
  navigate = useNavigate();
  currentPath = useLocation().pathname;
  return null;
}

test("[ISSUE-R6.3] asks before Back closes a report with content", async () => {
  const hideModal = vi.fn();
  render(
    <Provider store={configureStore({ reducer: { toast: toastReducer } })}>
      <MemoryRouter initialEntries={["/settings"]}>
        <RouterCapture />
        <IssueReportEditor hideModal={hideModal} />
      </MemoryRouter>
    </Provider>,
  );
  await user.type(screen.getByRole("textbox"), "畫面一直轉圈");

  for (let attempt = 0; attempt < 2; attempt++) {
    act(() => navigate(-1));
    const confirmation = await screen.findByRole("dialog", { name: "捨棄變更？" });
    await user.click(within(confirmation).getByRole("button", { name: "繼續編輯" }));

    expect(
      screen.queryByRole("dialog", { name: "捨棄變更？" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "問題回報" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("畫面一直轉圈");
  }
  expect(currentPath).toBe("/settings");
  expect(hideModal).not.toHaveBeenCalled();
});
