import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

export type MarketTab = "holding" | "favorites";
export type MarketSortKey = "marketValue" | "returnRate" | "fluct" | "name";

interface MainPageState {
  headerTitle: string | null;
  scrollTop: number;
  dashboardDaysToShow: number;
  marketPageSubpageName: MarketTab;
  marketSortKey: MarketSortKey;
  marketSearchText: string;
}

const initialState: MainPageState = {
  headerTitle: null,
  scrollTop: 0,
  dashboardDaysToShow: 30,
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

export const { updateHeaderTitle } = mainPageSlice.actions;
export const { updateScrollTop } = mainPageSlice.actions;
export const { changeDashboardDaysToShow } = mainPageSlice.actions;
export const { changeMarketPageSubpage } = mainPageSlice.actions;
export const { changeMarketSortKey } = mainPageSlice.actions;
export const { changeMarketSearchText } = mainPageSlice.actions;
export default mainPageSlice.reducer;
