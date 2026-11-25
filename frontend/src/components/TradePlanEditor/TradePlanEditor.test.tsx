import { configureStore, createSlice } from "@reduxjs/toolkit";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, type Mock, test, vi } from "vitest";

import type { TradePlan } from "../../types";
import Api from "../../utils/api";
import TradePlanEditor from "./TradePlanEditor";

// No delay between actions, so fake timers do not stall user-event.
const user = userEvent.setup({ delay: null });

vi.mock("../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));
vi.mock("../../storage/localDatabase");
vi.mock("../../pages/Main/Details/Details", () => ({ default: () => null }));
vi.mock("../../redux/slices/TradeRecordSlice", () => ({}));

const mockSavePlan = vi.fn();

vi.mock("../../redux/slices/TradePlanSlice", async () => {
  const { createAsyncThunk } =
    await vi.importActual<typeof import("@reduxjs/toolkit")>("@reduxjs/toolkit");
  return {
    createPlan: createAsyncThunk("tradePlan/createPlan", (body: object) =>
      mockSavePlan("create", body),
    ),
    updatePlan: createAsyncThunk("tradePlan/updatePlan", (body: object) =>
      mockSavePlan("update", body),
    ),
    deletePlan: createAsyncThunk("tradePlan/deletePlan", (id: string) =>
      mockSavePlan("delete", id),
    ),
  };
});

const sendRequest = Api.sendRequest as Mock;

const STOCK_NAMES: { [sid: string]: string } = { "2330": "台積電", "2317": "鴻海" };

const plan2330: TradePlan = {
  id: "7",
  sid: "2330",
  company_name: "台積電",
  plan_type: "buy",
  target_price: 500,
  target_quantity: 1000,
};

function renderPlanEditor({
  plan,
  isNarrow = false,
  hideModal = vi.fn(),
}: { plan?: TradePlan; isNarrow?: boolean; hideModal?: Mock } = {}) {
  window.matchMedia = ((query: string) => ({
    matches: isNarrow && query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  const slice = (name: string, initialState: object) =>
    createSlice({ name, initialState, reducers: {} }).reducer;
  const store = configureStore({
    reducer: { tradePlan: slice("tradePlan", { tradePlans: [], isWaiting: false }) },
  });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <TradePlanEditor
          plan={plan}
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
const summary = (): HTMLElement =>
  screen.getByRole("complementary", { name: "這筆紀錄的金額" });
const summaryOf = (title: string): string =>
  within(step(title)).getByRole("button", { expanded: false }).textContent ?? "";

async function setUnit(unit: "張" | "股"): Promise<void> {
  await user.click(
    within(screen.getByRole("tablist", { name: "股數單位" })).getByRole("tab", {
      name: unit,
    }),
  );
}

async function selectStock(sid: string): Promise<void> {
  await user.type(screen.getByRole("combobox"), sid);
  act(() => {
    vi.advanceTimersByTime(300);
  });
  await user.click(await screen.findByRole("option", { name: new RegExp(sid) }));
}

function summaryRow(label: string): string {
  return (within(summary()).getByText(label).parentElement?.textContent ?? "").replace(
    /\s/g,
    "",
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  mockSavePlan.mockReset().mockResolvedValue({});
  sendRequest.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint.startsWith("market/search")) {
      const keyword = decodeURIComponent(endpoint.split("keyword=")[1]);
      return {
        data: Object.entries(STOCK_NAMES)
          .filter(([sid]) => sid.startsWith(keyword))
          .map(([sid, name]) => ({ sid, name })),
      };
    }
    return {};
  });
});

afterEach(() => {
  vi.useRealTimers();
});

test("[PLAN-R5.6] shows the saved plan", async () => {
  renderPlanEditor();
  await selectStock("2330");
  await setUnit("張");
  await user.type(field("目標股數"), "1.5");
  await user.type(field("目標價格"), "500");
  await user.click(screen.getByRole("button", { name: "新增買進計畫" }));
  await screen.findByRole("heading", { name: /已新增/ });
  expect(screen.getByText("已新增買進計畫")).toBeInTheDocument();
  expect(screen.getByText("2330 台積電")).toBeInTheDocument();
  expect(screen.getByText("1.5 張（1,500 股） × 500 元")).toBeInTheDocument();
  expect(screen.getByText("750,000 元")).toBeInTheDocument();
  expect(screen.getByText("1,068 元")).toBeInTheDocument();
});

test("writes a lot quantity typed with a trailing decimal point without the point", async () => {
  renderPlanEditor();
  await selectStock("2330");
  await setUnit("張");
  await user.type(field("目標股數"), "3.");
  await user.type(field("目標價格"), "500");
  await user.click(screen.getByRole("button", { name: "新增買進計畫" }));
  await screen.findByRole("heading", { name: /已新增/ });
  expect(screen.getByText("3 張（3,000 股） × 500 元")).toBeInTheDocument();
});

test("[PLAN-R5.7] keeps the side and unit for another plan", async () => {
  renderPlanEditor();
  await user.click(screen.getByRole("tab", { name: "賣出" }));
  await selectStock("2330");
  await setUnit("股");
  await user.type(field("目標股數"), "1000");
  await user.type(field("目標價格"), "650");
  await user.click(screen.getByRole("button", { name: "新增賣出計畫" }));
  await screen.findByText("已新增賣出計畫");
  await user.click(screen.getByRole("button", { name: "再記一筆" }));
  expect(screen.getByRole("heading", { name: "新增買賣計畫" })).toBeInTheDocument();
  expect(screen.getByRole("combobox")).toHaveValue("");
  expect(field("目標股數")).toHaveValue("");
  expect(field("目標價格")).toHaveValue("");
  expect(screen.getByRole("tab", { name: "賣出", selected: true })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "股", selected: true })).toBeInTheDocument();
});

