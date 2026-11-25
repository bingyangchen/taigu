import { configureStore, createSlice } from "@reduxjs/toolkit";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";

import stockInfo from "../../redux/slices/StockInfoSlice";
import type { CashDividendRecord, StockInfo, TradeRecord } from "../../types";
import Api from "../../utils/api";
import CashDividendRecordEditor from "../CashDividendRecordEditor/CashDividendRecordEditor";
import TradeRecordEditor from "../TradeRecordEditor/TradeRecordEditor";

jest.mock("react-router-dom", () => {
  Object.assign(globalThis, { TextEncoder: jest.requireActual("util").TextEncoder });
  return jest.requireActual("react-router");
});
jest.mock("../../utils/api", () => ({
  __esModule: true,
  default: { sendRequest: jest.fn() },
}));
jest.mock("../../storage/localDatabase");
jest.mock("../../pages/Main/Details/Details", () => () => null);

const mockSaveTradeRecord = jest.fn();
const mockSaveCashDividend = jest.fn();
let quotes: { [sid: string]: StockInfo } = {};

jest.mock("../../redux/slices/TradeRecordSlice", () => {
  const { createAsyncThunk } = jest.requireActual("@reduxjs/toolkit");
  return {
    __esModule: true,
    createRecord: createAsyncThunk("tradeRecord/createRecord", (body: object) =>
      mockSaveTradeRecord("create", body),
    ),
    updateRecord: createAsyncThunk("tradeRecord/updateRecord", (body: object) =>
      mockSaveTradeRecord("update", body),
    ),
    deleteRecord: createAsyncThunk("tradeRecord/deleteRecord", (id: number) =>
      mockSaveTradeRecord("delete", id),
    ),
  };
});
jest.mock("../../redux/slices/CashDividendRecordSlice", () => {
  const { createAsyncThunk } = jest.requireActual("@reduxjs/toolkit");
  return {
    __esModule: true,
    createRecord: createAsyncThunk("cashDividend/createRecord", (body: object) =>
      mockSaveCashDividend("create", body),
    ),
    updateRecord: createAsyncThunk("cashDividend/updateRecord", (body: object) =>
      mockSaveCashDividend("update", body),
    ),
    deleteRecord: createAsyncThunk("cashDividend/deleteRecord", (id: number) =>
      mockSaveCashDividend("delete", id),
    ),
  };
});

const sendRequest = Api.sendRequest as jest.Mock;

const STOCK_NAMES: { [sid: string]: string } = {
  "2330": "台積電",
  "2317": "鴻海",
  "0050": "元大台灣50",
  "00878": "國泰永續高股息",
  "2454": "聯發科",
  "2412": "中華電",
};

let nextRecordId = 1;

function trade(sid: string, date: string, quantity: number, price = 100): TradeRecord {
  return {
    id: nextRecordId++,
    deal_time: date,
    sid,
    company_name: STOCK_NAMES[sid],
    deal_price: price,
    deal_quantity: quantity,
    handling_fee: 1,
  };
}

function dividend(sid: string, date: string, amount: number): CashDividendRecord {
  return {
    id: nextRecordId++,
    deal_time: date,
    sid,
    company_name: STOCK_NAMES[sid],
    cash_dividend: amount,
  };
}

function getWarehouse(records: TradeRecord[]): { [sid: string]: number[] } {
  const result: { [sid: string]: number[] } = {};
  for (const record of [...records].sort(
    (a, b) => a.deal_time.localeCompare(b.deal_time) || a.id - b.id,
  )) {
    result[record.sid] ??= [];
    if (record.deal_quantity > 0) {
      result[record.sid].push(...Array(record.deal_quantity).fill(record.deal_price));
    } else result[record.sid].splice(0, -record.deal_quantity);
  }
  for (const sid in result) if (result[sid].length === 0) delete result[sid];
  return result;
}

type RenderOptions = {
  trades?: TradeRecord[];
  dividends?: CashDividendRecord[];
  hasLoaded?: boolean;
  stockInfo?: { [sid: string]: StockInfo };
  isNarrow?: boolean;
};

function makeStore(options: RenderOptions) {
  const trades = options.trades ?? [];
  const tradeRecord = createSlice({
    name: "tradeRecord",
    initialState: {
      tradeRecords: trades,
      stockWarehouse: getWarehouse(trades),
      hasLoaded: options.hasLoaded ?? true,
      isWaiting: false,
    },
    reducers: {},
  });
  const cashDividend = createSlice({
    name: "cashDividend",
    initialState: {
      cashDividendRecords: options.dividends ?? [],
      hasLoaded: options.hasLoaded ?? true,
      isWaiting: false,
    },
    reducers: {},
  });
  return configureStore({
    reducer: {
      tradeRecord: tradeRecord.reducer,
      cashDividend: cashDividend.reducer,
      stockInfo,
    },
    preloadedState: {
      stockInfo: {
        ...stockInfo(undefined, { type: "init" }),
        sidStockInfoMap: options.stockInfo ?? {},
      },
    },
  });
}

