import { expect, test, vi } from "vitest";

import stockInfo, { fetchSingleStockInfo } from "./StockInfoSlice";

vi.mock("../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));
vi.mock("../../storage/localDatabase");

test("[STOCK-R5.3] puts the price on its quote's trading date", () => {
  vi.useFakeTimers({ now: new Date(2026, 9, 24, 10) });
  try {
    const initialState = stockInfo(undefined, { type: "init" });
    const state = stockInfo(
      {
        ...initialState,
        sidHistoricalPricesMap: {
          "2330": { daily: { "2026-10-22": 23.2, "2026-10-23": 23.45 } },
        },
      },
      fetchSingleStockInfo.fulfilled(
        {
          sid: "2330",
          name: "台積電",
          quantity: 1000,
          close: 23.45,
          fluct_price: 0.25,
          date: "2026-10-23",
        },
        "request",
        "2330",
      ),
    );
    expect(state.sidHistoricalPricesMap["2330"].daily).toEqual({
      "2026-10-22": 23.2,
      "2026-10-23": 23.45,
    });
  } finally {
    vi.useRealTimers();
  }
});
