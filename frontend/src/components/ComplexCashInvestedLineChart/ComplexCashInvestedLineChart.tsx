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
  data: (Date | string | number)[][];
  daysToShow: number;
  dispatch: AppDispatch;
}

interface State {}

class ComplexCashInvestedLineChart extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    if (this.props.tradeRecords.length === 0 || this.props.data.length <= 1) {
      return null;
    }

    return (
      <ReactECharts
        option={this.chartOption}
        style={{ height: Util.isMobile ? "100%" : "95%", width: "100%" }}
        notMerge={true}
      />
    );
  }

  private get chartData(): (Date | string | number)[][] {
    return Util.isMobile ? this.cashInvestedChartDataMobile : this.props.data;
  }

  private get chartOption(): EChartsOption {
    const data = this.chartData;
    if (data.length === 0) {
      return {};
    }

    // Extract dates and values from data
    const dates: (Date | string | number)[] = [];
    const dummyValues: number[] = [];
    const cashInvestedValues: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      dates.push(row[0]);
      dummyValues.push(0);
      const value = row[2] || row[1];
      cashInvestedValues.push(typeof value === "number" ? value : 0);
    }

    const dateFormatter = (date: Date | string | number): string => {
      if (date instanceof Date) {
        return this.props.daysToShow > 30
          ? `${date.getMonth() + 1}月`
          : `${date.getDate()}日`;
      }
      return String(date);
    };

    return {
      backgroundColor: "transparent",
      grid: {
        left: "1%",
        top: "5%",
        right: Util.isMobile ? "16%" : "2%",
        bottom: !Util.isMobile ? "15%" : "12%",
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: dates.map(dateFormatter),
        axisLabel: {
          color: "#aaa",
          interval: 1,
          showMaxLabel: true,
          showMinLabel: true,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          show: false,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
        {
          type: "value",
          show: Util.isMobile,
          position: "right",
          axisLabel: {
            show: Util.isMobile,
            color: "#aaa",
            formatter: (value: number) => {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
              if (value >= 1000) return (value / 1000).toFixed(1) + "K";
              return value.toString();
            },
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          splitNumber: 3,
        },
      ],
      series: [
        {
          type: "line",
          data: dummyValues,
          lineStyle: { width: 0 },
          symbol: "none",
          silent: true,
          yAxisIndex: 0,
        },
        {
          type: "line",
          data: cashInvestedValues,
          lineStyle: { width: Util.isMobile ? 2.5 : 2, color: "#4c8bf5" },
          symbol: "none",
          yAxisIndex: 1,
        },
      ],
      dataZoom: !Util.isMobile
        ? [
            {
              type: "slider",
              show: true,
              xAxisIndex: [0],
              start: 0,
              end: 100,
              bottom: "0%",
              height: "10%",
              handleIcon:
                "path://M30.9,53.2C16.8,53.2,5.3,41.7,5.3,27.6S16.8,2,30.9,2C45,2,56.4,13.5,56.4,27.6S45,53.2,30.9,53.2z M30.9,3.5C17.6,3.5,6.8,14.4,6.8,27.6c0,13.2,10.8,24.1,24.1,24.1C44.2,51.7,55,40.8,55,27.6C54.9,14.4,44.1,3.5,30.9,3.5z M36.9,35.8c0,0.5-0.4,0.9-0.9,0.9s-0.9-0.4-0.9-0.9V19.4c0-0.5,0.4-0.9,0.9-0.9s0.9,0.4,0.9,0.9V35.8z M25.8,35.8c0,0.5-0.4,0.9-0.9,0.9s-0.9-0.4-0.9-0.9V19.4c0-0.5,0.4-0.9,0.9-0.9s0.9,0.4,0.9,0.9V35.8z",
              handleSize: "80%",
              handleStyle: { color: "#4c8bf5", borderColor: "#4c8bf5" },
              textStyle: { color: "#aaa" },
              borderColor: "transparent",
              fillerColor: "rgba(76, 139, 245, 0.1)",
              dataBackground: {
                lineStyle: { color: "#4c8bf5", width: 0.5 },
                areaStyle: { color: "transparent" },
              },
              selectedDataBackground: {
                lineStyle: { color: "#4c8bf5", width: 0.5 },
                areaStyle: { color: "rgba(76, 139, 245, 0.1)" },
              },
            },
          ]
        : undefined,
      tooltip: { show: true, trigger: "axis", axisPointer: { type: "line" } },
    };
  }

  private get controlStartDate(): Date {
    return new Date(
      Math.min(
        ...this.props.tradeRecords.map((record) => Date.parse(record.deal_time)),
      ),
    );
  }

  private get cashInvestedChartDataMobile(): (Date | string | number)[][] {
    const candidates = [
      ...this.props.data.slice(
        -Math.min(this.props.daysToShow, this.props.data.length - 1),
      ),
    ];
    const n = 90;
    const l = candidates.length;
    if (l > n) {
      const m = l / n;
      let i = l - 1;
      let j = l - 1;
      const result = [this.props.data[0]];
      while (i >= 0) {
        result.push(candidates[i]);
        j -= m;
        i = Math.ceil(j);
      }
      return result;
    } else return [this.props.data[0], ...candidates];
  }
}

export default connect(mapStateToProps)(ComplexCashInvestedLineChart);