function mockViewport(isNarrow: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: isNarrow && query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function renderEditor(element: React.ReactElement, options: RenderOptions = {}) {
  mockViewport(options.isNarrow ?? false);
  const store = makeStore(options);
  const utils = render(
    <Provider store={store}>
      <MemoryRouter>{element}</MemoryRouter>
    </Provider>,
  );
  return { ...utils, store };
}

function renderTradeEditor(
  options: RenderOptions & {
    record?: TradeRecord;
    defaultSid?: string;
    presentation?: "modal" | "page";
    hideModal?: jest.Mock;
  } = {},
) {
  const hideModal = options.hideModal ?? jest.fn();
  const presentation = options.presentation ?? (options.isNarrow ? "page" : "modal");
  const utils = renderEditor(
    <TradeRecordEditor
      record={options.record}
      defaultSid={options.defaultSid}
      hideModal={hideModal}
      presentation={presentation}
    />,
    options,
  );
  return { ...utils, hideModal };
}

function renderDividendEditor(
  options: RenderOptions & {
    record?: CashDividendRecord;
    presentation?: "modal" | "page";
    hideModal?: jest.Mock;
  } = {},
) {
  const hideModal = options.hideModal ?? jest.fn();
  const utils = renderEditor(
    <CashDividendRecordEditor
      record={options.record}
      hideModal={hideModal}
      presentation={options.presentation ?? (options.isNarrow ? "page" : "modal")}
    />,
    options,
  );
  return { ...utils, hideModal };
}

const stockInput = (): HTMLElement => screen.getByRole("combobox");
const field = (label: string): HTMLInputElement =>
  screen.getByLabelText(label, { selector: "input" }) as HTMLInputElement;
const dateInput = (label: string): HTMLInputElement =>
  screen.getByLabelText(label, { selector: "input" }) as HTMLInputElement;
const summary = (): HTMLElement =>
  screen.getByRole("complementary", { name: "這筆紀錄的金額" });

function advance(milliseconds: number): void {
  act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

async function searchAndSelect(sid: string): Promise<void> {
  userEvent.click(stockInput());
  userEvent.type(stockInput(), sid);
  advance(300);
  const option = await screen.findByRole("option", {
    name: new RegExp(`(^|\\D)${sid}(\\D|$)`),
  });
  userEvent.click(option);
}

function step(title: string): HTMLElement {
  return screen.getByRole("region", { name: title });
}

function setUnit(unit: "張" | "股"): void {
  const button = within(screen.getByRole("tablist", { name: "股數單位" })).getByRole(
    "tab",
    { name: unit },
  );
  userEvent.click(button);
}

function submit(label: RegExp | string): void {
  userEvent.click(screen.getByRole("button", { name: label }));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 24, 10, 0));
  window.localStorage.clear();
  quotes = {};
  nextRecordId = 1;
  mockSaveTradeRecord.mockReset().mockResolvedValue({});
  mockSaveCashDividend.mockReset().mockResolvedValue({});
  sendRequest.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint.startsWith("market/search")) {
      const keyword = decodeURIComponent(endpoint.split("keyword=")[1]);
      return {
        data: Object.entries(STOCK_NAMES)
          .filter(([sid, name]) => sid.startsWith(keyword) || name.includes(keyword))
          .map(([sid, name]) => ({ sid, name })),
      };
    }
    if (endpoint.startsWith("market/company-names")) {
      const sid = decodeURIComponent(endpoint.split("sids=")[1]);
      return { [sid]: STOCK_NAMES[sid] };
    }
    if (endpoint.startsWith("market/current-stock-info")) {
      const sid = endpoint.split("sids=")[1];
      if (!quotes[sid]) throw new Error("Failed to fetch");
      return { [sid]: quotes[sid] };
    }
    throw new Error(`Unexpected request: ${endpoint}`);
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("trade record fields", () => {
  test("[REC-R1.1] adds a buy record and shows the saved view", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    fireEvent.change(dateInput("交易日期"), { target: { value: "2024-03-01" } });
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    expect(field("手續費用")).toHaveValue("855");
    submit("新增買進紀錄");
    expect(await screen.findByText("已新增買進紀錄")).toBeInTheDocument();
    expect(mockSaveTradeRecord).toHaveBeenCalledWith("create", {
      sid: "2330",
      deal_time: "2024-03-01",
      deal_price: 600,
      deal_quantity: 1000,
      handling_fee: 855,
    });
  });

  test("[REC-R1.2] points at the missing quantity on the narrow page", async () => {
    renderTradeEditor({ isNarrow: true });
    await searchAndSelect("2330");
    userEvent.type(field("成交單價"), "600");
    submit("新增買進紀錄");
    expect(within(step("股數與單價")).getByText("請填寫成交股數")).toBeInTheDocument();
    expect(field("成交股數")).toHaveFocus();
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
  });

  test("[REC-R1.3] records odd lots in shares", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    setUnit("股");
    userEvent.type(field("成交股數"), "250");
    userEvent.type(field("成交單價"), "600");
    submit("新增買進紀錄");
    await screen.findByText("已新增買進紀錄");
    expect(mockSaveTradeRecord.mock.calls[0][1].deal_quantity).toBe(250);
  });

  test("[REC-R1.4] records lots with decimals as shares", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "1.5");
    userEvent.type(field("成交單價"), "600");
    submit("新增買進紀錄");
    await screen.findByText("已新增買進紀錄");
    expect(mockSaveTradeRecord.mock.calls[0][1].deal_quantity).toBe(1500);
  });

  test("[REC-R1.5, REC-R1.10] converts the quantity when the unit changes", () => {
    renderTradeEditor();
    setUnit("股");
    userEvent.type(field("成交股數"), "1500");
    setUnit("張");
    expect(field("成交股數")).toHaveValue("1.5");
    setUnit("股");
    expect(field("成交股數")).toHaveValue("1,500");
  });

  test("[REC-R1.6] remembers the unit of the last added record", async () => {
    const { unmount } = renderTradeEditor();
    await searchAndSelect("2330");
    setUnit("股");
    userEvent.type(field("成交股數"), "200");
    userEvent.type(field("成交單價"), "600");
    submit("新增買進紀錄");
    await screen.findByText("已新增買進紀錄");
    unmount();
    renderTradeEditor();
    expect(screen.getByRole("tab", { name: "股", selected: true })).toBeInTheDocument();
  });

  test("[REC-R1.7] keeps the remembered unit after an edit", async () => {
    window.localStorage.setItem("record_editor_quantity_unit", "lot");
    const record = trade("2317", "2024-04-01", 200, 150);
    const { unmount } = renderTradeEditor({ record, trades: [record] });
    expect(screen.getByRole("tab", { name: "股", selected: true })).toBeInTheDocument();
    userEvent.clear(field("成交單價"));
    userEvent.type(field("成交單價"), "160");
    submit("儲存變更");
    await waitFor(() => expect(mockSaveTradeRecord).toHaveBeenCalled());
    unmount();
    renderTradeEditor();
    expect(screen.getByRole("tab", { name: "張", selected: true })).toBeInTheDocument();
  });

  test("[REC-R1.8] blocks a date later than today", async () => {
    renderTradeEditor({ isNarrow: true });
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    userEvent.click(within(step("交易日期")).getByRole("button"));
    fireEvent.change(dateInput("交易日期"), { target: { value: "2026-11-25" } });
    expect(
      within(step("交易日期")).getByText("交易日期不能晚於今天"),
    ).toBeInTheDocument();
    userEvent.click(within(step("股數與單價")).getByRole("button"));
    submit("新增買進紀錄");
    expect(within(step("交易日期")).getByText("交易日期不能晚於今天")).toBeVisible();
    expect(dateInput("交易日期")).toBeVisible();
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
  });

  test("[REC-R1.9] rejects zero shares", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    setUnit("股");
    userEvent.type(field("成交股數"), "0");
    userEvent.type(field("成交單價"), "600");
    submit("新增買進紀錄");
    expect(screen.getByText("成交股數要大於 0")).toBeInTheDocument();
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
  });

  test("lists what is missing when the editor opens", () => {
    renderTradeEditor();
    expect(within(summary()).getByText("還沒填：股票、股數與單價")).toBeInTheDocument();
  });

  test("[REC-R1.11] saves a zero price", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    setUnit("股");
    userEvent.type(field("成交股數"), "50");
    userEvent.type(field("成交單價"), "0");
    submit("新增買進紀錄");
    await screen.findByText("已新增買進紀錄");
    expect(mockSaveTradeRecord.mock.calls[0][1].deal_price).toBe(0);
  });

  test("[REC-R1.12] ignores a fourth decimal of lots", () => {
    renderTradeEditor();
    userEvent.type(field("成交股數"), "1.2345");
    expect(field("成交股數")).toHaveValue("1.234");
  });

  test("[REC-R1.13] ignores a decimal point in shares", () => {
    renderTradeEditor();
    setUnit("股");
    userEvent.type(field("成交股數"), "1.");
    expect(field("成交股數")).toHaveValue("1");
  });

  test("[REC-R1.14] ignores a fifth decimal of the price", () => {
    renderTradeEditor();
    userEvent.type(field("成交單價"), "1041.66671");
    expect(field("成交單價")).toHaveValue("1,041.6667");
  });

  test("[REC-R1.15] shows whole lots in lots when editing", () => {
    const record = trade("2330", "2024-03-01", 2000);
    renderTradeEditor({ record, trades: [record] });
    expect(screen.getByRole("tab", { name: "張", selected: true })).toBeInTheDocument();
    expect(field("成交股數")).toHaveValue("2");
  });

  test("[REC-R1.16] does not save without a handling fee", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    userEvent.clear(field("手續費用"));
    submit("新增買進紀錄");
    expect(within(step("手續費用")).getByText("請填寫手續費用")).toBeInTheDocument();
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
  });

  test("[REC-R1.17] selects the stock on Enter without submitting", async () => {
    renderTradeEditor();
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    userEvent.type(stockInput(), "2330");
    advance(300);
    await screen.findByRole("option", { name: /2330/ });
    userEvent.type(stockInput(), "{enter}");
    expect(
      screen.getByRole("button", { name: /已選股票：台積電，證券代號 2330/ }),
    ).toBeInTheDocument();
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
  });

  test("[REC-R1.18] does not save while the search text is not chosen", async () => {
    renderTradeEditor();
    userEvent.type(stockInput(), "2330");
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    advance(300);
    submit("新增買進紀錄");
    advance(150);
    expect(screen.getAllByText("請從搜尋結果選擇一檔股票").length).toBeGreaterThan(0);
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
  });

  test("[REC-R1.19] starts in lots in a new browser", () => {
    renderTradeEditor();
    expect(screen.getByRole("tab", { name: "張", selected: true })).toBeInTheDocument();
  });

  test("[REC-R1.20] keeps a price with more than four decimals", async () => {
    const record = { ...trade("2330", "2024-03-01", 1000), deal_price: 1041.66667 };
    renderTradeEditor({ record, trades: [record] });
    expect(field("成交單價")).toHaveValue("1,041.66667");
    setUnit("股");
    userEvent.clear(field("成交股數"));
    userEvent.type(field("成交股數"), "1001");
    submit("儲存變更");
    await waitFor(() => expect(mockSaveTradeRecord).toHaveBeenCalled());
    expect(mockSaveTradeRecord.mock.calls[0][1].deal_price).toBe(1041.66667);
  });

  test("lists quantity and price when only shares are filled", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "3");
    expect(within(summary()).getByText("還沒填：股數與單價")).toBeInTheDocument();
  });

  test("lists the fee once it is cleared", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    userEvent.clear(field("手續費用"));
    expect(within(summary()).getByText("還沒填：手續費用")).toBeInTheDocument();
  });

  test("[REC-R1.21] saves once when the button is pressed twice", async () => {
    let finishSave: (value: object) => void = () => {};
    mockSaveTradeRecord.mockImplementation(
      () => new Promise((resolve) => (finishSave = resolve)),
    );
    renderTradeEditor();
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    submit("新增買進紀錄");
    expect(screen.getByRole("button", { name: "新增買進紀錄" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    submit("新增買進紀錄");
    await act(async () => finishSave({}));
    await screen.findByText("已新增買進紀錄");
    expect(mockSaveTradeRecord).toHaveBeenCalledTimes(1);
  });
});

test("deleting from the editor does not submit the form", () => {
  const record = trade("2330", "2024-03-01", 1000, 600);
  renderTradeEditor({ record, trades: [record] });
  userEvent.click(screen.getByRole("button", { name: "刪除交易紀錄" }));
  expect(screen.getByText("刪除交易紀錄？")).toBeInTheDocument();
  expect(mockSaveTradeRecord).not.toHaveBeenCalled();
});

describe("default handling fee", () => {
  test("[REC-R3.1] estimates the buy fee", () => {
    renderTradeEditor();
    userEvent.type(field("成交單價"), "50.5");
    setUnit("股");
    userEvent.type(field("成交股數"), "1000");
    expect(field("手續費用")).toHaveValue("71");
  });

  test("[REC-R3.2] estimates the sell fee", () => {
    renderTradeEditor();
    userEvent.click(screen.getByRole("tab", { name: "賣出" }));
    userEvent.type(field("成交單價"), "600");
    setUnit("股");
    userEvent.type(field("成交股數"), "1000");
    expect(field("手續費用")).toHaveValue("2,655");
  });

  test("[REC-R3.3] charges at least 1", () => {
    renderTradeEditor();
    userEvent.type(field("成交單價"), "10");
    setUnit("股");
    userEvent.type(field("成交股數"), "1");
    expect(field("手續費用")).toHaveValue("1");
  });

  test("[REC-R3.4] keeps a changed fee of an edited record", () => {
    const record = { ...trade("2330", "2024-03-01", 1000, 600), handling_fee: 20 };
    renderTradeEditor({ record, trades: [record] });
    userEvent.clear(field("成交單價"));
    userEvent.type(field("成交單價"), "610");
    expect(field("手續費用")).toHaveValue("20");
    expect(within(step("手續費用")).getByText("已手動修改")).toBeInTheDocument();
  });

  function fillManualFee(): void {
    renderTradeEditor();
    userEvent.type(field("成交單價"), "600");
    setUnit("股");
    userEvent.type(field("成交股數"), "1000");
    expect(field("手續費用")).toHaveValue("855");
    userEvent.clear(field("手續費用"));
    userEvent.type(field("手續費用"), "500");
  }

  test("[REC-R3.5] keeps a changed fee when the shares change", () => {
    fillManualFee();
    userEvent.clear(field("成交股數"));
    userEvent.type(field("成交股數"), "2000");
    expect(field("手續費用")).toHaveValue("500");
  });

  test("[REC-R3.6] goes back to the estimate", () => {
    fillManualFee();
    userEvent.clear(field("成交股數"));
    userEvent.type(field("成交股數"), "2000");
    userEvent.click(screen.getByRole("button", { name: "改回試算" }));
    expect(field("手續費用")).toHaveValue("1,710");
    expect(screen.queryByText("已手動修改")).not.toBeInTheDocument();
  });

  test("keeps 改回試算 next to the fee error", () => {
    fillManualFee();
    userEvent.clear(field("手續費用"));
    submit("新增買進紀錄");
    expect(screen.getAllByText("請填寫手續費用").length).toBeGreaterThan(0);
    userEvent.click(screen.getByRole("button", { name: "改回試算" }));
    expect(field("手續費用")).toHaveValue("855");
  });

  test("keeps the first four decimals of a pasted price", () => {
    renderTradeEditor();
    userEvent.paste(field("成交單價"), "1041.66667");
    expect(field("成交單價")).toHaveValue("1,041.6666");
  });

  test("[REC-R3.7] keeps estimating a record whose fee is the estimate", () => {
    const record = { ...trade("2330", "2024-03-01", 1000, 600), handling_fee: 855 };
    renderTradeEditor({ record, trades: [record] });
    userEvent.clear(field("成交單價"));
    userEvent.type(field("成交單價"), "610");
    expect(field("手續費用")).toHaveValue("869");
  });

  function fillEstimatedFee(): void {
    renderTradeEditor();
    userEvent.type(field("成交單價"), "600");
    setUnit("股");
    userEvent.type(field("成交股數"), "1000");
    expect(field("手續費用")).toHaveValue("855");
  }

  test("[REC-R3.8] clears the estimate with the price", () => {
    fillEstimatedFee();
    userEvent.clear(field("成交單價"));
    expect(field("手續費用")).toHaveValue("");
  });

  test("[REC-R3.9] counts a cleared fee as changed", () => {
    fillEstimatedFee();
    userEvent.clear(field("手續費用"));
    userEvent.clear(field("成交股數"));
    userEvent.type(field("成交股數"), "2000");
    expect(field("手續費用")).toHaveValue("");
    expect(within(step("手續費用")).getByText("已手動修改")).toBeInTheDocument();
  });

  test("[REC-R3.10] charges nothing for stock dividends", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    userEvent.type(field("成交單價"), "0");
    setUnit("股");
    userEvent.type(field("成交股數"), "50");
    expect(field("手續費用")).toHaveValue("0");
    expect(within(summary()).getByText("應付金額").nextSibling).toHaveTextContent(
      "0元",
    );
  });

  test("[REC-R3.11] keeps a changed fee when the side changes", () => {
    fillManualFee();
    userEvent.click(screen.getByRole("tab", { name: "賣出" }));
    expect(field("手續費用")).toHaveValue("500");
  });
});

