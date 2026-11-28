import { act, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, expect, type Mock, test, vi } from "vitest";

import OfflineNotice from "../../../components/OfflineNotice/OfflineNotice";
import { store } from "../../../redux/store";
import { mockNetworkStatus } from "../../../testing/network";
import { DESKTOP, mockViewport } from "../../../testing/viewport";
import Api from "../../../utils/api";
import Details from "./Details";

vi.mock("../../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));
vi.mock("../../../storage/localDatabase");
vi.mock(
  "../../../components/HistoricalPriceLineChart/HistoricalPriceLineChart",
  () => ({ default: () => null }),
);
vi.mock("../../../components/StockIntradayLineChart/StockIntradayLineChart", () => ({
  default: () => null,
}));
vi.mock("../../../components/InventoryHistogram/InventoryHistogram", () => ({
  default: () => null,
}));

const sendRequest = Api.sendRequest as Mock;
let price = 23.45;
let network: ReturnType<typeof mockNetworkStatus>;

async function advance(milliseconds: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(milliseconds));
}

beforeAll(() => {
  const observer = class {
    public observe(): void {}
    public unobserve(): void {}
    public disconnect(): void {}
  };
  Object.assign(window, { IntersectionObserver: observer, ResizeObserver: observer });

  // jsdom has no Worker; the inventory histogram does not matter here.
  vi.stubGlobal(
    "Worker",
    class {
      public onmessage: ((event: { data: number[] }) => void) | null = null;
      public postMessage(): void {
        queueMicrotask(() => this.onmessage?.({ data: [] }));
      }
      public terminate(): void {}
    },
  );
});

beforeEach(() => {
  vi.useFakeTimers();
  network = mockNetworkStatus();
  network.setOnline(true);
  sendRequest.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint.startsWith("market/current-stock-info")) {
      if (!network.isOnline()) throw new TypeError("Failed to fetch");
      return { "2330": { sid: "2330", name: "台積電", close: price } };
    }
    if (endpoint.startsWith("market/intraday-prices")) return { date: null };
    if (endpoint.startsWith("market/historical-prices")) return { data: [] };
    return {};
  });
});

afterEach(() => {
  vi.useRealTimers();
});

test("[ACCT-R18.16] shows the new price 2 seconds after the network is back", async () => {
  mockViewport(DESKTOP);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/market/2330"]}>
        <Routes>
          <Route
            path="/market/:sid"
            element={
              <>
                <Details />
                <OfflineNotice narrowPlacement="aboveNavigationBar" />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  await advance(0);
  expect(screen.getByText("23.45")).toBeInTheDocument();

  network.setOnline(false);
  price = 23.55;
  await advance(60_000);
  expect(screen.getByRole("status")).toHaveTextContent("沒有網路連線");
  network.setOnline(true);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();

  await advance(1999);
  expect(screen.getByText("23.45")).toBeInTheDocument();
  await advance(1);
  expect(screen.getByText("23.55")).toBeInTheDocument();
});
