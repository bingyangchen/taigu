import React from "react";

import { Chart } from "react-google-charts";
import { connect } from "react-redux";
import { RootState } from "../../redux/store";
import Util from "../../utils/util";

function mapStateToProps(rootState: RootState) {
  return {};
}

interface Props extends ReturnType<typeof mapStateToProps> {
  data: (string | number | Date)[][];
  isWaiting: boolean;
}

interface State {
  fakeHistoricalPriceChartData: (Date | string | number)[][];
}

class HistoricalPriceLineChart extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      fakeHistoricalPriceChartData: this.genFakeHistoricalPriceChartData(),
    };
  }
  public render(): React.ReactNode {
    return (
      <Chart
        chartType="LineChart"
        data={
          this.props.isWaiting
            ? this.state.fakeHistoricalPriceChartData
            : this.props.data
        }
        chartPackages={["corechart", "controls"]}
        options={{
          legend: "none",
          backgroundColor: "transparent",
          hAxis: this.props.isWaiting
            ? { textPosition: "none", gridlines: { color: "none" }, baseline: "none" }
            : {
                textStyle: { color: "#aaa" },
                gridlines: { color: "none" },
                showTextEvery: 10,
              },
          series: this.props.isWaiting
            ? {
                0: {
                  targetAxisIndex: 1,
                  lineWidth: 2.5,
                  color: "#ddd",
                  enableInteractivity: false,
                },
              }
            : {
                0: {
                  // dummy
                  targetAxisIndex: 0,
                  visibleInLegend: false,
                  pointSize: 0,
                  lineWidth: 0,
                  enableInteractivity: false,
                },
                1: { targetAxisIndex: 1, lineWidth: 2.5, color: "#4c8bf5" },
              },
          vAxes: this.props.isWaiting
            ? undefined
            : {
                0: {
                  // dummy
                  textPosition: "none",
                  gridlines: { color: "none" },
                  baseline: "none",
                },
                1: {
                  format: "short",
                  textStyle: { color: "#aaa" },
                  gridlines: { color: "none", count: 3.5 },
                  baseline: "none",
                  viewWindowMode: "maximized",
                },
              },
          vAxis: this.props.isWaiting
            ? { textPosition: "none", gridlines: { color: "none" }, baseline: "none" }
            : undefined,
          chartArea: this.props.isWaiting
            ? { left: "0%", top: "3%", width: "100%", height: "100%" }
            : {
                left: "0%",
                top: "3%",
                width: Util.isMobile ? "86%" : "93%",
                height: "87%",
              },
        }}
        width="100%"
        height="100%"
      />
    );
  }
  private genFakeHistoricalPriceChartData(): (Date | string | number)[][] {
    const result: (Date | string | number)[][] = [["日期", "價格"]];
    for (let i = 0, p = 100; i < 60; i++) {
      result.push([i, p]);
      p += (p * (Math.random() - 0.5)) / 5;
    }
    return result;
  }
}

export default connect(mapStateToProps)(HistoricalPriceLineChart);