describe("editing, leaving and adding another", () => {
  test("[REC-R8.1] edits a sell record", async () => {
    const buy = trade("2317", "2024-04-01", 200, 140);
    const sell = trade("2317", "2024-05-02", -200, 150);
    const { hideModal } = renderTradeEditor({ record: sell, trades: [buy, sell] });
    expect(screen.getByRole("heading", { name: "編輯交易紀錄" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "賣出", selected: true }),
    ).toBeInTheDocument();
    expect(field("成交股數")).toHaveValue("200");
    expect(screen.getByRole("tab", { name: "股", selected: true })).toBeInTheDocument();
    userEvent.clear(field("成交股數"));
    userEvent.type(field("成交股數"), "100");
    submit("儲存變更");
    await waitFor(() => expect(hideModal).toHaveBeenCalled());
    expect(mockSaveTradeRecord.mock.calls[0][1]).toMatchObject({
      id: String(sell.id),
      deal_quantity: -100,
    });
  });

  async function addSellRecord(isNarrow = false) {
    const utils = renderTradeEditor({ isNarrow });
    if (isNarrow)
      userEvent.click(within(step("買賣與股票")).getByRole("tab", { name: "賣出" }));
    else userEvent.click(screen.getByRole("tab", { name: "賣出" }));
    await searchAndSelect("2330");
    fireEvent.change(dateInput("交易日期"), { target: { value: "2026-11-20" } });
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    submit("新增賣出紀錄");
    await screen.findByText("已新增賣出紀錄");
    return utils;
  }

  test("[REC-R12.3] keeps the side, unit and date for another record", async () => {
    await addSellRecord();
    userEvent.click(screen.getByRole("button", { name: "再記一筆" }));
    expect(screen.getByRole("heading", { name: "新增交易紀錄" })).toBeInTheDocument();
    expect(stockInput()).toHaveValue("");
    expect(field("成交股數")).toHaveValue("");
    expect(field("成交單價")).toHaveValue("");
    expect(
      screen.getByRole("tab", { name: "賣出", selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "張", selected: true })).toBeInTheDocument();
    expect(dateInput("交易日期")).toHaveValue("2026-11-20");
  });

  test("[REC-R12.5] shows the amount and holdings after saving", async () => {
    const holding = trade("2330", "2026-11-20", 2000, 1000);
    renderTradeEditor({ trades: [holding] });
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "3");
    userEvent.type(field("成交單價"), "1040");
    submit("新增買進紀錄");
    await screen.findByRole("heading", { name: /已新增/ });
    expect(screen.getByText("已新增買進紀錄")).toBeInTheDocument();
    expect(screen.getByText("2330 台積電・11/24（二）")).toBeInTheDocument();
    expect(screen.getByText("3,124,446 元")).toBeInTheDocument();
    expect(screen.getByText("2,000 → 5,000 股")).toBeInTheDocument();
  });

  test("[REC-R13.4] asks before closing a changed window", () => {
    const { hideModal } = renderTradeEditor();
    userEvent.type(field("成交單價"), "600");
    fireEvent.keyDown(field("成交單價"), { key: "Escape" });
    expect(screen.getByText("捨棄變更？")).toBeInTheDocument();
    expect(hideModal).not.toHaveBeenCalled();
  });

  test("[REC-R13.5] leaves another blank record without asking", async () => {
    const { hideModal } = await addSellRecord(true);
    userEvent.click(screen.getByRole("button", { name: "再記一筆" }));
    userEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.queryByText("捨棄變更？")).not.toBeInTheDocument();
    expect(hideModal).toHaveBeenCalled();
  });

  test("[REC-R13.6] closes only the search results on Escape", async () => {
    const { hideModal } = renderTradeEditor();
    userEvent.type(stockInput(), "23");
    advance(300);
    await screen.findAllByRole("option");
    fireEvent.keyDown(stockInput(), { key: "Escape" });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.queryByText("捨棄變更？")).not.toBeInTheDocument();
    expect(hideModal).not.toHaveBeenCalled();
  });

  test("[REC-R13.7] leaves with only search text without asking", () => {
    const { hideModal } = renderTradeEditor({ isNarrow: true });
    userEvent.type(stockInput(), "23");
    userEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.queryByText("捨棄變更？")).not.toBeInTheDocument();
    expect(hideModal).toHaveBeenCalled();
  });
});

