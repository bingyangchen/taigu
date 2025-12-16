import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import ecStat from "echarts-stat";
import React from "react";

echarts.registerTransform(ecStat.transform.histogram);

interface Props {
  prices: number[];
}

interface State {}

export default class InventoryHistogram extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
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

  private get chartOption(): EChartsOption {
    const prices = this.props.prices;
    if (prices.length === 0) return {};
    return {
      backgroundColor: "transparent",
      grid: { left: 45, top: 0, right: 10, bottom: 25, containLabel: false },
      dataset: [
        { source: prices.map((price) => [price]) },
        { transform: { type: "ecStat:histogram", config: { method: "sturges" } } },
      ],
      xAxis: {
        type: "category",
        axisLabel: { color: "#aaa", hideOverlap: true },
        axisLine: { show: true, lineStyle: { color: "#ddd", width: 2 } },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: "#aaa",
          formatter: (value: number) => {
            if (value >= 1_000) return Math.round(value / 1_000) + "K";
            return value.toString();
          },
        },
      },
      series: [
        {
          type: "bar",
          datasetIndex: 1,
          itemStyle: { color: "#666", borderRadius: [3, 3, 0, 0] },
          barWidth: "100%",
        },
      ],
      tooltip: {
        show: true,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const param = params[0] as { value: number[] };
          return `${param.value[4] ?? ""}<br/>數量: ${param.value[1] ?? 0}`;
        },
      },
    };
  }
}
