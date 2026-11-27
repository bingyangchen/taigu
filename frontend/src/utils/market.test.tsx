/** @vitest-environment node */

import { expect, test } from "vitest";

import { makeStockPriceHistory } from "./market";

const DATE_TO_CLOSE = {
  "2025-10-21": 17,
  "2025-10-22": 18,
  "2026-09-21": 19,
  "2026-09-22": 20,
  "2026-10-20": 20.5,
  "2026-10-21": 23.45,
};

test("keeps the closes of the range's days, today included", () => {
  expect(makeStockPriceHistory(DATE_TO_CLOSE, 30, "2026-10-21").dates).toEqual([
    "2026-09-22",
    "2026-10-20",
    "2026-10-21",
  ]);
  expect(makeStockPriceHistory(DATE_TO_CLOSE, 365, "2026-10-21").dates).toEqual(
    Object.keys(DATE_TO_CLOSE).slice(1),
  );
});

test("[STOCK-R5.4] takes the close before the range's first point from all the closes", () => {
  expect(makeStockPriceHistory(DATE_TO_CLOSE, 30, "2026-10-21")).toEqual({
    dates: ["2026-09-22", "2026-10-20", "2026-10-21"],
    values: [20, 20.5, 23.45],
    previousValues: [19, 20, 20.5],
  });
  expect(
    makeStockPriceHistory(DATE_TO_CLOSE, 365, "2026-10-21").previousValues[0],
  ).toBe(17);
  expect(
    makeStockPriceHistory({ "2026-10-20": 20 }, 30, "2026-10-21").previousValues,
  ).toEqual([null]);
});

test("has no points when the range has no closes", () => {
  expect(makeStockPriceHistory({ "2026-01-02": 10 }, 30, "2026-10-21")).toEqual({
    dates: [],
    values: [],
    previousValues: [],
  });
  expect(makeStockPriceHistory(undefined, 30, "2026-10-21").dates).toEqual([]);
});
