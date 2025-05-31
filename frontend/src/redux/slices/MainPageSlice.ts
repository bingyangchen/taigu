import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MainPageState {
  scrollTop: number;
  marketPageSubpageName: "holding" | "favorites";
}

const initialState: MainPageState = {
  scrollTop: 0,
  marketPageSubpageName: "holding",
};

export const mainPageSlice = createSlice({
  name: "mainPage",
  initialState,
  reducers: {
    updateScrollTop(state, action: PayloadAction<number>) {
      state.scrollTop = action.payload;
    },
    changeMarketPageSubpage(state, action: PayloadAction<"holding" | "favorites">) {
      state.marketPageSubpageName = action.payload;
    },
  },
});

export const { updateScrollTop } = mainPageSlice.actions;
export const { changeMarketPageSubpage } = mainPageSlice.actions;
export default mainPageSlice.reducer;
