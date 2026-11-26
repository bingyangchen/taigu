import { COLORS, TRANSPARENT_ALPHA } from "../styles/tokens";

export function getPeriodTrendColor(values: number[]): string {
  if (values.length < 2) return COLORS.chartMuted;
  const firstPrice = values[0];
  const lastPrice = values[values.length - 1];
  if (firstPrice > lastPrice) return COLORS.chartDown;
  if (firstPrice < lastPrice) return COLORS.chartUp;
  return COLORS.chartMuted;
}

export function makePeriodTrendAreaGradient(values: number[]): {
  start: string;
  end: string;
} {
  const color = getPeriodTrendColor(values);
  return { start: color, end: `${color}${TRANSPARENT_ALPHA}` };
}
