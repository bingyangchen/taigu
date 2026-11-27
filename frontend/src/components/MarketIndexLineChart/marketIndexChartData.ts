import { COLORS, FONT_SIZES } from "../../styles/tokens";
import { formatIndexChange, getChangePercent } from "../../utils/marketIndex";
import { makeChangeTooltipLine, NO_CHANGE_TEXT } from "../chartTooltip";
import {
  type IntradayTrendSegment,
  splitIntradayDataAtPreviousClose,
} from "../intradayTrend";

export const MARKET_INDEX_AXIS_LABEL_STYLE = {
  color: COLORS.textSecondary,
  fontSize: FONT_SIZES.chartTick,
};
export const MARKET_INDEX_SPLIT_LINE_STYLE = { color: COLORS.borderDefault };
export const MARKET_INDEX_TOOLTIP_STYLE = {
  confine: true,
  backgroundColor: COLORS.bgSurface,
  borderColor: COLORS.borderDefault,
  borderWidth: 1,
  textStyle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs },
};

export function makeIndexChangeTooltipLine(
  label: string,
  value: number,
  previousValue: number | null,
): string {
  if (previousValue === null) return makeChangeTooltipLine(label, null, NO_CHANGE_TEXT);
  const change = value - previousValue;
  return makeChangeTooltipLine(
    label,
    change,
    formatIndexChange(change, getChangePercent(change, previousValue)),
  );
}

// The first time or date label starts at the plot's left edge (alignMinLabel), so the
// plot runs almost to the edge like the stock charts; the right inset fits point
// labels such as "23,100.5".
export const MARKET_INDEX_GRID = {
  left: 6,
  top: 12,
  right: 61,
  bottom: 20,
  outerBoundsMode: "none" as const,
};

// MKT-R14 treats a previous close of 0 as missing, so it gets no reference line or axis room.
export function getChartPreviousClose(prevClosePrice: number | null): number | null {
  return prevClosePrice === 0 ? null : prevClosePrice;
}

// Keeps a flat line or a lone point off the plot edges.
export function getMarketIndexAxisPadding(minPrice: number, maxPrice: number): number {
  return Math.max((maxPrice - minPrice) * 0.1, Math.abs(maxPrice) * 0.001, 0.01);
}

export function getMarketIndexMinPrice(
  data: [number, number | null][],
  prevClosePrice: number | null,
): number {
  return Math.min(
    ...data.flatMap(([, price]) => (price === null ? [] : [price])),
    ...(prevClosePrice === null ? [] : [prevClosePrice]),
  );
}

export function getMarketIndexMaxPrice(
  data: [number, number | null][],
  prevClosePrice: number | null,
): number {
  return Math.max(
    ...data.flatMap(([, price]) => (price === null ? [] : [price])),
    ...(prevClosePrice === null ? [] : [prevClosePrice]),
  );
}

export function splitMarketIndexDataIntoColoredSegments(
  data: [number, number | null][],
  prevClosePrice: number | null,
): IntradayTrendSegment[] {
  if (prevClosePrice === null) return [{ data, color: COLORS.chartAccent }];
  return splitIntradayDataAtPreviousClose(data, prevClosePrice);
}
