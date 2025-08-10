import React from "react";
import { Chart } from "react-google-charts";
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

class SimpleCashInvestedLineChart extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      this.props.tradeRecords.length > 0 &&
      this.props.data.length > 1 && (
        <Chart
          chartType="LineChart"
          data={this.simpleData}
          chartPackages={["corechart", "controls"]}
          options={{
            legend: "none",
            backgroundColor: "transparent",
            hAxis: {
              format: this.props.daysToShow > 30 ? "M月" : "d日",
              textStyle: { color: "#aaa" },
              gridlines: { color: "none" },
              showTextEvery: 2,
            },
            series: {
              0: {
                // dummy
                targetAxisIndex: 0,
                visibleInLegend: false,
                pointSize: 0,
                lineWidth: 0,
                enableInteractivity: false,
              },
              1: { targetAxisIndex: 1, lineWidth: 3, color: "#4c8bf5" },
            },
            vAxes: {
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
            forceIFrame: true,
            chartArea: {
              left: "0%",
              top: "3%",
              width: Util.isMobile ? "86%" : "93%",
              height: "87%",
            },
          }}
          width="100%"
          height="100%"
        />
      )
    );
  }
  private get simpleData(): (Date | string | number)[][] {
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

export default connect(mapStateToProps)(SimpleCashInvestedLineChart);
