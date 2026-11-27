/** @vitest-environment node */

import { expect, test } from "vitest";

import { COLORS } from "../styles/tokens";
import { splitIntradayDataAtPreviousClose } from "./intradayTrend";

test("splits the line at the previous close across minutes without a quote", () => {
  expect(
    splitIntradayDataAtPreviousClose(
      [
        [10, 98],
        [11, null],
        [12, null],
        [13, 104],
      ],
      100,
    ),
  ).toEqual([
    {
      data: [
        [10, 98],
        [11, null],
        [12, null],
        [11, 100],
      ],
      color: COLORS.chartDown,
    },
    {
      data: [
        [11, 100],
        [13, 104],
      ],
      color: COLORS.chartUp,
    },
  ]);
});

test("draws a rise from exactly the previous close in red", () => {
  expect(
    splitIntradayDataAtPreviousClose(
      [
        [0, 100],
        [1, null],
        [2, 104],
      ],
      100,
    ),
  ).toEqual([
    {
      data: [
        [0, 100],
        [1, null],
        [0, 100],
      ],
      color: COLORS.chartDown,
    },
    {
      data: [
        [0, 100],
        [2, 104],
      ],
      color: COLORS.chartUp,
    },
  ]);
});

test("keeps minutes without a quote before the first and after the last quote", () => {
  expect(
    splitIntradayDataAtPreviousClose(
      [
        [0, null],
        [1, 101],
        [2, null],
      ],
      100,
    ),
  ).toEqual([
    {
      data: [
        [0, null],
        [1, 101],
        [2, null],
      ],
      color: COLORS.chartUp,
    },
  ]);
});

test("ends the red segment at a fall to exactly the previous close", () => {
  expect(
    splitIntradayDataAtPreviousClose(
      [
        [0, 102],
        [1, 100],
      ],
      100,
    ),
  ).toEqual([
    {
      data: [
        [0, 102],
        [1, 100],
      ],
      color: COLORS.chartUp,
    },
    {
      data: [
        [1, 100],
        [1, 100],
      ],
      color: COLORS.chartDown,
    },
  ]);
});

test("draws nothing without a quote", () => {
  expect(splitIntradayDataAtPreviousClose([], 100)).toEqual([]);
  expect(
    splitIntradayDataAtPreviousClose(
      [
        [0, null],
        [1, null],
      ],
      100,
    ),
  ).toEqual([]);
});

test("keeps a price equal to the previous close on the green side", () => {
  expect(
    splitIntradayDataAtPreviousClose(
      [
        [0, 100],
        [1, 99],
      ],
      100,
    ),
  ).toEqual([
    {
      data: [
        [0, 100],
        [1, 99],
      ],
      color: COLORS.chartDown,
    },
  ]);
});
