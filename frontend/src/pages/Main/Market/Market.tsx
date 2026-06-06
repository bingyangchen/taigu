import React from "react";
import { connect } from "react-redux";

import { SegmentedControl, SpeedDial } from "../../../components";
import {
  IconBriefcase,
  IconExclamation,
  IconHeart,
  IconMagnifier,
  IconXLarge,
} from "../../../icons";
import {
  changeMarketPageSubpage,
  changeMarketSearchText,
  changeMarketSortKey,
  type MarketSortKey,
  type MarketTab,
  updateHeaderTitle,
} from "../../../redux/slices/MainPageSlice";
import {
  calculateMarketValue,
  fetchStockInfo,
} from "../../../redux/slices/StockInfoSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import type { StockInfo } from "../../../types";
import Env from "../../../utils/env";
import Util from "../../../utils/util";
import styles from "./Market.module.scss";

const sortLabels: Record<MarketSortKey, string> = {
  marketValue: "持倉高到低",
  returnRate: "報酬率高到低",
  fluct: "今日漲跌幅",
  name: "名稱",
};

const shortSortLabels: Record<MarketSortKey, string> = {
  marketValue: "持倉",
  returnRate: "報酬率",
  fluct: "漲跌幅",
  name: "名稱",
};

const planDistanceThreshold = 0.05;

function mapStateToProps(rootState: RootState) {
  const {
    isWaiting: isWaitingTradeRecords,
    sidCashInvestedMap,
    sidTradeRecordsMap,
    stockWarehouse,
  } = rootState.tradeRecord;
  const { cashDividendRecords } = rootState.cashDividend;
  const { favorites } = rootState.memo;
  const { marketPageSubpageName, marketSearchText, marketSortKey } = rootState.mainPage;
  const { sidStockInfoMap } = rootState.stockInfo;
  const { tradePlans } = rootState.tradePlan;
  const { subscription } = rootState.account;
  return {
    cashDividendRecords,
    favorites,
    isWaitingTradeRecords,
    marketPageSubpageName,
    marketSearchText,
    marketSortKey,
    sidCashInvestedMap,
    sidStockInfoMap,
    sidTradeRecordsMap,
    stockWarehouse,
    subscription,
    tradePlans,
  };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  favoriteUpdateFailed: boolean;
  isRefreshingFavorites: boolean;
}

class Market extends React.Component<Props, State> {
  private fetchFavoriteStockInfoTimer: ReturnType<typeof setInterval> | null;

  public state: State;

  public constructor(props: Props) {
    super(props);
    this.state = { favoriteUpdateFailed: false, isRefreshingFavorites: false };
    this.fetchFavoriteStockInfoTimer = null;
  }

  public componentDidMount(): void {
    this.props.dispatch(updateHeaderTitle(null));
    if (this.props.marketPageSubpageName === "favorites") {
      this.fetchFavoriteStockInfo();
    }
    this.fetchFavoriteStockInfoTimer = setInterval(() => {
      if (this.props.marketPageSubpageName === "favorites") {
        this.fetchFavoriteStockInfo();
      }
    }, this.props.subscription.market_refresh_interval_seconds * 1000);
  }

  public componentWillUnmount(): void {
    if (this.fetchFavoriteStockInfoTimer) {
      clearInterval(this.fetchFavoriteStockInfoTimer);
      this.fetchFavoriteStockInfoTimer = null;
    }
  }

