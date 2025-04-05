import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import type {
  CreateTradeRecordRequestBody,
  StockWarehouse,
  TradeRecord,
  UpdateTradeRecordRequestBody,
} from "../../types";
import Api from "../../utils/api";
import { RootState } from "../store";

export interface TradeRecordState {
  tradeRecords: TradeRecord[];
  sidTradeRecordsMap: { [sid: string]: TradeRecord[] };
  sidHandlingFeeMap: { [sid: string]: number };
  sidGainMap: { [sid: string]: number };
  sidCashInvestedMap: { [sid: string]: number };
  stockWarehouse: StockWarehouse;
  totalCashInvested: number;
  totalHandlingFee: number;
  totalGain: number;
  cashInvestedChartData: (Date | string | number)[][];
  tradeVolumeChartData: (Date | string | number)[][];
  averageCashInvested: number;
  isWaiting: boolean;
}

const initialState: TradeRecordState = {
  tradeRecords: [],
  sidTradeRecordsMap: {},
  sidHandlingFeeMap: {},
  sidGainMap: {},
  sidCashInvestedMap: {},
  stockWarehouse: {},
  totalCashInvested: 0,
  totalHandlingFee: 0,
  totalGain: 0,
  cashInvestedChartData: [],
  tradeVolumeChartData: [],
  averageCashInvested: 0,
  isWaiting: false,
};

export const fetchAllTradeRecords = createAsyncThunk(
  "tradeRecord/fetchAllTradeRecords",
  async (): Promise<Omit<TradeRecordState, "isWaiting">> => {
    const response = await Api.sendRequest("stock/trade-records", "get");
    return await computeNewState(response.data);
  }
);

export const createRecord = createAsyncThunk(
  "tradeRecord/createRecord",
  async (
    requestBody: CreateTradeRecordRequestBody,
    thunkAPI
  ): Promise<Omit<TradeRecordState, "isWaiting">> => {
    const response = await Api.sendRequest(
      "stock/trade-records",
      "post",
      JSON.stringify(requestBody)
    );
    navigator.vibrate(20);
    const rootState = thunkAPI.getState() as RootState;
    return await computeNewState([
      response,
      ...rootState.tradeRecord.tradeRecords,
    ]);
  }
);

export const updateRecord = createAsyncThunk(
  "tradeRecord/updateRecord",
  async (
    requestBody: UpdateTradeRecordRequestBody,
    thunkAPI
  ): Promise<Omit<TradeRecordState, "isWaiting">> => {
    const response = await Api.sendRequest(
      `stock/trade-records/${requestBody.id}`,
      "post",
      JSON.stringify(requestBody)
    );
    navigator.vibrate(20);
    const rootState = thunkAPI.getState() as RootState;
    return await computeNewState(
      rootState.tradeRecord.tradeRecords
        .map((r) => (r.id === response.id ? response : r))
        .sort((a, b) => Date.parse(b.deal_time) - Date.parse(a.deal_time))
    );
  }
);

export const deleteRecord = createAsyncThunk(
  "tradeRecord/deleteRecord",
  async (
    id: string | number,
    thunkAPI
  ): Promise<Omit<TradeRecordState, "isWaiting">> => {
    await Api.sendRequest(`stock/trade-records/${id}`, "delete");
    navigator.vibrate(20);
    const rootState = thunkAPI.getState() as RootState;
    return await computeNewState(
      [...rootState.tradeRecord.tradeRecords].filter((r) => r.id !== id)
    );
  }
);

export const refreshWithNonCacheResponse = createAsyncThunk(
  "tradeRecord/refreshWithNonCacheResponse",
  async (
    tradeRecords: TradeRecord[]
  ): Promise<Omit<TradeRecordState, "isWaiting">> => {
    return await computeNewState(tradeRecords);
  }
);

