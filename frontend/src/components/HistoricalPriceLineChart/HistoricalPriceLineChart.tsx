import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { memo, useState } from "react";

import { COLORS, FONT_SIZES } from "../../styles/tokens";
import { useIsNarrowLayout } from "../../utils/mediaQuery";
import { makeTooltipTitle } from "../chartTooltip";
import { makeDateAxisLabel } from "../dateAxisLabel";
import { getPeriodTrendColor, makePeriodTrendAreaGradient } from "../periodTrend";
import {
  formatStockPriceAxisLabel,
  makeStockChangeTooltipLine,
  makeStockPriceTooltipLine,
} from "../stockPriceFormat";

interface Props {
  // In YYYY-MM-DD.
  dates: string[];
  values: number[];

  // The close before each point, which may be left out of the chart.
  previousValues: (number | null)[];
  isWaiting: boolean;
}

interface ChartData {
  dates: string[];
  values: number[];
}

function HistoricalPriceLineChart(props: Props) {
  const [fakeData] = useState(makeFakeChartData);
  const isNarrowLayout = useIsNarrowLayout();
  return (
    <ReactECharts
      option={makeHistoricalPriceChartOption(props, fakeData, isNarrowLayout)}
      style={{ height: "100%", width: "100%" }}
      notMerge={true}
    />
  );
}

export default memo(HistoricalPriceLineChart);

export function makeHistoricalPriceChartOption(
  props: Props,
  fakeData: ChartData,
  isNarrowLayout: boolean,
): EChartsOption {
  const dates = props.isWaiting ? fakeData.dates : props.dates;
  const values = props.isWaiting ? fakeData.values : props.values;
  const lineColor = props.isWaiting
    ? COLORS.chartInactive
    : getPeriodTrendColor(props.values);
  const areaGradient = makePeriodTrendAreaGradient(props.values);

  if (dates.length === 0 || values.length === 0) {
    return {};
  }

  return {
    backgroundColor: "transparent",
    grid: {
      left: 0,
      top: 12,
      right: 48,
      bottom: 24,
      containLabel: false,
      outerBoundsMode: "none",
    },
    xAxis: {
      type: "category",
      data: dates,
      show: !props.isWaiting,
      axisLabel: {
        show: !props.isWaiting,
        showMinLabel: false,
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        ...(props.isWaiting ? {} : makeDateAxisLabel(dates)),
        hideOverlap: true,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: props.isWaiting
      ? {
          type: "value",
          show: false,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        }
      : {
          type: "value",
          scale: true,
          position: "right",
          // The line spans the plot from its lowest to its highest close, so the gap
          // above it is the grid's fixed top margin instead of a rounded-up tick.
          min: "dataMin",
          max: "dataMax",
          axisLabel: {
            color: COLORS.textSecondary,
            fontSize: FONT_SIZES.chartTick,
            margin: 0,
            showMinLabel: false,
            showMaxLabel: false,
            formatter: formatStockPriceAxisLabel,
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
    series: props.isWaiting
      ? {
          type: "line",
          data: values,
          lineStyle: { width: 2.5, color: COLORS.chartInactive },
          symbol: "none",
          silent: true,
        }
      : {
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
      show: !props.isWaiting,
      trigger: "axis",
      axisPointer: {
        type: "line",
        lineStyle: { color: COLORS.borderDefault, width: 1 },
      },
      backgroundColor: COLORS.bgSurface,
      textStyle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) {
          return "";
        }
        const [{ name, value, dataIndex }] = params;
        return [
          makeTooltipTitle(name.replaceAll("-", "/")),
          makeStockPriceTooltipLine(value),
          makeStockChangeTooltipLine("漲跌", value, props.previousValues[dataIndex]),
          makeStockChangeTooltipLine("區間漲跌", value, values[0]),
        ].join("<br/>");
      },
    },
    animationDuration: 300,
    animationDurationUpdate: 160,
  };
}

function makeFakeChartData(): ChartData {
  const dates: string[] = [];
  const values: number[] = [];
  for (let i = 0, p = 100; i < 60; i++) {
    dates.push(i.toString());
    values.push(p);
    p += (p * (Math.random() - 0.5)) / 5;
  }
  return { dates, values };
}
