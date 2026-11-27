import { configureStore } from "@reduxjs/toolkit";
import { expect, type Mock, test, vi } from "vitest";

import Api from "../../utils/api";
import memo, { updateOrCreateMemo } from "./MemoSlice";

vi.mock("../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));

const sendRequest = Api.sendRequest as Mock;

test("[STOCK-R10.3] keeps the material facts when the memo is saved", () => {
  const materialFacts = [
    { date_time: "2026-11-20T08:00:00", title: "法說會", description: "第三季法說會" },
  ];
  const initialState = memo(undefined, { type: "init" });
  const state = memo(
    {
      ...initialState,
      sidCompanyInfoMap: {
        "2330": {
          sid: "2330",
          company_name: "台積電",
          business: "晶圓代工",
          note: "等法說會",
          material_facts: materialFacts,
        },
      },
    },
    updateOrCreateMemo.fulfilled(
      {
        sid: "2330",
        company_name: "台積電",
        business: "晶圓代工",
        note: "法說會後再加碼",
      },
      "request",
      { sid: "2330", note: "法說會後再加碼" },
    ),
  );
  expect(state.sidCompanyInfoMap["2330"].note).toBe("法說會後再加碼");
  expect(state.sidCompanyInfoMap["2330"].material_facts).toEqual(materialFacts);
});

test("loads the company info when a memo is saved before it has loaded", async () => {
  const savedMemo = { sid: "2330", company_name: "台積電", business: "晶圓代工" };
  sendRequest
    .mockReset()
    .mockImplementation(async (endpoint: string) =>
      endpoint.startsWith("stock-memo/company-info")
        ? { "2330": { ...savedMemo, note: "等法說會", material_facts: [] } }
        : { ...savedMemo, note: "等法說會" },
    );
  const store = configureStore({ reducer: { memo } });
  await store.dispatch(updateOrCreateMemo({ sid: "2330", note: "等法說會" })).unwrap();
  await vi.waitFor(() =>
    expect(store.getState().memo.sidCompanyInfoMap["2330"]).toEqual({
      ...savedMemo,
      note: "等法說會",
      material_facts: [],
    }),
  );
});
