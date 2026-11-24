import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import { formatIndexPoints } from "../../utils/marketIndex";
import Util from "../../utils/util";
import AccessibleChart from "../AccessibleChart/AccessibleChart";
import {
  getMarketIndexAxisPadding,
  MARKET_INDEX_AXIS_LABEL_STYLE,
  MARKET_INDEX_GRID,
  MARKET_INDEX_GUIDE_LINE_COLOR,
  MARKET_INDEX_SPLIT_LINE_STYLE,
  MARKET_INDEX_TOOLTIP_STYLE,
} from "../MarketIndexLineChart/marketIndexChartData";
import { getPeriodTrendColor, makePeriodTrendAreaGradient } from "../periodTrend";

interface Props {
  dates: string[];
  values: number[];
  label: string;
}

function makeMarketIndexHistoricalChartOption(
  dates: string[],
  values: number[],
): EChartsOption {
  const lineColor = getPeriodTrendColor(values);
  const areaGradient = makePeriodTrendAreaGradient(values);
  const spansYears = dates[0].slice(0, 4) !== dates.at(-1)?.slice(0, 4);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = getMarketIndexAxisPadding(minValue, maxValue);
  return {
    animation: false,
    backgroundColor: "transparent",
    grid: MARKET_INDEX_GRID,
    xAxis: {
      type: "category",
      data: dates,
      axisLabel: {
        ...MARKET_INDEX_AXIS_LABEL_STYLE,
        showMinLabel: true,
        showMaxLabel: true,

        // About five date labels across the axis.
        interval: Math.max(0, Math.round((dates.length - 1) / 4) - 1),
        formatter: (date: string) =>
          (spansYears ? date.slice(2, 7) : date.slice(5)).replace("-", "/"),
        hideOverlap: true,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      position: "right",
      min: minValue - padding,
      max: maxValue + padding,
      splitNumber: 3,
      axisLabel: {
        ...MARKET_INDEX_AXIS_LABEL_STYLE,
        margin: 8,
        showMinLabel: false,
        showMaxLabel: false,
        formatter: formatIndexPoints,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: MARKET_INDEX_SPLIT_LINE_STYLE },
    },
    series: {
      type: "line",
      data: values,
      lineStyle: { width: 2, color: lineColor, join: "round" },
      itemStyle: { color: lineColor },
      symbol: "circle",
      symbolSize: Util.isMobile ? 5 : 8,
      showSymbol: values.length === 1,
      emphasis: { itemStyle: { color: lineColor, borderColor: lineColor } },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: areaGradient.start },
            { offset: 1, color: areaGradient.end },
          ],
        },
      },
    },
    tooltip: {
      ...MARKET_INDEX_TOOLTIP_STYLE,
      trigger: "axis",
      axisPointer: {
        type: "line",
        lineStyle: { color: MARKET_INDEX_GUIDE_LINE_COLOR, width: 1 },
      },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const [param] = params;
        return `${param.name}<br/>指數 ${formatIndexPoints(param.value)}`;
      },
    },
  };
}

export default function MarketIndexHistoricalLineChart({
  dates,
  values,
  label,
}: Props) {
  const option = useMemo(
    () => makeMarketIndexHistoricalChartOption(dates, values),
    [dates, values],
  );
  return <AccessibleChart label={label} option={option} />;
}
