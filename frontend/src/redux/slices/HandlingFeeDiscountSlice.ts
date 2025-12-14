import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import type {
  CreateHandlingFeeDiscountRequestBody,
  HandlingFeeDiscount,
  UpdateHandlingFeeDiscountRequestBody,
} from "../../types";
import Api from "../../utils/api";

interface HandlingFeeDiscountState {
  discounts: HandlingFeeDiscount[];
  isWaiting: boolean;
}

const initialState: HandlingFeeDiscountState = { discounts: [], isWaiting: false };

export const fetchAllDiscounts = createAsyncThunk(
  "handlingFeeDiscount/fetchAllDiscounts",
  async (): Promise<HandlingFeeDiscount[]> => {
    const response = await Api.sendRequest("handling-fee/discount", "get");
    return response.data;
  },
);

export const createDiscount = createAsyncThunk(
  "handlingFeeDiscount/createDiscount",
  async (
    requestBody: CreateHandlingFeeDiscountRequestBody,
  ): Promise<HandlingFeeDiscount> => {
    const response = await Api.sendRequest(
      "handling-fee/discount",
      "post",
      JSON.stringify(requestBody),
    );
    if (navigator.vibrate) navigator.vibrate(20);
    return response;
  },
);

export const updateDiscount = createAsyncThunk(
  "handlingFeeDiscount/updateDiscount",
  async (
    requestBody: UpdateHandlingFeeDiscountRequestBody,
  ): Promise<HandlingFeeDiscount> => {
    const response = await Api.sendRequest(
      `handling-fee/discount/${requestBody.id}`,
      "put",
      JSON.stringify(requestBody),
    );
    if (navigator.vibrate) navigator.vibrate(20);
    return response;
  },
);

export const deleteDiscount = createAsyncThunk(
  "handlingFeeDiscount/deleteDiscount",
  async (id: string | number): Promise<string | number> => {
    await Api.sendRequest(`handling-fee/discount/${id}`, "delete");
    if (navigator.vibrate) navigator.vibrate(20);
    return id;
  },
);

export const handlingFeeDiscountSlice = createSlice({
  name: "handlingFeeDiscount",
  initialState,
  reducers: {
    refreshDiscountsWithNonCacheResponse(
      state,
      action: PayloadAction<HandlingFeeDiscount[]>,
    ) {
      state.discounts = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllDiscounts.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(fetchAllDiscounts.fulfilled, (state, action) => {
        state.discounts = action.payload;
        state.isWaiting = false;
      })
      .addCase(fetchAllDiscounts.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(createDiscount.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(createDiscount.fulfilled, (state, action) => {
        state.discounts = [action.payload, ...state.discounts];
        state.isWaiting = false;
      })
      .addCase(createDiscount.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(updateDiscount.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(updateDiscount.fulfilled, (state, action) => {
        state.discounts = state.discounts.map((d) => {
          return d.id === action.payload.id ? action.payload : d;
        });
        state.isWaiting = false;
      })
      .addCase(updateDiscount.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(deleteDiscount.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(deleteDiscount.fulfilled, (state, action) => {
        state.discounts = [...state.discounts].filter(
          (discount) => discount.id !== action.payload,
        );
        state.isWaiting = false;
      })
      .addCase(deleteDiscount.rejected, (state) => {
        state.isWaiting = false;
      });
  },
});

export const { refreshDiscountsWithNonCacheResponse } =
  handlingFeeDiscountSlice.actions;
export default handlingFeeDiscountSlice.reducer;
