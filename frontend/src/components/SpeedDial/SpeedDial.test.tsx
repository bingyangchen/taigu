import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import {
  MemoryRouter,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { expect, test, vi } from "vitest";

import SpeedDial from "./SpeedDial";

const user = userEvent.setup();

// The components barrel loads the store, which this test does not need.
vi.mock("../../components", () => ({
  CashDividendRecordEditor: () => null,
  StockSearchModal: () => null,
  TradePlanEditor: () => null,
  TradeRecordEditor: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

let navigate: NavigateFunction = () => {};
let currentHash = "";

function RouterCapture(): null {
  navigate = useNavigate();
  currentHash = useLocation().hash;
  return null;
}

function renderSpeedDial(): void {
  render(
    <MemoryRouter initialEntries={["/records"]}>
      <RouterCapture />
      <SpeedDial />
    </MemoryRouter>,
  );
}

const trigger = (): HTMLElement => screen.getByRole("button", { name: "新增或搜尋" });

test("closing the menu by going back moves focus from an option to the trigger", async () => {
  // The closed menu's options are transparent, so focus left on one of them would be
  // on a control the keyboard user cannot see.
  renderSpeedDial();
  await user.click(trigger());
  expect(currentHash).toBe("#@");
  screen.getByRole("button", { name: "搜尋" }).focus();

  act(() => navigate(-1));

  expect(currentHash).toBe("");
  expect(trigger()).toHaveFocus();
  expect(trigger()).toHaveAttribute("aria-expanded", "false");
});

test("closing the menu by going back leaves focus elsewhere alone", async () => {
  renderSpeedDial();
  await user.click(trigger());
  const outside = document.createElement("button");
  document.body.append(outside);
  try {
    outside.focus();

    act(() => navigate(-1));

    expect(currentHash).toBe("");
    expect(outside).toHaveFocus();
  } finally {
    outside.remove();
  }
});

test("Escape closes the open menu and moves focus to the trigger", async () => {
  renderSpeedDial();
  await user.click(trigger());

  // With focus outside the options, only the Escape handler can move it.
  (document.activeElement as HTMLElement).blur();

  await user.keyboard("{Escape}");

  expect(currentHash).toBe("");
  expect(trigger()).toHaveFocus();
});
