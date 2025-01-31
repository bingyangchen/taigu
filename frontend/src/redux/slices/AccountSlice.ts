import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { Account, UpdateAccountInfoRequestBody } from "../../types";
import Api from "../../utils/api";

interface AccountState extends Account {
    isWaiting: boolean;
}

const initialState: AccountState = {
    id: "",
    email: "",
    username: "",
    avatar_url: "",
    isWaiting: false,
};

export const fetchAccountInfo = createAsyncThunk(
    "account/fetchAccountInfo",
    async (): Promise<Account> => {
        const response = await Api.sendRequest("account/me", "get");
        if (response?.success) return response.data;
        else throw Error("Failed to fetch account info.");
    }
);

export const updateAccountInfo = createAsyncThunk(
    "account/updateAccountInfo",
    async (requestBody: UpdateAccountInfoRequestBody): Promise<Account> => {
        const response = await Api.sendRequest(
            "account/update",
            "post",
            JSON.stringify(requestBody)
        );
        navigator.vibrate(20);
        if (response?.success) return response.data;
        else throw Error(response?.error || "Failed to update account info.");
    }
);

export const deleteAccount = createAsyncThunk(
    "account/deleteAccount",
    async (requestBody: { password: string }): Promise<void> => {
        const response = await Api.sendRequest(
            "account/delete",
            "delete",
            JSON.stringify(requestBody)
        );
        if (!response?.success) {
            throw Error(response?.error || "Failed to delete account.");
        }
    }
);

export const login = createAsyncThunk(
    "account/login",
    async (requestBody: URLSearchParams): Promise<void> => {
        const response = await Api.sendRequest(
            "account/login",
            "post",
            requestBody
        );
        if (!response?.success) {
            throw Error(response?.error || "Failed to login.");
        }
    }
);

export const loginWithGoogle = createAsyncThunk(
    "account/loginWithGoogle",
    async (requestBody: URLSearchParams): Promise<void> => {
        const response = await Api.sendRequest(
            "account/google-login",
            "post",
            requestBody
        );
        if (!response?.success) {
            throw Error(response?.error || "Failed to login.");
        }
    }
);

export const logout = createAsyncThunk(
    "account/logout",
    async (): Promise<void> => {
        const response = await Api.sendRequest("account/logout", "get");
        if (!response?.success) {
            throw Error(response?.error || "Failed to logout.");
        }
    }
);

export const accountSlice = createSlice({
    name: "account",
    initialState,
    reducers: {
        refreshAccountInfoWithNonCacheResponse(
            state,
            action: PayloadAction<Account>
        ) {
            state.id = action.payload.id;
            state.email = action.payload.email;
            state.username = action.payload.username;
            state.avatar_url = action.payload.avatar_url;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAccountInfo.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(fetchAccountInfo.fulfilled, (state, action) => {
                state.id = action.payload.id;
                state.email = action.payload.email;
                state.username = action.payload.username;
                state.avatar_url = action.payload.avatar_url;

                state.isWaiting = false;
            })
            .addCase(fetchAccountInfo.rejected, (state) => {
                state.isWaiting = false;
            })

            .addCase(updateAccountInfo.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(updateAccountInfo.fulfilled, (state, action) => {
                state.id = action.payload.id;
                state.email = action.payload.email;
                state.username = action.payload.username;
                state.avatar_url = action.payload.avatar_url;

                state.isWaiting = false;
            })
            .addCase(updateAccountInfo.rejected, (state) => {
                state.isWaiting = false;
            })

            .addCase(deleteAccount.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(deleteAccount.fulfilled, (state, action) => {
                state.isWaiting = false;
            })
            .addCase(deleteAccount.rejected, (state) => {
                state.isWaiting = false;
            })

            .addCase(login.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(login.fulfilled, (state, action) => {
                state.isWaiting = false;
            })
            .addCase(login.rejected, (state) => {
                state.isWaiting = false;
            })

            .addCase(loginWithGoogle.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(loginWithGoogle.fulfilled, (state, action) => {
                state.isWaiting = false;
            })
            .addCase(loginWithGoogle.rejected, (state) => {
                state.isWaiting = false;
            })

            .addCase(logout.pending, (state) => {
                state.isWaiting = true;
            })
            .addCase(logout.fulfilled, (state, action) => {
                state.isWaiting = false;
            })
            .addCase(logout.rejected, (state) => {
                state.isWaiting = false;
            });
    },
});

export const { refreshAccountInfoWithNonCacheResponse } = accountSlice.actions;
export default accountSlice.reducer;
