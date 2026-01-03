import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

interface MainPageState {
  headerTitle: string | null;
  scrollTop: number;
  marketPageSubpageName: "holding" | "favorites";
}

const initialState: MainPageState = {
  headerTitle: null,
  scrollTop: 0,
  marketPageSubpageName: "holding",
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
    changeMarketPageSubpage(state, action: PayloadAction<"holding" | "favorites">) {
      state.marketPageSubpageName = action.payload;
    },
  },
});

export const { updateHeaderTitle } = mainPageSlice.actions;
export const { updateScrollTop } = mainPageSlice.actions;
export const { changeMarketPageSubpage } = mainPageSlice.actions;
export default mainPageSlice.reducer;