test("[PLAN-R6.1] points at the missing stock", async () => {
  renderPlanEditor();
  await setUnit("股");
  await user.type(field("目標股數"), "1000");
  await user.type(field("目標價格"), "500");
  await user.click(screen.getByRole("button", { name: "新增買進計畫" }));
  expect(screen.getByText("請選擇股票")).toBeInTheDocument();
  expect(mockSavePlan).not.toHaveBeenCalled();
});

test("[PLAN-R6.2] does not save search text that was not chosen", async () => {
  renderPlanEditor({ plan: plan2330 });
  await user.click(screen.getByRole("button", { name: /已選股票：台積電/ }));
  await user.type(screen.getByRole("combobox"), "2317");
  await user.click(screen.getByRole("button", { name: "儲存變更" }));
  act(() => {
    vi.advanceTimersByTime(150);
  });
  expect(screen.getByText("請從搜尋結果選擇一檔股票")).toBeInTheDocument();
  expect(mockSavePlan).not.toHaveBeenCalled();
});

test("lists what is missing when the editor opens", () => {
  renderPlanEditor();
  expect(
    within(summary()).getByText("還沒填：股票、目標股數與價格"),
  ).toBeInTheDocument();
});

test("[PLAN-R6.3] saves lots as shares", async () => {
  renderPlanEditor();
  await selectStock("2330");
  await setUnit("張");
  await user.type(field("目標股數"), "1.5");
  await user.type(field("目標價格"), "500");
  await user.click(screen.getByRole("button", { name: "新增買進計畫" }));
  await waitFor(() => expect(mockSavePlan).toHaveBeenCalled());
  expect(mockSavePlan).toHaveBeenCalledWith("create", {
    sid: "2330",
    plan_type: "buy",
    target_price: 500,
    target_quantity: 1500,
  });
});

test("[PLAN-R6.4] points at the missing target price on the narrow page", async () => {
  renderPlanEditor({ isNarrow: true });
  await selectStock("2330");
  await setUnit("張");
  await user.type(field("目標股數"), "1");
  await user.click(screen.getByRole("button", { name: "新增買進計畫" }));
  expect(within(step("目標股數與價格")).getByText("請填寫目標價格")).toBeVisible();
  expect(field("目標價格")).toHaveFocus();
  expect(mockSavePlan).not.toHaveBeenCalled();
});

test("[PLAN-R7.1] estimates the buy fee", async () => {
  renderPlanEditor();
  await setUnit("股");
  await user.type(field("目標股數"), "1000");
  await user.type(field("目標價格"), "100");
  expect(summaryRow("成交金額")).toBe("成交金額100,000元");
  expect(summaryRow("預估手續費")).toBe("預估手續費142元");
});

test("[PLAN-R7.2] estimates the sell fee", async () => {
  renderPlanEditor();
  await setUnit("股");
  await user.type(field("目標股數"), "1000");
  await user.type(field("目標價格"), "100");
  await user.click(screen.getByRole("tab", { name: "賣出" }));
  expect(summaryRow("成交金額")).toBe("成交金額100,000元");
  expect(summaryRow("預估手續費")).toBe("預估手續費442元");
});

test("[PLAN-R7.3] estimates at least 1 for the fee", async () => {
  renderPlanEditor();
  await setUnit("股");
  await user.type(field("目標股數"), "10");
  await user.type(field("目標價格"), "10");
  expect(summaryRow("成交金額")).toBe("成交金額100元");
  expect(summaryRow("預估手續費")).toBe("預估手續費1元");
});

test("[PLAN-R11.3] asks before closing a changed window", async () => {
  const { hideModal } = renderPlanEditor();
  await user.type(field("目標價格"), "500");
  fireEvent.keyDown(field("目標價格"), { key: "Escape" });
  expect(screen.getByText("捨棄變更？")).toBeInTheDocument();
  expect(hideModal).not.toHaveBeenCalled();
});

test("[PLAN-R15.1] opens the first step of a new plan", () => {
  renderPlanEditor({ isNarrow: true });
  expect(within(step("買賣與股票")).getByRole("combobox")).toBeVisible();
  expect(summaryOf("目標股數與價格")).toContain("還沒填");
});

test("[PLAN-R15.2] opens the next step once a stock is picked", async () => {
  renderPlanEditor({ isNarrow: true });
  await selectStock("2330");
  expect(summaryOf("買賣與股票")).toContain("買進・2330 台積電");
  expect(field("目標股數")).toHaveFocus();
});

test("[PLAN-R15.3] collapses every step when editing", () => {
  renderPlanEditor({
    isNarrow: true,
    plan: { ...plan2330, plan_type: "sell", target_quantity: 2000, target_price: 650 },
  });
  expect(summaryOf("買賣與股票")).toContain("賣出・2330 台積電");
  expect(summaryOf("目標股數與價格")).toContain("2 張 × 650 元");
});
