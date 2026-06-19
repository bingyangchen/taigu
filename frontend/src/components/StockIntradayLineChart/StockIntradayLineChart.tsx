import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";

import {
  getStockIntradayMaxPrice,
  getStockIntradayMinPrice,
  GREEN,
  RED,
  splitStockIntradayDataIntoColoredSegments,
} from "./stockIntradayChartData";

interface Props {
  data: [number, number | null][];
  prevClosePrice: number;
}

const MAJOR_MINUTES = [60, 120, 180, 240, 270];

function formatMarketMinute(minuteAfterOpen: number): string {
  const hour = 9 + Math.floor(minuteAfterOpen / 60);
  const minute = minuteAfterOpen % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function formatStockPrice(value: number): string {
  return value.toFixed(2);
}

class StockIntradayLineChart extends React.Component<Props> {
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
          color: "#aaa",
          fontSize: 11,
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
          color: "#aaa",
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
          smooth: 0.35,
          symbol: "none",
          lineStyle: { color: segment.color, width: 2 },
          z: 2,
        })),
        {
          type: "line",
          data: [],
          z: 1,
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#e2e8f0", width: 1, type: "solid" },
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
        backgroundColor: "#ffffff",
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
              : "0.00";
          const fluctColor = fluctPrice > 0 ? RED : GREEN;
          const fluctSign = fluctPrice > 0 ? "▲" : fluctPrice < 0 ? "▼" : "";
          return [
            `<span style="font-weight:600;color:#1f2933;">${formatMarketMinute(minuteAfterOpen)}</span>`,
            `價格 $${price.toFixed(2)}`,
            `<span style="color:${fluctColor};">較昨收 ${fluctSign}${Math.abs(fluctPrice).toFixed(2)} (${fluctPercent}%)</span>`,
          ].join("<br/>");
        },
      },
      animationDuration: 300,
      animationDurationUpdate: 160,
    };
  }
}

export default StockIntradayLineChart;
