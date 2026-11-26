import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";

import { COLORS } from "../../styles/tokens";

interface Props {
  sidMarketValueMap: { [sid: string]: number };
  totalMarketValue: number;
}

export default function MarketValuePieChart({
  sidMarketValueMap,
  totalMarketValue,
}: Props) {
  if (Object.keys(sidMarketValueMap).length === 0 || totalMarketValue === 0) {
    return null;
  }
  return (
    <ReactECharts
      option={makeMarketValuePieChartOption(sidMarketValueMap, totalMarketValue)}
      style={{ height: "100%", width: "100%" }}
    />
  );
}

function makeMarketValuePieChartOption(
  sidMarketValueMap: Props["sidMarketValueMap"],
  totalMarketValue: number,
): EChartsOption {
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
