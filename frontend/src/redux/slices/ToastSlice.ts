import type { PayloadAction } from "@reduxjs/toolkit";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import type { ToastMessage } from "../../types";

interface ToastState {
  toasts: (ToastMessage & { id: string })[];
}

const initialState: ToastState = { toasts: [] };

/** Each toast closes itself after a while; see `ToastList`. */
export const pushToast = createAsyncThunk(
  "toasts/pushToast",
  (toast: ToastMessage): ToastMessage => toast,
);

export const toastSlice = createSlice({
  name: "toasts",
  initialState,
  reducers: {
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(pushToast.fulfilled, (state, action) => {
      state.toasts.push({ ...action.payload, id: action.meta.requestId });
    });
  },
});

export const { removeToast } = toastSlice.actions;

export default toastSlice.reducer;