export const tradeRecordSlice = createSlice({
  name: "tradeRecord",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllTradeRecords.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(fetchAllTradeRecords.fulfilled, (state, action) => {
        state.tradeRecords = action.payload.tradeRecords;
        state.sidTradeRecordsMap = action.payload.sidTradeRecordsMap;
        state.sidHandlingFeeMap = action.payload.sidHandlingFeeMap;
        state.sidGainMap = action.payload.sidGainMap;
        state.stockWarehouse = action.payload.stockWarehouse;
        state.sidCashInvestedMap = action.payload.sidCashInvestedMap;
        state.totalCashInvested = action.payload.totalCashInvested;
        state.totalHandlingFee = action.payload.totalHandlingFee;
        state.totalGain = action.payload.totalGain;
        state.cashInvestedChartData = action.payload.cashInvestedChartData;
        state.tradeVolumeChartData = action.payload.tradeVolumeChartData;
        state.averageCashInvested = action.payload.averageCashInvested;
        state.isWaiting = false;
      })
      .addCase(fetchAllTradeRecords.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(createRecord.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(createRecord.fulfilled, (state, action) => {
        state.tradeRecords = action.payload.tradeRecords;
        state.sidTradeRecordsMap = action.payload.sidTradeRecordsMap;
        state.sidHandlingFeeMap = action.payload.sidHandlingFeeMap;
        state.sidGainMap = action.payload.sidGainMap;
        state.stockWarehouse = action.payload.stockWarehouse;
        state.sidCashInvestedMap = action.payload.sidCashInvestedMap;
        state.totalCashInvested = action.payload.totalCashInvested;
        state.totalHandlingFee = action.payload.totalHandlingFee;
        state.totalGain = action.payload.totalGain;
        state.cashInvestedChartData = action.payload.cashInvestedChartData;
        state.tradeVolumeChartData = action.payload.tradeVolumeChartData;
        state.averageCashInvested = action.payload.averageCashInvested;
        state.isWaiting = false;
      })
      .addCase(createRecord.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(updateRecord.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(updateRecord.fulfilled, (state, action) => {
        state.tradeRecords = action.payload.tradeRecords;
        state.sidTradeRecordsMap = action.payload.sidTradeRecordsMap;
        state.sidHandlingFeeMap = action.payload.sidHandlingFeeMap;
        state.sidGainMap = action.payload.sidGainMap;
        state.stockWarehouse = action.payload.stockWarehouse;
        state.sidCashInvestedMap = action.payload.sidCashInvestedMap;
        state.totalCashInvested = action.payload.totalCashInvested;
        state.totalHandlingFee = action.payload.totalHandlingFee;
        state.totalGain = action.payload.totalGain;
        state.cashInvestedChartData = action.payload.cashInvestedChartData;
        state.tradeVolumeChartData = action.payload.tradeVolumeChartData;
        state.averageCashInvested = action.payload.averageCashInvested;
        state.isWaiting = false;
      })
      .addCase(updateRecord.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(deleteRecord.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(deleteRecord.fulfilled, (state, action) => {
        state.tradeRecords = action.payload.tradeRecords;
        state.sidTradeRecordsMap = action.payload.sidTradeRecordsMap;
        state.sidHandlingFeeMap = action.payload.sidHandlingFeeMap;
        state.sidGainMap = action.payload.sidGainMap;
        state.stockWarehouse = action.payload.stockWarehouse;
        state.sidCashInvestedMap = action.payload.sidCashInvestedMap;
        state.totalCashInvested = action.payload.totalCashInvested;
        state.totalHandlingFee = action.payload.totalHandlingFee;
        state.totalGain = action.payload.totalGain;
        state.cashInvestedChartData = action.payload.cashInvestedChartData;
        state.tradeVolumeChartData = action.payload.tradeVolumeChartData;
        state.averageCashInvested = action.payload.averageCashInvested;
        state.isWaiting = false;
      })
      .addCase(deleteRecord.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(refreshWithNonCacheResponse.pending, (state) => {})
      .addCase(refreshWithNonCacheResponse.fulfilled, (state, action) => {
        state.tradeRecords = action.payload.tradeRecords;
        state.sidTradeRecordsMap = action.payload.sidTradeRecordsMap;
        state.sidHandlingFeeMap = action.payload.sidHandlingFeeMap;
        state.sidGainMap = action.payload.sidGainMap;
        state.stockWarehouse = action.payload.stockWarehouse;
        state.sidCashInvestedMap = action.payload.sidCashInvestedMap;
        state.totalCashInvested = action.payload.totalCashInvested;
        state.totalHandlingFee = action.payload.totalHandlingFee;
        state.totalGain = action.payload.totalGain;
        state.cashInvestedChartData = action.payload.cashInvestedChartData;
        state.tradeVolumeChartData = action.payload.tradeVolumeChartData;
        state.averageCashInvested = action.payload.averageCashInvested;
      })
      .addCase(refreshWithNonCacheResponse.rejected, (state) => {});
  },
});

const computeNewState = async (
  tradeRecords: TradeRecord[]
): Promise<Omit<TradeRecordState, "isWaiting">> => {
  const worker = new Worker(
    new URL("../../workers/tradeRecordWorker.ts", import.meta.url)
  );
  worker.postMessage(tradeRecords);
  return await new Promise((resolve) => {
    worker.onmessage = (event) => {
      worker.terminate();
      resolve(event.data);
    };
  });
};

export default tradeRecordSlice.reducer;
