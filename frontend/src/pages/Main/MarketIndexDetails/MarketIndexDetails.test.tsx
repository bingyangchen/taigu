import { configureStore } from "@reduxjs/toolkit";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { matchRoutes, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import MarketIndexSummary from "../../../components/MarketIndexSummary/MarketIndexSummary";
import mainPage from "../../../redux/slices/MainPageSlice";
import stockInfo, {
  fetchMarketIndexHistoricalPrices,
  fetchRealtimeMarketIndex,
} from "../../../redux/slices/StockInfoSlice";
import router from "../../../router";
import LocalDatabase from "../../../storage/localDatabase";
import type { MarketId, MarketIndex } from "../../../types";
import Api from "../../../utils/api";
import MarketIndexDetails from "./MarketIndexDetails";

const user = userEvent.setup();

vi.mock("../../../utils/api", () => ({
  ApiError: class extends Error {
    public readonly status: number;

    public constructor(_payload: object, status: number) {
      super();
      this.status = status;
    }
  },
  default: { sendRequest: vi.fn() },
}));
vi.mock("../../../redux/slices/TradeRecordSlice", () => ({ default: () => ({}) }));
vi.mock("../Details/Details", () => ({ default: () => null }));
vi.mock("../../../storage/localDatabase");
vi.mock("../../../components/MarketIndexLineChart/MarketIndexLineChart", () => ({
  default: ({ data }: { data: [number, number][] }) => (
    <span data-testid="sparkline">{JSON.stringify(data)}</span>
  ),
}));
vi.mock("../../../components", async () => ({
  SegmentedControl: (
    await vi.importActual<
      typeof import("../../../components/SegmentedControl/SegmentedControl")
    >("../../../components/SegmentedControl/SegmentedControl")
  ).default,
  RoundButton: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>回儀表板</button>
  ),
  Skeleton: () => null,
  SpeedDial: () => null,
  MarketIndexIntradayLineChart: ({
    label,
    data,
  }: {
    label: string;
    data: [number, number][];
  }) => <div aria-label={label}>{JSON.stringify(data)}</div>,
  MarketIndexHistoricalLineChart: ({
    label,
    dates,
    values,
  }: {
    label: string;
    dates: string[];
    values: number[];
  }) => (
    <div aria-label={label}>
      {JSON.stringify(dates.map((date, index) => [date, values[index]]))}
    </div>
  ),
}));

const today = "2026-11-24";
const yesterday = "2026-11-23";
const quotes: MarketIndex = {
  date: today,
  dates: { tse: today, otc: today },
  tse: { 0: 23010, 90: 23100.5, yesterday_price: 23000, last_fluct_price: 100.5 },
  otc: { 0: 249, 90: 252.5, yesterday_price: 250, last_fluct_price: 2.5 },
};

type History = { data: { date: string; price: number }[] };

const sendRequest = vi.mocked(Api.sendRequest);
const readHistoryCache = vi.mocked(LocalDatabase.getMarketIndexHistoricalPrices);
const nextHistoryDate = vi.mocked(LocalDatabase.getNextMarketIndexHistoricalSinceDate);
const writeHistoryCache = vi.mocked(LocalDatabase.putMarketIndexHistoricalPrices);

function mockQuotes(
  intraday: MarketIndex | Error = quotes,
  getHistory: (market: MarketId) => History | Promise<History> = () => ({ data: [] }),
) {
  sendRequest.mockImplementation(async (endpoint) => {
    if (endpoint === "market/market-index") {
      if (intraday instanceof Error) throw intraday;
      return intraday;
    }
    const market = new URLSearchParams(endpoint.split("?")[1]).get("market");
    if (market !== "tse" && market !== "otc") throw new Error(endpoint);
    return getHistory(market);
  });
}

function makeStore() {
  return configureStore({ reducer: { mainPage, stockInfo } });
}

