import type { EChartsOption } from "echarts";

import { COLORS } from "../../styles/tokens";

export const CHART_COLORS = {
  accent: COLORS.chartAccent,
  accentSoft: COLORS.chartAccentSoft,
  accentFaint: COLORS.chartAccentFaint,
  strongSeries: COLORS.textPrimary,
  mutedSeries: COLORS.textSecondary,
  secondaryText: COLORS.textSecondary,
  axisLine: COLORS.borderDefault,
  splitLine: COLORS.borderSubtle,
  incompleteArea: COLORS.chartIncompleteArea,
};

// The admin console keeps its own tick size, because ui-guidelines.md does not let
// the front-end type sizes apply to it.
export const CHART_TICK_FONT_SIZE = 11;

// The part of an ECharts tooltip or label callback parameter that the pages read.
export type DataIndexParam = { dataIndex: number };

export const CHART_GRID = { left: 36, right: 8, top: 24, bottom: 24 };

export const categoryAxisStyle = {
  axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
  axisTick: { show: false },
  axisLabel: { color: CHART_COLORS.secondaryText, fontSize: CHART_TICK_FONT_SIZE },
};

export function makeValueAxis(
  unit: string,
  {
    minInterval,
    formatLabel,
  }: { minInterval?: number; formatLabel?: (value: number) => string } = {},
): EChartsOption["yAxis"] {
  return {
    type: "value",
    name: unit,
    nameTextStyle: {
      color: CHART_COLORS.secondaryText,
      fontSize: CHART_TICK_FONT_SIZE,
      align: "right",
    },
    minInterval,
    splitLine: { lineStyle: { color: CHART_COLORS.splitLine } },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: CHART_COLORS.secondaryText,
      fontSize: CHART_TICK_FONT_SIZE,
      formatter: formatLabel,
    },
  };
}

// ECharts' generated description is in Simplified Chinese, so each chart gives its own.
export function makeAria(description: string): EChartsOption["aria"] {
  return { enabled: true, label: { description } };
}
