import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";

import Api from "../../utils/api";
import StockSearchContent from "./StockSearchContent";

vi.mock("../../utils/api", () => ({ default: { sendRequest: vi.fn() } }));

const sendRequest = Api.sendRequest as Mock;
const user = userEvent.setup({ delay: null });

const STOCKS = [
  { sid: "2330", name: "台積電", close: 600, fluct_price: 5 },
  { sid: "2331", name: "精英", close: 20, fluct_price: 0 },
  { sid: "2332", name: "友訊", close: 15, fluct_price: -1 },
];

const scrollIntoView = Element.prototype.scrollIntoView as Mock;

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  scrollIntoView.mockClear();
  sendRequest.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint.startsWith("market/search")) {
      const keyword = endpoint.split("keyword=")[1];
      return { data: STOCKS.filter((stock) => stock.sid.startsWith(keyword)) };
    }
    if (endpoint.startsWith("market/current-stock-info")) {
      const sids = endpoint.split("sids=")[1].split(",");
      return Object.fromEntries(
        STOCKS.filter((stock) => sids.includes(stock.sid)).map((stock) => [
          stock.sid,
          stock,
        ]),
      );
    }
    throw new Error(`Unexpected request: ${endpoint}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderSearch(variant: "dialog" | "page") {
  const onSelectStock = vi.fn();
  render(<StockSearchContent variant={variant} onSelectStock={onSelectStock} />);
  return { onSelectStock };
}

const searchInput = (): HTMLElement => screen.getByRole("combobox");

const highlightedSid = (): string | null => {
  const id = searchInput().getAttribute("aria-activedescendant");
  if (id === null) return null;
  const option = document.getElementById(id);
  expect(option).toHaveAttribute("aria-selected", "true");
  return option?.textContent?.match(/\d{4}/)?.[0] ?? null;
};

async function search(keyword: string): Promise<void> {
  await user.type(searchInput(), keyword);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  await screen.findAllByRole("option");
}

describe("dialog", () => {
  test("highlights the first result and opens it on Enter", async () => {
    const { onSelectStock } = renderSearch("dialog");
    await search("233");
    expect(highlightedSid()).toBe("2330");
    await user.keyboard("{Enter}");
    expect(onSelectStock).toHaveBeenCalledWith("2330");
  });

  test("moves the highlight with the arrow keys and wraps around", async () => {
    const { onSelectStock } = renderSearch("dialog");
    await search("233");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(highlightedSid()).toBe("2332");
    await user.keyboard("{ArrowDown}");
    expect(highlightedSid()).toBe("2330");
    await user.keyboard("{ArrowUp}");
    expect(highlightedSid()).toBe("2332");
    await user.keyboard("{Enter}");
    expect(onSelectStock).toHaveBeenCalledWith("2332");
  });

  test("scrolls the highlighted row into view", async () => {
    // The list holds up to 30 stocks and scrolls, so a row the keyboard reaches can
    // be outside the visible part of the list.
    renderSearch("dialog");
    await search("233");
    await user.keyboard("{ArrowUp}");
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
      screen.getByRole("option", { name: /友訊/ }),
    );
  });

  test("lists the recently picked stocks for the arrow keys", async () => {
    localStorage.setItem("stock_search_lru_cache", JSON.stringify(["2332", "2330"]));
    const { onSelectStock } = renderSearch("dialog");
    await screen.findAllByRole("option");
    expect(highlightedSid()).toBe("2332");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelectStock).toHaveBeenCalledWith("2330");
  });

  test("remembers a stock opened with Enter as recently picked", async () => {
    renderSearch("dialog");
    await search("233");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(JSON.parse(localStorage.getItem("stock_search_lru_cache") ?? "[]")).toEqual([
      "2331",
    ]);
  });

  test("leaves the Enter that confirms an IME composition to the input method", async () => {
    // Zhuyin users press Enter to confirm the characters they typed; opening a stock
    // then would take them away before they finish the keyword.
    const { onSelectStock } = renderSearch("dialog");
    await search("233");
    fireEvent.keyDown(searchInput(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(searchInput(), { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(searchInput(), { key: "ArrowDown", isComposing: true });
    expect(onSelectStock).not.toHaveBeenCalled();
    expect(highlightedSid()).toBe("2330");
  });

  test("does not open a result of the previous keyword", async () => {
    // Results stay on screen during the debounce, so a quick Enter after typing would
    // otherwise open a stock that does not match what the user typed.
    const { onSelectStock } = renderSearch("dialog");
    await search("233");
    await user.type(searchInput(), "2");
    expect(highlightedSid()).toBeNull();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelectStock).not.toHaveBeenCalled();
  });

  test("moves the highlight to the row under a moving pointer only", async () => {
    // Scrolling the list with an arrow key slides rows under a still pointer, which
    // fires mouseenter; following it would move the highlight away from the keyboard.
    renderSearch("dialog");
    await search("233");
    fireEvent.mouseEnter(screen.getByRole("option", { name: /精英/ }));
    expect(highlightedSid()).toBe("2330");
    fireEvent.mouseMove(screen.getByRole("option", { name: /友訊/ }));
    expect(highlightedSid()).toBe("2332");
  });

  test("does not scroll the list to the row under the pointer", async () => {
    // Scrolling to a partly visible row the pointer reaches would slide the list
    // under the pointer while the user only points.
    renderSearch("dialog");
    await search("233");
    scrollIntoView.mockClear();
    fireEvent.mouseMove(screen.getByRole("option", { name: /友訊/ }));
    expect(highlightedSid()).toBe("2332");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  test("scrolls the first result into view when new results arrive", async () => {
    renderSearch("dialog");
    await search("233");
    await user.keyboard("{ArrowUp}");
    await search("{Backspace}");
    expect(highlightedSid()).toBe("2330");
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
      screen.getByRole("option", { name: /台積電/ }),
    );
  });

  test("does not highlight a result of the previous keyword under the pointer", async () => {
    renderSearch("dialog");
    await search("233");
    await user.type(searchInput(), "2");
    fireEvent.mouseMove(screen.getByRole("option", { name: /友訊/ }));
    expect(highlightedSid()).toBeNull();
  });
});

describe("page", () => {
  test("highlights nothing until an arrow key is pressed", async () => {
    const { onSelectStock } = renderSearch("page");
    await search("233");
    expect(highlightedSid()).toBeNull();
    await user.keyboard("{Enter}");
    expect(onSelectStock).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}");
    expect(highlightedSid()).toBe("2330");
    await user.keyboard("{Enter}");
    expect(onSelectStock).toHaveBeenCalledWith("2330");
  });
});
