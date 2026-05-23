import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import * as ecStat from "echarts-stat";
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
echarts.registerTransform((ecStat as any).transform.histogram);

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
      grid: { left: 42, top: 8, right: 12, bottom: 26, containLabel: false },
      dataset: [
        { source: prices.map((price) => [price]) },
        { transform: { type: "ecStat:histogram", config: { method: "sturges" } } },
      ],
      xAxis: {
        type: "category",
        axisLabel: { color: "#9aa7b5", hideOverlap: true },
        axisLine: { show: true, lineStyle: { color: "#dce5ef", width: 1 } },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: "#9aa7b5",
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
          itemStyle: { color: "rgba(76, 139, 245, 0.38)", borderRadius: [3, 3, 0, 0] },
          barWidth: "100%",
        },
      ],
      tooltip: {
        show: true,
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: { color: "rgba(76, 139, 245, 0.08)" },
        },
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        borderColor: "#dbe4ef",
        borderWidth: 1,
        textStyle: { color: "#334155", fontSize: 12 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const param = params[0] as { value: number[] };
          return `${param.value[4] ?? ""}<br/>數量: ${param.value[1] ?? 0}`;
        },
      },
    };
  }
}
