import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MainPageState {
    scrollTop: number;
    stockListPageSubpageName: "holding" | "favorites";
}

const initialState: MainPageState = {
    scrollTop: 0,
    stockListPageSubpageName: "holding",
};

export const mainPageSlice = createSlice({
    name: "mainPage",
    initialState,
    reducers: {
        updateScrollTop(state, action: PayloadAction<number>) {
            state.scrollTop = action.payload;
        },
        changeStockListPageSubpage(
            state,
            action: PayloadAction<"holding" | "favorites">
        ) {
            state.stockListPageSubpageName = action.payload;
        },
    },
});

export const { updateScrollTop } = mainPageSlice.actions;
export const { changeStockListPageSubpage } = mainPageSlice.actions;
export default mainPageSlice.reducer;
