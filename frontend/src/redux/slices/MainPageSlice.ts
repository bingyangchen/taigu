import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

import type { MarketSortKey, MarketTab } from "../../types";

export type StockDetailChartMode = "intraday" | "historical";

interface MainPageState {
  headerTitle: string | null;
  scrollTop: number;
  dashboardDaysToShow: number;
  marketIndexHistoricalDaysToShow: number;
  stockDetailChartMode: StockDetailChartMode;
  marketPageSubpageName: MarketTab;
  marketSortKey: MarketSortKey;
  marketSearchText: string;
}

const initialState: MainPageState = {
  headerTitle: null,
  scrollTop: 0,
  dashboardDaysToShow: 30,
  marketIndexHistoricalDaysToShow: 30,
  stockDetailChartMode: "intraday",
  marketPageSubpageName: "holding",
  marketSortKey: "marketValue",
  marketSearchText: "",
};

export const mainPageSlice = createSlice({
  name: "mainPage",
  initialState,
  reducers: {
    updateHeaderTitle(state, action: PayloadAction<string | null>) {
      state.headerTitle = action.payload;
    },
    updateScrollTop(state, action: PayloadAction<number>) {
      state.scrollTop = action.payload;
    },
    changeDashboardDaysToShow(state, action: PayloadAction<number>) {
      state.dashboardDaysToShow = action.payload;
    },
    changeMarketIndexHistoricalDaysToShow(state, action: PayloadAction<number>) {
      state.marketIndexHistoricalDaysToShow = action.payload;
    },
    changeStockDetailChartMode(state, action: PayloadAction<StockDetailChartMode>) {
      state.stockDetailChartMode = action.payload;
    },
    changeMarketPageSubpage(state, action: PayloadAction<MarketTab>) {
      state.marketPageSubpageName = action.payload;
    },
    changeMarketSortKey(state, action: PayloadAction<MarketSortKey>) {
      state.marketSortKey = action.payload;
    },
    changeMarketSearchText(state, action: PayloadAction<string>) {
      state.marketSearchText = action.payload;
    },
  },
});

export const {
  updateHeaderTitle,
  updateScrollTop,
  changeDashboardDaysToShow,
  changeMarketIndexHistoricalDaysToShow,
  changeStockDetailChartMode,
  changeMarketPageSubpage,
  changeMarketSortKey,
  changeMarketSearchText,
} = mainPageSlice.actions;
export default mainPageSlice.reducer;
