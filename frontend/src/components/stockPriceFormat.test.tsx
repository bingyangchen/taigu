/** @vitest-environment node */

import { expect, test } from "vitest";

import { formatStockChange, formatStockPriceAxisLabel } from "./stockPriceFormat";

test.each([
  { change: 6, previousClose: 594, expected: "▲6.00 (1.01%)" },
  { change: -0.45, previousClose: 23.9, expected: "▼0.45 (1.88%)" },
  { change: 1470, previousClose: 1000, expected: "▲1,470.00 (147.00%)" },
  { change: 0, previousClose: 600, expected: "-" },
  { change: 5, previousClose: 0, expected: "▲5.00 (--)" },
])(
  "writes a $change change from $previousClose as $expected",
  ({ change, previousClose, expected }) => {
    expect(formatStockChange(change, previousClose)).toBe(expected);
  },
);

test("leaves the trailing zeros out of an axis price", () => {
  expect([2450, 23.5, 23.45].map(formatStockPriceAxisLabel)).toEqual([
    "2,450",
    "23.5",
    "23.45",
  ]);
});
