import type { LineSeriesOption } from "echarts";

export function makeIntradayTooltipSeries(
  data: [number, number | null][],
): LineSeriesOption {
  return {
    type: "line",
    data: data.filter((point): point is [number, number] => point[1] !== null),
    symbol: "none",
    lineStyle: { opacity: 0 },
    silent: true,
    emphasis: { disabled: true },
    animation: false,
  };
}
