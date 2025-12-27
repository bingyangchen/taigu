import React from "react";
import { connect } from "react-redux";

import {
  DollarSign,
  MarketIndexLineChart,
  MarketValuePieChart,
  PercentSign,
  SimpleCashInvestedLineChart,
  SpeedDial,
  SummaryCard,
  TradeRecordModal,
} from "../../../components";
import {
  getSidMarketValueMap,
  getTotalMarketValue,
} from "../../../redux/slices/StockInfoSlice";
import type { RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import Env from "../../../utils/env";
import Util from "../../../utils/util";
import styles from "./Dashboard.module.scss";

function mapStateToProps(rootState: RootState) {
  const {
    tradeRecords,
    stockWarehouse,
    totalCashInvested,
    totalHandlingFee,
    sidGainMap,
    cashInvestedChartData,
    averageCashInvested,
  } = rootState.tradeRecord;
  const { cashDividendRecords } = rootState.cashDividend;
  const {
    sidStockInfoMap,
    realtimePriceDate,
    tseIndexRealtimePrices,
    otcIndexRealtimePrices,
  } = rootState.stockInfo;
  const { handlingFeeDiscountRecords } = rootState.handlingFeeDiscount;
  return {
    tradeRecords,
    cashDividendRecords,
    handlingFeeDiscountRecords,
    totalCashInvested,
    totalHandlingFee,
    sidGainMap,
    cashInvestedChartData,
    averageCashInvested,
    sidStockInfoMap,
    stockWarehouse,
    realtimePriceDate,
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
  totalEarning: number;
  animatedTotalCashInvested: number;
  xirr: number;
  activeModalName: "createTradeRecord" | null;
}

class Dashboard extends React.Component<Props, State> {
  public state: State;
  private animationFrameId: number | null = null;
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
      totalEarning: 0,
      animatedTotalCashInvested: 0,
      xirr: 0,
      activeModalName: null,
    };
  }

  public componentDidMount(): void {
    this.updateIndexLineCharts();
    this.updateCashInvestedLineChart();
    this.updateMarketRelatedData();
    this.updateXIRR();
    this.updateTotalEarning();
    this.animateTotalCashInvested();
  }

  public componentWillUnmount(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
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
      this.updateMarketRelatedData();
    }
    if (
      prevProps.tradeRecords !== this.props.tradeRecords ||
      prevProps.handlingFeeDiscountRecords !== this.props.handlingFeeDiscountRecords ||
      prevProps.cashDividendRecords !== this.props.cashDividendRecords ||
      prevState.totalMarketValue !== this.state.totalMarketValue
    ) {
      this.updateXIRR();
    }
    if (
      prevProps.sidGainMap !== this.props.sidGainMap ||
      prevProps.cashDividendRecords !== this.props.cashDividendRecords
    ) {
      this.updateTotalEarning();
    }
  }

  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        {Util.isMobile && <SpeedDial />}
        <div className={styles.left}>
          <div className={styles.upper}>
            <div className={styles.market_index}>
              <div className={styles.left}>
                <div className={styles.title}>加權指數</div>
                <div className={styles.date}>{this.props.realtimePriceDate}</div>
              </div>
              <div className={styles.chart_container}>
                {this.state.tseIndexLineChart}
              </div>
              <div className={`${styles.price} ${this.getIndexPriceClass("tse")}`}>
                <div className={styles.price}>{this.latestTsePrice}</div>
                <div className={styles.fluct_price}>
                  {this.getIndexFluctPriceText(
                    this.props.tseIndexRealtimePrices.last_fluct_price ?? 0,
                  )}{" "}
                  {this.getIndexFluctPercentText(this.latestTseFluctPercent)}
                </div>
              </div>
            </div>
            <div className={styles.market_index}>
              <div className={styles.left}>
                <div className={styles.title}>櫃買指數</div>
                <div className={styles.date}>{this.props.realtimePriceDate}</div>
              </div>
              <div className={styles.chart_container}>
                {this.state.otcIndexLineChart}
              </div>
              <div className={`${styles.price} ${this.getIndexPriceClass("otc")}`}>
                <div className={styles.price}>{this.latestOtcPrice}</div>
                <div className={styles.fluct_price}>
                  {this.getIndexFluctPriceText(
                    this.props.otcIndexRealtimePrices.last_fluct_price ?? 0,
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
                ${Math.round(this.state.animatedTotalCashInvested).toLocaleString()}
              </div>
            </div>
            <div className={styles.body}>
              {this.props.tradeRecords.length === 0 ? (
                <div className={styles.empty_section}>
                  還沒有任何交易紀錄喔！快
                  <span
                    className={styles.button}
                    onClick={this.handleCreateTradeRecordClick}
                  >
                    點這裡
                  </span>
                  新增你的第一筆交易，展開投資之旅吧！
                </div>
              ) : (
                <>
                  <div className={styles.cash_invested_chart_container}>
                    {this.state.cashInvestedLineChart}
                  </div>
                  <div className={styles.controls}>
                    <div className={styles.time_span_options}>
                      <div
                        className={styles.time_span_options_inner}
                        style={
                          {
                            "--active-index": this.getActiveOptionIndex(),
                          } as React.CSSProperties
                        }
                      >
                        <div className={styles.sliding_background} />
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
                    {/* <RoundButton className="p-12" hint_text="查看詳情">
                      <IconFullScreen sideLength="14" />
                    </RoundButton> */}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={styles.right}>
          <div className={styles.upper}>
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
          </div>
          <SummaryCard title="年化報酬率">
            {this.props.tradeRecords.length > 0
              ? (this.state.xirr * 100).toFixed(2)
              : 0}
            <PercentSign />
          </SummaryCard>
          <SummaryCard title="實現損益" onClick={this.handleClickTotalEarning}>
            <DollarSign />
            {Math.round(this.state.totalEarning).toLocaleString()}
          </SummaryCard>
          <SummaryCard title="手續費用(-)" onClick={this.handleClickHandlingFee}>
            <DollarSign />
            {this.props.totalHandlingFee.toLocaleString()}
          </SummaryCard>
        </div>
        {this.activeModal}
      </div>
    );
  }

  private get activeModal(): React.ReactElement | null {
    if (this.state.activeModalName === "createTradeRecord") {
      return <TradeRecordModal hideModal={Util.getHideModalCallback(this)} />;
    }
    return null;
  }

  private get latestTsePrice(): number {
    const numbers = Object.keys(this.props.tseIndexRealtimePrices)
      .map((k) => parseInt(k))
      .filter((n) => !Number.isNaN(n));
    if (numbers.length === 0) return 0;
    const maxNum = Math.max(...numbers);
    return this.props.tseIndexRealtimePrices[maxNum.toString()] ?? 0;
  }

  private get latestOtcPrice(): number {
    const numbers = Object.keys(this.props.otcIndexRealtimePrices)
      .map((k) => parseInt(k))
      .filter((n) => !Number.isNaN(n));
    if (numbers.length === 0) return 0;
    const maxNum = Math.max(...numbers);
    return this.props.otcIndexRealtimePrices[maxNum.toString()] ?? 0;
  }

  private get latestTseFluctPercent(): number {
    const latestTseFluctPrice = this.props.tseIndexRealtimePrices.last_fluct_price ?? 0;
    return (
      Math.round(
        (latestTseFluctPrice / (this.latestTsePrice + latestTseFluctPrice)) * 10000,
      ) / 100
    );
  }

  private get latestOtcFluctPercent(): number {
    const latestOtcFluctPrice = this.props.otcIndexRealtimePrices.last_fluct_price ?? 0;
    return (
      Math.round(
        (latestOtcFluctPrice / (this.latestOtcPrice + latestOtcFluctPrice)) * 10000,
      ) / 100
    );
  }

  private getIndexPriceClass(index: "tse" | "otc"): string {
    if (index === "tse") {
      return this.latestTsePrice >
        (this.props.tseIndexRealtimePrices.yesterday_price ?? 0)
        ? styles.red
        : this.latestTsePrice < (this.props.tseIndexRealtimePrices.yesterday_price ?? 0)
          ? styles.green
          : styles.gray;
    } else {
      return this.latestOtcPrice >
        (this.props.otcIndexRealtimePrices.yesterday_price ?? 0)
        ? styles.red
        : this.latestOtcPrice < (this.props.otcIndexRealtimePrices.yesterday_price ?? 0)
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

  private updateTotalEarning(): void {
    this.setState({
      totalEarning:
        Object.values(this.props.sidGainMap).reduce((sum, gain) => sum + gain, 0) +
        this.props.cashDividendRecords.reduce(
          (sum, record) => sum + record.cash_dividend,
          0,
        ),
    });
  }

  private getTimeSpanOptionClass(number: number): string {
    return this.state.daysToShow === number ? styles.active : "";
  }

  private getActiveOptionIndex(): number {
    const options = [30, 91, 365, Infinity];
    return options.indexOf(this.state.daysToShow);
  }

  private handleClickTimeSpanOption = (number: number): void => {
    this.setState({ daysToShow: number });
  };

  private handleClickTotalEarning = (): void => {
    this.props.router.navigate(`${Env.frontendRootPath}earning-analysis`);
  };

  private handleClickHandlingFee = (): void => {
    this.props.router.navigate(`${Env.frontendRootPath}handling-fee`);
  };

  private handleCreateTradeRecordClick = (): void => {
    this.setState({ activeModalName: "createTradeRecord" });
  };

  private updateIndexLineCharts(): void {
    this.setState((state, props) => {
      const tseChartData: [number, number | null][] = [];
      for (let i = 0; i <= 270; i++) {
        if (
          Object.prototype.hasOwnProperty.call(
            props.tseIndexRealtimePrices,
            i.toString(),
          )
        ) {
          tseChartData.push([i, props.tseIndexRealtimePrices[i]]);
        } else tseChartData.push([i, null]);
      }

      const otcChartData: [number, number | null][] = [];
      for (let i = 0; i <= 270; i++) {
        if (
          Object.prototype.hasOwnProperty.call(
            props.otcIndexRealtimePrices,
            i.toString(),
          )
        ) {
          otcChartData.push([i, props.otcIndexRealtimePrices[i]]);
        } else otcChartData.push([i, null]);
      }

      return {
        tseIndexLineChart: (
          <MarketIndexLineChart
            data={tseChartData}
            prevClosePrice={this.props.tseIndexRealtimePrices.yesterday_price ?? 0}
          />
        ),
        otcIndexLineChart: (
          <MarketIndexLineChart
            data={otcChartData}
            prevClosePrice={this.props.otcIndexRealtimePrices.yesterday_price ?? 0}
          />
        ),
      };
    });
  }

  private updateCashInvestedLineChart(): void {
    this.setState((state, props) => {
      const allData = props.cashInvestedChartData.map((row) => {
        const dateStr = row[0] as string;
        return { date: Util.dateStringToDate(dateStr), value: row[1] as number };
      });
      const daysToShow = Math.min(state.daysToShow, allData.length);
      const filteredData = allData.slice(-daysToShow);
      return {
        cashInvestedLineChart: (
          <SimpleCashInvestedLineChart
            dates={filteredData.map((d) => d.date)}
            values={filteredData.map((d) => d.value)}
          />
        ),
      };
    });
  }

  private updateMarketRelatedData(): void {
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
            <MarketValuePieChart
              sidMarketValueMap={this.state.sidMarketValueMap}
              totalMarketValue={this.state.totalMarketValue}
            />
          ),
        });
      },
    );
  }

  private updateXIRR(): void {
    this.setState((state, props) => {
      return {
        xirr: Util.calculateXIRR(
          props.tradeRecords,
          props.handlingFeeDiscountRecords,
          props.cashDividendRecords,
          state.totalMarketValue,
        ),
      };
    });
  }

  private animateTotalCashInvested(): void {
    if (this.state.animatedTotalCashInvested === this.props.totalCashInvested) {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      return;
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(() => {
      this.setState((state, props) => {
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
      });
      this.animationFrameId = null;
      this.animateTotalCashInvested();
    });
  }
}

export default connect(mapStateToProps)(withRouter(Dashboard));