  public render(): React.ReactNode {
    const activeTab = this.props.marketPageSubpageName;
    const allSids = this.getAllSids(activeTab);
    const visibleSids = this.getVisibleSids(activeTab);
    const isLoading =
      (activeTab === "holding" && this.props.isWaitingTradeRecords) ||
      (activeTab === "favorites" &&
        this.state.isRefreshingFavorites &&
        allSids.length > 0 &&
        visibleSids.every((sid) => !(sid in this.props.sidStockInfoMap)));

    return (
      <div className={styles.main}>
        <section className={styles.summary_panel}>
          <div className={styles.summary_copy}>
            <h1>{this.getTitle(activeTab)}</h1>
            <p>{this.getSubtitle(activeTab)}</p>
          </div>
          <div className={styles.metrics}>{this.renderMetrics(activeTab)}</div>
        </section>

        <section className={styles.control_bar} aria-label="市場控制列">
          <div className={styles.segmented_wrapper}>
            <SegmentedControl
              label="市場資料分類"
              optionWidth="86px"
              options={[
                { label: "持股", value: "holding" },
                { label: "關注", value: "favorites" },
              ]}
              value={activeTab}
              onChange={this.handleSubpageChange}
            />
          </div>
          <div className={styles.search_sort_row}>
            <label className={styles.search_box}>
              <IconMagnifier sideLength="16" />
              <input
                aria-label="搜尋股票"
                placeholder={
                  activeTab === "holding" ? "搜尋持股代號或名稱" : "搜尋最愛代號或名稱"
                }
                value={this.props.marketSearchText}
                onChange={this.handleSearchChange}
              />
              {this.props.marketSearchText && (
                <button
                  aria-label="清除搜尋"
                  className={styles.clear_search_button}
                  type="button"
                  onClick={this.clearSearch}
                >
                  <IconXLarge sideLength="12" />
                </button>
              )}
            </label>
            {this.renderResultCount(allSids.length, visibleSids.length)}
            {this.renderUpdateFailure()}
            <div className={styles.sort_menu}>
              <select
                aria-label="排序股票"
                value={this.props.marketSortKey}
                onChange={this.handleSortChange}
              >
                {(Object.keys(sortLabels) as MarketSortKey[]).map((sortKey) => (
                  <option key={sortKey} value={sortKey}>
                    {sortLabels[sortKey]}
                  </option>
                ))}
              </select>
              <span className={styles.sort_label}>
                {shortSortLabels[this.props.marketSortKey]}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.stock_list} aria-live="polite">
          {isLoading
            ? this.renderSkeletonCards(activeTab)
            : this.renderStockList(activeTab, allSids, visibleSids)}
        </section>
        {Util.isMobile && <SpeedDial />}
      </div>
    );
  }

  private renderMetrics(activeTab: MarketTab): React.ReactNode {
    const allSids = this.getAllSids(activeTab);
    const upCount = allSids.filter(
      (sid) => (this.props.sidStockInfoMap[sid]?.fluct_price ?? 0) > 0,
    ).length;
    const downCount = allSids.filter(
      (sid) => (this.props.sidStockInfoMap[sid]?.fluct_price ?? 0) < 0,
    ).length;
    if (activeTab === "favorites") {
      return (
        <>
          {this.renderMetric("最愛檔數", this.props.favorites.length.toLocaleString())}
          {this.renderMetric("今日上漲", upCount.toLocaleString(), "up")}
          {this.renderMetric("今日下跌", downCount.toLocaleString(), "down")}
        </>
      );
    }

    return (
      <>
        {this.renderMetric(
          "持股檔數",
          Object.keys(this.props.stockWarehouse).length.toLocaleString(),
        )}
        {this.renderMetric("今日上漲", upCount.toLocaleString(), "up")}
        {this.renderMetric("今日下跌", downCount.toLocaleString(), "down")}
      </>
    );
  }

  private renderMetric(
    label: string,
    value: string,
    tone: "up" | "down" | "neutral" = "neutral",
  ): React.ReactNode {
    return (
      <div className={styles.metric}>
        <span>{label}</span>
        <strong className={styles[tone]}>{value}</strong>
      </div>
    );
  }

  private renderStockList(
    activeTab: MarketTab,
    allSids: string[],
    visibleSids: string[],
  ): React.ReactNode {
    if (allSids.length === 0) {
      return this.renderEmptyState(activeTab);
    }
    if (visibleSids.length === 0) {
      return this.renderNoSearchResults();
    }
    return visibleSids.map((sid) => this.renderStockCard(activeTab, sid));
  }

  private renderStockCard(activeTab: MarketTab, sid: string): React.ReactNode {
    const stockInfo = this.props.sidStockInfoMap[sid];
    const stockName = stockInfo?.name ?? this.getFallbackStockName(sid);
    const fluctPrice = stockInfo?.fluct_price ?? 0;
    const close = stockInfo?.close ?? 0;
    const changePercent = this.getChangePercent(stockInfo);
    const tone = fluctPrice > 0 ? "up" : fluctPrice < 0 ? "down" : "neutral";
    const accessibleLabel =
      activeTab === "holding"
        ? this.getHoldingAccessibleLabel(sid, stockInfo)
        : this.getFavoriteAccessibleLabel(sid, stockInfo);

    return (
      <button
        key={sid}
        aria-label={accessibleLabel}
        className={`${styles.stock_card} ${styles[tone]}`}
        type="button"
        onClick={() => this.navigateToDetail(activeTab, sid)}
      >
        <div className={styles.card_top_row}>
          <div className={styles.company}>
            <strong>{stockName}</strong>
            <span>{sid}</span>
          </div>
          <div className={styles.price_block}>
            <strong>{close > 0 ? close.toLocaleString() : "--"}</strong>
            <span>{this.formatChange(fluctPrice, changePercent)}</span>
          </div>
        </div>
        {activeTab === "holding" && this.renderHoldingChips(sid, stockInfo)}
        {this.renderMarketSignals(sid, stockInfo)}
      </button>
    );
  }

  private renderHoldingChips(
    sid: string,
    stockInfo: StockInfo | undefined,
  ): React.ReactNode {
    const inventoryCosts = this.props.stockWarehouse[sid] ?? [];
    const inventory = inventoryCosts.length;
    const averageCost =
      inventory > 0 ? (this.props.sidCashInvestedMap[sid] ?? 0) / inventory : 0;
    const returnRate = this.getReturnRate(sid, stockInfo);
    const returnTone = returnRate > 0 ? "up" : returnRate < 0 ? "down" : "neutral";

    return (
      <div className={styles.holding_chips}>
        <div>
          <span>庫存</span>
          <strong>{inventory.toLocaleString()} 股</strong>
        </div>
        <div>
          <span>平均成本</span>
          <strong>${averageCost.toFixed(2)}</strong>
        </div>
        <div>
          <span>報酬率</span>
          <strong className={styles[returnTone]}>
            {this.formatPercent(returnRate)}
          </strong>
        </div>
      </div>
    );
  }

  private renderMarketSignals(
    sid: string,
    stockInfo: StockInfo | undefined,
  ): React.ReactNode {
    const planText = this.getNearestPlanText(sid, stockInfo);
    return (
      <div className={styles.market_signals}>
        <span className={styles.volume_text}>{this.getVolumeText(stockInfo)}</span>
        {planText && <strong className={styles.plan_chip}>{planText}</strong>}
      </div>
    );
  }

  private renderEmptyState(activeTab: MarketTab): React.ReactNode {
    const isHolding = activeTab === "holding";
    const EmptyIcon = isHolding ? IconBriefcase : IconHeart;
    return (
      <div className={styles.empty_state}>
        <EmptyIcon sideLength="40" color="#4c8bf5" />
        <h2>{isHolding ? "還沒有持股" : "還沒有最愛股票"}</h2>
        <p>
          {isHolding
            ? "新增第一筆交易紀錄後，這裡會自動整理你的庫存、成本與報酬率。"
            : "到股票詳情頁點選愛心，就能把常看的股票集中在這裡追蹤。"}
        </p>
        <div>
          <button
            className={styles.primary_action}
            type="button"
            onClick={() =>
              this.props.router.navigate(
                `${Env.frontendRootPath}${isHolding ? "records/trade/new" : "search"}`,
              )
            }
          >
            {isHolding ? "新增交易紀錄" : "搜尋股票"}
          </button>
          <button
            className={styles.secondary_action}
            type="button"
            onClick={() =>
              isHolding
                ? this.props.router.navigate(`${Env.frontendRootPath}records`)
                : this.handleSubpageChange("holding")
            }
          >
            {isHolding ? "查看交易紀錄" : "查看持股"}
          </button>
        </div>
      </div>
    );
  }

  private renderNoSearchResults(): React.ReactNode {
    return (
      <div className={styles.empty_state}>
        <IconMagnifier sideLength="40" color="#4c8bf5" />
        <h2>找不到符合的股票</h2>
        <p>請確認代號或名稱是否正確，或清除搜尋條件。</p>
        <button
          className={styles.primary_action}
          type="button"
          onClick={this.clearSearch}
        >
          清除搜尋
        </button>
      </div>
    );
  }

  private renderSkeletonCards(activeTab: MarketTab): React.ReactNode {
    return Array.from({ length: 6 }).map((_, index) => (
      <div
        key={index}
        className={`${styles.skeleton_card} ${
          activeTab === "holding" ? styles.holding_skeleton : styles.favorite_skeleton
        }`}
      >
        <div />
        <div />
        <div />
      </div>
    ));
  }

  private renderResultCount(totalCount: number, visibleCount: number): React.ReactNode {
    if (!this.props.marketSearchText || visibleCount === totalCount) {
      return null;
    }
    return <span className={styles.result_count}>{visibleCount} 筆結果</span>;
  }

  private renderUpdateFailure(): React.ReactNode {
    if (
      !this.state.favoriteUpdateFailed ||
      this.props.marketPageSubpageName !== "favorites"
    ) {
      return null;
    }
    return (
      <div className={styles.update_failure}>
        <span title="暫時無法取得最新價格，已保留上次資料。">
          <IconExclamation sideLength="14" />
          更新失敗
        </span>
        <button
          aria-label="重新整理最愛股價"
          type="button"
          onClick={this.fetchFavoriteStockInfo}
        >
          ↻
        </button>
      </div>
    );
  }

  private getVisibleSids(activeTab: MarketTab): string[] {
    const keyword = this.props.marketSearchText.trim().toLowerCase();
    return this.getAllSids(activeTab)
      .filter((sid) => {
        if (!keyword) return true;
        const name = this.getFallbackStockName(sid).toLowerCase();
        return sid.toLowerCase().includes(keyword) || name.includes(keyword);
      })
      .sort((leftSid, rightSid) => this.compareSids(leftSid, rightSid));
  }

  private compareSids(leftSid: string, rightSid: string): number {
    if (this.props.marketSortKey === "name") {
      return this.getFallbackStockName(leftSid).localeCompare(
        this.getFallbackStockName(rightSid),
        "zh-Hant",
      );
    }
    if (this.props.marketSortKey === "returnRate") {
      return (
        this.getReturnRate(rightSid, this.props.sidStockInfoMap[rightSid]) -
        this.getReturnRate(leftSid, this.props.sidStockInfoMap[leftSid])
      );
    }
    if (this.props.marketSortKey === "fluct") {
      return (
        this.getAbsoluteChangePercent(this.props.sidStockInfoMap[rightSid]) -
        this.getAbsoluteChangePercent(this.props.sidStockInfoMap[leftSid])
      );
    }
    return this.getMarketValue(rightSid) - this.getMarketValue(leftSid);
  }

  private fetchFavoriteStockInfo = async (): Promise<void> => {
    if (this.props.favorites.length === 0) return;
    this.setState({ isRefreshingFavorites: true });
    try {
      await this.props.dispatch(fetchStockInfo(this.props.favorites)).unwrap();
      this.setState({ favoriteUpdateFailed: false, isRefreshingFavorites: false });
    } catch {
      this.setState({ favoriteUpdateFailed: true, isRefreshingFavorites: false });
    }
  };

  private handleSubpageChange = (value: string): void => {
    const nextTab = value === "favorites" ? "favorites" : "holding";
    this.props.dispatch(changeMarketPageSubpage(nextTab));
    if (nextTab === "favorites") {
      this.fetchFavoriteStockInfo();
    }
  };

  private handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.props.dispatch(changeMarketSearchText(event.target.value));
  };

  private clearSearch = (): void => {
    this.props.dispatch(changeMarketSearchText(""));
  };

  private handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.props.dispatch(changeMarketSortKey(event.target.value as MarketSortKey));
  };

  private getAllSids(activeTab: MarketTab): string[] {
    return activeTab === "holding"
      ? Object.keys(this.props.stockWarehouse)
      : this.props.favorites;
  }

  private getSubtitle(activeTab: MarketTab): string {
    return activeTab === "holding"
      ? "追蹤你的持股現況、報酬率與最新價格。"
      : "觀察你關注的股票，等待適合的進場時機。";
  }

  private getTitle(activeTab: MarketTab): string {
    return activeTab === "holding" ? "持股追蹤" : "關注";
  }

  private getFallbackStockName(sid: string): string {
    return (
      this.props.sidStockInfoMap[sid]?.name ??
      this.props.sidTradeRecordsMap[sid]?.[0]?.company_name ??
      sid
    );
  }

  private getMarketValue(sid: string): number {
    return calculateMarketValue(
      this.props.sidStockInfoMap[sid],
      this.props.stockWarehouse[sid] ?? [],
    );
  }

  private getReturnRate(sid: string, stockInfo: StockInfo | undefined): number {
    const inventoryCosts = this.props.stockWarehouse[sid] ?? [];
    const marketValue = calculateMarketValue(stockInfo, inventoryCosts);
    return Util.calculateXIRR(
      this.props.sidTradeRecordsMap[sid] || [],
      [],
      this.props.cashDividendRecords.filter((record) => record.sid === sid),
      marketValue,
    );
  }

  private getNearestPlanText(
    sid: string,
    stockInfo: StockInfo | undefined,
  ): string | null {
    if (!stockInfo?.close) return null;
    const plans = this.props.tradePlans.filter((plan) => plan.sid === sid);
    if (plans.length === 0) return null;
    const nearestPlan = plans
      .map((plan) => ({
        plan,
        distance: Math.abs((plan.target_price - stockInfo.close) / stockInfo.close),
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (nearestPlan.distance > planDistanceThreshold) return null;
    const planType = nearestPlan.plan.plan_type === "buy" ? "買進價" : "賣出價";
    return `距${planType} ${(nearestPlan.distance * 100).toFixed(1)}%`;
  }

  private getChangePercent(stockInfo: StockInfo | undefined): number {
    if (!stockInfo || stockInfo.fluct_price === 0) return 0;
    const previousClose = stockInfo.close - stockInfo.fluct_price;
    if (previousClose === 0) return 0;
    return Math.abs(stockInfo.fluct_price / previousClose);
  }

  private getAbsoluteChangePercent(stockInfo: StockInfo | undefined): number {
    return this.getChangePercent(stockInfo);
  }

  private formatChange(fluctPrice: number, percent: number): string {
    if (fluctPrice === 0) return "-";
    const symbol = fluctPrice > 0 ? "▲" : "▼";
    return `${symbol} ${Math.abs(fluctPrice).toFixed(2)}  ${(percent * 100).toFixed(2)}%`;
  }

  private getAccessibleChangeText(stockInfo: StockInfo | undefined): string {
    if (!stockInfo || stockInfo.fluct_price === 0) return "今日持平";
    const direction = stockInfo.fluct_price > 0 ? "上漲" : "下跌";
    const percent = this.getChangePercent(stockInfo);
    return `${direction} ${Math.abs(stockInfo.fluct_price).toFixed(2)}，${(
      percent * 100
    ).toFixed(2)}%`;
  }

  private getHoldingAccessibleLabel(
    sid: string,
    stockInfo: StockInfo | undefined,
  ): string {
    const inventoryCosts = this.props.stockWarehouse[sid] ?? [];
    const inventory = inventoryCosts.length;
    const averageCost =
      inventory > 0 ? (this.props.sidCashInvestedMap[sid] ?? 0) / inventory : 0;
    const returnRate = this.getReturnRate(sid, stockInfo);
    const priceText = stockInfo?.close
      ? `目前價格 ${stockInfo.close.toLocaleString()}`
      : "尚未取得價格";
    const planText = this.getNearestPlanText(sid, stockInfo);
    return `${this.getFallbackStockName(sid)} ${sid}，${priceText}，${this.getAccessibleChangeText(
      stockInfo,
    )}，庫存 ${inventory.toLocaleString()} 股，平均成本 ${averageCost.toFixed(
      2,
    )}，報酬率 ${this.formatPercent(returnRate)}，${this.getVolumeText(
      stockInfo,
    )}${planText ? `，${planText}` : ""}，${stockInfo ? "可查看詳情" : "尚未取得價格"}`;
  }

  private getFavoriteAccessibleLabel(
    sid: string,
    stockInfo: StockInfo | undefined,
  ): string {
    const priceText = stockInfo?.close
      ? `目前價格 ${stockInfo.close.toLocaleString()}`
      : "尚未取得價格";
    const volumeText = stockInfo?.quantity
      ? this.getVolumeText(stockInfo)
      : "尚未取得成交量";
    const planText = this.getNearestPlanText(sid, stockInfo);
    return `${this.getFallbackStockName(sid)} ${sid}，${priceText}，${this.getAccessibleChangeText(
      stockInfo,
    )}，${volumeText}${planText ? `，${planText}` : ""}`;
  }

  private formatPercent(value: number): string {
    if (!Number.isFinite(value)) return "-";
    return `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
  }

  private formatVolume(quantity: number): string {
    const lots = quantity >= 1000 ? quantity / 1000 : quantity;
    if (lots >= 10000) {
      return `${(lots / 10000).toFixed(1)} 萬張`;
    }
    return `${Math.round(lots).toLocaleString()} 張`;
  }

  private getVolumeText(stockInfo: StockInfo | undefined): string {
    return stockInfo?.quantity
      ? `成交量 ${this.formatVolume(stockInfo.quantity)}`
      : "成交量 --";
  }

  private navigateToDetail(activeTab: MarketTab, sid: string): void {
    this.props.router.navigate(`${Env.frontendRootPath}market/${activeTab}/${sid}`);
  }
}

export default connect(mapStateToProps)(withRouter(Market));
