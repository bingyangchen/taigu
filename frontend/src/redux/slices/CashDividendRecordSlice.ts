import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import type {
  CashDividendRecord,
  CreateCashDividendRecordRequestBody,
  UpdateCashDividendRecordRequestBody,
} from "../../types";
import Api from "../../utils/api";

interface CashDividendRecordState {
  cashDividendRecords: CashDividendRecord[];
  sidTotalCashDividendMap: { [sid: string]: number };
  totalCashDividend: number;
  isWaiting: boolean;
}

const initialState: CashDividendRecordState = {
  cashDividendRecords: [],
  sidTotalCashDividendMap: {},
  totalCashDividend: 0,
  isWaiting: false,
};

export const fetchAllCashDividendRecords = createAsyncThunk(
  "cashDividendRecord/fetchAllCashDividendRecords",
  async (): Promise<CashDividendRecord[]> => {
    const response = await Api.sendRequest("stock/cash-dividends", "get");
    return response.data;
  }
);

export const createRecord = createAsyncThunk(
  "cashDividendRecord/createRecord",
  async (
    requestBody: CreateCashDividendRecordRequestBody
  ): Promise<CashDividendRecord> => {
    const response = await Api.sendRequest(
      "stock/cash-dividends",
      "post",
      JSON.stringify(requestBody)
    );
    navigator.vibrate(20);
    return response;
  }
);

export const updateRecord = createAsyncThunk(
  "cashDividendRecord/updateRecord",
  async (
    requestBody: UpdateCashDividendRecordRequestBody
  ): Promise<CashDividendRecord> => {
    const response = await Api.sendRequest(
      `stock/cash-dividends/${requestBody.id}`,
      "post",
      JSON.stringify(requestBody)
    );
    navigator.vibrate(20);
    return response;
  }
);

export const deleteRecord = createAsyncThunk(
  "cashDividendRecord/deleteRecord",
  async (id: string | number): Promise<string | number> => {
    await Api.sendRequest(`stock/cash-dividends/${id}`, "delete");
    navigator.vibrate(20);
    return id;
  }
);

export const cashDividendRecordSlice = createSlice({
  name: "cashDividendRecord",
  initialState,
  reducers: {
    refreshCashDividendRecordsWithNonCacheResponse(
      state,
      action: PayloadAction<CashDividendRecord[]>
    ) {
      state.cashDividendRecords = [...action.payload].sort(
        (a, b) => Date.parse(b.deal_time) - Date.parse(a.deal_time)
      );
      state.sidTotalCashDividendMap = getSidTotalCashDividendMap(
        state.cashDividendRecords
      );
      state.totalCashDividend = getTotalCashDividend(state.sidTotalCashDividendMap);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllCashDividendRecords.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(fetchAllCashDividendRecords.fulfilled, (state, action) => {
        state.cashDividendRecords = [...action.payload].sort(
          (a, b) => Date.parse(b.deal_time) - Date.parse(a.deal_time)
        );
        state.sidTotalCashDividendMap = getSidTotalCashDividendMap(
          state.cashDividendRecords
        );
        state.totalCashDividend = getTotalCashDividend(state.sidTotalCashDividendMap);
        state.isWaiting = false;
      })
      .addCase(fetchAllCashDividendRecords.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(createRecord.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(createRecord.fulfilled, (state, action) => {
        state.cashDividendRecords = [action.payload, ...state.cashDividendRecords].sort(
          (a, b) => Date.parse(b.deal_time) - Date.parse(a.deal_time)
        );
        state.sidTotalCashDividendMap = getSidTotalCashDividendMap(
          state.cashDividendRecords
        );
        state.totalCashDividend = getTotalCashDividend(state.sidTotalCashDividendMap);
        state.isWaiting = false;
      })
      .addCase(createRecord.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(updateRecord.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(updateRecord.fulfilled, (state, action) => {
        state.cashDividendRecords = state.cashDividendRecords
          .map((r) => {
            return r.id === action.payload.id ? action.payload : r;
          })
          .sort((a, b) => Date.parse(b.deal_time) - Date.parse(a.deal_time));
        state.sidTotalCashDividendMap = getSidTotalCashDividendMap(
          state.cashDividendRecords
        );
        state.totalCashDividend = getTotalCashDividend(state.sidTotalCashDividendMap);
        state.isWaiting = false;
      })
      .addCase(updateRecord.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(deleteRecord.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(deleteRecord.fulfilled, (state, action) => {
        state.cashDividendRecords = [...state.cashDividendRecords].filter(
          (r) => r.id !== action.payload
        );
        state.sidTotalCashDividendMap = getSidTotalCashDividendMap(
          state.cashDividendRecords
        );
        state.totalCashDividend = getTotalCashDividend(state.sidTotalCashDividendMap);
        state.isWaiting = false;
      })
      .addCase(deleteRecord.rejected, (state) => {
        state.isWaiting = false;
      });
  },
});

const getSidTotalCashDividendMap = (
  cashDividendRecords: CashDividendRecord[]
): { [sid: string]: number } => {
  const result: { [sid: string]: number } = {};
  for (const record of cashDividendRecords) {
    const sid = record.sid;
    if (!(sid in result)) result[sid] = record.cash_dividend;
    else result[sid] += record.cash_dividend;
  }
  return result;
};

const getTotalCashDividend = (sidCashDividendMap: {
  [sid: string]: number;
}): number => {
  return Object.values(sidCashDividendMap).reduce((a, b) => a + b, 0);
};

export const { refreshCashDividendRecordsWithNonCacheResponse } =
  cashDividendRecordSlice.actions;
export default cashDividendRecordSlice.reducer;
