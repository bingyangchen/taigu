import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface SettingsPageState {
  headerTitle: string;
}

const initialState: SettingsPageState = {
  headerTitle: "",
};

export const settingsPageSlice = createSlice({
  name: "settingsPage",
  initialState,
  reducers: {
    updateHeaderTitle(state, action: PayloadAction<string>) {
      state.headerTitle = action.payload;
    },
  },
});

export const { updateHeaderTitle } = settingsPageSlice.actions;
export default settingsPageSlice.reducer;
