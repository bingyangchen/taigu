import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { IndexPriceInfo, MarketIndex, StockInfo } from "../../types";
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
  isWaitingHistoricalPrices: boolean;
  tseIndexRealtimePrices: {
    [number: string]: IndexPriceInfo;
  };
  otcIndexRealtimePrices: {
    [number: string]: IndexPriceInfo;
  };
}

const initialState: StockInfoState = {
  sidStockInfoMap: {},
  sidHistoricalPricesMap: {},
  isWaitingHistoricalPrices: false,
  tseIndexRealtimePrices: {},
  otcIndexRealtimePrices: {},
};

export const fetchRealtimeMarketIndex = createAsyncThunk(
  "stockInfo/fetchRealtimeMarketIndex",
  async (): Promise<MarketIndex> => {
    return await Api.sendRequest("stock/market-index", "get");
  }
);

export const fetchStockInfo = createAsyncThunk(
  "stockInfo/fetchStockInfo",
  async (sids: string[]): Promise<{ [sid: string]: StockInfo }> => {
    return await Api.sendRequest(
      `stock/current-stock-info${sids.length > 0 ? `?sids=${sids.join(",")}` : ""}`,
      "get"
    );
  }
);

export const fetchSingleStockInfo = createAsyncThunk(
  "stockInfo/fetchSingleStockInfo",
  async (sid: string): Promise<StockInfo> => {
    const response = await Api.sendRequest(
      `stock/current-stock-info?sids=${sid}`,
      "get"
    );
    return response[sid];
  }
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
      `stock/historical-prices/${sid}?frequency=${frequency}`,
      "get"
    );
    const data: { date: string; price: number }[] = response.data.map(
      (row: { date: string; price: number }) => {
        return {
          date: new Date(Date.parse(row.date)).toLocaleDateString("af"),
          price: row.price,
        };
      }
    );
    return { sid, frequency, data };
  }
);

export const stockInfoSlice = createSlice({
  name: "stockInfo",
  initialState,
  reducers: {
    refreshMarketIndexWithNonCacheResponse(state, action: PayloadAction<MarketIndex>) {
      state.tseIndexRealtimePrices = action.payload.tse;
      state.otcIndexRealtimePrices = action.payload.otc;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRealtimeMarketIndex.pending, (state) => {})
      .addCase(fetchRealtimeMarketIndex.fulfilled, (state, action) => {
        state.tseIndexRealtimePrices = action.payload.tse;
        state.otcIndexRealtimePrices = action.payload.otc;
      })
      .addCase(fetchRealtimeMarketIndex.rejected, (state) => {})

      .addCase(fetchStockInfo.pending, (state) => {})
      .addCase(fetchStockInfo.fulfilled, (state, action) => {
        for (const [sid, info] of Object.entries(action.payload)) {
          state.sidStockInfoMap[sid] = info;
        }
      })
      .addCase(fetchStockInfo.rejected, (state) => {})

      .addCase(fetchSingleStockInfo.pending, (state) => {})
      .addCase(fetchSingleStockInfo.fulfilled, (state, action) => {
        state.sidStockInfoMap[action.payload.sid] = action.payload;
        if (!(action.payload.sid in state.sidHistoricalPricesMap)) {
          state.sidHistoricalPricesMap[action.payload.sid] = {};
        }
        if (!state.sidHistoricalPricesMap[action.payload.sid].daily) {
          state.sidHistoricalPricesMap[action.payload.sid].daily = {};
        }
        state.sidHistoricalPricesMap[action.payload.sid].daily![
          new Date().toLocaleDateString("af")
        ] = action.payload.close;
      })
      .addCase(fetchSingleStockInfo.rejected, (state) => {})

      .addCase(fetchSingleStockHistoricalPrices.pending, (state) => {
        state.isWaitingHistoricalPrices = true;
      })
      .addCase(fetchSingleStockHistoricalPrices.fulfilled, (state, action) => {
        const { sid, frequency, data } = action.payload;
        if (!(sid in state.sidHistoricalPricesMap)) {
          state.sidHistoricalPricesMap[sid] = {};
        }
        if (frequency === "DAILY") {
          if (!state.sidHistoricalPricesMap[sid].daily) {
            state.sidHistoricalPricesMap[sid].daily = {};
          }
          data.forEach((row) => {
            state.sidHistoricalPricesMap[sid].daily![row.date] = row.price;
          });
        } else if (frequency === "WEEKLY") {
          if (!state.sidHistoricalPricesMap[sid].weekly) {
            state.sidHistoricalPricesMap[sid].weekly = {};
          }
          data.forEach((row) => {
            state.sidHistoricalPricesMap[sid].weekly![row.date] = row.price;
          });
        } else if (frequency === "MONTHLY") {
          if (!state.sidHistoricalPricesMap[sid].monthly) {
            state.sidHistoricalPricesMap[sid].monthly = {};
          }
          data.forEach((row) => {
            state.sidHistoricalPricesMap[sid].monthly![row.date] = row.price;
          });
        }
        state.isWaitingHistoricalPrices = false;
      })
      .addCase(fetchSingleStockHistoricalPrices.rejected, (state) => {
        state.isWaitingHistoricalPrices = false;
      });
  },
});

export const getSidMarketValueMap = (
  sidStockInfoMap: { [sid: string]: StockInfo },
  stockWarehouse: { [sid: string]: number[] }
): { [sid: string]: number } => {
  const result: { [sid: string]: number } = {};
  for (const [sid, inventoryCosts] of Object.entries(stockWarehouse)) {
    result[sid] = calculateMarketValue(sidStockInfoMap[sid], inventoryCosts);
  }
  return result;
};

export const calculateMarketValue = (
  stockInfo: StockInfo | undefined,
  inventoryCosts: number[]
): number => {
  return (stockInfo?.close || 0) * inventoryCosts.length;
};

export const getTotalMarketValue = (
  sidStockInfoMap: { [sid: string]: StockInfo },
  stockWarehouse: { [sid: string]: number[] }
): number => {
  let result = 0;
  for (const [sid, inventoryCosts] of Object.entries(stockWarehouse)) {
    result += calculateMarketValue(sidStockInfoMap[sid], inventoryCosts);
  }
  return result;
};

export const { refreshMarketIndexWithNonCacheResponse } = stockInfoSlice.actions;
export default stockInfoSlice.reducer;
