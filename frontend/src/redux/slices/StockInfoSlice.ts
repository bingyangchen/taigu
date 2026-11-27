import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import LocalDatabase from "../../storage/localDatabase";
import type {
  MarketId,
  MarketIndex,
  MarketIndexIntradayPrices,
  StockInfo,
  StockIntradayPrices,
} from "../../types";
import Api from "../../utils/api";
import {
  makeMarketIndexQuote,
  MARKET_IDS,
  type MarketIndexQuote,
} from "../../utils/marketIndex";
import { assertCurrentSession, getDocumentSessionVersion } from "../../utils/session";
import type { RootState } from "../store";

export type MarketIndexQueryStatus =
  | "idle"
  | "loading"
  | "ready"
  | "failed"
  | "retrying";

function isMarketIndexRequestPending(status: MarketIndexQueryStatus): boolean {
  return status === "loading" || status === "retrying";
}

function canReplaceMarketIndexQuote(
  current: MarketIndexQuote,
  cached: MarketIndexQuote,
): boolean {
  const currentPoint = current.points.at(-1);
  if (!currentPoint) return true;
  const cachedPoint = cached.points.at(-1);
  if (!cachedPoint || !current.date || !cached.date) return false;
  return (
    cached.date > current.date ||
    (cached.date === current.date && cachedPoint[0] > currentPoint[0])
  );
}

interface StockInfoState {
  sidStockInfoMap: { [sid: string]: StockInfo };
  sidIntradayPricesMap: { [sid: string]: StockIntradayPrices };
  sidHistoricalPricesMap: {
    [sid: string]: {
      daily?: { [date: string]: number };
      weekly?: { [date: string]: number };
      monthly?: { [date: string]: number };
    };
  };
  marketIndexHistoricalPricesMap: Partial<Record<MarketId, Record<string, number>>>;
  marketIndexHistoricalStatus: Record<MarketId, MarketIndexQueryStatus>;
  marketIndexRealtimeStatus: MarketIndexQueryStatus;
  marketIndexRealtimeDates: Record<MarketId, string | null>;
  marketIndexRealtimePrices: Record<MarketId, MarketIndexIntradayPrices>;
  isWaitingHistoricalPrices: boolean;
  isWaitingIntradayPrices: boolean;
}

const initialState: StockInfoState = {
  sidStockInfoMap: {},
  sidIntradayPricesMap: {},
  sidHistoricalPricesMap: {},
  marketIndexHistoricalPricesMap: {},
  isWaitingHistoricalPrices: false,
  isWaitingIntradayPrices: false,
  marketIndexHistoricalStatus: { tse: "idle", otc: "idle" },
  marketIndexRealtimeStatus: "idle",
  marketIndexRealtimeDates: { tse: null, otc: null },
  marketIndexRealtimePrices: { tse: {}, otc: {} },
};

export const fetchRealtimeMarketIndex = createAsyncThunk(
  "stockInfo/fetchRealtimeMarketIndex",
  async () => {
    let isCached = false;
    const data: MarketIndex = await Api.sendRequest(
      "market/market-index",
      "get",
      undefined,
      {
        onCacheFallback: () => {
          isCached = true;
        },
      },
    );
    return { data, isCached };
  },
  {
    condition: (_, { getState }) =>
      !isMarketIndexRequestPending(
        (getState() as RootState).stockInfo.marketIndexRealtimeStatus,
      ),
  },
);

export const fetchStockInfo = createAsyncThunk(
  "stockInfo/fetchStockInfo",
  async (sids: string[]): Promise<{ [sid: string]: StockInfo }> => {
    return await Api.sendRequest(
      `market/current-stock-info${sids.length > 0 ? `?sids=${sids.join(",")}` : ""}`,
      "get",
    );
  },
);

export const fetchSingleStockInfo = createAsyncThunk(
  "stockInfo/fetchSingleStockInfo",
  async (sid: string): Promise<StockInfo> => {
    const response = await Api.sendRequest(
      `market/current-stock-info?sids=${sid}`,
      "get",
    );
    const stockInfo: StockInfo | undefined = response[sid];

    // The endpoint leaves out a stock that has no price yet.
    if (!stockInfo) throw new Error(`No current stock info for ${sid}`);
    return stockInfo;
  },
);

