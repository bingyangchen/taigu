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

class ComplexCashInvestedLineChart extends React.Component<Props, State> {
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
          data={Util.isMobile ? this.cashInvestedChartDataMobile : this.props.data}
          chartPackages={!Util.isMobile ? ["corechart", "controls"] : ["corechart"]}
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
              1: {
                // cumulated cash invested
                targetAxisIndex: 1,
                lineWidth: Util.isMobile ? "2.5" : "2",
                color: "#4c8bf5",
              },
            },
            vAxes: {
              0: {
                textPosition: "none",
                gridlines: { color: "none" },
                baseline: "none",
              },
              1: {
                format: "short",
                textPosition: Util.isMobile ? undefined : "none",
                textStyle: { color: "#aaa" },
                gridlines: { color: "none", count: 3.5 },
                baseline: Util.isMobile ? "none" : 1,
              },
            },
            chartArea: {
              left: "1%",
              top: "5%",
              width: Util.isMobile ? "84%" : "98%",
              height: "85%",
            },
          }}
          width="100%"
          height={Util.isMobile ? "100%" : "95%"}
          controls={
            !Util.isMobile
              ? [
                  {
                    controlType: "ChartRangeFilter",
                    options: {
                      filterColumnIndex: 0,
                      height: "10px",
                      ui: {
                        chartType: "LineChart",
                        chartOptions: {
                          chartArea: {
                            width: "95%",
                            height: "10%",
                          },
                          backgroundColor: "transparent",
                          hAxis: {
                            baselineColor: "none",
                            textPosition: "none",
                            gridlines: {
                              color: "none",
                            },
                          },
                          vAxis: {
                            textPosition: "none",
                            gridlines: {
                              color: "none",
                            },
                            baselineColor: "none",
                          },
                          series: {
                            0: {
                              targetAxisIndex: 0,
                              visibleInLegend: false,
                              pointSize: 0,
                              lineWidth: 0,
                            },
                            1: {
                              targetAxisIndex: 1,
                              color: "#4c8bf5",
                            },
                            2: {
                              targetAxisIndex: 1,
                              lineWidth: "0.5",
                              color: "#aaa",
                            },
                          },
                        },
                      },
                    },
                    controlPosition: "bottom",
                    controlWrapperParams: {
                      state: {
                        range: {
                          start: this.controlStartDate,
                          end: new Date(),
                        },
                      },
                    },
                  },
                ]
              : undefined
          }
        />
      )
    );
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
