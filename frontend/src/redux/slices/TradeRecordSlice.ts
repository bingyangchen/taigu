import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import type {
  CreateTradeRecordRequestBody,
  StockWarehouse,
  TradeRecord,
  UpdateTradeRecordRequestBody,
} from "../../types";
import Api from "../../utils/api";
import { RootState } from "../store";
import { refreshDiscountsWithNonCacheResponse } from "./HandlingFeeDiscountSlice";

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
  },
);

export const createRecord = createAsyncThunk(
  "tradeRecord/createRecord",
  async (
    requestBody: CreateTradeRecordRequestBody,
    thunkAPI,
  ): Promise<Omit<TradeRecordState, "isWaiting">> => {
    const response = await Api.sendRequest(
      "stock/trade-record",
      "post",
      JSON.stringify(requestBody),
    );
    // if (navigator.vibrate) navigator.vibrate(20);
    const rootState = thunkAPI.getState() as RootState;
    const newState = await computeNewState([
      response,
      ...rootState.tradeRecord.tradeRecords,
    ]);
    const totalDiscount = rootState.handlingFeeDiscount.discounts.reduce(
      (sum, discount) => sum + discount.amount,
      0,
    );
    return { ...newState, totalHandlingFee: newState.totalHandlingFee - totalDiscount };
  },
);

export const updateRecord = createAsyncThunk(
  "tradeRecord/updateRecord",
  async (
    requestBody: UpdateTradeRecordRequestBody,
    thunkAPI,
  ): Promise<Omit<TradeRecordState, "isWaiting">> => {
    const response = await Api.sendRequest(
      `stock/trade-records/${requestBody.id}`,
      "post",
      JSON.stringify(requestBody),
    );
    // if (navigator.vibrate) navigator.vibrate(20);
    const rootState = thunkAPI.getState() as RootState;
    const newState = await computeNewState(
      rootState.tradeRecord.tradeRecords.map((r) =>
        r.id === response.id ? response : r,
      ),
    );
    const totalDiscount = rootState.handlingFeeDiscount.discounts.reduce(
      (sum, discount) => sum + discount.amount,
      0,
    );
    return { ...newState, totalHandlingFee: newState.totalHandlingFee - totalDiscount };
  },
);

export const deleteRecord = createAsyncThunk(
  "tradeRecord/deleteRecord",
  async (
    id: string | number,
    thunkAPI,
  ): Promise<Omit<TradeRecordState, "isWaiting">> => {
    await Api.sendRequest(`stock/trade-records/${id}`, "delete");
    // if (navigator.vibrate) navigator.vibrate(20);
    const rootState = thunkAPI.getState() as RootState;
    const newState = await computeNewState(
      [...rootState.tradeRecord.tradeRecords].filter((r) => r.id !== id),
    );
    const totalDiscount = rootState.handlingFeeDiscount.discounts.reduce(
      (sum, discount) => sum + discount.amount,
      0,
    );
    return { ...newState, totalHandlingFee: newState.totalHandlingFee - totalDiscount };
  },
);

export const refreshWithNonCacheResponse = createAsyncThunk(
  "tradeRecord/refreshWithNonCacheResponse",
  async (
    tradeRecords: TradeRecord[],
    thunkAPI,
  ): Promise<Omit<TradeRecordState, "isWaiting">> => {
    const newState = await computeNewState(tradeRecords);
    const rootState = thunkAPI.getState() as RootState;
    const totalDiscount = rootState.handlingFeeDiscount.discounts.reduce(
      (sum, discount) => sum + discount.amount,
      0,
    );
    return { ...newState, totalHandlingFee: newState.totalHandlingFee - totalDiscount };
  },
);

export const calculateTotalHandlingFee = createAsyncThunk(
  "tradeRecord/calculateTotalHandlingFee",
  async (_, thunkAPI) => {
    const rootState = thunkAPI.getState() as RootState;
    const baseTotalHandlingFee = Object.values(
      rootState.tradeRecord.sidHandlingFeeMap,
    ).reduce((sum, fee) => sum + fee, 0);
    const totalDiscount = rootState.handlingFeeDiscount.discounts.reduce(
      (sum, discount) => sum + discount.amount,
      0,
    );
    return baseTotalHandlingFee - totalDiscount;
  },
);

export const tradeRecordSlice = createSlice({
  name: "tradeRecord",
  initialState,
  reducers: {
    adjustTotalHandlingFee(state, action: { payload: number }) {
      state.totalHandlingFee += action.payload;
    },
  },
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

      .addCase(calculateTotalHandlingFee.fulfilled, (state, action) => {
        state.totalHandlingFee = action.payload;
      })

      .addCase(refreshDiscountsWithNonCacheResponse, (state, action) => {
        const baseTotalHandlingFee = Object.values(state.sidHandlingFeeMap).reduce(
          (sum, fee) => sum + fee,
          0,
        );
        const newTotalDiscount = action.payload.reduce(
          (sum, discount) => sum + discount.amount,
          0,
        );
        state.totalHandlingFee = baseTotalHandlingFee - newTotalDiscount;
      });
  },
});

const computeNewState = async (
  tradeRecords: TradeRecord[],
): Promise<Omit<TradeRecordState, "isWaiting">> => {
  const worker = new Worker(
    new URL("../../workers/tradeRecordWorker.ts", import.meta.url),
  );
  worker.postMessage(tradeRecords);
  return await new Promise((resolve) => {
    worker.onmessage = (event) => {
      worker.terminate();
      resolve(event.data);
    };
  });
};

export const { adjustTotalHandlingFee } = tradeRecordSlice.actions;
export default tradeRecordSlice.reducer;