export const fetchMarketIndexHistoricalPrices = createAsyncThunk(
  "stockInfo/fetchMarketIndexHistoricalPrices",
  async ({ market }: { market: MarketId }, { dispatch }) => {
    const sessionVersion = getDocumentSessionVersion();
    const cachedPrices = await LocalDatabase.getMarketIndexHistoricalPrices(
      market,
    ).catch((error: unknown) => {
      console.warn("Could not read cached market index history", error);
      return {};
    });
    assertCurrentSession(sessionVersion);
    if (Object.keys(cachedPrices).length > 0) {
      dispatch(restoreMarketIndexHistoricalPrices({ market, prices: cachedPrices }));
    }

    const since = LocalDatabase.getNextMarketIndexHistoricalSinceDate(cachedPrices);
    const query = new URLSearchParams({ market });
    if (since) query.set("since", since);

    let isCached = false;
    const response: { data: { date: string; price: number }[] } = await Api.sendRequest(
      `market/market-index-historical-prices?${query.toString()}`,
      "get",
      undefined,
      {
        onCacheFallback: () => {
          isCached = true;
        },
      },
    );
    assertCurrentSession(sessionVersion);
    if (!isCached) {
      await LocalDatabase.putMarketIndexHistoricalPrices(market, response.data).catch(
        (error: unknown) =>
          console.warn("Could not save cached market index history", error),
      );
    }
    assertCurrentSession(sessionVersion);
    return { market, data: response.data, isCached };
  },
  {
    condition: ({ market }, { getState }) =>
      !isMarketIndexRequestPending(
        (getState() as RootState).stockInfo.marketIndexHistoricalStatus[market],
      ),
  },
);

export const fetchSingleStockIntradayPrices = createAsyncThunk(
  "stockInfo/fetchSingleStockIntradayPrices",
  async (sid: string): Promise<{ sid: string; data: StockIntradayPrices }> => {
    const response: StockIntradayPrices = await Api.sendRequest(
      `market/intraday-prices?sid=${sid}`,
      "get",
    );
    return { sid, data: response };
  },
);

export const fetchSingleStockHistoricalPrices = createAsyncThunk(
  "stockInfo/fetchSingleStockHistoricalPrices",
  async (payload: {
    sid: string;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  }): Promise<{
    sid: string;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    data: { date: string; price: number }[];
  }> => {
    const { sid, frequency } = payload;
    const response = await Api.sendRequest(
      `market/historical-prices?sid=${sid}&frequency=${frequency}`,
      "get",
    );
    const data: { date: string; price: number }[] = response.data.map(
      (row: { date: string; price: number }) => {
        return {
          date: new Date(Date.parse(row.date)).toLocaleDateString("af"),
          price: row.price,
        };
      },
    );
    return { sid, frequency, data };
  },
);

