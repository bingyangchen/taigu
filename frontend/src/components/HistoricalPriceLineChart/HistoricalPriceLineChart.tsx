import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";

import Util from "../../utils/util";
import { GREEN, RED } from "../MarketIndexLineChart/marketIndexChartData";

const HISTORICAL_PRICE_FLAT_COLOR = "#888888";

interface Props {
  dates: string[];
  values: number[];
  isWaiting: boolean;
}

interface State {
  fakeDates: string[];
  fakeValues: number[];
}

class HistoricalPriceLineChart extends React.PureComponent<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    const fakeData = this.genFakeHistoricalPriceChartData();
    this.state = { fakeDates: fakeData.dates, fakeValues: fakeData.values };
  }
  public render(): React.ReactNode {
    return (
      <ReactECharts
        option={this.chartOption}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
      />
    );
  }

  private get periodTrendColor(): string {
    const values = this.props.values;
    if (values.length < 2) return HISTORICAL_PRICE_FLAT_COLOR;
    const firstPrice = values[0];
    const lastPrice = values[values.length - 1];
    if (firstPrice > lastPrice) return GREEN;
    if (firstPrice < lastPrice) return RED;
    return HISTORICAL_PRICE_FLAT_COLOR;
  }

  private get periodTrendAreaGradient(): { start: string; end: string } {
    const color = this.periodTrendColor;
    if (color === GREEN) return { start: GREEN, end: "#1aa26000" };
    if (color === RED) return { start: RED, end: "#d4493f00" };
    return { start: "#888888", end: "#88888800" };
  }

  private get chartOption(): EChartsOption {
    const dates = this.props.isWaiting ? this.state.fakeDates : this.props.dates;
    const values = this.props.isWaiting ? this.state.fakeValues : this.props.values;
    const lineColor = this.props.isWaiting ? "#ccc" : this.periodTrendColor;
    const areaGradient = this.periodTrendAreaGradient;

    if (dates.length === 0 || values.length === 0) {
      return {};
    }

    return {
      backgroundColor: "transparent",
      grid: {
        left: 0,
        top: 12,
        right: 38,
        bottom: 24,
        containLabel: false,
        outerBoundsMode: "none",
      },
      xAxis: {
        type: "category",
        data: dates,
        show: !this.props.isWaiting,
        axisLabel: {
          show: !this.props.isWaiting,
          showMinLabel: false,
          color: "#aaa",
          interval: (index: number) => index % 10 === 0,
          hideOverlap: true,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: this.props.isWaiting
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
            min: "dataMin",
            axisLabel: {
              color: "#aaa",
              margin: 0,
              showMinLabel: false,
              showMaxLabel: false,
              formatter: (value: number) => {
                if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
                if (value >= 1_000) return (value / 1_000).toFixed(1) + "K";
                return value.toString();
              },
            },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
          },
      series: this.props.isWaiting
        ? {
            type: "line",
            data: values,
            lineStyle: { width: 2.5, color: "#ccc" },
            symbol: "none",
            silent: true,
          }
        : {
            type: "line",
            data: values,
            lineStyle: { width: 2, color: lineColor, join: "round" },
            itemStyle: { color: lineColor },
            symbol: "circle",
            symbolSize: Util.isMobile ? 5 : 8,
            showSymbol: false,
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
        show: !this.props.isWaiting,
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "#ddd", width: 1 } },
        backgroundColor: "#ffffff",
        textStyle: { color: "#334155", fontSize: 12 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) {
            return "";
          }
          const param = params[0];
          const dateStr = param.name;
          const value = param.value;
          const dataIndex = param.dataIndex;
          const previousValue =
            typeof dataIndex === "number" && dataIndex > 0
              ? values[dataIndex - 1]
              : null;
          const fluctPercent =
            previousValue && previousValue !== 0
              ? (((value - previousValue) / previousValue) * 100).toFixed(2)
              : "-";
          return `${dateStr}<br/>收盤價 $${value.toLocaleString()}<br/>漲跌幅 ${fluctPercent}%`;
        },
      },
      animationDuration: 300,
      animationDurationUpdate: 160,
    };
  }

  private genFakeHistoricalPriceChartData(): { dates: string[]; values: number[] } {
    const dates: string[] = [];
    const values: number[] = [];
    for (let i = 0, p = 100; i < 60; i++) {
      dates.push(i.toString());
      values.push(p);
      p += (p * (Math.random() - 0.5)) / 5;
    }
    return { dates, values };
  }
}

export default HistoricalPriceLineChart;
