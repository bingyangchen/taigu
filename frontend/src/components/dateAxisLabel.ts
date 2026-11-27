import { getDaysBetween } from "../utils/date";

/**
 * Labels about five of `dates` (in YYYY-MM-DD) across a category axis: by day, or
 * by month when the dates span more than half a year. A span of a few months is
 * labeled by day even across a new year, because month labels five dates apart
 * would repeat a month.
 */
export function makeDateAxisLabel(dates: string[]) {
  const isLabeledByMonth =
    dates.length > 0 && getDaysBetween(dates[0], dates[dates.length - 1]) > 183;
  return {
    interval: Math.max(0, Math.round((dates.length - 1) / 4) - 1),
    formatter: (date: string) =>
      (isLabeledByMonth ? date.slice(2, 7) : date.slice(5)).replace("-", "/"),
  };
}