describe("steps", () => {
  const summaryOf = (title: string): string =>
    within(step(title)).getByRole("button", { expanded: false }).textContent ?? "";

  test("[REC-R21.1] opens the first step of a new trade record", () => {
    renderTradeEditor({ isNarrow: true });
    expect(within(step("買賣與股票")).getByRole("combobox")).toBeVisible();
    expect(summaryOf("交易日期")).toContain("11/24（二）");
    expect(summaryOf("股數與單價")).toContain("還沒填");
    expect(summaryOf("手續費用")).toContain("填好股數與單價後自動試算");
  });

  test("[REC-R21.2] opens the next step once a stock is picked", async () => {
    renderTradeEditor({ isNarrow: true });
    await searchAndSelect("2330");
    expect(summaryOf("買賣與股票")).toContain("買進・2330 台積電");
    expect(field("成交股數")).toBeVisible();
    expect(field("成交股數")).toHaveFocus();
  });

  test("[REC-R21.3] collapses every step when editing", () => {
    const buy = trade("2317", "2024-04-01", 200, 140);
    const record = { ...trade("2317", "2024-05-02", -200, 150), handling_fee: 132 };
    renderTradeEditor({ isNarrow: true, record, trades: [buy, record] });
    expect(summaryOf("買賣與股票")).toContain("賣出・2317 鴻海");
    expect(summaryOf("交易日期")).toContain("2024/5/2（四）");
    expect(summaryOf("股數與單價")).toContain("200 股 × 150 元");
    expect(summaryOf("手續費用")).toContain("132 元");
  });

  test("[REC-R21.6] focuses the primary button when every step is filled", async () => {
    const record = trade("2330", "2024-03-01", 1000, 600);
    renderTradeEditor({ isNarrow: true, record, trades: [record] });
    userEvent.click(within(step("買賣與股票")).getByRole("button"));
    userEvent.click(screen.getByRole("button", { name: /更換股票/ }));
    userEvent.type(stockInput(), "2317");
    advance(300);
    userEvent.click(await screen.findByRole("option", { name: /2317/ }));
    expect(summaryOf("買賣與股票")).toContain("買進・2317 鴻海");
    expect(screen.getByRole("button", { name: "儲存變更" })).toHaveFocus();
  });

  test("[REC-R21.8] skips a stock chosen in advance", async () => {
    renderTradeEditor({ isNarrow: true, defaultSid: "2330" });
    await waitFor(() => expect(summaryOf("買賣與股票")).toContain("買進・2330 台積電"));
    expect(field("成交股數")).toBeVisible();
  });

  test("marks a partly filled step", async () => {
    renderTradeEditor({ isNarrow: true });
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "3");
    userEvent.click(within(step("交易日期")).getByRole("button"));
    expect(summaryOf("股數與單價")).toContain("還沒填完");
  });

  test("[REC-R21.9] flags a future date in the collapsed step", () => {
    renderTradeEditor({ isNarrow: true });
    userEvent.click(within(step("交易日期")).getByRole("button"));
    fireEvent.change(dateInput("交易日期"), { target: { value: "2026-11-25" } });
    userEvent.click(within(step("股數與單價")).getByRole("button"));
    expect(summaryOf("交易日期")).toContain("交易日期不能晚於今天");
  });

  test("[REC-R21.10] flags search text left in the collapsed step", () => {
    const record = trade("2317", "2024-05-02", -200, 150);
    renderTradeEditor({ isNarrow: true, record, trades: [record] });
    userEvent.click(within(step("買賣與股票")).getByRole("button"));
    userEvent.click(screen.getByRole("button", { name: /更換股票/ }));
    userEvent.type(stockInput(), "2330");
    userEvent.click(within(step("股數與單價")).getByRole("button"));
    advance(150);
    expect(summaryOf("買賣與股票")).toContain("賣出・2317 鴻海");
    expect(summaryOf("買賣與股票")).toContain("請從搜尋結果選擇一檔股票");
  });
});

