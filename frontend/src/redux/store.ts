import { type AnyAction, combineReducers, configureStore } from "@reduxjs/toolkit";

import { ACCOUNT_DATA_CLEARED, getSessionVersion } from "../utils/session";
import accountReducer from "./slices/AccountSlice";
import fetchAllCashDividendReducer from "./slices/CashDividendRecordSlice";
import handlingFeeDiscountReducer from "./slices/HandlingFeeDiscountSlice";
import mainPageReducer from "./slices/MainPageSlice";
import memoReducer from "./slices/MemoSlice";
import planUpsellReducer from "./slices/PlanUpsellSlice";
import settingsPageReducer from "./slices/SettingsPageSlice";
import stockInfoReducer from "./slices/StockInfoSlice";
import toastReducer from "./slices/ToastSlice";
import tradePlanReducer from "./slices/TradePlanSlice";
import tradeRecordReducer from "./slices/TradeRecordSlice";

const appReducer = combineReducers({
  settingsPage: settingsPageReducer,
  account: accountReducer,
  tradeRecord: tradeRecordReducer,
  cashDividend: fetchAllCashDividendReducer,
  stockInfo: stockInfoReducer,
  tradePlan: tradePlanReducer,
  memo: memoReducer,
  toast: toastReducer,
  planUpsell: planUpsellReducer,
  mainPage: mainPageReducer,
  handlingFeeDiscount: handlingFeeDiscountReducer,
});

const requestVersions = new Map<string, string>();

function rootReducer(
  state: ReturnType<typeof appReducer> | undefined,
  action: AnyAction,
) {
  if (action.type === ACCOUNT_DATA_CLEARED) return appReducer(undefined, action);
  if (action.meta?.requestId) {
    if (action.meta.requestStatus === "pending") {
      requestVersions.set(action.meta.requestId, getSessionVersion());
    } else {
      const version = requestVersions.get(action.meta.requestId);
      requestVersions.delete(action.meta.requestId);
      if (version !== getSessionVersion())
        return appReducer(state, { type: "account/staleRequest" });
    }
  }
  return appReducer(state, action);
}

export const store = configureStore({ reducer: rootReducer });

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
