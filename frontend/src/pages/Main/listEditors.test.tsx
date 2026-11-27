import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, expect, type Mock, test, vi } from "vitest";

import { TradePlanEditor } from "../../components";
import accountReducer from "../../redux/slices/AccountSlice";
import cashDividendReducer from "../../redux/slices/CashDividendRecordSlice";
import handlingFeeDiscountReducer from "../../redux/slices/HandlingFeeDiscountSlice";
import mainPageReducer from "../../redux/slices/MainPageSlice";
import memoReducer from "../../redux/slices/MemoSlice";
import planUpsellReducer from "../../redux/slices/PlanUpsellSlice";
import settingsPageReducer from "../../redux/slices/SettingsPageSlice";
import stockInfoReducer from "../../redux/slices/StockInfoSlice";
import toastReducer from "../../redux/slices/ToastSlice";
import tradePlanReducer from "../../redux/slices/TradePlanSlice";
import tradeRecordReducer from "../../redux/slices/TradeRecordSlice";
import {
  DESKTOP,
  mockViewport,
  PHONE_PORTRAIT,
  type Viewport,
} from "../../testing/viewport";
import type {
  CashDividendRecord,
  HandlingFeeDiscount,
  TradePlan,
  TradeRecord,
} from "../../types";
import Api from "../../utils/api";
import {
  HandlingFeeDiscountCreateRoute,
  HandlingFeeDiscountEditRoute,
  TradePlanEditRoute,
  TradeRecordEditRoute,
} from "./EditorRoutes/EditorRoutes";
import HandlingFee from "./HandlingFee/HandlingFee";
import Plans from "./Plans/Plans";
import Records from "./Records/Records";

// No delay between actions, so fake timers do not stall user-event.
const user = userEvent.setup({ delay: null });

vi.mock("../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));
vi.mock("../../storage/localDatabase");
vi.mock("./Details/Details", () => ({ default: () => null }));
vi.mock("echarts-for-react", () => ({ default: () => null }));

const sendRequest = Api.sendRequest as Mock;

const reducer = {
  settingsPage: settingsPageReducer,
  account: accountReducer,
  tradeRecord: tradeRecordReducer,
  cashDividend: cashDividendReducer,
  stockInfo: stockInfoReducer,
  tradePlan: tradePlanReducer,
  memo: memoReducer,
  toast: toastReducer,
  planUpsell: planUpsellReducer,
  mainPage: mainPageReducer,
  handlingFeeDiscount: handlingFeeDiscountReducer,
};

const tradeRecord2330: TradeRecord = {
  id: 1,
  sid: "2330",
  company_name: "台積電",
  deal_time: "2024-03-01",
  deal_quantity: 1000,
  deal_price: 600,
  handling_fee: 855,
};

const cashDividend2330: CashDividendRecord = {
  id: 4,
  sid: "2330",
  company_name: "台積電",
  deal_time: "2024-07-15",
  cash_dividend: 1500,
};

const buyPlan2330: TradePlan = {
  id: "7",
  sid: "2330",
  company_name: "台積電",
  plan_type: "buy",
  target_price: 500,
  target_quantity: 1000,
};

const septemberDiscount: HandlingFeeDiscount = {
  id: 7,
  date: "2026-09-15",
  amount: 200,
  memo: "9 月退佣",
};

function makeStore({
  tradeRecords = [],
  cashDividendRecords = [],
  tradePlans = [],
  discounts = [],
  grossHandlingFee = 0,
}: {
  tradeRecords?: TradeRecord[];
  cashDividendRecords?: CashDividendRecord[];
  tradePlans?: TradePlan[];
  discounts?: HandlingFeeDiscount[];
  grossHandlingFee?: number;
}) {
  const initial = configureStore({ reducer }).getState();
  return configureStore({
    reducer,
    preloadedState: {
      ...initial,
      tradeRecord: {
        ...initial.tradeRecord,
        tradeRecords,
        grossHandlingFee,
        hasLoaded: true,
      },
      cashDividend: { ...initial.cashDividend, cashDividendRecords, hasLoaded: true },
      tradePlan: { ...initial.tradePlan, tradePlans },
      handlingFeeDiscount: {
        ...initial.handlingFeeDiscount,
        handlingFeeDiscountRecords: discounts,
        hasLoaded: true,
      },
    },
  });
}

let currentPath = "";

function LocationCapture(): null {
  currentPath = useLocation().pathname;
  return null;
}

function renderPages(
  path: string,
  viewport: Viewport,
  store: ReturnType<typeof makeStore>,
  extra?: React.ReactNode,
) {
  mockViewport(viewport);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <LocationCapture />
        <Routes>
          <Route path="/records" element={<Records />} />
          <Route
            path="/records/trade/:recordId/edit"
            element={<TradeRecordEditRoute />}
          />
          <Route path="/plans" element={<Plans />} />
          <Route path="/plans/:planId/edit" element={<TradePlanEditRoute />} />
          <Route path="/handling-fee" element={<HandlingFee />} />
          <Route
            path="/handling-fee/discounts/new"
            element={<HandlingFeeDiscountCreateRoute />}
          />
          <Route
            path="/handling-fee/discounts/:discountId/edit"
            element={<HandlingFeeDiscountEditRoute />}
          />
        </Routes>
        {extra}
      </MemoryRouter>
    </Provider>,
  );
}

