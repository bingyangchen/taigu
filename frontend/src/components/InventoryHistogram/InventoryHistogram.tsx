import React from "react";
import { Chart } from "react-google-charts";

interface Props {
  data: (string | number)[][];
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
      <Chart
        chartType="Histogram"
        data={this.props.data}
        options={{
          legend: { position: "none" },
          colors: ["#444"],
          backgroundColor: "transparent",
          chartArea: {
            left: "10%",
            top: "8%",
            width: "85%",
            height: "80%",
          },
          vAxis: { gridlines: { color: "#eee" } },
        }}
        width="100%"
        height="100%"
      />
    );
  }
}
