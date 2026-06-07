import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import LocalDatabase from "../../storage/localDatabase";
import type { MarketIndex, StockInfo } from "../../types";
import Api from "../../utils/api";

interface StockInfoState {
  sidStockInfoMap: { [sid: string]: StockInfo };
  sidHistoricalPricesMap: {
    [sid: string]: {
      daily?: { [date: string]: number };
      weekly?: { [date: string]: number };
      monthly?: { [date: string]: number };
    };
  };
  marketIndexHistoricalPricesMap: {
    tse?: { [date: string]: number };
    otc?: { [date: string]: number };
  };
  isWaitingHistoricalPrices: boolean;
  isWaitingMarketIndexHistoricalPrices: boolean;
  realtimePriceDate: string;
  tseIndexRealtimePrices: { [number: string]: number } & {
    yesterday_price?: number;
    last_fluct_price?: number;
  };
  otcIndexRealtimePrices: { [number: string]: number } & {
    yesterday_price?: number;
    last_fluct_price?: number;
  };
}

const initialState: StockInfoState = {
  sidStockInfoMap: {},
  sidHistoricalPricesMap: {},
  marketIndexHistoricalPricesMap: {},
  isWaitingHistoricalPrices: false,
  isWaitingMarketIndexHistoricalPrices: false,
  realtimePriceDate: "0000-00-00",
  tseIndexRealtimePrices: {},
  otcIndexRealtimePrices: {},
};

export const fetchRealtimeMarketIndex = createAsyncThunk(
  "stockInfo/fetchRealtimeMarketIndex",
  async (): Promise<MarketIndex> => {
    return await Api.sendRequest("market/market-index", "get");
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
    return response[sid];
  },
);

export const fetchMarketIndexHistoricalPrices = createAsyncThunk(
  "stockInfo/fetchMarketIndexHistoricalPrices",
  async (
    payload: { market: "tse" | "otc" },
    { dispatch },
  ): Promise<{ market: "tse" | "otc"; data: { date: string; price: number }[] }> => {
    const { market } = payload;
    const cachedPrices = await LocalDatabase.getMarketIndexHistoricalPrices(market);
    if (Object.keys(cachedPrices).length > 0) {
      dispatch(setMarketIndexHistoricalPrices({ market, prices: cachedPrices }));
    }

    const since = LocalDatabase.getNextMarketIndexHistoricalSinceDate(cachedPrices);
    const query = new URLSearchParams({ market });
    if (since) query.set("since", since);

    const response = await Api.sendRequest(
      `market/market-index-historical-prices?${query.toString()}`,
      "get",
    );
    const data: { date: string; price: number }[] = response.data.map(
      (row: { date: string; price: number }) => ({
        date: new Date(Date.parse(row.date)).toLocaleDateString("af"),
        price: row.price,
      }),
    );
    await LocalDatabase.putMarketIndexHistoricalPrices(market, data);
    return { market, data };
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
    setMarketIndexHistoricalPrices: (
      state,
      action: PayloadAction<{
        market: "tse" | "otc";
        prices: { [date: string]: number };
      }>,
    ) => {
      state.marketIndexHistoricalPricesMap[action.payload.market] =
        action.payload.prices;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRealtimeMarketIndex.pending, () => {})
      .addCase(fetchRealtimeMarketIndex.fulfilled, (state, action) => {
        state.realtimePriceDate = action.payload.date || "0000-00-00";
        state.tseIndexRealtimePrices = action.payload.tse;
        state.otcIndexRealtimePrices = action.payload.otc;
      })
      .addCase(fetchRealtimeMarketIndex.rejected, () => {})

      .addCase(fetchStockInfo.pending, () => {})
      .addCase(fetchStockInfo.fulfilled, (state, action) => {
        for (const [sid, info] of Object.entries(action.payload)) {
          state.sidStockInfoMap[sid] = info;
        }
      })
      .addCase(fetchStockInfo.rejected, () => {})

      .addCase(fetchSingleStockInfo.pending, () => {})
      .addCase(fetchSingleStockInfo.fulfilled, (state, action) => {
        const { sid, close } = action.payload;
        state.sidStockInfoMap[sid] = action.payload;
        if (!(sid in state.sidHistoricalPricesMap)) {
          state.sidHistoricalPricesMap[sid] = {};
        }
        const historicalPrices = state.sidHistoricalPricesMap[sid];
        if (!historicalPrices.daily) {
          historicalPrices.daily = {};
        }
        historicalPrices.daily[new Date().toLocaleDateString("af")] = close;
      })
      .addCase(fetchSingleStockInfo.rejected, () => {})

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

      .addCase(fetchMarketIndexHistoricalPrices.pending, (state) => {
        state.isWaitingMarketIndexHistoricalPrices = true;
      })
      .addCase(fetchMarketIndexHistoricalPrices.fulfilled, (state, action) => {
        const { market, data } = action.payload;
        const daily = (state.marketIndexHistoricalPricesMap[market] ??= {});
        data.forEach((row) => {
          daily[row.date] = row.price;
        });
        state.isWaitingMarketIndexHistoricalPrices = false;
      })
      .addCase(fetchMarketIndexHistoricalPrices.rejected, (state) => {
        state.isWaitingMarketIndexHistoricalPrices = false;
      });
  },
});

export const { setMarketIndexHistoricalPrices } = stockInfoSlice.actions;
export default stockInfoSlice.reducer;