describe("stock suggestions", () => {
  test("[REC-R22.7] selects nothing on Enter in an empty field", () => {
    renderTradeEditor({ trades: [trade("2330", "2026-11-01", 1000)] });
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    userEvent.click(stockInput());
    expect(screen.getByText("最近記過")).toBeInTheDocument();
    userEvent.type(stockInput(), "{enter}");
    expect(stockInput()).toHaveValue("");
    expect(screen.queryByRole("button", { name: /已選股票/ })).not.toBeInTheDocument();
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
  });

  const optionSids = (): string[] =>
    screen
      .getAllByRole("option")
      .map((option) => (option.lastElementChild?.textContent ?? "").split("・")[0]);

  test("[REC-R22.1] lists recently recorded stocks for a buy", () => {
    renderTradeEditor({
      trades: [
        trade("00878", "2026-11-20", 1000),
        trade("2330", "2026-10-01", 1000),
        trade("0050", "2026-11-22", 1000),
        trade("2330", "2026-09-15", 1000),
      ],
    });
    userEvent.click(stockInput());
    expect(screen.getByText("最近記過")).toBeInTheDocument();
    expect(optionSids()).toEqual(["2330", "0050", "00878"]);
  });

  test("[REC-R22.2] lists at most five stocks", () => {
    renderTradeEditor({
      trades: ["2330", "0050", "00878", "2317", "2454", "2412"].map((sid) =>
        trade(sid, "2026-11-01", 1000),
      ),
    });
    userEvent.click(stockInput());
    expect(optionSids()).toEqual(["2412", "2454", "2317", "00878", "0050"]);
  });

  test("[REC-R22.3] lists holdings for a sell", () => {
    renderTradeEditor({
      trades: [
        trade("2330", "2026-11-01", 2000),
        trade("00878", "2026-11-01", 5000),
        trade("0050", "2026-11-01", 1000),
        trade("0050", "2026-11-02", -1000),
      ],
    });
    userEvent.click(screen.getByRole("tab", { name: "賣出" }));
    userEvent.click(stockInput());
    expect(screen.getByText("持有中")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("00878");
    expect(options[0]).toHaveTextContent("持有 5,000 股");
    expect(options[1]).toHaveTextContent("2330");
    expect(options[1]).toHaveTextContent("持有 2,000 股");
  });

  test("[REC-R22.5] shows no list without records", () => {
    renderTradeEditor();
    userEvent.click(stockInput());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("[REC-R22.6] shows no list for a sell without holdings", () => {
    renderTradeEditor({
      trades: [trade("2330", "2026-11-01", 1000), trade("2330", "2026-11-02", -1000)],
    });
    userEvent.click(screen.getByRole("tab", { name: "賣出" }));
    userEvent.click(stockInput());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("chooses a suggestion only with the arrow keys", () => {
    renderTradeEditor({ trades: [trade("2330", "2026-11-01", 1000)] });
    userEvent.click(stockInput());
    userEvent.type(stockInput(), "{enter}");
    expect(stockInput()).toBeInTheDocument();
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
    userEvent.type(stockInput(), "{arrowdown}{enter}");
    expect(
      screen.getByRole("button", { name: /已選股票：台積電，證券代號 2330/ }),
    ).toBeInTheDocument();
  });

  test("lists the suggestions again after Escape", () => {
    renderTradeEditor({ trades: [trade("2330", "2026-11-01", 1000)] });
    userEvent.click(stockInput());
    fireEvent.keyDown(stockInput(), { key: "Escape" });
    expect(screen.queryByText("最近記過")).not.toBeInTheDocument();
    userEvent.click(field("成交單價"));
    advance(150);
    userEvent.click(stockInput());
    expect(screen.getByText("最近記過")).toBeInTheDocument();
  });
});

const holdingText = (): string =>
  (within(summary()).getByText("庫存").parentElement?.textContent ?? "").replace(
    /\s|變成/g,
    "",
  );

describe("amount and holdings", () => {
  test("[REC-R23.1] shows the payable amount of a buy", async () => {
    renderTradeEditor({ trades: [trade("2330", "2026-11-01", 2000)] });
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "3");
    userEvent.type(field("成交單價"), "1040");
    expect(within(summary()).getByText("3,120,000 元")).toBeInTheDocument();
    expect(within(summary()).getByText("4,446 元")).toBeInTheDocument();
    expect(within(summary()).getByText("應付金額").nextSibling).toHaveTextContent(
      "3,124,446",
    );
    expect(holdingText()).toBe("庫存2,000→5,000股");
  });

  test("[REC-R23.2] shows the receivable amount of a sell", async () => {
    renderTradeEditor({ trades: [trade("00878", "2026-11-01", 5000)] });
    userEvent.click(screen.getByRole("tab", { name: "賣出" }));
    await searchAndSelect("00878");
    userEvent.type(field("成交股數"), "5");
    userEvent.type(field("成交單價"), "22.35");
    expect(within(summary()).getByText("111,750 元")).toBeInTheDocument();
    expect(within(summary()).getByText("494 元")).toBeInTheDocument();
    expect(within(summary()).getByText("應收金額").nextSibling).toHaveTextContent(
      "111,256",
    );
    expect(holdingText()).toBe("庫存5,000→0股");
  });

  test("[REC-R23.3] leaves out the edited record from the holdings after", () => {
    const buy = trade("2317", "2024-04-01", 1700);
    const sell = trade("2317", "2024-05-02", -200);
    renderTradeEditor({ record: sell, trades: [buy, sell] });
    userEvent.clear(field("成交股數"));
    userEvent.type(field("成交股數"), "100");
    expect(holdingText()).toBe("庫存1,500→1,600股");
  });

  test("[REC-R23.4] waits for the price", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "3");
    expect(within(summary()).getByText("應付金額").nextSibling).not.toHaveTextContent(
      /\d/,
    );
  });

  test("[REC-R23.5] shows a shortfall", async () => {
    renderTradeEditor({ trades: [trade("2330", "2026-11-01", 2000)] });
    userEvent.click(screen.getByRole("tab", { name: "賣出" }));
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "3");
    expect(holdingText()).toBe("庫存2,000→不足1,000股");
  });

  test("[REC-R23.8] waits for the fee", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "1");
    userEvent.type(field("成交單價"), "600");
    userEvent.clear(field("手續費用"));
    expect(within(summary()).getByText("應付金額").nextSibling).not.toHaveTextContent(
      /\d/,
    );
  });

  test("[REC-R23.10] rounds the trade amount", async () => {
    renderTradeEditor();
    await searchAndSelect("2330");
    setUnit("股");
    userEvent.type(field("成交股數"), "333");
    userEvent.type(field("成交單價"), "10.55");
    expect(within(summary()).getByText("3,513 元")).toBeInTheDocument();
    expect(within(summary()).getByText("5 元")).toBeInTheDocument();
    expect(within(summary()).getByText("應付金額").nextSibling).toHaveTextContent(
      "3,518",
    );
  });

  test("[REC-R23.11] starts from a shortfall", async () => {
    renderTradeEditor({ trades: [trade("2330", "2026-11-01", -1000)] });
    await searchAndSelect("2330");
    userEvent.type(field("成交股數"), "3");
    expect(holdingText()).toBe("庫存不足1,000→2,000股");
  });
});

