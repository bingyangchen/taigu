/** @vitest-environment node */

import { expect, test } from "vitest";

import { makeDateAxisLabel } from "./dateAxisLabel";

function getLabels(dates: string[]) {
  const { formatter } = makeDateAxisLabel(dates);
  return dates.map(formatter);
}

test("labels a span of a few months by day, even across a new year", () => {
  expect(getLabels(["2025-12-01", "2026-02-27"])).toEqual(["12/01", "02/27"]);
});

test("labels a span longer than half a year by month", () => {
  expect(getLabels(["2025-10-22", "2026-10-21"])).toEqual(["25/10", "26/10"]);
});
