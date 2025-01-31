import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import type { Error } from "../../types";

interface ErrorState {
    errors: Error[];
}

const initialState: ErrorState = {
    errors: [],
};

const setAutoRemoveErrorTimer = createAsyncThunk(
    "error/setAutoRemoveErrorTimer",
    (): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), 5000);
        });
    }
);

export const pushError = createAsyncThunk(
    "errors/pushError",
    (error: Error, thunkAPI): Error => {
        thunkAPI.dispatch(setAutoRemoveErrorTimer());
        navigator.vibrate(20);
        return error;
    }
);

export const errorSlice = createSlice({
    name: "error",
    initialState,
    reducers: {
        removeError: (state, action: PayloadAction<number>) => {
            state.errors.splice(action.payload, 1);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(
                pushError.fulfilled,
                (state, action: PayloadAction<Error>) => {
                    state.errors.push(action.payload);
                }
            )
            .addCase(setAutoRemoveErrorTimer.fulfilled, (state, action) => {
                state.errors.splice(0, 1);
            });
    },
});

export const { removeError } = errorSlice.actions;

export default errorSlice.reducer;
