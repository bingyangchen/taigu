/** @vitest-environment node */

import { expect, test } from "vitest";

import { makeHistoricalPriceChartOption } from "./HistoricalPriceLineChart";

function getTooltips(
  dates: string[],
  values: number[],
  previousValues: (number | null)[] = [null, ...values.slice(0, -1)],
) {
  const { tooltip } = makeHistoricalPriceChartOption(
    { dates, values, previousValues, isWaiting: false },
    { dates: [], values: [] },
  );
  if (!tooltip || Array.isArray(tooltip) || typeof tooltip.formatter !== "function") {
    throw new Error("Expected a tooltip formatter");
  }
  const { formatter } = tooltip;
  return dates.map((date, dataIndex) => {
    const content = formatter(
      [{ name: date, value: values[dataIndex], dataIndex }] as never,
      "",
      () => {},
    );
    if (typeof content !== "string") throw new Error("Expected tooltip text");
    return content.split("<br/>").map((line) => line.replace(/<[^>]*>/g, ""));
  });
}

test("[STOCK-R5.2] shows each close's change from the close before it", () => {
  expect(getTooltips(["2026-10-19", "2026-10-20"], [20, 20.5])).toEqual([
    ["2026/10/19", "價格 $20.00", "漲跌 -- (--)", "區間漲跌 0.00 (0.00%)"],
    ["2026/10/20", "價格 $20.50", "漲跌 ▲0.50 (2.50%)", "區間漲跌 ▲0.50 (2.50%)"],
  ]);
});

test("[STOCK-R5.4] shows the change of a range's first point from the close before it", () => {
  expect(getTooltips(["2026-09-25"], [20], [19])).toEqual([
    ["2026/09/25", "價格 $20.00", "漲跌 ▲1.00 (5.26%)", "區間漲跌 0.00 (0.00%)"],
  ]);
});

test("shows no percent when the close before is zero", () => {
  expect(getTooltips(["2026-10-20", "2026-10-21"], [0, 40])[1]).toEqual([
    "2026/10/21",
    "價格 $40.00",
    "漲跌 ▲40.00 (--)",
    "區間漲跌 ▲40.00 (--)",
  ]);
});

test("groups the thousands of a price and its change", () => {
  expect(getTooltips(["2026-10-20", "2026-10-21"], [1000, 2470])[1]).toEqual([
    "2026/10/21",
    "價格 $2,470.00",
    "漲跌 ▲1,470.00 (147.00%)",
    "區間漲跌 ▲1,470.00 (147.00%)",
  ]);
});

test("shows a fall with the arrow alone, like the other change figures", () => {
  expect(getTooltips(["2026-10-20", "2026-10-21"], [20.5, 20])[1]).toEqual([
    "2026/10/21",
    "價格 $20.00",
    "漲跌 ▼0.50 (2.44%)",
    "區間漲跌 ▼0.50 (2.44%)",
  ]);
});

test("[STOCK-R5.5] compares each close with the first close of the range", () => {
  expect(
    getTooltips(["2026-10-21", "2026-10-22", "2026-10-23"], [20, 20.5, 22])[2],
  ).toEqual([
    "2026/10/23",
    "價格 $22.00",
    "漲跌 ▲1.50 (7.32%)",
    "區間漲跌 ▲2.00 (10.00%)",
  ]);
});