const field = (label: string): HTMLInputElement =>
  screen.getByLabelText(label, { selector: "input" }) as HTMLInputElement;
const step = (title: string): HTMLElement =>
  screen.getByRole("region", { name: title });
const summaryOf = (title: string): string =>
  within(step(title)).getByRole("button", { expanded: false }).textContent ?? "";
const listRow = (name: RegExp): HTMLElement => screen.getByRole("button", { name });
const rowTexts = (): string[] =>
  Array.from(document.querySelectorAll("[data-scroll-anchor]")).map((row) =>
    (row.textContent ?? "").replace(/\s/g, ""),
  );

async function replaceValue(input: HTMLInputElement, value: string): Promise<void> {
  await user.clear(input);
  await user.type(input, value);
}

beforeAll(() => {
  const observer = class {
    public observe(): void {}
    public unobserve(): void {}
    public disconnect(): void {}
  };
  Object.assign(window, { IntersectionObserver: observer, ResizeObserver: observer });
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 21, 12));
  window.localStorage.clear();
  sendRequest.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint.startsWith("market/search")) {
      return { data: [{ sid: "2330", name: "台積電" }] };
    }
    return {};
  });
});

afterEach(() => {
  vi.useRealTimers();
});

test("[REC-R11.1] opens the edit page from a row in the narrow layout", async () => {
  renderPages(
    "/records",
    PHONE_PORTRAIT,
    makeStore({ tradeRecords: [tradeRecord2330] }),
  );

  await user.click(listRow(/2330台積電2024-03-01/u));

  expect(currentPath).toBe("/records/trade/1/edit");
  expect(screen.getByRole("heading", { name: "編輯交易紀錄" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(summaryOf("買賣與股票")).toContain("買進・2330 台積電");
  expect(summaryOf("股數與單價")).toContain("× 600 元");
});

test("[REC-R11.2] opens the editor window from a row in the wide layout", async () => {
  renderPages("/records", DESKTOP, makeStore({ tradeRecords: [tradeRecord2330] }));

  await user.click(listRow(/2330台積電2024-03-01/u));

  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("heading", { name: "編輯交易紀錄" }),
  ).toBeInTheDocument();
  expect(field("成交單價")).toHaveValue("600");
  expect(currentPath).toBe("/records");
});

test("[REC-R9.2] deletes a cash dividend by long pressing its row on a phone", async () => {
  renderPages(
    "/records",
    PHONE_PORTRAIT,
    makeStore({ cashDividendRecords: [cashDividend2330] }),
  );
  const row = listRow(/2330台積電2024-07-15/u);

  fireEvent.touchStart(row, { touches: [{ clientX: 10, clientY: 10 }] });
  act(() => {
    vi.advanceTimersByTime(500);
  });
  fireEvent.touchEnd(row);
  await user.click(await screen.findByText("刪除"));

  const dialog = await screen.findByRole("dialog", { name: "刪除現金股利？" });
  expect(within(dialog).getByText("入帳金額").parentElement).toHaveTextContent("1,500");
  await user.click(within(dialog).getByRole("button", { name: "刪除現金股利" }));

  expect(
    screen.queryByRole("dialog", { name: "刪除現金股利？" }),
  ).not.toBeInTheDocument();
  expect(rowTexts()).toEqual([]);
  expect(sendRequest).toHaveBeenCalledWith("cash-dividends/4", "delete");
});

test("[PLAN-R5.1] adds a plan from the editor window in the wide layout", async () => {
  const sellPlan: TradePlan = {
    ...buyPlan2330,
    id: "8",
    plan_type: "sell",
    target_price: 650,
  };
  sendRequest.mockImplementation(async (endpoint: string, method: string, body) => {
    if (endpoint.startsWith("market/search")) {
      return { data: [{ sid: "2330", name: "台積電" }] };
    }
    if (endpoint === "trade-plans" && method === "post") {
      return { id: "9", company_name: "台積電", ...JSON.parse(body as string) };
    }
    return {};
  });
  const closeEditor = vi.fn();
  renderPages(
    "/plans",
    DESKTOP,
    makeStore({ tradePlans: [sellPlan] }),
    <TradePlanEditor hideModal={closeEditor} />,
  );
  const dialog = screen.getByRole("dialog");

  await user.type(within(dialog).getByRole("combobox"), "2330");
  act(() => {
    vi.advanceTimersByTime(300);
  });
  await user.click(await screen.findByRole("option", { name: /2330/u }));
  await user.click(within(dialog).getByRole("tab", { name: "股" }));
  await user.type(field("目標股數"), "1000");
  await user.type(field("目標價格"), "500");
  await user.click(within(dialog).getByRole("button", { name: "新增買進計畫" }));
  await user.click(await screen.findByRole("button", { name: "完成" }));
  await settle();

  expect(closeEditor).toHaveBeenCalled();
  const rows = rowTexts();
  expect(rows).toHaveLength(2);
  expect(
    rows.some(
      (row) =>
        row.includes("買進") && row.includes("1,000股") && row.includes("目標價500"),
    ),
  ).toBe(true);
  expect(rows.some((row) => row.includes("賣出") && row.includes("目標價650"))).toBe(
    true,
  );
});

test("[PLAN-R9.1] edits a plan in the editor window in the wide layout", async () => {
  sendRequest.mockImplementation(async (endpoint: string, method: string, body) =>
    endpoint === "trade-plans/7" && method === "post"
      ? { ...buyPlan2330, ...JSON.parse(body as string) }
      : {},
  );
  renderPages("/plans", DESKTOP, makeStore({ tradePlans: [buyPlan2330] }));

  await user.click(listRow(/2330/u));
  await replaceValue(field("目標價格"), "520");
  await user.click(screen.getByRole("button", { name: "儲存變更" }));
  await settle();

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(rowTexts()[0]).toContain("520");
});

test("[PLAN-R9.2] edits a plan on the edit page in the narrow layout", async () => {
  sendRequest.mockImplementation(async (endpoint: string, method: string, body) =>
    endpoint === "trade-plans/7" && method === "post"
      ? { ...buyPlan2330, ...JSON.parse(body as string) }
      : {},
  );
  renderPages("/plans", PHONE_PORTRAIT, makeStore({ tradePlans: [buyPlan2330] }));

  await user.click(listRow(/2330/u));
  expect(currentPath).toBe("/plans/7/edit");
  await user.click(
    within(step("目標股數與價格")).getByRole("button", { expanded: false }),
  );
  await replaceValue(field("目標價格"), "520");
  await user.click(screen.getByRole("button", { name: "儲存變更" }));
  await settle();

  expect(currentPath).toBe("/plans");
  expect(rowTexts()[0]).toContain("520");
});

function mockDiscountRequests(): void {
  sendRequest.mockImplementation(async (endpoint: string, method: string, body) => {
    if (endpoint === "handling-fee/discount" && method === "post") {
      return { id: 99, ...JSON.parse(body as string) };
    }
    if (endpoint.startsWith("handling-fee/discount/") && method === "put") {
      return JSON.parse(body as string);
    }
    return {};
  });
}

// Runs the modal's closing transition and the handling fee's count-up animation.
async function settle(): Promise<void> {
  // One step at a time, because each step of the animation sets the next timer.
  for (let tick = 0; tick < 100; tick++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
  }
}

test("[FEE-R7.1] adds a discount in the editor window in the wide layout", async () => {
  mockDiscountRequests();
  renderPages("/handling-fee", DESKTOP, makeStore({ grossHandlingFee: 1000 }));

  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  const dialog = screen.getByRole("dialog");
  await user.type(field("折讓金額"), "200");
  await user.type(field("備註（選填）"), "9 月退佣");
  await user.click(within(dialog).getByRole("button", { name: "新增折讓紀錄" }));
  await user.click(await screen.findByRole("button", { name: "完成" }));
  await settle();

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(rowTexts()).toEqual(["9月退佣2002026-10-21"]);
  expect(screen.getByText("累積手續費").nextElementSibling).toHaveTextContent("800");
  expect(sendRequest).toHaveBeenCalledWith(
    "handling-fee/discount",
    "post",
    JSON.stringify({ date: "2026-10-21", amount: 200, memo: "9 月退佣" }),
  );
});

test("[FEE-R7.2] adds a discount without a memo on the edit page in the narrow layout", async () => {
  mockDiscountRequests();
  renderPages("/handling-fee", PHONE_PORTRAIT, makeStore({ grossHandlingFee: 1000 }));

  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  expect(currentPath).toBe("/handling-fee/discounts/new");
  await user.type(field("折讓金額"), "300");
  await user.click(screen.getByRole("button", { name: "新增折讓紀錄" }));
  await user.click(await screen.findByRole("button", { name: "完成" }));

  expect(currentPath).toBe("/handling-fee");
  expect(rowTexts()).toEqual(["手續費折讓3002026-10-21"]);
  const [, , body] = sendRequest.mock.calls.find(
    ([endpoint, method]) => endpoint === "handling-fee/discount" && method === "post",
  ) as [string, string, string];
  expect(JSON.parse(body)).toEqual({ date: "2026-10-21", amount: 300, memo: "" });
});

test("[FEE-R9.1] edits a discount amount on the edit page in the narrow layout", async () => {
  mockDiscountRequests();
  renderPages(
    "/handling-fee",
    PHONE_PORTRAIT,
    makeStore({ grossHandlingFee: 1000, discounts: [septemberDiscount] }),
  );

  await user.click(listRow(/9 月退佣/u));
  expect(currentPath).toBe("/handling-fee/discounts/7/edit");
  expect(summaryOf("折讓日期")).toContain("9/15（二）");
  expect(summaryOf("金額與備註")).toContain("200");
  await user.click(within(step("金額與備註")).getByRole("button", { expanded: false }));
  expect(field("備註（選填）")).toHaveValue("9 月退佣");
  await replaceValue(field("折讓金額"), "300");
  await user.click(screen.getByRole("button", { name: "儲存變更" }));
  await settle();

  expect(currentPath).toBe("/handling-fee");
  expect(rowTexts()).toEqual(["9月退佣3002026-09-15"]);
  expect(screen.getByText("累積手續費").nextElementSibling).toHaveTextContent("700");
  expect(sendRequest).toHaveBeenCalledWith(
    "handling-fee/discount/7",
    "put",
    expect.stringContaining('"amount":300'),
  );
});
