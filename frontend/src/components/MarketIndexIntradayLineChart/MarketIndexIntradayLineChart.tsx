import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import { COLORS } from "../../styles/tokens";
import {
  formatIndexPoints,
  formatMarketMinute,
  MARKET_CLOSE_MINUTE,
} from "../../utils/marketIndex";
import AccessibleChart from "../AccessibleChart/AccessibleChart";
import { makeTooltipTitle } from "../chartTooltip";
import { makeIntradayTooltipSeries } from "../intradayTooltip";
import {
  getChartPreviousClose,
  getMarketIndexAxisPadding,
  getMarketIndexMaxPrice,
  getMarketIndexMinPrice,
  makeIndexChangeTooltipLine,
  MARKET_INDEX_AXIS_LABEL_STYLE,
  MARKET_INDEX_GRID,
  MARKET_INDEX_GUIDE_LINE_COLOR,
  MARKET_INDEX_SPLIT_LINE_STYLE,
  MARKET_INDEX_TOOLTIP_STYLE,
  splitMarketIndexDataIntoColoredSegments,
} from "../MarketIndexLineChart/marketIndexChartData";

const TOOLTIP_SERIES_ID = "tooltip";

interface Props {
  data: [number, number | null][];
  prevClosePrice: number | null;
  label: string;
}

function makePointDescription(
  minute: number,
  price: number,
  prevClosePrice: number | null,
): string[] {
  return [
    makeTooltipTitle(formatMarketMinute(minute)),
    `指數 ${formatIndexPoints(price)}`,
    makeIndexChangeTooltipLine("較昨收", price, prevClosePrice),
  ];
}

export function makeMarketIndexIntradayChartOption(
  data: [number, number | null][],
  quotedPrevClosePrice: number | null,
): EChartsOption | null {
  const prevClosePrice = getChartPreviousClose(quotedPrevClosePrice);
  const pointCount = data.filter(([, price]) => price !== null).length;
  if (pointCount === 0) return null;

  const segments = splitMarketIndexDataIntoColoredSegments(data, prevClosePrice);
  const minPrice = getMarketIndexMinPrice(data, prevClosePrice);
  const maxPrice = getMarketIndexMaxPrice(data, prevClosePrice);
  const padding = getMarketIndexAxisPadding(minPrice, maxPrice);
  return {
    animation: false,
    backgroundColor: "transparent",
    grid: MARKET_INDEX_GRID,
    xAxis: {
      type: "value",
      min: 0,
      max: MARKET_CLOSE_MINUTE,
      interval: 90,
      axisLabel: {
        ...MARKET_INDEX_AXIS_LABEL_STYLE,
        alignMinLabel: "left",
        hideOverlap: true,
        formatter: formatMarketMinute,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      position: "right",
      min: minPrice - padding,
      max: maxPrice + padding,
      splitNumber: 3,
      axisLabel: {
        ...MARKET_INDEX_AXIS_LABEL_STYLE,
        showMinLabel: false,
        showMaxLabel: false,
        formatter: formatIndexPoints,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { showMaxLine: false, lineStyle: MARKET_INDEX_SPLIT_LINE_STYLE },
    },
    series: [
      ...segments.map((segment) => ({
        type: "line" as const,
        data: segment.data,
        connectNulls: true,
        symbol: pointCount === 1 ? "circle" : "none",
        itemStyle: { color: segment.color },
        lineStyle: { color: segment.color, width: 2 },
        tooltip: { show: false },
      })),
      { ...makeIntradayTooltipSeries(data), id: TOOLTIP_SERIES_ID },
      ...(prevClosePrice === null
        ? []
        : [
            {
              type: "line" as const,
              data: [],
              tooltip: { show: false },
              markLine: {
                silent: true,
                symbol: "none",
                lineStyle: {
                  color: MARKET_INDEX_GUIDE_LINE_COLOR,
                  width: 1,
                  type: "dashed" as const,
                },
                data: [{ yAxis: prevClosePrice }],
                label: { show: false },
              },
            },
          ]),
    ],
    tooltip: {
      ...MARKET_INDEX_TOOLTIP_STYLE,
      trigger: "axis",
      axisPointer: {
        type: "line",
        snap: true,
        lineStyle: { color: COLORS.borderDefault, width: 1 },
      },
      formatter: (params: unknown) => {
        if (!Array.isArray(params)) return "";
        const point = params.find((param) => param.seriesId === TOOLTIP_SERIES_ID);
        if (!point || !Array.isArray(point.value)) return "";
        const [minute, price] = point.value;
        return makePointDescription(minute, price, quotedPrevClosePrice).join("<br/>");
      },
    },
  };
}

export default function MarketIndexIntradayLineChart({
  data,
  prevClosePrice,
  label,
}: Props) {
  const option = useMemo(
    () => makeMarketIndexIntradayChartOption(data, prevClosePrice),
    [data, prevClosePrice],
  );
  if (option === null) return null;
  return <AccessibleChart label={label} option={option} />;
}
