import { configureStore, createSlice } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DESKTOP, mockViewport, PHONE_PORTRAIT } from "../../testing/viewport";
import type { HandlingFeeDiscount } from "../../types";
import HandlingFeeDiscountEditor from "./HandlingFeeDiscountEditor";

// No delay between actions, so fake timers do not stall user-event.
const user = userEvent.setup({ delay: null });

vi.mock("../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));
vi.mock("../../storage/localDatabase");

const mockSaveDiscount = vi.fn();

vi.mock("../../redux/slices/HandlingFeeDiscountSlice", async () => {
  const { createAsyncThunk } =
    await vi.importActual<typeof import("@reduxjs/toolkit")>("@reduxjs/toolkit");
  return {
    createDiscount: createAsyncThunk(
      "handlingFeeDiscount/createDiscount",
      (body: object) => mockSaveDiscount("create", body),
    ),
    updateDiscount: createAsyncThunk(
      "handlingFeeDiscount/updateDiscount",
      (body: object) => mockSaveDiscount("update", body),
    ),
    deleteDiscount: createAsyncThunk(
      "handlingFeeDiscount/deleteDiscount",
      (id: number) => mockSaveDiscount("delete", id),
    ),
  };
});

const septemberDiscount: HandlingFeeDiscount = {
  id: 7,
  date: "2026-09-15",
  amount: 200,
  memo: "9 月退佣",
};

function renderDiscountEditor({
  record,
  isNarrow = false,
  grossHandlingFee = 1000,
  discounts = [],
  hasLoadedTrades = true,
}: {
  record?: HandlingFeeDiscount;
  isNarrow?: boolean;
  grossHandlingFee?: number;
  discounts?: HandlingFeeDiscount[];
  hasLoadedTrades?: boolean;
} = {}) {
  mockViewport(isNarrow ? PHONE_PORTRAIT : DESKTOP);
  const slice = (name: string, initialState: object) =>
    createSlice({ name, initialState, reducers: {} }).reducer;
  const store = configureStore({
    reducer: {
      tradeRecord: slice("tradeRecord", {
        grossHandlingFee,
        hasLoaded: hasLoadedTrades,
      }),
      handlingFeeDiscount: slice("handlingFeeDiscount", {
        handlingFeeDiscountRecords: discounts,
        hasLoaded: true,
        isWaiting: false,
      }),
    },
  });
  const hideModal = vi.fn();
  render(
    <Provider store={store}>
      <MemoryRouter>
        <HandlingFeeDiscountEditor
          record={record}
          hideModal={hideModal}
          presentation={isNarrow ? "page" : "modal"}
        />
      </MemoryRouter>
    </Provider>,
  );
  return { hideModal };
}

const field = (label: string): HTMLInputElement =>
  screen.getByLabelText(label, { selector: "input" }) as HTMLInputElement;
const step = (title: string): HTMLElement =>
  screen.getByRole("region", { name: title });
const summaryOf = (title: string): string =>
  within(step(title)).getByRole("button", { expanded: false }).textContent ?? "";
const summary = (): HTMLElement =>
  screen.getByRole("complementary", { name: "這筆紀錄的金額" });
const rowText = (container: HTMLElement, label: string): string =>
  (within(container).getByText(label).parentElement?.textContent ?? "").replace(
    /\s/g,
    "",
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21, 12));
  mockSaveDiscount
    .mockReset()
    .mockImplementation(async (_action, body) => ({ id: 99, ...body }));
});

afterEach(() => {
  vi.useRealTimers();
});

test("[FEE-R7.3] shows the saved discount", async () => {
  renderDiscountEditor();
  await user.type(field("折讓金額"), "200");
  await user.type(field("備註（選填）"), "9 月退佣");
  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  await screen.findByRole("heading", { name: "已新增折讓紀錄" });
  expect(screen.getByText("9 月退佣・10/21（三）")).toBeInTheDocument();
  expect(rowText(document.body, "折讓金額")).toBe("折讓金額200元");
  expect(rowText(document.body, "累積手續費")).toBe("累積手續費1,000→800元");
  expect(mockSaveDiscount).toHaveBeenCalledWith("create", {
    date: "2026-10-21",
    amount: 200,
    memo: "9 月退佣",
  });
});

test("[FEE-R7.4] keeps the date and opens the amount step for another discount", async () => {
  renderDiscountEditor({ isNarrow: true });
  fireEvent.change(field("折讓日期"), { target: { value: "2026-09-15" } });
  await user.type(field("折讓金額"), "200");
  await user.type(field("備註（選填）"), "9 月退佣");
  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  await screen.findByRole("heading", { name: "已新增折讓紀錄" });
  await user.click(screen.getByRole("button", { name: "再記一筆" }));
  expect(screen.getByRole("heading", { name: "新增折讓紀錄" })).toBeInTheDocument();
  expect(field("折讓金額")).toHaveValue("");
  expect(field("備註（選填）")).toHaveValue("");
  expect(field("折讓日期")).toHaveValue("2026-09-15");
  expect(summaryOf("折讓日期")).toContain("9/15（二）");
  expect(field("折讓金額")).toBeVisible();
});

