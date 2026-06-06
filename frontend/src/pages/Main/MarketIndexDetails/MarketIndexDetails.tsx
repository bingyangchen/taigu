import React from "react";
import { connect } from "react-redux";

import {
  HistoricalPriceLineChart,
  MarketIndexIntradayLineChart,
  RoundButton,
  SegmentedControl,
  SpeedDial,
} from "../../../components";
import { IconChevronLeft } from "../../../icons";
import { changeMarketIndexHistoricalDaysToShow } from "../../../redux/slices/MainPageSlice";
import {
  fetchMarketIndexHistoricalPrices,
  fetchRealtimeMarketIndex,
} from "../../../redux/slices/StockInfoSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
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
  const { scrollTop, marketIndexHistoricalDaysToShow } = rootState.mainPage;
  return {
    realtimePriceDate,
    tseIndexRealtimePrices,
    otcIndexRealtimePrices,
    marketIndexHistoricalPricesMap,
    isWaitingMarketIndexHistoricalPrices,
    marketIndexHistoricalDaysToShow,
    mainScrollTop: scrollTop,
  };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  chartMode: ChartMode;
}

class MarketIndexDetails extends React.Component<Props, State> {
  private readonly SHOW_FLOATING_INFO_THRESHOLD = 120;

  public state: State = { chartMode: "intraday" };

  public componentDidMount(): void {
    if (!this.isValidMarket) {
      this.props.router.navigate(`${Env.frontendRootPath}`);
      return;
    }
    this.props.dispatch(fetchMarketIndexHistoricalPrices({ market: this.market }));
  }

  public render(): React.ReactNode {
    if (!this.isValidMarket) return null;

    return (
      <div className={styles.main}>
        {Util.isMobile && <SpeedDial />}
        <div
          className={`${styles.back_button_container} ${
            this.props.mainScrollTop > this.SHOW_FLOATING_INFO_THRESHOLD
              ? styles.scrolled
              : ""
          }`}
        >
          <RoundButton
            onClick={() => this.props.router.navigate(-1)}
            className="p-12"
            hint_text="回儀表板"
          >
            <IconChevronLeft sideLength="16" />
          </RoundButton>
        </div>
        <div className={styles.content}>
          <div className={styles.header_card}>
            <div className={styles.title}>{this.marketLabel}</div>
            <div className={styles.date}>{this.props.realtimePriceDate}</div>
            <div className={`${styles.price_row} ${this.priceClass}`}>
              <div className={styles.price}>{this.latestPrice}</div>
              <div className={styles.fluct_price}>
                {this.fluctPriceText} {this.fluctPercentText}
              </div>
            </div>
          </div>
          <div className={styles.chart_card}>
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
              className={`${styles.chart_container} ${
                this.state.chartMode === "historical" && this.showHistoricalLoadingState
                  ? styles.is_waiting
                  : ""
              }`}
              aria-label={
                this.state.chartMode === "intraday"
                  ? "今日走勢"
                  : `${this.historicalChartAriaLabel}收盤價走勢`
              }
            >
              {this.state.chartMode === "intraday" ? (
                this.showIntradayEmptyState ? (
                  <div className={styles.empty_chart}>
                    <div>盤中尚未有成交資料</div>
                    <span>開盤後會顯示今日走勢。</span>
                  </div>
                ) : (
                  <MarketIndexIntradayLineChart
                    data={this.intradayChartData}
                    prevClosePrice={this.realtimePrices.yesterday_price ?? 0}
                  />
                )
              ) : this.showHistoricalEmptyState ? (
                <div className={styles.empty_chart}>
                  <div>目前沒有歷史價格資料</div>
                  <span>收盤後會開始累積歷史資料。</span>
                </div>
              ) : (
                <HistoricalPriceLineChart
                  dates={this.historicalChartData.dates}
                  values={this.historicalChartData.values}
                  isWaiting={this.showHistoricalLoadingState}
                />
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
    const numbers = Object.keys(this.realtimePrices)
      .map((key) => parseInt(key))
      .filter((number) => !Number.isNaN(number));
    if (numbers.length === 0) return 0;
    const maxNum = Math.max(...numbers);
    return this.realtimePrices[maxNum.toString()] ?? 0;
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

  private get intradayChartData(): [number, number | null][] {
    const realtimePrices = this.realtimePrices;
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

  private get showIntradayEmptyState(): boolean {
    return !this.intradayChartData.some(([, price]) => price !== null);
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

  private get historicalChartData(): { dates: string[]; values: number[] } {
    const daily = this.props.marketIndexHistoricalPricesMap[this.market] ?? {};
    const sortedDates = Object.keys(daily).sort(
      (a, b) => Util.dateStringToDate(a).getTime() - Util.dateStringToDate(b).getTime(),
    );
    const daysToShow = Math.min(
      this.props.marketIndexHistoricalDaysToShow,
      sortedDates.length,
    );
    const filteredDates = sortedDates.slice(-daysToShow);
    return { dates: filteredDates, values: filteredDates.map((date) => daily[date]) };
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