async function showPage({
  fromDashboard = false,
  intraday = quotes,
  getHistory,
}: {
  fromDashboard?: boolean;
  intraday?: MarketIndex | Error;
  getHistory?: (market: MarketId) => History | Promise<History>;
} = {}) {
  mockQuotes(intraday, getHistory);
  const testStore = makeStore();
  await testStore.dispatch(fetchRealtimeMarketIndex());
  await act(async () => {
    render(
      <Provider store={testStore}>
        <MemoryRouter initialEntries={[fromDashboard ? "/" : "/market-index"]}>
          <Routes>
            <Route path="/" element={<MarketIndexSummary />} />
            <Route path="/market-index" element={<MarketIndexDetails />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
  });
  return testStore;
}

async function selectOneMonth() {
  await user.click(screen.getByRole("tab", { name: /^1M/ }));
}

function getHistoryPoints(market: "加權指數" | "櫃買指數"): [string, number][] {
  return JSON.parse(
    screen.getByLabelText(`${market}歷史走勢（點）`).textContent ?? "[]",
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  readHistoryCache.mockResolvedValue({});
  nextHistoryDate.mockReturnValue(null);
  writeHistoryCache.mockResolvedValue(undefined);
});

test("[MKT-R13.1] shares the last trading date and keeps both intraday summaries", async () => {
  await showPage({
    fromDashboard: true,
    intraday: {
      ...quotes,
      dates: { tse: "2026-11-20", otc: "2026-11-20" },
      tse: { 0: 22990, 270: 22880, yesterday_price: 23000, last_fluct_price: -120 },
    },
  });
  expect(screen.getAllByText("行情日期 2026/11/20")).toHaveLength(1);
  expect(screen.getByText("22,880")).toBeVisible();
  expect(screen.getByText("▼120 (0.52%)")).toBeVisible();
  expect(screen.getAllByTestId("sparkline")).toHaveLength(2);
  expect(screen.getAllByTestId("sparkline")[0]).toHaveTextContent("[270,22880]");
  expect(screen.getAllByTestId("sparkline")[1]).toHaveTextContent("[90,252.5]");
});

test("[MKT-R13.3] shows a loading card until the first quote arrives", async () => {
  sendRequest.mockReturnValue(new Promise(() => {}));
  const testStore = makeStore();
  void testStore.dispatch(fetchRealtimeMarketIndex());
  render(
    <Provider store={testStore}>
      <MemoryRouter>
        <MarketIndexSummary />
      </MemoryRouter>
    </Provider>,
  );
  expect(screen.getByText("讀取行情中")).toBeVisible();
  expect(screen.queryByText("--")).not.toBeInTheDocument();
});

test("[MKT-R13.4] shows that there are no quotes yet", async () => {
  await showPage({
    fromDashboard: true,
    intraday: { ...quotes, dates: { tse: null, otc: null }, tse: {}, otc: {} },
  });
  expect(screen.getByText("目前沒有行情")).toBeVisible();
  expect(screen.getByRole("link", { name: /大盤指數/ })).toHaveAttribute(
    "href",
    "/market-index",
  );
});

test("[MKT-R13.5] keeps both summaries when an update fails", async () => {
  const testStore = await showPage({ fromDashboard: true });
  sendRequest.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await testStore.dispatch(fetchRealtimeMarketIndex());
  });
  expect(screen.getByText("更新失敗，顯示上次行情")).toBeVisible();
  expect(screen.getByText("23,100.5")).toBeVisible();
  expect(screen.getByText("252.5")).toBeVisible();
  expect(screen.getAllByTestId("sparkline")).toHaveLength(2);
});

test("[MKT-R13.7] shows cached quotes as a failed update when opened offline", async () => {
  mockQuotes();
  sendRequest.mockImplementationOnce(async (_endpoint, _method, _body, options) => {
    options?.onCacheFallback?.();
    return quotes;
  });
  const testStore = makeStore();
  await testStore.dispatch(fetchRealtimeMarketIndex());
  render(
    <Provider store={testStore}>
      <MemoryRouter>
        <MarketIndexSummary />
      </MemoryRouter>
    </Provider>,
  );
  expect(screen.getByText("更新失敗，顯示上次行情")).toBeVisible();
  expect(screen.getByText("23,100.5")).toBeVisible();
  expect(screen.getByText("252.5")).toBeVisible();
  expect(screen.getAllByTestId("sparkline")).toHaveLength(2);
});

test("[MKT-R13.6] shows a failed first read", async () => {
  await showPage({ fromDashboard: true, intraday: new Error("offline") });
  expect(screen.getByText("行情讀取失敗")).toBeVisible();
  expect(screen.getByRole("link", { name: /大盤指數/ })).toHaveAttribute(
    "href",
    "/market-index",
  );
});

test("[MKT-R13.2] all card content belongs to one keyboard-operable link", async () => {
  await showPage({ fromDashboard: true });
  const link = screen.getByRole("link", { name: /大盤指數/ });
  expect(screen.getAllByRole("link")).toEqual([link]);
  expect(link).toHaveAttribute("href", "/market-index");
  for (const text of ["大盤指數", "加權指數", "櫃買指數"]) {
    expect(link).toContainElement(screen.getByText(text));
  }
  await user.tab();
  expect(link).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(
    await screen.findByRole("heading", { level: 1, name: "大盤指數" }),
  ).toBeVisible();
});

