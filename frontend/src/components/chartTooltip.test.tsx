/** @vitest-environment node */

import { expect, test } from "vitest";

import { COLORS } from "../styles/tokens";
import { makeChangeTooltipLine } from "./chartTooltip";

test.each([
  { change: 5, color: COLORS.priceUp },
  { change: -5, color: COLORS.priceDown },
  { change: 0, color: COLORS.priceFlat },
  { change: null, color: COLORS.priceFlat },
])("colors a $change change like the other change figures", ({ change, color }) => {
  expect(makeChangeTooltipLine("漲跌", change, "text")).toBe(
    `<span style="color:${color};">漲跌 text</span>`,
  );
});