describe("oversold sells", () => {
  const warningFor = (date: string, shares: string): string =>
    `存下這筆之後，${date}的賣出會比當時的庫存多 ${shares} 股。如果有更早的買進還沒記，可以先補記。`;

  async function addTrade(
    trades: TradeRecord[],
    { side, date, lots }: { side: "買進" | "賣出"; date?: string; lots?: string },
  ): Promise<void> {
    renderTradeEditor({ trades });
    if (side === "賣出") userEvent.click(screen.getByRole("tab", { name: "賣出" }));
    await searchAndSelect("2330");
    if (date) {
      fireEvent.change(dateInput("交易日期"), { target: { value: date } });
    }
    if (lots) userEvent.type(field("成交股數"), lots);
  }

  test("[REC-R24.1] warns about selling more than the holdings", async () => {
    await addTrade([trade("2330", "2026-11-20", 2000)], { side: "賣出", lots: "3" });
    userEvent.type(field("成交單價"), "1050");
    expect(screen.getAllByText(warningFor("11/24（二）", "1,000"))).toHaveLength(2);
    userEvent.click(screen.getByRole("button", { name: "新增賣出紀錄" }));
    await screen.findByText("已新增賣出紀錄");
    expect(mockSaveTradeRecord).toHaveBeenCalledTimes(1);
  });

  test("[REC-R24.2] does not warn when selling every share", async () => {
    await addTrade([trade("2330", "2026-11-20", 2000)], { side: "賣出", lots: "2" });
    expect(screen.queryByText(/存下這筆之後/)).not.toBeInTheDocument();
  });

  test("[REC-R24.3] warns about a sell earlier than the buy", async () => {
    await addTrade([trade("2330", "2026-11-20", 2000)], {
      side: "賣出",
      date: "2026-11-10",
      lots: "1",
    });
    expect(holdingText()).toBe("庫存2,000→1,000股");
    expect(screen.getAllByText(warningFor("11/10（二）", "1,000"))).toHaveLength(2);
  });

  test("[REC-R24.4] warns when an edited sell grows", () => {
    const buy = trade("2317", "2024-04-01", 1700);
    const sell = trade("2317", "2024-05-02", -200);
    renderTradeEditor({ record: sell, trades: [buy, sell] });
    userEvent.clear(field("成交股數"));
    userEvent.type(field("成交股數"), "1800");
    expect(screen.getAllByText(warningFor("2024/5/2（四）", "100"))).toHaveLength(2);
  });

  test("[REC-R24.5] warns about a later sell", async () => {
    await addTrade(
      [trade("2330", "2026-11-02", 2000), trade("2330", "2026-11-20", -2000)],
      { side: "賣出", date: "2026-11-10", lots: "1" },
    );
    expect(screen.getAllByText(warningFor("11/20（五）", "1,000"))).toHaveLength(2);
  });

  test("[REC-R24.6] warns when an edited buy shrinks", () => {
    const buy = trade("2330", "2026-11-02", 2000);
    const sell = trade("2330", "2026-11-20", -2000);
    renderTradeEditor({ record: buy, trades: [buy, sell] });
    userEvent.clear(field("成交股數"));
    userEvent.type(field("成交股數"), "1");
    expect(screen.getAllByText(warningFor("11/20（五）", "1,000"))).toHaveLength(2);
  });

  test("[REC-R24.7] waits for the shares", async () => {
    await addTrade([trade("2330", "2026-11-20", -2000)], {
      side: "買進",
      date: "2026-11-10",
    });
    expect(screen.queryByText(/存下這筆之後/)).not.toBeInTheDocument();
  });

  test("[REC-R24.8] does not warn about an earlier shortfall", async () => {
    await addTrade([trade("2330", "2026-11-01", -2000)], {
      side: "買進",
      date: "2026-11-10",
      lots: "1",
    });
    expect(screen.queryByText(/存下這筆之後/)).not.toBeInTheDocument();
  });

  test("[REC-R24.9] warns when an edited buy moves later", () => {
    const buy = trade("2330", "2026-11-02", 2000);
    const sell = trade("2330", "2026-11-20", -2000);
    renderTradeEditor({ record: buy, trades: [buy, sell] });
    fireEvent.change(dateInput("交易日期"), { target: { value: "2026-11-23" } });
    expect(screen.getAllByText(warningFor("11/20（五）", "2,000"))).toHaveLength(2);
  });

  test("[REC-R24.10] puts a new record last on its day", async () => {
    await addTrade([trade("2330", "2026-11-20", 1000)], {
      side: "賣出",
      date: "2026-11-20",
      lots: "1",
    });
    expect(screen.queryByText(/存下這筆之後/)).not.toBeInTheDocument();
    expect(
      (within(summary()).getByText("庫存").parentElement?.textContent ?? "").replace(
        /\s|變成/g,
        "",
      ),
    ).toBe("庫存1,000→0股");
  });

  test("[REC-R24.11] does not warn about an unchanged shortfall", () => {
    const sell = trade("2330", "2026-11-20", -1000);
    renderTradeEditor({ record: sell, trades: [sell] });
    userEvent.clear(field("成交單價"));
    userEvent.type(field("成交單價"), "1050");
    expect(screen.queryByText(/存下這筆之後/)).not.toBeInTheDocument();
  });
});