test("[MKT-R14.1] opens both intraday charts and starts both historical queries", async () => {
  await showPage({ fromDashboard: true });
  await act(async () => {
    fireEvent.click(screen.getByText("櫃買指數"));
  });
  expect(screen.getByRole("tab", { name: "今日" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByText("行情日期 2026/11/24")).toBeVisible();
  expect(screen.getByText("23,100.5")).toBeVisible();
  expect(screen.getByText("▲100.5 (0.44%)")).toBeVisible();
  expect(screen.getByLabelText("加權指數今日走勢（點）")).toHaveTextContent(
    "[[0,23010],[90,23100.5]]",
  );
  expect(screen.getByLabelText("櫃買指數今日走勢（點）")).toBeVisible();
  await waitFor(() => {
    const endpoints = sendRequest.mock.calls.map(([endpoint]) => endpoint);
    expect(endpoints).toContain("market/market-index-historical-prices?market=tse");
    expect(endpoints).toContain("market/market-index-historical-prices?market=otc");
  });
});

test("[MKT-R14.2] opens both charts on a direct visit and returns to the dashboard", async () => {
  await showPage();

  expect(screen.getByLabelText("加權指數今日走勢（點）")).toBeVisible();
  expect(screen.getByLabelText("櫃買指數今日走勢（點）")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "回儀表板" }));
  expect(screen.getByRole("link", { name: /大盤指數/ })).toBeVisible();
});

test.each(["/market-index/tse", "/market-index/otc"])(
  "[MKT-R14.13] uses the not-found route for %s",
  (path) => {
    expect(matchRoutes(router.routes, path)?.at(-1)?.route.path).toBe("*");
  },
);

test("[MKT-R14.5] a slow OTC query does not hold back the TSE chart", async () => {
  let finishOtc: (value: History) => void = () => {};
  const pending = new Promise<History>((resolve) => {
    finishOtc = resolve;
  });
  await showPage({
    getHistory: (market) =>
      market === "otc" ? pending : { data: [{ date: yesterday, price: 23000 }] },
  });
  await selectOneMonth();
  expect(await screen.findByLabelText("加權指數歷史走勢（點）")).toBeVisible();
  expect(screen.getByText("正在載入歷史走勢")).toBeVisible();
  expect(screen.queryByLabelText("櫃買指數歷史走勢（點）")).not.toBeInTheDocument();
  await act(async () => finishOtc({ data: [{ date: yesterday, price: 250 }] }));
  expect(screen.getByLabelText("櫃買指數歷史走勢（點）")).toBeVisible();
});

test("[MKT-R14.6] preserves the quote when the historical chart has no dated points", async () => {
  await showPage({ intraday: { ...quotes, dates: { tse: today, otc: null } } });
  await selectOneMonth();
  const otc = within(screen.getByRole("region", { name: "櫃買指數" }));
  expect(await otc.findByText("目前沒有歷史走勢")).toBeVisible();
  expect(otc.getByText("252.5")).toBeVisible();
  expect(otc.getByText("行情日期不明")).toBeVisible();
  expect(screen.getByLabelText("加權指數歷史走勢（點）")).toBeVisible();
});

test("[MKT-R14.7] retries only the failed market without replacing the other chart", async () => {
  let otcRequests = 0;
  await showPage({
    getHistory: (market) => {
      if (market === "otc" && ++otcRequests === 1) throw new Error("offline");
      return { data: [{ date: yesterday, price: market === "tse" ? 23000 : 250 }] };
    },
  });
  await selectOneMonth();
  const retry = await screen.findByRole("button", { name: "重試" });
  const tseChart = await screen.findByLabelText("加權指數歷史走勢（點）");
  fireEvent.click(retry);
  expect(await screen.findByLabelText("櫃買指數歷史走勢（點）")).toBeVisible();
  expect(otcRequests).toBe(2);
  expect(screen.getByLabelText("加權指數歷史走勢（點）")).toBe(tseChart);
  expect(
    sendRequest.mock.calls.filter(([endpoint]) => endpoint.endsWith("market=tse")),
  ).toHaveLength(1);
});

