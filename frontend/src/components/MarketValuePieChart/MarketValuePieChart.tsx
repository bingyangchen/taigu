import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";

interface Props {
  sidMarketValueMap: { [sid: string]: number };
  totalMarketValue: number;
}

interface State {}

class MarketValuePieChart extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    if (
      Object.keys(this.props.sidMarketValueMap).length === 0 ||
      this.props.totalMarketValue === 0
    ) {
      return null;
    }
    return (
      <ReactECharts
        option={this.chartOption}
        style={{ height: "100%", width: "100%" }}
      />
    );
  }

  private get chartOption(): EChartsOption {
    const { sidMarketValueMap, totalMarketValue } = this.props;

    const data = Object.entries(sidMarketValueMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const percentage =
            totalMarketValue > 0
              ? ((params.value / totalMarketValue) * 100).toFixed(2)
              : "0.00";
          return `${params.name}<br/>市值: $${params.value.toLocaleString()}<br/>占比: ${percentage}%`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["65%", "95%"],
          padAngle: 5,
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10 },
          label: { show: false },
          emphasis: { label: { show: false } },
          data: data,
        },
      ],
      // prettier-ignore
      color: [
        "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452",
        "#9a60b4", "#ea7ccc",
      ],
    };
  }
}

export default MarketValuePieChart;
