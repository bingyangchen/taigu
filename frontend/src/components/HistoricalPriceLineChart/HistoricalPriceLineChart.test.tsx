/** @vitest-environment node */

import { expect, test } from "vitest";

import { makeHistoricalPriceChartOption } from "./HistoricalPriceLineChart";

function getTooltips(dates: string[], values: number[]) {
  const { tooltip } = makeHistoricalPriceChartOption(
    { dates, values, isWaiting: false },
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
  expect(getTooltips(["10/19", "10/20"], [20, 20.5])).toEqual([
    ["10/19", "價格 $20.00", "漲跌 -- (--)"],
    ["10/20", "價格 $20.50", "漲跌 ▲0.50 (2.50%)"],
  ]);
});

test("shows no percent when the close before is zero", () => {
  expect(getTooltips(["10/20", "10/21"], [0, 40])[1]).toEqual([
    "10/21",
    "價格 $40.00",
    "漲跌 ▲40.00 (--)",
  ]);
});

test("shows a fall with the arrow alone, like the other change figures", () => {
  expect(getTooltips(["10/20", "10/21"], [20.5, 20])[1]).toEqual([
    "10/21",
    "價格 $20.00",
    "漲跌 ▼0.50 (2.44%)",
  ]);
});
