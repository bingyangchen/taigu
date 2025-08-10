import React from "react";
import { Chart } from "react-google-charts";

interface Props {
  data: (Date | string | number)[][];
  prevClosePrice: number;
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
      this.props.data.length > 1 && (
        <Chart
          chartType="LineChart"
          chartPackages={["corechart"]}
          data={this.props.data}
          options={{
            legend: "none",
            backgroundColor: "transparent",
            vAxis: {
              textPosition: "none",
              gridlines: { color: "none" },
              baseline: this.props.prevClosePrice,
              baselineColor: "#ddd",
              viewWindowMode: "maximized",
            },
            hAxis: {
              textPosition: "none",
              gridlines: { color: "none" },
              baseline: "none",
              minValue: 0,
              maxValue: 270,
            },
            series: { 0: { color: this.lineColor } },
            interpolateNulls: true,
            chartArea: {
              left: "0",
              top: "10%",
              width: "100%",
              height: "90%",
            },
            enableInteractivity: false,
          }}
          width="100%"
          height="100%"
        />
      )
    );
  }
  private get lineColor(): string {
    if (this.props.data.length < 1) return "#000";
    const lastNonNanNumber = [...this.props.data]
      .reverse()
      .find((row) => typeof row[1] === "number" && !isNaN(row[1]));
    if (lastNonNanNumber === undefined) return "#000";
    if ((lastNonNanNumber[1] as number) > this.props.prevClosePrice) {
      return "#de5246";
    }
    return "#1aa260";
  }
}

export default MarketIndexLineChart;
