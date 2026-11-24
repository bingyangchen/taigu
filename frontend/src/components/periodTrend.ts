import { GREEN, RED } from "./MarketIndexLineChart/marketIndexChartData";

const FLAT_COLOR = "#888888";
const TRANSPARENT_ALPHA = "00";

export function getPeriodTrendColor(values: number[]): string {
  if (values.length < 2) return FLAT_COLOR;
  const firstPrice = values[0];
  const lastPrice = values[values.length - 1];
  if (firstPrice > lastPrice) return GREEN;
  if (firstPrice < lastPrice) return RED;
  return FLAT_COLOR;
}

export function makePeriodTrendAreaGradient(values: number[]): {
  start: string;
  end: string;
} {
  const color = getPeriodTrendColor(values);
  return { start: color, end: `${color}${TRANSPARENT_ALPHA}` };
}
