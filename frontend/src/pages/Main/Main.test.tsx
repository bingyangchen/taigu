import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, expect, test, vi } from "vitest";

import imgPersonFill from "../../assets/person-fill.svg";
import { store } from "../../redux/store";
import {
  DESKTOP,
  mockViewport,
  PHONE_PORTRAIT,
  type Viewport,
} from "../../testing/viewport";
import Main from "./Main";

const user = userEvent.setup();

// The account never loads, so the page stays on its shell.
vi.mock("../../utils/api", () => ({
  default: { sendRequest: vi.fn(() => new Promise(() => {})) },
}));
vi.mock("../../storage/localDatabase");

beforeAll(() => {
  const observer = class {
    public observe(): void {}
    public unobserve(): void {}
    public disconnect(): void {}
  };
  Object.assign(window, { IntersectionObserver: observer, ResizeObserver: observer });
  const toastRoot = document.createElement("div");
  toastRoot.id = "toast-root";
  document.body.append(toastRoot);
});

beforeEach(() => window.localStorage.clear());

function renderMain(viewport: Viewport) {
  const viewportControl = mockViewport(viewport);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Main />}>
            <Route index element={<div>儀表板內容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return {
    resize: (next: Partial<Viewport>) => act(() => viewportControl.resize(next)),
  };
}

// The bottom navigation bar is the only navigation with a link to the account.
const bottomNavigationBar = () => screen.queryByRole("link", { name: "帳號" });
const sidebarSearch = () => screen.queryByRole("button", { name: "搜尋" });
const collapseButton = () => screen.queryByRole("button", { name: /側邊欄/u });

// In the icon rail a tab's name is only its accessible name, not its visible text.
function expectSidebarShowsIconsOnly(iconsOnly: boolean): void {
  const marketTab = screen.getByRole("link", { name: "市場" });
  if (iconsOnly) expect(marketTab).toHaveAttribute("aria-label", "市場");
  else expect(marketTab).not.toHaveAttribute("aria-label");
}

test("[NAV-R2.1] shows the bottom navigation bar on a phone held upright", () => {
  renderMain(PHONE_PORTRAIT);

  expect(bottomNavigationBar()).toBeInTheDocument();
  expect(sidebarSearch()).not.toBeInTheDocument();
});

test("[NAV-R2.2] shows the icon rail on a tablet held upright", () => {
  renderMain({ width: 768, height: 1024, canHover: false });

  expect(sidebarSearch()).toBeInTheDocument();
  expectSidebarShowsIconsOnly(true);
  expect(collapseButton()).not.toBeInTheDocument();
  expect(bottomNavigationBar()).not.toBeInTheDocument();
});

test("[NAV-R2.3] shows the bottom navigation bar on a phone held sideways", () => {
  renderMain({ width: 844, height: 390, canHover: false });

  expect(bottomNavigationBar()).toBeInTheDocument();
  expect(sidebarSearch()).not.toBeInTheDocument();
});

test("[NAV-R2.4] switches the navigation where the width crosses 600px", () => {
  const { resize } = renderMain(DESKTOP);

  resize({ width: 599 });
  expect(bottomNavigationBar()).toBeInTheDocument();
  expect(sidebarSearch()).not.toBeInTheDocument();

  resize({ width: 600 });
  expect(bottomNavigationBar()).not.toBeInTheDocument();
  expect(sidebarSearch()).toBeInTheDocument();
  expectSidebarShowsIconsOnly(true);
});

test("[NAV-R1.6] keeps the collapsed state out of the narrow layout", () => {
  window.localStorage.setItem("main-nav-collapsed", "1");
  const { resize } = renderMain(PHONE_PORTRAIT);
  expect(bottomNavigationBar()).toBeInTheDocument();
  expect(sidebarSearch()).not.toBeInTheDocument();
  expect(collapseButton()).not.toBeInTheDocument();

  resize(DESKTOP);

  expectSidebarShowsIconsOnly(true);
  expect(collapseButton()).toHaveAttribute("aria-expanded", "false");
});

test("[NAV-R1.7] shows the collapse button from 960px", () => {
  const { resize } = renderMain({ width: 960, height: 800 });
  expectSidebarShowsIconsOnly(false);

  resize({ width: 959 });
  expectSidebarShowsIconsOnly(true);
  expect(collapseButton()).not.toBeInTheDocument();
  expect(window.localStorage.getItem("main-nav-collapsed")).toBeNull();

  resize({ width: 960 });
  expectSidebarShowsIconsOnly(false);
  expect(collapseButton()).toHaveAttribute("aria-expanded", "true");
});

test("[REC-R10.3] opens the add menu from the icon rail", async () => {
  renderMain({ width: 768, height: 1024, canHover: false });

  await user.click(screen.getByRole("button", { name: "新增" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新增交易紀錄" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新增買賣計畫" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "新增現金股利" }));

  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByRole("heading", { name: "新增現金股利" }),
  ).toBeInTheDocument();
  expect(screen.getByText("儀表板內容")).toBeInTheDocument();
});

test("[REC-R10.4] opens the add menu from the sidebar the user collapsed", async () => {
  window.localStorage.setItem("main-nav-collapsed", "1");
  renderMain(DESKTOP);

  await user.click(screen.getByRole("button", { name: "新增" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新增交易紀錄" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新增現金股利" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "新增買賣計畫" }));

  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByRole("heading", { name: "新增買賣計畫" }),
  ).toBeInTheDocument();
});

test("[ACCT-R9.3] shows the default avatar when the account has none", () => {
  const { resize } = renderMain(DESKTOP);
  const sidebarAvatar = within(
    screen.getByRole("link", { name: /查看帳號與設定/u }),
  ).getByRole("presentation", { hidden: true });
  expect(sidebarAvatar).toHaveAttribute("src", imgPersonFill);

  resize(PHONE_PORTRAIT);

  const bottomBarAvatar = within(bottomNavigationBar() as HTMLElement).getByRole(
    "presentation",
    { hidden: true },
  );
  expect(bottomBarAvatar).toHaveAttribute("src", imgPersonFill);
});