test("[FEE-R8.5] saves a memo of only spaces as no memo", async () => {
  renderDiscountEditor();
  await user.type(field("折讓金額"), "200");
  await user.type(field("備註（選填）"), "  ");
  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  await screen.findByRole("heading", { name: "已新增折讓紀錄" });
  expect(mockSaveDiscount).toHaveBeenCalledWith("create", {
    date: "2026-10-21",
    amount: 200,
    memo: "",
  });
  expect(screen.getByText("手續費折讓・10/21（三）")).toBeInTheDocument();
});

test("[FEE-R8.1] points at the missing amount of a new discount", async () => {
  const { hideModal } = renderDiscountEditor();
  expect(field("折讓日期")).toHaveValue("2026-10-21");
  expect(field("折讓金額")).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  expect(within(step("金額與備註")).getByText("請填寫折讓金額")).toBeVisible();
  expect(hideModal).not.toHaveBeenCalled();
  expect(mockSaveDiscount).not.toHaveBeenCalled();
});

test("[FEE-R8.2] blocks a date later than today", async () => {
  renderDiscountEditor();
  await user.type(field("折讓金額"), "200");
  fireEvent.change(field("折讓日期"), { target: { value: "2026-10-22" } });
  expect(within(step("折讓日期")).getByText("折讓日期不能晚於今天")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  expect(mockSaveDiscount).not.toHaveBeenCalled();
});

test("[FEE-R8.3] opens the amount step of a new discount on the narrow page", () => {
  renderDiscountEditor({ isNarrow: true });
  expect(summaryOf("折讓日期")).toContain("10/21（三）");
  expect(field("折讓金額")).toBeVisible();
});

test("[FEE-R8.4] collapses every step when editing on the narrow page", () => {
  renderDiscountEditor({
    isNarrow: true,
    record: septemberDiscount,
    discounts: [septemberDiscount],
  });
  expect(summaryOf("折讓日期")).toContain("9/15（二）");
  expect(summaryOf("金額與備註")).toContain("200 元・9 月退佣");
});

test("[FEE-R9.2] sends an empty memo to clear it", async () => {
  const { hideModal } = renderDiscountEditor({
    record: septemberDiscount,
    discounts: [septemberDiscount],
  });
  await user.clear(field("備註（選填）"));
  await user.click(screen.getByRole("button", { name: "儲存變更" }));
  await waitFor(() => expect(hideModal).toHaveBeenCalled());
  expect(mockSaveDiscount).toHaveBeenCalledWith("update", {
    id: 7,
    date: "2026-09-15",
    amount: 200,
    memo: "",
  });
});

test("[FEE-R11.4] asks before closing a changed window", async () => {
  const { hideModal } = renderDiscountEditor();
  await user.type(field("折讓金額"), "200");
  fireEvent.keyDown(field("折讓金額"), { key: "Escape" });
  expect(screen.getByText("捨棄變更？")).toBeInTheDocument();
  expect(hideModal).not.toHaveBeenCalled();
});

test("[FEE-R14.1] ignores a decimal point and a minus sign", async () => {
  renderDiscountEditor();
  await user.type(field("折讓金額"), "200.-");
  expect(field("折讓金額")).toHaveValue("200");
});

test("[FEE-R17.1] keeps the form open when saving fails", async () => {
  mockSaveDiscount.mockRejectedValue(new Error("Failed to fetch"));
  const { hideModal } = renderDiscountEditor();
  await user.type(field("折讓金額"), "200");
  await user.type(field("備註（選填）"), "9 月退佣");
  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  await waitFor(() => expect(mockSaveDiscount).toHaveBeenCalled());
  expect(hideModal).not.toHaveBeenCalled();
  expect(field("折讓金額")).toHaveValue("200");
  expect(field("備註（選填）")).toHaveValue("9 月退佣");
});

test("[FEE-R18.1] shows the net handling fee after a new discount", async () => {
  renderDiscountEditor({ grossHandlingFee: 1000 });
  await user.type(field("折讓金額"), "200");
  expect(rowText(summary(), "折讓金額")).toBe("折讓金額200元");
  expect(rowText(summary(), "累積手續費")).toBe("累積手續費1,000→變成800元");
});

test("[FEE-R18.2] replaces the original amount when editing", async () => {
  renderDiscountEditor({
    grossHandlingFee: 1000,
    record: septemberDiscount,
    discounts: [septemberDiscount],
  });
  await user.clear(field("折讓金額"));
  await user.type(field("折讓金額"), "300");
  expect(rowText(summary(), "折讓金額")).toBe("折讓金額300元");
  expect(rowText(summary(), "累積手續費")).toBe("累積手續費800→變成700元");
});

test("[FEE-R18.3] leaves out the net handling fee while trades load", async () => {
  renderDiscountEditor({ grossHandlingFee: 0, hasLoadedTrades: false });
  await user.type(field("折讓金額"), "200");
  expect(rowText(summary(), "折讓金額")).toBe("折讓金額200元");
  expect(within(summary()).queryByText("累積手續費")).not.toBeInTheDocument();
});
