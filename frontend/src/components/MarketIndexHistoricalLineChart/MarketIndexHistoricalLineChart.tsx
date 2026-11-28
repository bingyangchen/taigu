import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import { COLORS } from "../../styles/tokens";
import { formatIndexPoints } from "../../utils/marketIndex";
import { useIsNarrowLayout } from "../../utils/mediaQuery";
import AccessibleChart from "../AccessibleChart/AccessibleChart";
import { makeTooltipTitle } from "../chartTooltip";
import { makeDateAxisLabel } from "../dateAxisLabel";
import {
  getMarketIndexAxisPadding,
  makeIndexChangeTooltipLine,
  MARKET_INDEX_AXIS_LABEL_STYLE,
  MARKET_INDEX_GRID,
  MARKET_INDEX_SPLIT_LINE_STYLE,
  MARKET_INDEX_TOOLTIP_STYLE,
} from "../MarketIndexLineChart/marketIndexChartData";
import { getPeriodTrendColor, makePeriodTrendAreaGradient } from "../periodTrend";

interface Props {
  dates: string[];
  values: number[];
  previousValues: (number | null)[];
  label: string;
}

export function makeMarketIndexHistoricalChartOption(
  dates: string[],
  values: number[],
  previousValues: (number | null)[],
  isNarrowLayout: boolean,
): EChartsOption {
  const lineColor = getPeriodTrendColor(values);
  const areaGradient = makePeriodTrendAreaGradient(values);
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
        alignMinLabel: "left",
        ...makeDateAxisLabel(dates),
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
      splitLine: { showMaxLine: false, lineStyle: MARKET_INDEX_SPLIT_LINE_STYLE },
    },
    series: {
      type: "line",
      data: values,
      lineStyle: { width: 2, color: lineColor, join: "round" },
      itemStyle: { color: lineColor },
      symbol: "circle",
      symbolSize: isNarrowLayout ? 5 : 8,
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
        lineStyle: { color: COLORS.borderDefault, width: 1 },
      },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const [{ name, value, dataIndex }] = params;
        return [
          makeTooltipTitle(name.replaceAll("-", "/")),
          `指數 ${formatIndexPoints(value)}`,
          makeIndexChangeTooltipLine("漲跌", value, previousValues[dataIndex]),
          makeIndexChangeTooltipLine("區間漲跌", value, values[0]),
        ].join("<br/>");
      },
    },
  };
}

export default function MarketIndexHistoricalLineChart({
  dates,
  values,
  previousValues,
  label,
}: Props) {
  const isNarrowLayout = useIsNarrowLayout();
  const option = useMemo(
    () =>
      makeMarketIndexHistoricalChartOption(
        dates,
        values,
        previousValues,
        isNarrowLayout,
      ),
    [dates, values, previousValues, isNarrowLayout],
  );
  return <AccessibleChart label={label} option={option} />;
}
