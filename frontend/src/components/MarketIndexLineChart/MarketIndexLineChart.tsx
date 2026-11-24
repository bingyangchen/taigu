import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";

import { MARKET_CLOSE_MINUTE } from "../../utils/marketIndex";
import {
  getChartPreviousClose,
  getMarketIndexMaxPrice,
  getMarketIndexMinPrice,
  splitMarketIndexDataIntoColoredSegments,
} from "./marketIndexChartData";

interface Props {
  data: [number, number | null][];
  prevClosePrice: number | null;
}

interface State {}

class MarketIndexLineChart extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      this.props.data.length > 0 && (
        <ReactECharts
          option={this.chartOption}
          style={{ height: "100%", width: "100%" }}
          notMerge={true}
        />
      )
    );
  }

  private get chartOption(): EChartsOption {
    const { data } = this.props;
    const prevClosePrice = getChartPreviousClose(this.props.prevClosePrice);
    const segments = splitMarketIndexDataIntoColoredSegments(data, prevClosePrice);
    const minPrice = getMarketIndexMinPrice(data, prevClosePrice);
    const maxPrice = getMarketIndexMaxPrice(data, prevClosePrice);

    return {
      backgroundColor: "transparent",
      grid: { left: 0, top: 0, right: 0, bottom: 0, containLabel: false },
      xAxis: {
        type: "value",
        min: 0,
        max: MARKET_CLOSE_MINUTE,
        show: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        show: false,
        min: minPrice * 0.999,
        max: maxPrice * 1.001,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        scale: true,
      },
      series: [
        ...segments.map((segment) => ({
          type: "line" as const,
          data: segment.data,
          connectNulls: true,
          symbol: data.length === 1 ? "circle" : "none",
          itemStyle: { color: segment.color },
          lineStyle: { color: segment.color, width: 2 },
        })),
        ...(prevClosePrice === null
          ? []
          : [
              {
                type: "line" as const,
                data: [],
                markLine: {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: "#ddd", width: 1, type: "solid" as const },
                  data: [{ yAxis: prevClosePrice }],
                  label: { show: false },
                },
              },
            ]),
      ],
      tooltip: { show: false },
      animation: false,
    };
  }
}

export default MarketIndexLineChart;
