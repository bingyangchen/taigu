import styles from "./Home.module.scss";

import React from "react";
import Chart from "react-google-charts";
import { connect } from "react-redux";

import {
  DollarSign,
  MarketIndexLineChart,
  PercentSign,
  RoundButton,
  SimpleCashInvestedLineChart,
  StretchableButton,
} from "../../../components";
import { IconFullScreen } from "../../../icons";
import {
  getSidMarketValueMap,
  getTotalMarketValue,
} from "../../../redux/slices/StockInfoSlice";
import type { RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import { IndexPriceInfo } from "../../../types";

function mapStateToProps(rootState: RootState) {
  const {
    tradeRecords,
    stockWarehouse,
    totalCashInvested,
    totalHandlingFee,
    totalGain,
    cashInvestedChartData,
    averageCashInvested,
  } = rootState.tradeRecord;
  const { totalCashDividend } = rootState.cashDividend;
  const { sidStockInfoMap, tseIndexRealtimePrices, otcIndexRealtimePrices } =
    rootState.stockInfo;
  return {
    tradeRecords,
    totalCashDividend,
    totalCashInvested,
    totalHandlingFee,
    totalGain,
    cashInvestedChartData,
    averageCashInvested,
    sidStockInfoMap,
    stockWarehouse,
    tseIndexRealtimePrices,
    otcIndexRealtimePrices,
  };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {}

interface State {
  tseIndexLineChart: React.ReactElement | null;
  otcIndexLineChart: React.ReactElement | null;
  cashInvestedLineChart: React.ReactElement | null;
  marketValuePieChart: React.ReactElement | null;
  daysToShow: number;
  sidMarketValueMap: { [sid: string]: number };
  totalMarketValue: number;
  animatedTotalCashInvested: number;
}

class Home extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      tseIndexLineChart: null,
      otcIndexLineChart: null,
      cashInvestedLineChart: null,
      marketValuePieChart: null,
      daysToShow: 30,
      sidMarketValueMap: {},
      totalMarketValue: 0,
      animatedTotalCashInvested: 0,
    };
  }
  public componentDidMount(): void {
    this.updateIndexLineCharts();
    this.updateCashInvestedLineChart();
    this.updateMarketValueDataAndPieChart();
    this.animateTotalCashInvested();
  }
  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot?: any,
  ): void {
    if (
      prevProps.tseIndexRealtimePrices !== this.props.tseIndexRealtimePrices ||
      prevProps.otcIndexRealtimePrices !== this.props.otcIndexRealtimePrices
    ) {
      this.updateIndexLineCharts();
    }
    if (
      prevProps.totalCashInvested !== this.props.totalCashInvested ||
      prevState.daysToShow !== this.state.daysToShow
    ) {
      this.updateCashInvestedLineChart();
      this.animateTotalCashInvested();
    }
    if (
      prevProps.totalCashInvested !== this.props.totalCashInvested ||
      prevProps.sidStockInfoMap !== this.props.sidStockInfoMap
    ) {
      this.updateMarketValueDataAndPieChart();
    }
  }
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <StretchableButton />
        <div className={styles.left}>
          <div className={styles.upper}>
            <div className={styles.market_index}>
              <div className={styles.left}>
                <div className={styles.title}>加權指數</div>
                <div className={styles.date}>{this.tseInfoDate}</div>
              </div>
              <div className={styles.chart_container}>
                {this.state.tseIndexLineChart}
              </div>
              <div className={`${styles.price} ${this.getIndexPriceExtraClass("tse")}`}>
                <div className={styles.price}>
                  {this.latestTsePriceInfo?.price ?? 0}
                </div>
                <div className={styles.fluct_price}>
                  {this.getIndexFluctPriceText(
                    this.latestTsePriceInfo?.fluct_price ?? 0,
                  )}{" "}
                  {this.getIndexFluctPercentText(this.latestTseFluctPercent)}
                </div>
              </div>
            </div>
            <div className={styles.market_index}>
              <div className={styles.left}>
                <div className={styles.title}>櫃買指數</div>
                <div className={styles.date}>{this.otcInfoDate}</div>
              </div>
              <div className={styles.chart_container}>
                {this.state.otcIndexLineChart}
              </div>
              <div className={`${styles.price} ${this.getIndexPriceExtraClass("otc")}`}>
                <div className={styles.price}>
                  {this.latestOtcPriceInfo?.price ?? 0}
                </div>
                <div className={styles.fluct_price}>
                  {this.getIndexFluctPriceText(
                    this.latestOtcPriceInfo?.fluct_price ?? 0,
                  )}{" "}
                  {this.getIndexFluctPercentText(this.latestOtcFluctPercent)}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.lower}>
            <div className={styles.cash_invested_text}>
              <div className={styles.title}>投入金額</div>
              <div className={styles.cash_invested}>
                <DollarSign />
                {Math.round(this.state.animatedTotalCashInvested).toLocaleString()}
              </div>
            </div>
            <div className={styles.body}>
              <div className={styles.cash_invested_chart_container}>
                {this.state.cashInvestedLineChart}
              </div>
              <div className={styles.controls}>
                <div className={styles.time_span_options}>
                  <div className={styles.time_span_options_inner}>
                    <span
                      className={this.getTimeSpanOptionClass(30)}
                      onClick={() => this.handleClickTimeSpanOption(30)}
                    >
                      1M
                    </span>
                    <span
                      className={this.getTimeSpanOptionClass(91)}
                      onClick={() => this.handleClickTimeSpanOption(91)}
                    >
                      1Q
                    </span>
                    <span
                      className={this.getTimeSpanOptionClass(365)}
                      onClick={() => this.handleClickTimeSpanOption(365)}
                    >
                      1Y
                    </span>
                    <span
                      className={this.getTimeSpanOptionClass(Infinity)}
                      onClick={() => this.handleClickTimeSpanOption(Infinity)}
                    >
                      ALL
                    </span>
                  </div>
                </div>
                <RoundButton className="p-12" hint_text="查看詳情">
                  <IconFullScreen sideLength="14" />
                </RoundButton>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.right}>
          <div className={styles.title}>投資組合</div>
          <div className={styles.market_value_chart_container}>
            {this.state.marketValuePieChart}
            <div className={styles.chart_center}>
              <div className={styles.upper}>目前市值</div>
              <div className={styles.lower}>
                <DollarSign />
                {Math.round(this.state.totalMarketValue).toLocaleString()}
              </div>
            </div>
          </div>
          <div className={styles.summary}>
            <div className={styles.row}>
              <span>報酬率</span>
              <span>
                {this.props.tradeRecords.length > 0 ? this.rateOfReturn.toFixed(2) : 0}
                <PercentSign />
              </span>
            </div>
            <div className={styles.row}>
              <span>實現損益</span>
              <span>
                <DollarSign />
                {Math.round(this.totalEarning).toLocaleString()}
              </span>
            </div>
            <div className={styles.row}>
              <span>手續費用</span>
              <span>
                <DollarSign />
                {this.props.totalHandlingFee.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  private get marketValuePieChartData(): (string | number)[][] {
    const result: (string | number)[][] = [];
    for (const [sid, marketValue] of Object.entries(this.state.sidMarketValueMap)) {
      result.push([sid, marketValue]);
    }
    result.sort((a, b) => (b[1] as number) - (a[1] as number));
    result.unshift(["Sid", "Market Value"]);
    return result;
  }
  private get tseInfoDate(): string {
    return Object.values(this.props.tseIndexRealtimePrices)[0]?.date ?? "0000-00-00";
  }
  private get otcInfoDate(): string {
    return Object.values(this.props.otcIndexRealtimePrices)[0]?.date ?? "0000-00-00";
  }
  private get latestTsePriceInfo(): IndexPriceInfo | null {
    const maxNum = Math.max(
      ...Object.keys(this.props.tseIndexRealtimePrices).map((k) => parseInt(k)),
    );
    return this.props.tseIndexRealtimePrices[maxNum.toString()] ?? null;
  }
  private get latestOtcPriceInfo(): IndexPriceInfo | null {
    const maxNum = Math.max(
      ...Object.keys(this.props.otcIndexRealtimePrices).map((k) => parseInt(k)),
    );
    return this.props.otcIndexRealtimePrices[maxNum.toString()] ?? null;
  }
  private get latestTseFluctPercent(): number {
    const latestTseFluctPrice = this.latestTsePriceInfo?.fluct_price ?? 0;
    return (
      Math.round(
        (latestTseFluctPrice /
          ((this.latestTsePriceInfo?.price ?? 0) + latestTseFluctPrice)) *
          10000,
      ) / 100
    );
  }
  private get latestOtcFluctPercent(): number {
    const latestOtcFluctPrice = this.latestOtcPriceInfo?.fluct_price ?? 0;
    return (
      Math.round(
        (latestOtcFluctPrice /
          ((this.latestOtcPriceInfo?.price ?? 0) + latestOtcFluctPrice)) *
          10000,
      ) / 100
    );
  }
  private getIndexPriceExtraClass(index: "tse" | "otc"): string {
    if (index === "tse") {
      const latestTsePrice = this.latestTsePriceInfo?.price ?? 0;
      const prevTseClosePrice =
        (Object.values(this.props.tseIndexRealtimePrices)[0]?.price ?? 0) -
        (Object.values(this.props.tseIndexRealtimePrices)[0]?.fluct_price ?? 0);
      return latestTsePrice > prevTseClosePrice
        ? styles.red
        : latestTsePrice < prevTseClosePrice
          ? styles.green
          : styles.gray;
    } else {
      const latestOtcPrice = this.latestOtcPriceInfo?.price ?? 0;
      const prevOtcClosePrice =
        (Object.values(this.props.otcIndexRealtimePrices)[0]?.price ?? 0) -
        (Object.values(this.props.otcIndexRealtimePrices)[0]?.fluct_price ?? 0);
      return latestOtcPrice > prevOtcClosePrice
        ? styles.red
        : latestOtcPrice < prevOtcClosePrice
          ? styles.green
          : styles.gray;
    }
  }
  private getIndexFluctPriceText(fluctPrice: number): string {
    return (
      (fluctPrice > 0 ? "▲" : fluctPrice < 0 ? "▼" : "-") +
      (fluctPrice !== 0 ? Math.abs(fluctPrice) : "")
    );
  }
  private getIndexFluctPercentText(fluctPercent: number): string {
    return `(${fluctPercent !== 0 ? Math.abs(fluctPercent) + "%" : "-"})`;
  }
  private get totalEarning(): number {
    return this.props.totalGain + this.props.totalCashDividend;
  }
  private getTimeSpanOptionClass(number: number): string {
    return this.state.daysToShow === number ? styles.active : "";
  }
  private handleClickTimeSpanOption = (number: number): void => {
    this.setState({ daysToShow: number });
  };
  private get rateOfReturn(): number {
    return (
      ((this.state.totalMarketValue -
        this.props.totalCashInvested +
        this.totalEarning -
        this.props.totalHandlingFee) /
        this.props.averageCashInvested) *
      100
    );
  }
  private updateIndexLineCharts(): void {
    this.setState((state, props) => {
      const tseChartData: (string | number)[][] = [["時間", "價格"]];
      for (let i = 0; i <= 270; i++) {
        if (props.tseIndexRealtimePrices.hasOwnProperty(i.toString())) {
          tseChartData.push([i, props.tseIndexRealtimePrices[i].price]);
        } else tseChartData.push([i, NaN]);
      }

      const otcChartData: (string | number)[][] = [["時間", "價格"]];
      for (let i = 0; i <= 270; i++) {
        if (props.otcIndexRealtimePrices.hasOwnProperty(i.toString())) {
          otcChartData.push([i, props.otcIndexRealtimePrices[i].price]);
        } else otcChartData.push([i, NaN]);
      }

      const prevTseClosePrice =
        (Object.values(this.props.tseIndexRealtimePrices)[0]?.price ?? 0) -
        (Object.values(this.props.tseIndexRealtimePrices)[0]?.fluct_price ?? 0);
      const prevOtcClosePrice =
        (Object.values(this.props.otcIndexRealtimePrices)[0]?.price ?? 0) -
        (Object.values(this.props.otcIndexRealtimePrices)[0]?.fluct_price ?? 0);
      return {
        tseIndexLineChart: (
          <MarketIndexLineChart
            data={tseChartData}
            prevClosePrice={prevTseClosePrice}
          />
        ),
        otcIndexLineChart: (
          <MarketIndexLineChart
            data={otcChartData}
            prevClosePrice={prevOtcClosePrice}
          />
        ),
      };
    });
  }
  private updateCashInvestedLineChart(): void {
    this.setState((state, props) => {
      const chartData = props.cashInvestedChartData.map((row, i) => {
        return i === 0 ? row : [new Date(row[0]), ...row.slice(1)];
      });
      return {
        cashInvestedLineChart: (
          <SimpleCashInvestedLineChart data={chartData} daysToShow={state.daysToShow} />
        ),
      };
    });
  }
  private updateMarketValueDataAndPieChart(): void {
    this.setState(
      (state, props) => {
        return {
          sidMarketValueMap: getSidMarketValueMap(
            props.sidStockInfoMap,
            props.stockWarehouse,
          ),
          totalMarketValue: getTotalMarketValue(
            props.sidStockInfoMap,
            props.stockWarehouse,
          ),
        };
      },
      () => {
        this.setState({
          marketValuePieChart: (
            <Chart
              chartType="PieChart"
              data={this.marketValuePieChartData}
              options={{
                // colors: [
                //     "#abdee6",
                //     "#ff968a",
                //     "#ffc8a2",
                //     "#97c1a9",
                //     "#cbaacb",
                //     "#c6dbda",
                //     "#f3b0c3",
                //     "#cce2cb",
                //     "#ffffb5",
                //     "#8fcaca",
                //     "#ffccb6",
                //     "#55cbcd",
                //     "#f6eac2",
                //     "#04f0f0",
                //     "#fee1e8",
                //     "#fed7c3",
                //     "#b6cfb6",
                //     "#ecd5e3",
                //     "#ffc5bf",
                //     "#a21edb",
                //     "#ffaea5",
                // ],
                sliceVisibilityThreshold: 0.05,
                backgroundColor: "transparent",
                pieHole: 0.8,
                pieSliceText: "none",
                pieSliceBorderColor: "",
                chartArea: {
                  left: "0",
                  top: "5%",
                  width: "100%",
                  height: "90%",
                },
                legend: "none",
              }}
              width="100%"
              height="100%"
            />
          ),
        });
      },
    );
  }
  private animateTotalCashInvested(): void {
    if (this.state.animatedTotalCashInvested === this.props.totalCashInvested) {
      return;
    }
    this.setState(
      (state, props) => {
        return {
          animatedTotalCashInvested: Math.min(
            state.animatedTotalCashInvested +
              Math.max(
                1,
                (props.totalCashInvested - state.animatedTotalCashInvested) / 2.5,
              ),
            props.totalCashInvested,
          ),
        };
      },
      () => setTimeout(() => this.animateTotalCashInvested(), 30),
    );
  }
}

export default connect(mapStateToProps)(withRouter(Home));
