import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import * as ecStat from "echarts-stat";

import { COLORS, FONT_SIZES } from "../../styles/tokens";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
echarts.registerTransform((ecStat as any).transform.histogram);

interface Props {
  prices: number[];
}

export default function InventoryHistogram({ prices }: Props) {
  return (
    <ReactECharts
      option={makeInventoryHistogramOption(prices)}
      style={{ height: "100%", width: "100%" }}
      notMerge={true}
    />
  );
}

function makeInventoryHistogramOption(prices: number[]): EChartsOption {
  if (prices.length === 0) return {};
  return {
    backgroundColor: "transparent",
    grid: { left: 42, top: 8, right: 12, bottom: 26, containLabel: false },
    dataset: [
      { source: prices.map((price) => [price]) },
      { transform: { type: "ecStat:histogram", config: { method: "sturges" } } },
    ],
    xAxis: {
      type: "category",
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        hideOverlap: true,
      },
      axisLine: { show: true, lineStyle: { color: COLORS.borderDefault, width: 1 } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        formatter: (value: number) => {
          if (value >= 1_000) return Math.round(value / 1_000) + "K";
          return value.toString();
        },
      },
    },
    series: [
      {
        type: "bar",
        datasetIndex: 1,
        itemStyle: { color: COLORS.chartAccentSoft, borderRadius: [3, 3, 0, 0] },
        barWidth: "100%",
      },
    ],
    tooltip: {
      show: true,
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: COLORS.chartAccentWash } },
      backgroundColor: COLORS.bgSurface,
      borderColor: COLORS.borderDefault,
      borderWidth: 1,
      textStyle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const param = params[0] as { value: number[] };
        return `${param.value[4] ?? ""}<br/>數量: ${param.value[1] ?? 0}`;
      },
    },
  };
}
