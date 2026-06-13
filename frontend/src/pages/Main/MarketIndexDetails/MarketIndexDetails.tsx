import React from "react";
import { connect } from "react-redux";

import {
  HistoricalPriceLineChart,
  MarketIndexIntradayLineChart,
  RoundButton,
  ScrollThresholdContainer,
  SegmentedControl,
  SkeletonOverlay,
  SpeedDial,
} from "../../../components";
import * as Icons from "../../../icons";
import { changeMarketIndexHistoricalDaysToShow } from "../../../redux/slices/MainPageSlice";
import {
  fetchMarketIndexHistoricalPrices,
  fetchRealtimeMarketIndex,
} from "../../../redux/slices/StockInfoSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import { dateStringToDate } from "../../../utils/date";
import Env from "../../../utils/env";
import Util from "../../../utils/util";
import styles from "./MarketIndexDetails.module.scss";

type MarketId = "tse" | "otc";
type ChartMode = "intraday" | "historical";

const MARKET_LABELS: Record<MarketId, string> = { tse: "加權指數", otc: "櫃買指數" };

function mapStateToProps(rootState: RootState) {
  const {
    realtimePriceDate,
    tseIndexRealtimePrices,
    otcIndexRealtimePrices,
    marketIndexHistoricalPricesMap,
    isWaitingMarketIndexHistoricalPrices,
  } = rootState.stockInfo;
  const { marketIndexHistoricalDaysToShow } = rootState.mainPage;
  return {
    realtimePriceDate,
    tseIndexRealtimePrices,
    otcIndexRealtimePrices,
    marketIndexHistoricalPricesMap,
    isWaitingMarketIndexHistoricalPrices,
    marketIndexHistoricalDaysToShow,
  };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  chartMode: ChartMode;
  intradayLineChart: React.ReactElement | null;
  historicalLineChart: React.ReactElement | null;
}

class MarketIndexDetails extends React.Component<Props, State> {
  public state: State = {
    chartMode: "intraday",
    intradayLineChart: null,
    historicalLineChart: null,
  };