test("[MKT-R14.8] keeps cached historical points when the update fails", async () => {
  readHistoryCache.mockImplementation(async (market) =>
    market === "otc" ? { [yesterday]: 251 } : {},
  );
  await showPage({
    getHistory: (market) => {
      if (market === "otc") throw new Error("offline");
      return { data: [] };
    },
  });
  await selectOneMonth();
  expect(await screen.findByText("更新失敗，顯示上次取得的走勢")).toBeVisible();
  expect(getHistoryPoints("櫃買指數")).toEqual([
    [yesterday, 251],
    [today, 252.5],
  ]);
});

test("preserves newer intraday charts after a service worker fallback", async () => {
  const store = await showPage();
  sendRequest.mockImplementationOnce(async (_endpoint, _method, _body, options) => {
    options?.onCacheFallback?.();
    return {
      ...quotes,
      dates: { tse: yesterday, otc: null },
      tse: { 90: 22000 },
      otc: {},
    };
  });
  await act(async () => {
    await store.dispatch(fetchRealtimeMarketIndex());
  });

  expect(screen.getByText("行情日期 2026/11/24")).toBeVisible();
  expect(screen.getByLabelText("加權指數今日走勢（點）")).toHaveTextContent("23100.5");
  expect(screen.getByLabelText("櫃買指數今日走勢（點）")).toHaveTextContent("252.5");
  expect(screen.getAllByText("更新失敗，顯示上次取得的走勢")).toHaveLength(2);
});

test("uses a newer fallback point per index during repeated slow responses", async () => {
  const store = await showPage();
  sendRequest.mockImplementationOnce(async (_endpoint, _method, _body, options) => {
    options?.onCacheFallback?.();
    return {
      ...quotes,
      dates: { tse: today, otc: yesterday },
      tse: { ...quotes.tse, 120: 23120 },
      otc: { ...quotes.otc, 120: 245 },
    };
  });
  await act(async () => {
    await store.dispatch(fetchRealtimeMarketIndex());
  });

  expect(screen.getByLabelText("加權指數今日走勢（點）")).toHaveTextContent("23120");
  expect(screen.getByLabelText("櫃買指數今日走勢（點）")).toHaveTextContent("252.5");
  expect(screen.getAllByText("更新失敗，顯示上次取得的走勢")).toHaveLength(2);
});

test("renders the network history when IndexedDB cannot read or write", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    readHistoryCache.mockRejectedValue(new Error("read unavailable"));
    writeHistoryCache.mockRejectedValue(new Error("write unavailable"));
    await showPage({
      getHistory: (market) => ({
        data: [{ date: yesterday, price: market === "tse" ? 23000 : 251 }],
      }),
    });
    await selectOneMonth();
    expect(getHistoryPoints("加權指數")).toContainEqual([yesterday, 23000]);
    expect(getHistoryPoints("櫃買指數")).toContainEqual([yesterday, 251]);
  } finally {
    warning.mockRestore();
  }
});

test("preserves newer history when a later cache read succeeds", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const earlier = "2026-11-20";
    readHistoryCache.mockImplementation(async (market) =>
      market === "tse" ? { [earlier]: 22900 } : {},
    );
    writeHistoryCache.mockRejectedValue(new Error("write unavailable"));
    const store = await showPage({
      getHistory: () => ({ data: [{ date: yesterday, price: 23000 }] }),
    });
    await selectOneMonth();
    expect(getHistoryPoints("加權指數")).toContainEqual([yesterday, 23000]);

    sendRequest.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await store.dispatch(fetchMarketIndexHistoricalPrices({ market: "tse" }));
    });

    expect(screen.getByText("更新失敗，顯示上次取得的走勢")).toBeVisible();
    expect(getHistoryPoints("加權指數")).toContainEqual([earlier, 22900]);
    expect(getHistoryPoints("加權指數")).toContainEqual([yesterday, 23000]);
  } finally {
    warning.mockRestore();
  }
});

test("[MKT-R14.9] presents different dates and places the OTC quote on its own date", async () => {
  await showPage({
    fromDashboard: true,
    intraday: { ...quotes, dates: { tse: today, otc: yesterday } },
    getHistory: () => ({ data: [{ date: yesterday, price: 200 }] }),
  });
  expect(screen.getByText("行情日期 2026/11/24")).toBeVisible();
  expect(screen.getByText("行情日期 2026/11/23")).toBeVisible();
  await act(async () => {
    fireEvent.click(screen.getByRole("link", { name: /大盤指數/ }));
  });
  await selectOneMonth();
  expect(screen.getByText("行情日期 2026/11/24")).toBeVisible();
  expect(screen.getByText("行情日期 2026/11/23")).toBeVisible();
  await screen.findByLabelText("櫃買指數歷史走勢（點）");
  expect(getHistoryPoints("櫃買指數")).toEqual([[yesterday, 252.5]]);
});

