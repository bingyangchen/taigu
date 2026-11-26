import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";

import { COLORS } from "../../styles/tokens";

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      color: COLORS.chartCategories,
    };
  }
}

export default MarketValuePieChart;