  public componentDidMount(): void {
    if (!this.isValidMarket) {
      this.props.router.navigate(`${Env.frontendRootPath}`);
      return;
    }
    this.props.dispatch(fetchMarketIndexHistoricalPrices({ market: this.market }));
    this.updateIntradayLineChart();
    this.updateHistoricalLineChart();
  }

  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
  ): void {
    const marketChanged =
      prevProps.router.params.market !== this.props.router.params.market;
    const realtimePricesChanged =
      this.market === "tse"
        ? prevProps.tseIndexRealtimePrices !== this.props.tseIndexRealtimePrices
        : prevProps.otcIndexRealtimePrices !== this.props.otcIndexRealtimePrices;

    if (
      (this.state.chartMode === "intraday" &&
        (realtimePricesChanged || marketChanged)) ||
      (prevState.chartMode !== this.state.chartMode &&
        this.state.chartMode === "intraday")
    ) {
      this.updateIntradayLineChart();
    }

    const historicalDataChanged =
      prevProps.marketIndexHistoricalPricesMap !==
        this.props.marketIndexHistoricalPricesMap ||
      prevProps.marketIndexHistoricalDaysToShow !==
        this.props.marketIndexHistoricalDaysToShow ||
      prevProps.isWaitingMarketIndexHistoricalPrices !==
        this.props.isWaitingMarketIndexHistoricalPrices ||
      prevProps.realtimePriceDate !== this.props.realtimePriceDate ||
      realtimePricesChanged;

    if (
      (this.state.chartMode === "historical" &&
        (historicalDataChanged || marketChanged)) ||
      (prevState.chartMode !== this.state.chartMode &&
        this.state.chartMode === "historical")
    ) {
      this.updateHistoricalLineChart();
    }
  }

  public render(): React.ReactNode {
    if (!this.isValidMarket) return null;

    return (
      <div className={styles.main}>
        {Util.isMobile && <SpeedDial />}
        <ScrollThresholdContainer
          className={styles.back_button_container}
          scrolledClassName={styles.scrolled}
        >
          <RoundButton
            onClick={() => this.props.router.navigate(-1)}
            className="p-12"
            hint_text="回儀表板"
          >
            <Icons.IconChevronLeft sideLength="16" />
          </RoundButton>
        </ScrollThresholdContainer>
        <div className={styles.content}>
          <div className={`${styles.block} ${styles.header_card}`}>
            <div className={styles.title}>{this.marketLabel}</div>
            <div className={styles.date}>{this.props.realtimePriceDate}</div>
            <div className={`${styles.price_row} ${this.priceClass}`}>
              <div className={styles.price}>{this.latestPrice}</div>
              <div className={styles.fluct_price}>
                {this.fluctPriceText} {this.fluctPercentText}
              </div>
            </div>
          </div>
          <div className={`${styles.block} ${styles.chart_card}`}>
            <div className={styles.controls}>
              <SegmentedControl
                label="指數圖表類型"
                options={[
                  { label: "今日", value: "intraday" },
                  { label: "歷史", value: "historical" },
                ]}
                value={this.state.chartMode}
                onChange={this.handleChartModeChange}
              />
            </div>
            <div
              className={styles.chart_container}
              aria-label={
                this.state.chartMode === "intraday"
                  ? "今日走勢"
                  : `${this.historicalChartAriaLabel}收盤價走勢`
              }
            >
              {this.state.chartMode === "historical" &&
                this.showHistoricalLoadingState && (
                  <SkeletonOverlay className={styles.chart_overlay} />
                )}
              {this.state.chartMode === "intraday" ? (
                this.showIntradayEmptyState ? (
                  <div className={styles.empty_chart}>
                    <div>盤中尚未有成交資料</div>
                    <span>開盤後會顯示今日走勢。</span>
                  </div>
                ) : (
                  this.state.intradayLineChart
                )
              ) : this.showHistoricalEmptyState ? (
                <div className={styles.empty_chart}>
                  <div>目前沒有歷史價格資料</div>
                  <span>收盤後會開始累積歷史資料。</span>
                </div>
              ) : (
                this.state.historicalLineChart
              )}
            </div>
            {this.state.chartMode === "historical" &&
              !this.showHistoricalEmptyState && (
                <div className={styles.historical_controls}>
                  <SegmentedControl
                    label="歷史股價圖表時間區間"
                    options={[
                      { label: "1M", value: "30" },
                      { label: "1Q", value: "91" },
                      { label: "1Y", value: "365" },
                      { label: "ALL", value: "Infinity" },
                    ]}
                    value={String(this.props.marketIndexHistoricalDaysToShow)}
                    onChange={this.handleHistoricalTimeSpanChange}
                  />
                </div>
              )}
          </div>
        </div>
      </div>
    );
  }

  private get market(): MarketId {
    return this.props.router.params.market as MarketId;
  }

  private get isValidMarket(): boolean {
    return this.market === "tse" || this.market === "otc";
  }

  private get marketLabel(): string {
    return MARKET_LABELS[this.market];
  }

  private get realtimePrices(): Props["tseIndexRealtimePrices"] {
    return this.market === "tse"
      ? this.props.tseIndexRealtimePrices
      : this.props.otcIndexRealtimePrices;
  }

  private get latestPrice(): number {
    return MarketIndexDetails.getLatestRealtimePrice(this.realtimePrices);
  }

  private get priceClass(): string {
    const yesterdayPrice = this.realtimePrices.yesterday_price ?? 0;
    if (this.latestPrice > yesterdayPrice) return styles.red;
    if (this.latestPrice < yesterdayPrice) return styles.green;
    return styles.gray;
  }

  private get fluctPriceText(): string {
    const fluctPrice = this.realtimePrices.last_fluct_price ?? 0;
    return (
      (fluctPrice > 0 ? "▲" : fluctPrice < 0 ? "▼" : "-") +
      (fluctPrice !== 0 ? Math.abs(fluctPrice) : "")
    );
  }

  private get fluctPercentText(): string {
    const fluctPrice = this.realtimePrices.last_fluct_price ?? 0;
    const fluctPercent =
      Math.round((fluctPrice / (this.latestPrice + fluctPrice)) * 10000) / 100;
    return `(${fluctPercent !== 0 ? Math.abs(fluctPercent) + "%" : "-"})`;
  }

  private get showIntradayEmptyState(): boolean {
    return !MarketIndexDetails.hasRealtimeIntradayData(this.realtimePrices);
  }

  private get showHistoricalLoadingState(): boolean {
    const daily = this.props.marketIndexHistoricalPricesMap[this.market];
    return (
      this.props.isWaitingMarketIndexHistoricalPrices &&
      (daily === undefined || Object.keys(daily).length === 0)
    );
  }

  private get showHistoricalEmptyState(): boolean {
    const daily = this.props.marketIndexHistoricalPricesMap[this.market];
    return (
      !this.props.isWaitingMarketIndexHistoricalPrices &&
      (daily === undefined || Object.keys(daily).length === 0)
    );
  }

  private get historicalChartAriaLabel(): string {
    const daysToShow = this.props.marketIndexHistoricalDaysToShow;
    if (daysToShow === Infinity) return "全部";
    if (daysToShow <= 30) return "近 1 個月";
    if (daysToShow <= 91) return "近 1 季";
    return "近 1 年";
  }

  private buildIntradayChartData(
    realtimePrices: Props["tseIndexRealtimePrices"],
  ): [number, number | null][] {
    const chartData: [number, number | null][] = [];
    for (let i = 0; i <= 270; i++) {
      if (Object.prototype.hasOwnProperty.call(realtimePrices, i.toString())) {
        chartData.push([i, realtimePrices[i.toString()]]);
      } else {
        chartData.push([i, null]);
      }
    }
    return chartData;
  }

  private buildHistoricalChartData(
    marketIndexHistoricalPricesMap: Props["marketIndexHistoricalPricesMap"],
    marketIndexHistoricalDaysToShow: number,
    market: MarketId,
    realtimePriceDate: string,
    realtimePrices: Props["tseIndexRealtimePrices"],
  ): { dates: string[]; values: number[] } {
    // Merge today's realtime price for display only. Do not persist this to Redux
    // or LocalDatabase, otherwise incremental fetch `since` would be wrong.
    const daily = { ...(marketIndexHistoricalPricesMap[market] ?? {}) };
    const latestRealtimePrice =
      MarketIndexDetails.getLatestRealtimePrice(realtimePrices);
    if (
      MarketIndexDetails.hasRealtimeIntradayData(realtimePrices) &&
      latestRealtimePrice > 0 &&
      realtimePriceDate &&
      realtimePriceDate !== "0000-00-00"
    ) {
      const todayDate = new Date(Date.parse(realtimePriceDate)).toLocaleDateString(
        "af",
      );
      daily[todayDate] = latestRealtimePrice;
    }

    const sortedDates = Object.keys(daily).sort(
      (a, b) => dateStringToDate(a).getTime() - dateStringToDate(b).getTime(),
    );
    const daysToShow = Math.min(marketIndexHistoricalDaysToShow, sortedDates.length);
    const filteredDates = sortedDates.slice(-daysToShow);
    return { dates: filteredDates, values: filteredDates.map((date) => daily[date]) };
  }

  private static getLatestRealtimePrice(
    realtimePrices: Props["tseIndexRealtimePrices"],
  ): number {
    const numbers = Object.keys(realtimePrices)
      .map((key) => parseInt(key))
      .filter((number) => !Number.isNaN(number));
    if (numbers.length === 0) return 0;
    const maxNum = Math.max(...numbers);
    return realtimePrices[maxNum.toString()] ?? 0;
  }

  private static hasRealtimeIntradayData(
    realtimePrices: Props["tseIndexRealtimePrices"],
  ): boolean {
    return Object.keys(realtimePrices).some((key) => !Number.isNaN(parseInt(key)));
  }

  private updateIntradayLineChart(): void {
    this.setState((state, props) => {
      const market = props.router.params.market as MarketId;
      if (market !== "tse" && market !== "otc") {
        return { intradayLineChart: null };
      }

      const realtimePrices =
        market === "tse" ? props.tseIndexRealtimePrices : props.otcIndexRealtimePrices;
      const chartData = this.buildIntradayChartData(realtimePrices);
      const hasPlottedData = chartData.some(([, price]) => price !== null);
      if (!hasPlottedData) {
        return { intradayLineChart: null };
      }

      return {
        intradayLineChart: (
          <MarketIndexIntradayLineChart
            data={chartData}
            prevClosePrice={realtimePrices.yesterday_price ?? 0}
          />
        ),
      };
    });
  }

  private updateHistoricalLineChart(): void {
    this.setState((state, props) => {
      const market = props.router.params.market as MarketId;
      if (market !== "tse" && market !== "otc") {
        return { historicalLineChart: null };
      }

      const daily = props.marketIndexHistoricalPricesMap[market];
      const isEmpty =
        !props.isWaitingMarketIndexHistoricalPrices &&
        (daily === undefined || Object.keys(daily).length === 0);
      if (isEmpty) {
        return { historicalLineChart: null };
      }

      const realtimePrices =
        market === "tse" ? props.tseIndexRealtimePrices : props.otcIndexRealtimePrices;
      const { dates, values } = this.buildHistoricalChartData(
        props.marketIndexHistoricalPricesMap,
        props.marketIndexHistoricalDaysToShow,
        market,
        props.realtimePriceDate,
        realtimePrices,
      );
      const isWaiting =
        props.isWaitingMarketIndexHistoricalPrices &&
        (daily === undefined || Object.keys(daily).length === 0);

      return {
        historicalLineChart: (
          <HistoricalPriceLineChart
            dates={dates}
            values={values}
            isWaiting={isWaiting}
          />
        ),
      };
    });
  }

  private handleHistoricalTimeSpanChange = (value: string): void => {
    this.props.dispatch(
      changeMarketIndexHistoricalDaysToShow(
        value === "Infinity" ? Infinity : Number(value),
      ),
    );
  };

  private handleChartModeChange = (value: string): void => {
    this.setState({ chartMode: value as ChartMode });
    if (value === "intraday") {
      this.props.dispatch(fetchRealtimeMarketIndex());
    }
  };
}

export default connect(mapStateToProps)(withRouter(MarketIndexDetails));