export const stockInfoSlice = createSlice({
  name: "stockInfo",
  initialState,
  reducers: {
    restoreMarketIndexHistoricalPrices: (
      state,
      action: PayloadAction<{ market: MarketId; prices: { [date: string]: number } }>,
    ) => {
      const { market, prices } = action.payload;
      state.marketIndexHistoricalPricesMap[market] = {
        ...prices,
        ...state.marketIndexHistoricalPricesMap[market],
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRealtimeMarketIndex.pending, (state) => {
        state.marketIndexRealtimeStatus =
          state.marketIndexRealtimeStatus === "failed" ? "retrying" : "loading";
      })
      .addCase(fetchRealtimeMarketIndex.fulfilled, (state, action) => {
        const { data, isCached } = action.payload;
        for (const market of MARKET_IDS) {
          const date = data.dates?.[market] ?? null;
          if (
            isCached &&
            !canReplaceMarketIndexQuote(
              makeMarketIndexQuote(
                state.marketIndexRealtimePrices[market],
                state.marketIndexRealtimeDates[market],
              ),
              makeMarketIndexQuote(data[market], date),
            )
          ) {
            continue;
          }
          state.marketIndexRealtimeDates[market] = date;
          state.marketIndexRealtimePrices[market] = data[market];
        }
        state.marketIndexRealtimeStatus = isCached ? "failed" : "ready";
      })
      .addCase(fetchRealtimeMarketIndex.rejected, (state) => {
        state.marketIndexRealtimeStatus = "failed";
      })

      .addCase(fetchStockInfo.pending, () => {})
      .addCase(fetchStockInfo.fulfilled, (state, action) => {
        for (const [sid, info] of Object.entries(action.payload)) {
          state.sidStockInfoMap[sid] = info;
        }
      })
      .addCase(fetchStockInfo.rejected, () => {})

      .addCase(fetchSingleStockInfo.pending, () => {})
      .addCase(fetchSingleStockInfo.fulfilled, (state, action) => {
        const { sid, close, date } = action.payload;
        state.sidStockInfoMap[sid] = action.payload;
        if (!(sid in state.sidHistoricalPricesMap)) {
          state.sidHistoricalPricesMap[sid] = {};
        }
        const historicalPrices = state.sidHistoricalPricesMap[sid];
        if (!historicalPrices.daily) {
          historicalPrices.daily = {};
        }
        // On the quote's trading date, so a day without trading replaces the last
        // trading day's close with the same price instead of adding a point.
        historicalPrices.daily[date ?? new Date().toLocaleDateString("af")] = close;
      })
      .addCase(fetchSingleStockInfo.rejected, () => {})

      .addCase(fetchSingleStockIntradayPrices.pending, (state) => {
        state.isWaitingIntradayPrices = true;
      })
      .addCase(fetchSingleStockIntradayPrices.fulfilled, (state, action) => {
        const { sid, data } = action.payload;
        state.sidIntradayPricesMap[sid] = data;
        state.isWaitingIntradayPrices = false;
      })
      .addCase(fetchSingleStockIntradayPrices.rejected, (state) => {
        state.isWaitingIntradayPrices = false;
      })

      .addCase(fetchSingleStockHistoricalPrices.pending, (state) => {
        state.isWaitingHistoricalPrices = true;
      })
      .addCase(fetchSingleStockHistoricalPrices.fulfilled, (state, action) => {
        const { sid, frequency, data } = action.payload;
        if (!(sid in state.sidHistoricalPricesMap)) {
          state.sidHistoricalPricesMap[sid] = {};
        }
        const historicalPrices = state.sidHistoricalPricesMap[sid];
        if (frequency === "DAILY") {
          if (!historicalPrices.daily) {
            historicalPrices.daily = {};
          }
          const daily = historicalPrices.daily;
          data.forEach((row) => {
            daily[row.date] = row.price;
          });
        } else if (frequency === "WEEKLY") {
          if (!historicalPrices.weekly) {
            historicalPrices.weekly = {};
          }
          const weekly = historicalPrices.weekly;
          data.forEach((row) => {
            weekly[row.date] = row.price;
          });
        } else if (frequency === "MONTHLY") {
          if (!historicalPrices.monthly) {
            historicalPrices.monthly = {};
          }
          const monthly = historicalPrices.monthly;
          data.forEach((row) => {
            monthly[row.date] = row.price;
          });
        }
        state.isWaitingHistoricalPrices = false;
      })
      .addCase(fetchSingleStockHistoricalPrices.rejected, (state) => {
        state.isWaitingHistoricalPrices = false;
      })

      .addCase(fetchMarketIndexHistoricalPrices.pending, (state, action) => {
        const { market } = action.meta.arg;
        state.marketIndexHistoricalStatus[market] =
          state.marketIndexHistoricalStatus[market] === "failed"
            ? "retrying"
            : "loading";
      })
      .addCase(fetchMarketIndexHistoricalPrices.fulfilled, (state, action) => {
        const { market, data, isCached } = action.payload;
        const daily = (state.marketIndexHistoricalPricesMap[market] ??= {});
        data.forEach(({ date, price }) => {
          if (!isCached || !(date in daily)) daily[date] = price;
        });
        state.marketIndexHistoricalStatus[market] = isCached ? "failed" : "ready";
      })
      .addCase(fetchMarketIndexHistoricalPrices.rejected, (state, action) => {
        state.marketIndexHistoricalStatus[action.meta.arg.market] = "failed";
      });
  },
});

const { restoreMarketIndexHistoricalPrices } = stockInfoSlice.actions;
export default stockInfoSlice.reducer;