describe("price limit", () => {
  const quote = (
    close: number,
    previousClose: number,
  ): { [sid: string]: StockInfo } => ({
    "2330": {
      sid: "2330",
      name: "台積電",
      quantity: 0,
      close,
      fluct_price: close - previousClose,
    },
    "00878": {
      sid: "00878",
      name: "國泰永續高股息",
      quantity: 0,
      close,
      fluct_price: close - previousClose,
    },
  });

  async function typePrice(
    price: string,
    {
      stockInfo,
      sid = "2330",
      date,
    }: { stockInfo?: { [sid: string]: StockInfo }; sid?: string; date?: string },
  ): Promise<void> {
    quotes = stockInfo ?? {};
    renderTradeEditor({ stockInfo, isNarrow: false });
    await searchAndSelect(sid);
    if (date) fireEvent.change(dateInput("交易日期"), { target: { value: date } });
    userEvent.type(field("成交單價"), price);
  }

  const limitWarning =
    "2330 今天的成交價應在 927 到 1,133 元之間，請確認單價有沒有打錯。";

  test("[REC-R25.1] warns about a price outside the limit", async () => {
    await typePrice("10400", { stockInfo: quote(1045, 1030) });
    expect(screen.getByText(limitWarning)).toBeInTheDocument();
  });

  test("[REC-R25.2] accepts the upper limit", async () => {
    await typePrice("1133", { stockInfo: quote(1045, 1030) });
    expect(screen.queryByText(limitWarning)).not.toBeInTheDocument();
  });

  test("[REC-R25.3] checks only today's trades", async () => {
    await typePrice("10400", { stockInfo: quote(1045, 1030), date: "2026-11-23" });
    expect(screen.queryByText(/今天的成交價應在/)).not.toBeInTheDocument();
  });

  test("[REC-R25.4] skips a stock without a price", async () => {
    await typePrice("10400", { stockInfo: quote(0, 0) });
    expect(screen.queryByText(/今天的成交價應在/)).not.toBeInTheDocument();
  });

  test("[REC-R25.5] accepts the lower limit", async () => {
    await typePrice("927", { stockInfo: quote(1045, 1030) });
    expect(screen.queryByText(/今天的成交價應在/)).not.toBeInTheDocument();
  });

  test("[REC-R25.6] flags the collapsed step", async () => {
    quotes = quote(1045, 1030);
    renderTradeEditor({ isNarrow: true, stockInfo: quotes });
    await searchAndSelect("2330");
    userEvent.type(field("成交單價"), "10400");
    userEvent.click(within(step("手續費用")).getByRole("button"));
    expect(
      within(step("股數與單價")).getByText("單價超出今天的漲跌停範圍"),
    ).toBeInTheDocument();
  });

  test("[REC-R25.7] skips a stock whose price is not loaded", async () => {
    await typePrice("10400", {});
    expect(screen.queryByText(/今天的成交價應在/)).not.toBeInTheDocument();
  });

  test("[REC-R25.8] skips a zero price", async () => {
    await typePrice("0", { stockInfo: quote(1045, 1030) });
    expect(screen.queryByText(/今天的成交價應在/)).not.toBeInTheDocument();
  });

  test("[REC-R25.9] rounds the range to cents", async () => {
    await typePrice("24.73", { stockInfo: quote(22.5, 22.47), sid: "00878" });
    expect(
      screen.getByText(
        "00878 今天的成交價應在 20.22 到 24.72 元之間，請確認單價有沒有打錯。",
      ),
    ).toBeInTheDocument();
  });
});

describe("weekend dates", () => {
  test("[REC-R26.1] warns about a Sunday", () => {
    renderTradeEditor({ isNarrow: true });
    userEvent.click(within(step("交易日期")).getByRole("button"));
    fireEvent.change(dateInput("交易日期"), { target: { value: "2026-11-22" } });
    expect(
      screen.getByText("11/22（日）是週日，台股沒有開盤，請確認交易日期。"),
    ).toBeInTheDocument();
    userEvent.click(within(step("股數與單價")).getByRole("button"));
    expect(within(step("交易日期")).getByText("這天台股沒有開盤")).toBeInTheDocument();
  });

  test("[REC-R26.2] warns about a Saturday", () => {
    renderDividendEditor();
    fireEvent.change(dateInput("入帳日期"), { target: { value: "2026-11-21" } });
    expect(
      screen.getByText("11/21（六）是週六，台股沒有開盤，請確認入帳日期。"),
    ).toBeInTheDocument();
  });
});

describe("stock field", () => {
  test("[MKT-R20.3] shows the stock again when the search is left empty", () => {
    const record = trade("2330", "2024-03-01", 1000, 600);
    renderTradeEditor({ record, trades: [record] });
    userEvent.click(screen.getByRole("button", { name: /更換股票/ }));
    userEvent.click(field("成交單價"));
    advance(150);
    expect(
      screen.getByRole("button", { name: /已選股票：台積電，證券代號 2330/ }),
    ).toBeInTheDocument();
  });

  test("[MKT-R20.4] does not save search text that was not chosen", () => {
    const record = trade("2330", "2024-03-01", 1000, 600);
    renderTradeEditor({ record, trades: [record] });
    userEvent.click(screen.getByRole("button", { name: /更換股票/ }));
    userEvent.type(stockInput(), "2317");
    submit("儲存變更");
    advance(150);
    expect(screen.getByText("請從搜尋結果選擇一檔股票")).toBeInTheDocument();
    expect(stockInput()).toHaveValue("2317");
    expect(mockSaveTradeRecord).not.toHaveBeenCalled();
  });
});

