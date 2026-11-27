import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";

import { COLORS, FONT_SIZES } from "../../styles/tokens";
import { formatMarketMinute } from "../../utils/marketIndex";
import { makeTooltipTitle } from "../chartTooltip";
import { makeIntradayTooltipSeries } from "../intradayTooltip";
import {
  formatStockPrice,
  makeStockChangeTooltipLine,
  makeStockPriceTooltipLine,
} from "../stockPriceFormat";
import {
  getStockIntradayMaxPrice,
  getStockIntradayMinPrice,
  splitStockIntradayDataIntoColoredSegments,
} from "./stockIntradayChartData";

interface Props {
  data: [number, number | null][];
  prevClosePrice: number;
}

const MAJOR_MINUTES = [60, 120, 180, 240, 270];

export default function StockIntradayLineChart({ data, prevClosePrice }: Props) {
  const option = makeStockIntradayChartOption(data, prevClosePrice);
  if (!option) return null;

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", width: "100%" }}
      notMerge={true}
    />
  );
}

/** Returns null when no minute of `data` has a quote. */
export function makeStockIntradayChartOption(
  data: Props["data"],
  prevClosePrice: number,
): EChartsOption | null {
  if (!data.some(([, price]) => price !== null)) return null;

  const segments = splitStockIntradayDataIntoColoredSegments(data, prevClosePrice);
  const minPrice = getStockIntradayMinPrice(data, prevClosePrice);
  const maxPrice = getStockIntradayMaxPrice(data, prevClosePrice);

  return {
    backgroundColor: "transparent",
    grid: {
      left: 6,
      top: 12,
      right: 48,
      bottom: 24,
      containLabel: false,
      outerBoundsMode: "none",
    },
    xAxis: {
      type: "value",
      min: 0,
      max: 270,
      interval: 60,
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        formatter: (minute: number) =>
          MAJOR_MINUTES.includes(minute) ? formatMarketMinute(minute) : "",
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      position: "right",
      min: minPrice * 0.999,
      max: maxPrice * 1.001,
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        margin: 0,
        showMinLabel: false,
        showMaxLabel: false,
        formatter: formatStockPrice,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    series: [
      ...segments.map((segment) => ({
        type: "line" as const,
        data: segment.data,
        connectNulls: true,
        smooth: false,
        symbol: "none",
        lineStyle: { color: segment.color, width: 2 },
        z: 2,
        tooltip: { show: false },
      })),
      makeIntradayTooltipSeries(data),
      {
        type: "line",
        data: [],
        z: 1,
        tooltip: { show: false },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: COLORS.borderDefault, width: 1, type: "solid" },
          data: [{ yAxis: prevClosePrice }],
          label: { show: false },
        },
      },
    ],
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "line",
        snap: true,
        lineStyle: { color: COLORS.borderDefault, width: 1 },
      },
      backgroundColor: COLORS.bgSurface,
      textStyle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const param = params.find(
          (item) => Array.isArray(item.value) && item.value[1] !== null,
        );
        if (!param || !Array.isArray(param.value) || param.value[1] === null) {
          return "";
        }
        const minuteAfterOpen = param.value[0] as number;
        const price = param.value[1] as number;
        return [
          makeTooltipTitle(formatMarketMinute(minuteAfterOpen)),
          makeStockPriceTooltipLine(price),
          makeStockChangeTooltipLine("較昨收", price, prevClosePrice),
        ].join("<br/>");
      },
    },
    animationDuration: 300,
    animationDurationUpdate: 160,
  };
}
