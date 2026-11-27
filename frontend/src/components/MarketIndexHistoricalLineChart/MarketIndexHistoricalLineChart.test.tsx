/** @vitest-environment node */

import { expect, test } from "vitest";

import { makeMarketIndexHistory, makeMarketIndexQuote } from "../../utils/marketIndex";
import { makeMarketIndexHistoricalChartOption } from "./MarketIndexHistoricalLineChart";

const NO_QUOTE = makeMarketIndexQuote({}, null);

function makeClosingPrices(count: number): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10),
      22850 + index * 5,
    ]),
  );
}

function getTooltips(closingPrices: Record<string, number>, limit: number) {
  const { dates, values, previousValues } = makeMarketIndexHistory(
    closingPrices,
    NO_QUOTE,
    limit,
  );
  const { tooltip } = makeMarketIndexHistoricalChartOption(
    dates,
    values,
    previousValues,
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

test("[MKT-R15.3] compares the first point of a range with the close before the range", () => {
  const tooltips = getTooltips(makeClosingPrices(31), 30);
  expect(tooltips).toHaveLength(30);
  expect(tooltips[0]).toEqual(["2026/10/02", "指數 22,855", "漲跌 ▲5 (0.02%)"]);
  expect(tooltips[1]).toEqual(["2026/10/03", "指數 22,860", "漲跌 ▲5 (0.02%)"]);
});

test("[MKT-R15.4] shows no change for the earliest close", () => {
  const tooltips = getTooltips(makeClosingPrices(10), Infinity);
  expect(tooltips).toHaveLength(10);
  expect(tooltips[0]).toEqual(["2026/10/01", "指數 22,850", "漲跌 -- (--)"]);
});
