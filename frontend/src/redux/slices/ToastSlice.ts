import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import type { Error } from "../../types";

interface ToastState {
  toasts: Error[];
}

const initialState: ToastState = {
  toasts: [],
};

const setAutoRemoveToastTimer = createAsyncThunk(
  "toasts/setAutoRemoveToastTimer",
  (): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 5000);
    });
  }
);

export const pushToast = createAsyncThunk(
  "toasts/pushToast",
  (toast: Error, thunkAPI): Error => {
    thunkAPI.dispatch(setAutoRemoveToastTimer());
    navigator.vibrate(20);
    return toast;
  }
);

export const toastSlice = createSlice({
  name: "toasts",
  initialState,
  reducers: {
    removeToast: (state, action: PayloadAction<number>) => {
      state.toasts.splice(action.payload, 1);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(pushToast.fulfilled, (state, action: PayloadAction<Error>) => {
        state.toasts.push(action.payload);
      })
      .addCase(setAutoRemoveToastTimer.fulfilled, (state, action) => {
        state.toasts.splice(0, 1);
      });
  },
});

export const { removeToast } = toastSlice.actions;

export default toastSlice.reducer;