test("[MKT-R14.10] retries the shared intraday request once", async () => {
  await showPage({ intraday: new Error("offline") });
  expect(screen.getByText("盤中行情讀取失敗")).toBeVisible();
  expect(screen.queryByText("目前沒有盤中走勢")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "重試" })).toHaveLength(1);
  mockQuotes();
  fireEvent.click(screen.getByRole("button", { name: "重試" }));
  expect(await screen.findByLabelText("加權指數今日走勢（點）")).toBeVisible();
  expect(screen.getByLabelText("櫃買指數今日走勢（點）")).toBeVisible();
  expect(
    sendRequest.mock.calls.filter(([endpoint]) => endpoint === "market/market-index"),
  ).toHaveLength(2);
});

test("keeps focus on the shared retry during a background request that fails", async () => {
  const store = await showPage({ intraday: new Error("offline") });
  const retry = screen.getByRole("button", { name: "重試" });
  retry.focus();
  let rejectRequest: (error: Error) => void = () => {};
  sendRequest.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
  );
  let request: Promise<unknown> = Promise.resolve();
  await act(async () => {
    request = store.dispatch(fetchRealtimeMarketIndex());
  });
  expect(retry).toHaveFocus();
  expect(retry).toHaveAttribute("aria-disabled", "true");
  await act(async () => {
    rejectRequest(new Error("offline again"));
    await request;
  });
  expect(retry).toHaveFocus();
  expect(retry).toHaveAttribute("aria-disabled", "false");
});

test("[MKT-R14.12] ignores the legacy shared date for both quotes", async () => {
  const legacyQuotes = { ...quotes, dates: undefined };
  await showPage({
    fromDashboard: true,
    intraday: legacyQuotes,
    getHistory: () => ({ data: [{ date: yesterday, price: 100 }] }),
  });
  expect(screen.getAllByText("行情日期不明")).toHaveLength(2);
  expect(screen.getByText("23,100.5")).toBeVisible();
  expect(screen.getByText("252.5")).toBeVisible();
  await act(async () => {
    fireEvent.click(screen.getByRole("link", { name: /大盤指數/ }));
  });
  await selectOneMonth();
  await screen.findByLabelText("櫃買指數歷史走勢（點）");
  expect(screen.getAllByText("行情日期不明")).toHaveLength(2);
  expect(screen.getByText("23,100.5")).toBeVisible();
  expect(screen.getByText("252.5")).toBeVisible();
  expect(getHistoryPoints("加權指數")).toEqual([[yesterday, 100]]);
  expect(getHistoryPoints("櫃買指數")).toEqual([[yesterday, 100]]);
});

test("[MKT-R15.1] applies each range to both charts and replaces a same-date close", async () => {
  const rows = Array.from({ length: 49 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 10, 23 - index)).toISOString().slice(0, 10),
    price: 200 - index,
  }));
  const firstDate = "2025-10-20";
  await showPage({
    getHistory: (market) => ({
      data:
        market === "tse"
          ? [...rows.slice(0, 35), { date: firstDate, price: 15000 }]
          : [{ date: today, price: 250 }, ...rows],
    }),
  });
  await selectOneMonth();
  await screen.findByLabelText("櫃買指數歷史走勢（點）");
  expect(screen.getByRole("tab", { name: /^1M/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(getHistoryPoints("加權指數")).toHaveLength(30);
  expect(getHistoryPoints("加權指數").at(-1)).toEqual([today, 23100.5]);
  expect(getHistoryPoints("櫃買指數")).toHaveLength(30);
  expect(getHistoryPoints("櫃買指數").at(-1)).toEqual([today, 252.5]);
  await user.click(screen.getByRole("tab", { name: /^ALL/ }));
  expect(getHistoryPoints("加權指數")).toHaveLength(37);
  expect(getHistoryPoints("加權指數")[0]).toEqual([firstDate, 15000]);
  expect(getHistoryPoints("櫃買指數")).toHaveLength(50);
  expect(sendRequest).toHaveBeenCalledTimes(3);
  expect(writeHistoryCache).toHaveBeenCalledWith(
    "tse",
    expect.not.arrayContaining([expect.objectContaining({ date: today })]),
  );
});

test("[MKT-R15.2] plots a lone dated intraday point after history loads", async () => {
  await showPage();
  await selectOneMonth();
  await screen.findByLabelText("加權指數歷史走勢（點）");
  expect(getHistoryPoints("加權指數")).toEqual([[today, 23100.5]]);
});
