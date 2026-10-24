import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import LocalDatabase from "../../storage/localDatabase";
import type { Account, UpdateAccountInfoRequestBody } from "../../types";
import Api from "../../utils/api";
import Util from "../../utils/util";
import { pushToast } from "./ToastSlice";

interface AccountState extends Account {
  isWaiting: boolean;
}

const initialState: AccountState = {
  id: "",
  email: "",
  username: "",
  avatar_url: "",
  subscription: { plan: "free", market_refresh_interval_seconds: 600 },
  isWaiting: false,
};

export const fetchAccountInfo = createAsyncThunk(
  "account/fetchAccountInfo",
  async (): Promise<Account> => {
    return await Api.sendRequest("account/me", "get");
  },
);

export const updateAccountInfo = createAsyncThunk(
  "account/updateAccountInfo",
  async (requestBody: UpdateAccountInfoRequestBody): Promise<Account> => {
    const response = await Api.sendRequest(
      "account/update",
      "post",
      JSON.stringify(requestBody),
    );
    // if (navigator.vibrate) navigator.vibrate(20);
    return response;
  },
);

export const openSession = createAsyncThunk(
  "account/openSession",
  async (_, thunkAPI): Promise<void> => {
    // A page opened in a background tab is recorded once the user switches to it.
    if (document.visibilityState !== "visible") return;

    // `me` sets the CSRF cookie, and open-session without it gets a 403, which logs
    // the user out.
    if (!Api.hasCsrfToken) await thunkAPI.dispatch(fetchAccountInfo()).unwrap();
    await Api.sendRequest(
      "account/open-session",
      "post",
      new URLSearchParams({ platform: Util.platform }),
      { silentOnFailure: true },
    );
  },
);

export const changeAccountBinding = createAsyncThunk(
  "account/changeAccountBinding",
  async (requestBody: URLSearchParams, thunkAPI): Promise<Account> => {
    const response = await Api.sendRequest(
      "account/change-binding",
      "post",
      requestBody,
    );
    thunkAPI.dispatch(pushToast({ type: "success", text: "成功綁定" }));
    return response;
  },
);

export const deleteAccount = createAsyncThunk(
  "account/deleteAccount",
  async (requestBody: { password: string }): Promise<void> => {
    await Api.sendRequest("account/delete", "delete", JSON.stringify(requestBody));
    await Api.clearCache();
    await LocalDatabase.clearAll();
  },
);

export const login = createAsyncThunk(
  "account/login",
  async (requestBody: URLSearchParams): Promise<void> => {
    await Api.sendRequest("account/login", "post", requestBody);
    await Api.clearCache();
  },
);

export const loginWithGoogle = createAsyncThunk(
  "account/loginWithGoogle",
  async (requestBody: URLSearchParams): Promise<void> => {
    await Api.sendRequest("account/google-login", "post", requestBody);
    await Api.clearCache();
  },
);

export const logout = createAsyncThunk("account/logout", async (): Promise<void> => {
  await Api.sendRequest("account/logout", "post", new URLSearchParams());
  await Api.clearCache();
  await LocalDatabase.clearAll();
});

export const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {},
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
        state.subscription = action.payload.subscription;

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
        state.subscription = action.payload.subscription;

        state.isWaiting = false;
      })
      .addCase(updateAccountInfo.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(changeAccountBinding.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(changeAccountBinding.fulfilled, (state, action) => {
        state.id = action.payload.id;
        state.email = action.payload.email;
        state.username = action.payload.username;
        state.avatar_url = action.payload.avatar_url;
        state.subscription = action.payload.subscription;

        state.isWaiting = false;
      })
      .addCase(changeAccountBinding.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(deleteAccount.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(deleteAccount.fulfilled, (state) => {
        state.isWaiting = false;
      })
      .addCase(deleteAccount.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(login.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(login.fulfilled, (state) => {
        state.isWaiting = false;
      })
      .addCase(login.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(loginWithGoogle.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(loginWithGoogle.fulfilled, (state) => {
        state.isWaiting = false;
      })
      .addCase(loginWithGoogle.rejected, (state) => {
        state.isWaiting = false;
      })

      .addCase(logout.pending, (state) => {
        state.isWaiting = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isWaiting = false;
      })
      .addCase(logout.rejected, (state) => {
        state.isWaiting = false;
      });
  },
});

export default accountSlice.reducer;
