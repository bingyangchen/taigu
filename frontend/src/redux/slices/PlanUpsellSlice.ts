import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

import type { PlanQuotaResource } from "../../types";

interface PlanUpsellState {
  isOpen: boolean;
  resource: PlanQuotaResource | null;
  message: string | null;
}

const initialState: PlanUpsellState = { isOpen: false, resource: null, message: null };

export const planUpsellSlice = createSlice({
  name: "planUpsell",
  initialState,
  reducers: {
    openPlanUpsell: (
      state,
      action: PayloadAction<{ resource: PlanQuotaResource; message?: string | null }>,
    ) => {
      state.isOpen = true;
      state.resource = action.payload.resource;
      state.message = action.payload.message ?? null;
    },
    closePlanUpsell: (state) => {
      state.isOpen = false;
      state.resource = null;
      state.message = null;
    },
  },
});

export const { closePlanUpsell, openPlanUpsell } = planUpsellSlice.actions;

export default planUpsellSlice.reducer;
