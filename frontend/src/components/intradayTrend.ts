import { COLORS } from "../styles/tokens";

type IntradayPoint = [number, number | null];

export interface IntradayTrendSegment {
  data: IntradayPoint[];
  color: string;
}

export const PREVIOUS_CLOSE_LINE_STYLE = {
  color: COLORS.textSecondary,
  width: 1,
  type: "dashed" as const,
};

/**
 * Splits an intraday line into red segments above the previous close and green
 * ones at or below it. Where the line crosses the previous close, both segments end
 * at the interpolated crossing point, even when minutes without a quote lie between
 * the two quotes.
 */
export function splitIntradayDataAtPreviousClose(
  data: IntradayPoint[],
  prevClosePrice: number,
): IntradayTrendSegment[] {
  const segments: IntradayTrendSegment[] = [];
  let segment: IntradayPoint[] = [];
  let color: string | null = null;
  let lastQuote: [number, number] | null = null;

  for (const point of data) {
    const [minute, price] = point;
    if (price === null) {
      segment.push(point);
      continue;
    }
    const pointColor = price > prevClosePrice ? COLORS.chartUp : COLORS.chartDown;
    if (color !== null && lastQuote !== null && pointColor !== color) {
      // The colors differ only when the two quotes sit on opposite sides of the
      // previous close or one of them is on it, so the crossing lies between them,
      // at the last quote itself when that quote equals the previous close.
      const [lastMinute, lastPrice] = lastQuote;
      const ratio = (prevClosePrice - lastPrice) / (price - lastPrice);
      const crossing: IntradayPoint = [
        lastMinute + ratio * (minute - lastMinute),
        prevClosePrice,
      ];
      segment.push(crossing);
      segments.push({ data: segment, color });
      segment = [crossing, point];
    } else {
      segment.push(point);
    }
    color = pointColor;
    lastQuote = [minute, price];
  }

  if (color !== null) segments.push({ data: segment, color });
  return segments;
}
