import type { EChartsOption } from "echarts";

import tokens from "./tokens.module.scss";

export const CHART_COLORS = {
  blue: tokens.blue,
  blueLight: tokens.blueTransparent2,
  blueMedium: tokens.blueTransparent1,
  deepGray: tokens.deepGray,
  gray: tokens.gray,
  lightGray: tokens.lightGray,
  noisyWhite: tokens.noisyWhite,
  incompleteArea: tokens.blackTransparent3,
};

// The part of an ECharts tooltip or label callback parameter that the pages read.
export type DataIndexParam = { dataIndex: number };

export const CHART_GRID = { left: 36, right: 8, top: 24, bottom: 24 };

export const categoryAxisStyle = {
  axisLine: { lineStyle: { color: CHART_COLORS.lightGray } },
  axisTick: { show: false },
  axisLabel: { color: CHART_COLORS.gray, fontSize: 11 },
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
    nameTextStyle: { color: CHART_COLORS.gray, fontSize: 11, align: "right" },
    minInterval,
    splitLine: { lineStyle: { color: CHART_COLORS.noisyWhite } },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: CHART_COLORS.gray, fontSize: 11, formatter: formatLabel },
  };
}

// ECharts' generated description is in Simplified Chinese, so each chart gives its own.
export function makeAria(description: string): EChartsOption["aria"] {
  return { enabled: true, label: { description } };
}
