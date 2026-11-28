import { act, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, expect, type Mock, test, vi } from "vitest";

import { useAppSelector } from "../../redux/hooks";
import { store } from "../../redux/store";
import { mockNetworkStatus } from "../../testing/network";
import { mockViewport, PHONE_PORTRAIT } from "../../testing/viewport";
import type { TradeRecord } from "../../types";
import Api from "../../utils/api";
import Main from "./Main";
import Market from "./Market/Market";

vi.mock("../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));
vi.mock("../../storage/localDatabase", () => ({
  default: {
    prepareForAccount: vi.fn(async () => undefined),
    getTradeRecords: vi.fn(async () => []),
    getTradeRecordsLastRevision: vi.fn(async () => 0),
    applyTradeRecordSyncResponse: vi.fn(async () => [HOLDING]),
    getMarketIndexHistoricalPrices: vi.fn(async () => ({})),
  },
}));

const HOLDING: TradeRecord = {
  id: 1,
  deal_time: "2026-01-05",
  sid: "2330",
  company_name: "台積電",
  deal_price: 1000,
  deal_quantity: 1000,
  handling_fee: 1425,
};
const FREE_PLAN = { plan: "free", market_refresh_interval_seconds: 600 };

const sendRequest = Api.sendRequest as Mock;
let price = 1000;
let network: ReturnType<typeof mockNetworkStatus>;
let visibilityState: Document["visibilityState"] = "visible";

async function advance(milliseconds: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(milliseconds));
}

function countRequests(prefix: string): number {
  return sendRequest.mock.calls.filter(([endpoint]) => endpoint.startsWith(prefix))
    .length;
}

function HoldingPrice() {
  const close = useAppSelector(
    (state) => state.stockInfo.sidStockInfoMap["2330"]?.close,
  );
  return <p>2330 價格 {close}</p>;
}

async function renderDashboard(): Promise<void> {
  mockViewport(PHONE_PORTRAIT);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Main />}>
            <Route index element={<HoldingPrice />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  await advance(0);
  expect(screen.getByText("2330 價格 1000")).toBeInTheDocument();
}

async function renderMarketHoldings(): Promise<void> {
  mockViewport(PHONE_PORTRAIT);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/market"]}>
        <Routes>
          <Route path="/" element={<Main />}>
            <Route path="market" element={<Market />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  await advance(0);
}

const holdingRow = (): HTMLElement => screen.getByRole("button", { name: /2330/ });

beforeAll(() => {
  const observer = class {
    public observe(): void {}
    public unobserve(): void {}
    public disconnect(): void {}
  };
  Object.assign(window, { IntersectionObserver: observer, ResizeObserver: observer });

  // jsdom has no Worker; only the holdings matter to these tests.
  vi.stubGlobal(
    "Worker",
    class {
      public onmessage: ((event: { data: object }) => void) | null = null;
      public postMessage(): void {
        queueMicrotask(() =>
          this.onmessage?.({
            data: {
              tradeRecords: [HOLDING],
              sidTradeRecordsMap: { "2330": [HOLDING] },
              stockWarehouse: { "2330": Array(1000).fill(1000) },
              sidCashInvestedMap: { "2330": 1_000_000 },
              sidHandlingFeeMap: { "2330": 1425 },
              sidGainMap: {},
              totalCashInvested: 1_000_000,
              grossHandlingFee: 1425,
              cashInvestedChartData: [],
              tradeVolumeChartData: [],
              averageCashInvested: 0,
            },
          }),
        );
      }
      public terminate(): void {}
    },
  );
  const toastRoot = document.createElement("div");
  toastRoot.id = "toast-root";
  document.body.append(toastRoot);
});

beforeEach(() => {
  vi.useFakeTimers();
  network = mockNetworkStatus();
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibilityState,
  );
  network.setOnline(true);
  price = 1000;
  sendRequest.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint === "account/me") {
      return {
        id: "1",
        email: "a@example.com",
        username: "A",
        subscription: FREE_PLAN,
      };
    }
    if (endpoint === "trade-records") return { records: [HOLDING] };
    if (endpoint.startsWith("market/current-stock-info")) {
      return { "2330": { sid: "2330", name: "台積電", close: price } };
    }
    if (endpoint === "market/market-index") return {};
    return { data: [] };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

test("[ACCT-R18.15] refreshes the market data after a short drop without showing the notice", async () => {
  await renderDashboard();
  const stockRequests = countRequests("market/current-stock-info");
  const indexRequests = countRequests("market/market-index");

  network.setOnline(false);
  await advance(1000);
  network.setOnline(true);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();

  await advance(1999);
  expect(countRequests("market/current-stock-info")).toBe(stockRequests);
  await advance(1);
  expect(countRequests("market/current-stock-info")).toBe(stockRequests + 1);
  expect(countRequests("market/market-index")).toBe(indexRequests + 1);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("[ACCT-R18.18] refreshes the prices 2 seconds after switching back online", async () => {
  await renderMarketHoldings();
  expect(holdingRow()).toHaveTextContent("1,000");
  network.setOnline(false);
  await advance(3000);
  expect(screen.getByRole("status")).toHaveTextContent("沒有網路連線");

  // The browser sends no event while the app is in the background.
  act(() => {
    visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  network.setOnlineWithoutEvent(true);
  price = 1010;
  act(() => {
    visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await advance(1999);
  expect(holdingRow()).toHaveTextContent("1,000");
  await advance(1);
  expect(holdingRow()).toHaveTextContent("1,010");
});
