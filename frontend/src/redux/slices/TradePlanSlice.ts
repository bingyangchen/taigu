import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import type {
    CreateTradePlanRequestBody,
    TradePlan,
    UpdateTradePlanRequestBody,
} from "../../types";
import Api from "../../utils/api";

interface TradePlanState {
    tradePlans: TradePlan[];
    isWaiting: boolean;
}

const initialState: TradePlanState = {
    tradePlans: [],
    isWaiting: false,
};

export const fetchAllTradePlans = createAsyncThunk(
    "tradePlan/fetchAllTradePlans",
    async (): Promise<TradePlan[]> => {
        const response = await Api.sendRequest("memo/trade-plans", "get");
        if (response?.success) return response.data;
        else throw Error("Failed to fetch trade plans");
    }
);

export const createPlan = createAsyncThunk(
    "tradePlan/createPlan",
    async (requestBody: CreateTradePlanRequestBody): Promise<TradePlan> => {
        const response = await Api.sendRequest(
            "memo/trade-plans",
            "post",
            JSON.stringify(requestBody)
        );
        navigator.vibrate(20);
        if (response?.success) return response.data;
        else throw Error(response?.error || "Failed to create trade plan");
    }
);

export const updatePlan = createAsyncThunk(
    "tradePlan/updatePlan",
    async (requestBody: UpdateTradePlanRequestBody): Promise<TradePlan> => {
        const response = await Api.sendRequest(
            `memo/trade-plan/${requestBody.id}`,
            "post",
            JSON.stringify(requestBody)
        );
        navigator.vibrate(20);
        if (response?.success) return response.data;
        else throw Error(response?.error || "Failed to update trade plan");
    }
);

export const deletePlan = createAsyncThunk(
    "tradePlan/deletePlan",
    async (id: string | number): Promise<string | number> => {
        const response = await Api.sendRequest(
            `memo/trade-plan/${id}`,
            "delete"
        );
        navigator.vibrate(20);
        if (response?.success) return id;
        else throw Error("Failed to delete trade plan");
    }
);

export const tradePlanSlice = createSlice({
    name: "tradePlan",
    initialState,
    reducers: {
        refreshTradePlansWithNonCacheResponse(
            state,
            action: PayloadAction<TradePlan[]>
        ) {
            state.tradePlans = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAllTradePlans.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(fetchAllTradePlans.fulfilled, (state, action) => {
                state.tradePlans = action.payload;
                state.isWaiting = false;
            })
            .addCase(fetchAllTradePlans.rejected, (state) => {
                state.isWaiting = false;
            })

            .addCase(createPlan.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(createPlan.fulfilled, (state, action) => {
                state.tradePlans = [action.payload, ...state.tradePlans];
                state.isWaiting = false;
            })
            .addCase(createPlan.rejected, (state) => {
                state.isWaiting = false;
            })

            .addCase(updatePlan.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(updatePlan.fulfilled, (state, action) => {
                state.tradePlans = state.tradePlans.map((p) => {
                    return p.id === action.payload.id ? action.payload : p;
                });
                state.isWaiting = false;
            })
            .addCase(updatePlan.rejected, (state) => {
                state.isWaiting = false;
            })

            .addCase(deletePlan.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(deletePlan.fulfilled, (state, action) => {
                state.tradePlans = [...state.tradePlans].filter(
                    (plan) => plan.id !== action.payload
                );
                state.isWaiting = false;
            })
            .addCase(deletePlan.rejected, (state) => {
                state.isWaiting = false;
            });
    },
});

export const { refreshTradePlansWithNonCacheResponse } = tradePlanSlice.actions;
export default tradePlanSlice.reducer;
