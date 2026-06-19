import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";

import {
  getMarketIndexMaxPrice,
  getMarketIndexMinPrice,
  splitMarketIndexDataIntoColoredSegments,
} from "../MarketIndexLineChart/marketIndexChartData";

interface Props {
  data: [number, number | null][];
  prevClosePrice: number;
}

function formatMarketMinute(minuteAfterOpen: number): string {
  const hour = 9 + Math.floor(minuteAfterOpen / 60);
  const minute = minuteAfterOpen % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function formatPrice(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toString();
}

class MarketIndexIntradayLineChart extends React.Component<Props> {
  public render(): React.ReactNode {
    if (!this.hasPlottedData) return null;

    return (
      <ReactECharts
        option={this.chartOption}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
      />
    );
  }

  private get hasPlottedData(): boolean {
    return this.props.data.some(([, price]) => price !== null);
  }

  private get chartOption(): EChartsOption {
    const { data, prevClosePrice } = this.props;
    const segments = splitMarketIndexDataIntoColoredSegments(data, prevClosePrice);
    const minPrice = getMarketIndexMinPrice(data, prevClosePrice);
    const maxPrice = getMarketIndexMaxPrice(data, prevClosePrice);

    return {
      backgroundColor: "transparent",
      grid: {
        left: 6,
        top: 12,
        right: 40,
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
          color: "#aaa",
          formatter: (minute: number) => formatMarketMinute(minute),
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
          color: "#aaa",
          margin: 0,
          showMinLabel: false,
          showMaxLabel: false,
          formatter: formatPrice,
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
          symbol: "none",
          lineStyle: { color: segment.color, width: 2 },
        })),
        {
          type: "line",
          data: [],
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#ddd", width: 1, type: "solid" },
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
          lineStyle: { color: "#ddd", width: 1 },
        },
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        borderColor: "#dbe4ef",
        borderWidth: 1,
        textStyle: { color: "#334155", fontSize: 12 },
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
          const fluctPrice = Math.round((price - prevClosePrice) * 100) / 100;
          const fluctPercent =
            prevClosePrice !== 0
              ? ((fluctPrice / prevClosePrice) * 100).toFixed(2)
              : null;
          const fluctSign = fluctPrice > 0 ? "▲" : fluctPrice < 0 ? "▼" : "-";
          const fluctPercentText =
            fluctPercent !== null ? ` (${Math.abs(Number(fluctPercent))}%)` : "";
          return [
            formatMarketMinute(minuteAfterOpen),
            `指數 ${price.toLocaleString()}`,
            `較昨收 ${fluctSign}${Math.abs(fluctPrice).toLocaleString()}${fluctPercentText}`,
          ].join("<br/>");
        },
      },
      animationDuration: 300,
      animationDurationUpdate: 160,
    };
  }
}

export default MarketIndexIntradayLineChart;
