import { configureStore, createSlice } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, expect, type Mock, test, vi } from "vitest";

import type { CashDividendRecord, TradePlan, TradeRecord } from "../../types";
import Api from "../../utils/api";
import Plans from "./Plans/Plans";
import Records from "./Records/Records";

const user = userEvent.setup();

vi.mock("../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));
vi.mock("../../storage/localDatabase");
vi.mock("./Details/Details", () => ({ default: () => null }));
vi.mock("../../redux/slices/TradeRecordSlice", () => ({
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
}));

const sendRequest = Api.sendRequest as Mock;

function makeStore({
  tradeRecords = [],
  cashDividendRecords = [],
  tradePlans = [],
}: {
  tradeRecords?: TradeRecord[];
  cashDividendRecords?: CashDividendRecord[];
  tradePlans?: TradePlan[];
}) {
  const slice = (name: string, initialState: object) =>
    createSlice({ name, initialState, reducers: {} }).reducer;
  return configureStore({
    reducer: {
      tradeRecord: slice("tradeRecord", {
        tradeRecords,
        stockWarehouse: {},
        hasLoaded: true,
        isWaiting: false,
      }),
      cashDividend: slice("cashDividend", {
        cashDividendRecords,
        hasLoaded: true,
        isWaiting: false,
      }),
      tradePlan: slice("tradePlan", { tradePlans, isWaiting: false }),
      stockInfo: slice("stockInfo", { sidStockInfoMap: {} }),
      mainPage: slice("mainPage", { scrollTop: 0 }),
    },
  });
}

function renderWithStore(
  element: React.ReactElement,
  store: ReturnType<typeof makeStore>,
) {
  return render(
    <Provider store={store}>
      <MemoryRouter>{element}</MemoryRouter>
    </Provider>,
  );
}

beforeAll(() => {
  const observer = class {
    public observe(): void {}
    public unobserve(): void {}
    public disconnect(): void {}
  };
  Object.assign(window, { IntersectionObserver: observer, ResizeObserver: observer });
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  sendRequest.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint.startsWith("market/search")) {
      return { data: [{ sid: "2317", name: "鴻海" }] };
    }
    return {};
  });
});

test("[REC-R15.1] lists records newest first with their labels", () => {
  const tradeRecord = (
    id: number,
    sid: string,
    company_name: string,
    deal_time: string,
    deal_quantity: number,
    deal_price: number,
  ): TradeRecord => ({
    id,
    sid,
    company_name,
    deal_time,
    deal_quantity,
    deal_price,
    handling_fee: 1,
  });
  const store = makeStore({
    tradeRecords: [
      tradeRecord(1, "2330", "台積電", "2024-03-01", 1000, 600),
      tradeRecord(2, "2317", "鴻海", "2024-04-01", 200, 140),
      tradeRecord(3, "2317", "鴻海", "2024-05-02", -200, 150),
    ],
    cashDividendRecords: [
      {
        id: 4,
        sid: "2330",
        company_name: "台積電",
        deal_time: "2024-07-15",
        cash_dividend: 1500,
      },
    ],
  });
  const { container } = renderWithStore(<Records />, store);
  const rows = Array.from(container.querySelectorAll("[data-scroll-anchor]")).map(
    (row) => (row.textContent ?? "").replace(/\s/g, ""),
  );
  expect(rows).toEqual([
    "2330台積電2024-07-15股利入帳金額1,500",
    "2317鴻海2024-05-02賣出200股成交價150",
    "2317鴻海2024-04-01買進200股成交價140",
    "2330台積電2024-03-01買進1,000股成交價600",
  ]);
});

test("[PLAN-R4.1] filters buy plans by 買", async () => {
  const store = makeStore({
    tradePlans: [
      {
        id: "1",
        sid: "2330",
        company_name: "台積電",
        plan_type: "buy",
        target_price: 500,
        target_quantity: 1000,
      },
      {
        id: "2",
        sid: "2330",
        company_name: "台積電",
        plan_type: "sell",
        target_price: 650,
        target_quantity: 1000,
      },
    ],
  });
  const { container } = renderWithStore(<Plans />, store);
  await user.type(screen.getByRole("textbox"), "買");
  const rows = container.querySelectorAll("[data-scroll-anchor]");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent("買進");
});