describe("cash dividend editor", () => {
  async function fillDividend(sid: string, amount?: string): Promise<void> {
    await searchAndSelect(sid);
    if (amount) userEvent.type(field("入帳金額"), amount);
  }

  test("[REC-R2.1] adds a cash dividend", async () => {
    renderDividendEditor();
    await fillDividend("2330");
    fireEvent.change(dateInput("入帳日期"), { target: { value: "2024-07-15" } });
    userEvent.type(field("入帳金額"), "1500");
    submit("新增現金股利");
    expect(await screen.findByText("已新增現金股利")).toBeInTheDocument();
    expect(mockSaveCashDividend).toHaveBeenCalledWith("create", {
      sid: "2330",
      deal_time: "2024-07-15",
      cash_dividend: 1500,
    });
  });

  test("[REC-R2.2] points at the missing amount", async () => {
    renderDividendEditor({ isNarrow: true });
    await fillDividend("2330");
    submit("新增現金股利");
    expect(within(step("入帳金額")).getByText("請填寫入帳金額")).toBeInTheDocument();
    expect(field("入帳金額")).toBeVisible();
    expect(mockSaveCashDividend).not.toHaveBeenCalled();
  });

  test("[REC-R2.3] shows a future date at once", () => {
    renderDividendEditor({ isNarrow: true });
    userEvent.click(within(step("入帳日期")).getByRole("button"));
    fireEvent.change(dateInput("入帳日期"), { target: { value: "2026-11-25" } });
    expect(
      within(step("入帳日期")).getByText("入帳日期不能晚於今天"),
    ).toBeInTheDocument();
  });

  test("lists what is missing when the editor opens", () => {
    renderDividendEditor();
    expect(within(summary()).getByText("還沒填：股票、入帳金額")).toBeInTheDocument();
  });

  test("[REC-R2.4] ignores a decimal point and a minus sign", () => {
    renderDividendEditor();
    userEvent.type(field("入帳金額"), "1500.-");
    expect(field("入帳金額")).toHaveValue("1,500");
  });

  test("keeps the caret in place when Backspace deletes a thousands separator", () => {
    renderDividendEditor();
    const input = field("入帳金額");
    userEvent.type(input, "1000");
    const setNativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    const frameCallbacks: ((time: number) => void)[] = [];
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });

    // Backspace right after the comma of 1,000.
    setNativeValue?.call(input, "1000");
    input.setSelectionRange(1, 1);
    fireEvent.input(input);
    frameCallbacks.forEach((callback) => callback(0));
    expect(input).toHaveValue("1,000");
    expect(input.selectionStart).toBe(1);
  });

  test("writes the held shares next to a search result", async () => {
    renderDividendEditor({ trades: [trade("2330", "2026-11-20", 2000)] });
    userEvent.type(stockInput(), "2330");
    advance(300);
    expect(await screen.findByRole("option", { name: /2330/ })).toHaveTextContent(
      "持有 2,000 股",
    );
  });

  test("[REC-R8.2] edits a cash dividend", async () => {
    const record = dividend("2330", "2024-07-15", 1500);
    const { hideModal } = renderDividendEditor({ record, dividends: [record] });
    userEvent.clear(field("入帳金額"));
    userEvent.type(field("入帳金額"), "1800");
    submit("儲存變更");
    await waitFor(() => expect(hideModal).toHaveBeenCalled());
    expect(mockSaveCashDividend.mock.calls[0][1]).toMatchObject({
      id: String(record.id),
      cash_dividend: 1800,
    });
  });

  test("[REC-R12.7] keeps the date for another cash dividend", async () => {
    renderDividendEditor();
    await fillDividend("2330");
    fireEvent.change(dateInput("入帳日期"), { target: { value: "2026-07-15" } });
    userEvent.type(field("入帳金額"), "1500");
    submit("新增現金股利");
    await screen.findByText("已新增現金股利");
    userEvent.click(screen.getByRole("button", { name: "再記一筆" }));
    expect(screen.getByRole("heading", { name: "新增現金股利" })).toBeInTheDocument();
    expect(stockInput()).toHaveValue("");
    expect(field("入帳金額")).toHaveValue("");
    expect(dateInput("入帳日期")).toHaveValue("2026-07-15");
  });

  test("[REC-R21.5] opens the stock step first", () => {
    renderDividendEditor({ isNarrow: true });
    expect(within(step("股票")).getByRole("combobox")).toBeVisible();
    expect(within(step("入帳日期")).getByRole("button")).toHaveTextContent(
      "11/24（二）",
    );
    expect(within(step("入帳金額")).getByRole("button")).toHaveTextContent("還沒填");
  });

  test("[REC-R21.7] flags collapsed steps with problems", () => {
    renderDividendEditor({ isNarrow: true });
    submit("新增現金股利");
    expect(within(step("股票")).getByText("請選擇股票")).toBeVisible();
    expect(
      within(within(step("入帳金額")).getByRole("button")).getByText("請填寫入帳金額"),
    ).toBeInTheDocument();
  });

  test("[REC-R22.4] lists holdings", () => {
    renderDividendEditor({
      trades: [trade("2330", "2026-11-01", 2000), trade("00878", "2026-11-01", 5000)],
    });
    userEvent.click(stockInput());
    expect(screen.getByText("持有中")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("00878");
    expect(options[1]).toHaveTextContent("2330");
  });

  const totalText = (): string =>
    (
      within(summary()).getByText("2330 累計現金股利").parentElement?.textContent ?? ""
    ).replace(/\s|變成/g, "");

  test("[REC-R23.6] adds the amount to the total dividend", async () => {
    renderDividendEditor({ dividends: [dividend("2330", "2025-07-15", 9000)] });
    await fillDividend("2330", "4450");
    expect(within(summary()).getByText("入帳金額").nextSibling).toHaveTextContent(
      "4,450",
    );
    expect(totalText()).toBe("2330累計現金股利9,000→13,450元");
  });

  test("[REC-R23.7] replaces the edited amount in the total dividend", () => {
    const record = dividend("2330", "2025-07-15", 1500);
    renderDividendEditor({
      record,
      dividends: [dividend("2330", "2024-07-15", 7500), record],
    });
    userEvent.clear(field("入帳金額"));
    userEvent.type(field("入帳金額"), "1800");
    expect(totalText()).toBe("2330累計現金股利9,000→9,300元");
  });

  test("[REC-R23.9] waits for the amount", async () => {
    renderDividendEditor({ dividends: [dividend("2330", "2025-07-15", 9000)] });
    await fillDividend("2330");
    expect(within(summary()).getByText("入帳金額").nextSibling).not.toHaveTextContent(
      /\d/,
    );
    expect(totalText()).toBe("2330累計現金股利9,000元");
  });
});
