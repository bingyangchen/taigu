import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";
import { connect } from "react-redux";

import { AppDispatch, RootState } from "../../redux/store";
import Util from "../../utils/util";

function mapStateToProps(rootState: RootState) {
  const { tradeRecords } = rootState.tradeRecord;
  return { tradeRecords };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  dates: Date[];
  values: number[];
  dispatch: AppDispatch;
}

interface State {}

class SimpleCashInvestedLineChart extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    if (
      this.props.tradeRecords.length === 0 ||
      this.props.dates.length === 0 ||
      this.props.values.length === 0
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
    const { dates, values } = this.props;

    if (values.length === 0 || dates.length !== values.length) {
      return {};
    }

    return {
      backgroundColor: "transparent",
      grid: {
        left: 0,
        top: 5,
        right: 50,
        bottom: 25,
        containLabel: false,
        outerBoundsMode: "none",
      },
      xAxis: {
        type: "category",
        data: dates.map((d) => this.formatDate(d)),
        boundaryGap: false,
        axisLabel: {
          color: "#aaa",
          showMinLabel: false,
          showMaxLabel: true,
          hideOverlap: true,
          formatter: (value: string) => {
            const date = new Date(value);
            if (values.length > 30) return `${date.getMonth() + 1}月`;
            return `${date.getDate()}日`;
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        position: "right",
        axisLabel: {
          color: "#aaa",
          margin: 3,
          formatter: (value: number) => {
            if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
            else if (value >= 1_000) return Math.round(value / 1_000) + "K";
            return value.toString();
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        splitNumber: 3,
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: false,
          symbolSize: Util.isMobile ? 5 : 8,
          showSymbol: false,
          sampling: "lttb",
          lineStyle: { color: "#4c8bf5", width: 3, join: "round" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(76, 139, 245, 1)" },
                { offset: 1, color: "rgba(76, 139, 245, 0)" },
              ],
            },
          },
        },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) {
            return "";
          }
          const param = params[0];
          const dateStr = param.name;
          const value = param.value;
          return `${dateStr}<br/>現金投入: $${Number(value).toLocaleString()}`;
        },
      },
      animationDurationUpdate: 0,
      animationDuration: 500,
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

export default connect(mapStateToProps)(SimpleCashInvestedLineChart);
