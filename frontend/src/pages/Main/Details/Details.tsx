import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";

import {
  BottomSheet,
  DollarSign,
  HistoricalPriceLineChart,
  InventoryHistogram,
  Modal,
  PercentSign,
  RoundButton,
  SpeedDial,
  StockMemoEditor,
} from "../../../components";
import {
  IconBriefcase,
  IconChevronLeft,
  IconChevronRight,
  IconClockHistory,
  IconHeart,
  IconHeartFill,
  IconMemo,
  IconThumbtack,
} from "../../../icons";
import type { MarketTab } from "../../../redux/slices/MainPageSlice";
import {
  addToFavorites,
  fakeAddToFavorites,
  fakeRemoveFromFavorites,
  fetchCompanyInfo,
  removeFromFavorites,
} from "../../../redux/slices/MemoSlice";
import {
  calculateMarketValue,
  fetchSingleStockHistoricalPrices,
  fetchSingleStockInfo,
} from "../../../redux/slices/StockInfoSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import { MaterialFact } from "../../../types";
import Env from "../../../utils/env";
import { getVisibleMarketSids } from "../../../utils/marketSids";
import Util from "../../../utils/util";
import styles from "./Details.module.scss";

function mapStateToProps(rootState: RootState) {
  const { sidStockInfoMap } = rootState.stockInfo;
  const {
    sidTradeRecordsMap,
    sidGainMap,
    sidCashInvestedMap,
    sidHandlingFeeMap,
    stockWarehouse,
    isWaiting: isWaitingTradeRecord,
  } = rootState.tradeRecord;
  const { cashDividendRecords, sidTotalCashDividendMap } = rootState.cashDividend;
  const { sidHistoricalPricesMap, isWaitingHistoricalPrices } = rootState.stockInfo;
  const { sidCompanyInfoMap, favorites } = rootState.memo;
  const { tradePlans } = rootState.tradePlan;
  const { scrollTop, marketSortKey, marketSearchText } = rootState.mainPage;
  const { subscription } = rootState.account;
  return {
    cashDividendRecords,
    sidStockInfoMap,
    sidTradeRecordsMap,
    sidCashInvestedMap,
    sidHandlingFeeMap,
    stockWarehouse,
    sidGainMap,
    sidTotalCashDividendMap,
    sidHistoricalPricesMap,
    sidCompanyInfoMap,
    favorites,
    tradePlans,
    isWaitingHistoricalPrices,
    isWaitingTradeRecord,
    mainScrollTop: scrollTop,
    marketSortKey,
    marketSearchText,
    subscription,
  };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  activeModalName: "companyInfo" | "updateOrCreateNote" | null;
  historicalPriceChartDates: string[];
  historicalPriceChartValues: number[];
  marketValue: number;
  xirr: number;
  inventoryHistogram: React.ReactElement | null;
  touchStartX: number;
  touchStartY: number;
  touchDiffX: number;
  switchDirection: "prev" | "next" | null;
  isScrollingHorizontally: boolean;
  isScrollingVertically: boolean;
  hasVibrated: boolean;
  activeMaterialFact: MaterialFact | null;
  didStockInfoFail: boolean;
  isPageSwitching: boolean;
}

class Details extends React.Component<Props, State> {
  public state: State;
  private mainRef: React.RefObject<HTMLDivElement>;
  private fetchStockInfoTimer: ReturnType<typeof setInterval> | null = null;
  private pageSwitchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SCROLLING_THRESHOLD: number = 10;
  private readonly SWITCHING_THRESHOLD: number = 85;
  private readonly SHOW_FLOATING_INFO_THRESHOLD: number = 120;
  public constructor(props: Props) {
    super(props);
    this.state = {
      activeModalName: null,
      historicalPriceChartDates: [],
      historicalPriceChartValues: [],
      marketValue: 0,
      xirr: 0,
      inventoryHistogram: null,
      touchStartX: 0,
      touchStartY: 0,
      touchDiffX: 0,
      switchDirection: null,
      isScrollingHorizontally: false,
      isScrollingVertically: false,
      hasVibrated: false,
      activeMaterialFact: null,
      didStockInfoFail: false,
      isPageSwitching: false,
    };
    this.mainRef = React.createRef();
  }

  public async componentDidMount(): Promise<void> {
    if (this.listName !== null && this.mainRef.current) {
      // Do not write this using React inline event handling
      this.mainRef.current.addEventListener("touchstart", this.handleTouchStart, true);
      this.mainRef.current.addEventListener("touchmove", this.handleTouchMove, true);
      this.mainRef.current.addEventListener("touchend", this.handleTouchEnd, true);
    }
    await this.loadStockDetail(this.sid);
  }

  private async loadStockDetail(sid: string): Promise<void> {
    const inventoryHistogramPrices = await this.calcInventoryHistogramChartData(sid);
    if (sid !== this.sid) return;
    this.setState({
      inventoryHistogram: <InventoryHistogram prices={inventoryHistogramPrices} />,
      activeMaterialFact: null,
    });
    this.props
      .dispatch(fetchSingleStockInfo(sid))
      .unwrap()
      .then(() => {
        if (sid !== this.sid) return;
        this.setState({ didStockInfoFail: false });
        this.setState(
          (state, props) => {
            return {
              marketValue: calculateMarketValue(
                props.sidStockInfoMap[sid],
                props.stockWarehouse[sid] || [],
              ),
            };
          },
          () => {
            this.setState({ xirr: this.calcXIRR() });
          },
        );
      })
      .catch(() => {
        if (sid === this.sid) this.setState({ didStockInfoFail: true });
      });
    this.props
      .dispatch(fetchSingleStockHistoricalPrices({ sid, frequency: "DAILY" }))
      .unwrap()
      .then(() => {
        if (sid !== this.sid) return;
        const chartData = this.getHistoricalPriceChartData(sid);
        this.setState({
          historicalPriceChartDates: chartData.dates,
          historicalPriceChartValues: chartData.values,
        });
      });
    this.props.dispatch(fetchCompanyInfo(sid));

    this.startFetchStockInfoTimer(sid);
  }

  private startFetchStockInfoTimer(sid: string): void {
    if (this.fetchStockInfoTimer) {
      clearInterval(this.fetchStockInfoTimer);
      this.fetchStockInfoTimer = null;
    }
    this.fetchStockInfoTimer = setInterval(() => {
      this.props
        .dispatch(fetchSingleStockInfo(sid))
        .unwrap()
        .then(() => {
          if (sid === this.sid) this.setState({ didStockInfoFail: false });
        })
        .catch(() => {
          if (sid === this.sid) this.setState({ didStockInfoFail: true });
        });
    }, this.props.subscription.market_refresh_interval_seconds * 1000);
  }

  public async componentDidUpdate(prevProps: Readonly<Props>): Promise<void> {
    if (prevProps.isWaitingTradeRecord !== this.props.isWaitingTradeRecord) {
      this.setState({
        inventoryHistogram: (
          <InventoryHistogram prices={await this.calcInventoryHistogramChartData()} />
        ),
        xirr: this.calcXIRR(),
      });
    }
    if (prevProps.router.params.sid !== this.props.router.params.sid) {
      if (this.fetchStockInfoTimer) {
        clearInterval(this.fetchStockInfoTimer);
        this.fetchStockInfoTimer = null;
      }
      this.setState(
        {
          activeMaterialFact: null,
          didStockInfoFail: false,
          historicalPriceChartDates: [],
          historicalPriceChartValues: [],
          inventoryHistogram: null,
          marketValue: 0,
          xirr: 0,
        },
        () => {
          void this.loadStockDetail(this.sid);
        },
      );
      return;
    }
    if (
      prevProps.stockWarehouse !== this.props.stockWarehouse ||
      prevProps.sidStockInfoMap !== this.props.sidStockInfoMap
    ) {
      this.setState(
        (state, props) => {
          return {
            marketValue: calculateMarketValue(
              props.sidStockInfoMap[this.sid],
              props.stockWarehouse[this.sid] || [],
            ),
          };
        },
        () => this.setState({ xirr: this.calcXIRR() }),
      );
    }
    if (
      prevProps.sidHistoricalPricesMap[this.sid] !==
      this.props.sidHistoricalPricesMap[this.sid]
    ) {
      const chartData = this.getHistoricalPriceChartData();
      this.setState({
        historicalPriceChartDates: chartData.dates,
        historicalPriceChartValues: chartData.values,
      });
    }
  }

  public componentWillUnmount(): void {
    if (this.listName !== null && this.mainRef.current) {
      this.mainRef.current.removeEventListener("touchstart", this.handleTouchStart);
      this.mainRef.current.removeEventListener("touchmove", this.handleTouchMove);
      this.mainRef.current.removeEventListener("touchend", this.handleTouchEnd);
    }
    if (this.fetchStockInfoTimer) {
      clearInterval(this.fetchStockInfoTimer);
      this.fetchStockInfoTimer = null;
    }
    if (this.pageSwitchTimer) {
      clearTimeout(this.pageSwitchTimer);
      this.pageSwitchTimer = null;
    }
  }

  public render(): React.ReactNode {
    const stockInfo = this.props.sidStockInfoMap[this.sid];
    return (
      <>
        {this.activeModal}
        <div
          className={`${styles.main} ${
            this.state.isPageSwitching ? styles.is_switching : ""
          }`}
          ref={this.mainRef}
        >
          {Util.isMobile && (
            <div
              className={`${styles.mobile_back_button_container} ${
                this.props.mainScrollTop > this.SHOW_FLOATING_INFO_THRESHOLD
                  ? styles.scrolled
                  : ""
              }`}
            >
              <RoundButton
                onClick={() => this.props.router.navigate(-1)}
                className="p-12"
                hint_text="回列表"
                aria-label="回列表"
              >
                <IconChevronLeft sideLength="16" />
              </RoundButton>
            </div>
          )}
          {Util.isMobile && (
            <button
              type="button"
              className={`${styles.mobile_favorite_button} ${
                this.props.mainScrollTop > this.SHOW_FLOATING_INFO_THRESHOLD
                  ? styles.scrolled
                  : ""
              } ${this.isFavorite ? styles.active : ""}`}
              onClick={this.changeFavStatus}
              aria-label={this.isFavorite ? "取消關注" : "加入關注"}
            >
              {this.isFavorite ? (
                <IconHeartFill sideLength="20" />
              ) : (
                <IconHeart sideLength="20" />
              )}
            </button>
          )}
          {Util.isMobile && this.sid in this.props.sidStockInfoMap && (
            <div
              className={`${styles.stock_brief_info_container} ${
                this.props.mainScrollTop > this.SHOW_FLOATING_INFO_THRESHOLD
                  ? styles.show
                  : ""
              }`}
              onClick={this.handleScrollToTop}
              role="button"
              tabIndex={0}
            >
              <div className={styles.company_name}>
                {this.props.sidStockInfoMap[this.sid].name}
              </div>
              <div className={styles.sid}>{this.sid}</div>
            </div>
          )}
          {this.state.didStockInfoFail && (
            <div className={styles.inline_notice}>
              <span>資料暫時無法更新，畫面顯示的是最近一次取得的資訊。</span>
              <button type="button" onClick={this.retryFetchStockInfo}>
                重試
              </button>
            </div>
          )}
          <section className={`${styles.block} ${styles.hero_block}`}>
            <div className={styles.hero_toolbar}>
              {!Util.isMobile && (
                <RoundButton
                  onClick={() => this.props.router.navigate(-1)}
                  className={styles.toolbar_button}
                  hint_text="回列表"
                  aria-label="回列表"
                >
                  <IconChevronLeft sideLength="17" />
                </RoundButton>
              )}
              <div className={styles.toolbar_spacer} />
              {!Util.isMobile && (
                <button
                  type="button"
                  className={`${styles.icon_button} ${
                    this.isFavorite ? styles.active : ""
                  }`}
                  onClick={this.changeFavStatus}
                  aria-label={this.isFavorite ? "取消關注" : "加入關注"}
                >
                  {this.isFavorite ? (
                    <IconHeartFill sideLength="18" />
                  ) : (
                    <IconHeart sideLength="18" />
                  )}
                </button>
              )}
              {!Util.isMobile && (
                <>
                  <button
                    type="button"
                    className={styles.icon_button}
                    aria-label="公司資訊"
                    onClick={() => {
                      this.setState({ activeModalName: "companyInfo" });
                    }}
                  >
                    <IconBriefcase sideLength="18" />
                  </button>
                  <button
                    type="button"
                    className={styles.icon_button}
                    aria-label="編輯備註"
                    onClick={() => {
                      this.setState({ activeModalName: "updateOrCreateNote" });
                    }}
                  >
                    <IconMemo sideLength="18" />
                  </button>
                </>
              )}
            </div>
            <div className={styles.stock_info}>
              <div className={styles.stock_heading}>
                <h1 className={styles.company_name}>{stockInfo?.name || this.sid}</h1>
                <div className={styles.sid}>{this.sid}</div>
              </div>
              <div className={`${styles.price} ${!stockInfo ? styles.skeleton : ""}`}>
                {stockInfo ? (
                  <>
                    <DollarSign />
                    {stockInfo.close}
                  </>
                ) : (
                  " "
                )}
              </div>
              <div className={styles.price_meta}>
                <span className={this.fluctPriceClass}>{this.fluctPriceString}</span>
                <span className={styles.trade_quantity}>
                  成交 {this.tradeVolumeText} 張
                </span>
              </div>
              {Util.isMobile && (
                <div className={styles.mobile_text_actions}>
                  <button
                    type="button"
                    onClick={() => this.setState({ activeModalName: "companyInfo" })}
                    aria-label="公司資訊"
                  >
                    <IconBriefcase sideLength="16" />
                    公司資訊
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      this.setState({ activeModalName: "updateOrCreateNote" })
                    }
                    aria-label="編輯備註"
                  >
                    <IconMemo sideLength="16" />
                    備註
                  </button>
                </div>
              )}
            </div>
            <div
              className={`${styles.historical_price_chart_container} ${
                this.props.isWaitingHistoricalPrices ? styles.is_waiting : ""
              }`}
              aria-label="近 60 日收盤價走勢"
            >
              {this.showHistoricalPriceEmptyState ? (
                <div className={styles.empty_chart}>
                  <div>目前沒有歷史價格資料</div>
                  <span>稍後更新後會顯示走勢圖。</span>
                </div>
              ) : (
                <HistoricalPriceLineChart
                  dates={this.state.historicalPriceChartDates}
                  values={this.state.historicalPriceChartValues}
                  isWaiting={this.props.isWaitingHistoricalPrices}
                />
              )}
            </div>
          </section>
          <section className={`${styles.block} ${styles.summary_block}`}>
            <div className={styles.section_title}>投資摘要</div>
            <div className={styles.investment_info}>
              {this.summaryRows.map((row) => (
                <div className={styles.summary_row} key={row.label}>
                  <span className={styles.upper}>{row.label}</span>
                  <span
                    className={`${styles.lower} ${row.tone ? styles[row.tone] : ""}`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
          {this.hasInventory && (
            <section className={`${styles.block} ${styles.inventory_block}`}>
              <div className={styles.section_header}>
                <div className={styles.section_title}>庫存分佈</div>
                <div className={styles.section_hint}>依買進成本分布</div>
              </div>
              <div className={styles.inventory_histogram_container}>
                {this.state.inventoryHistogram}
              </div>
            </section>
          )}
          <section className={`${styles.block} ${styles.action_block}`}>
            <div className={styles.section_title}>紀錄與計畫</div>
            <div className={styles.action_list}>
              <Link
                to={`${Env.frontendRootPath}records?sid=${this.sid}`}
                className={styles.action_button}
              >
                <IconClockHistory sideLength="20" color="#444" />
                <span>查看交易紀錄</span>
                {this.tradeRecordCount === 0 && <em>尚無紀錄</em>}
              </Link>
              <Link
                to={`${Env.frontendRootPath}plans?sid=${this.sid}`}
                className={styles.action_button}
              >
                <IconThumbtack sideLength="20" color="#444" />
                <span>查看買賣計畫</span>
                {this.tradePlanCount > 0 && <em>{this.tradePlanCount} 個計畫</em>}
              </Link>
            </div>
          </section>
          <section className={`${styles.block} ${styles.company_block}`}>
            <div className={styles.section_header}>
              <div className={styles.section_title}>公司與重大消息</div>
              <button
                type="button"
                className={styles.text_button}
                onClick={() => this.setState({ activeModalName: "companyInfo" })}
              >
                完整資料
              </button>
            </div>
            <div className={styles.company_summary}>
              {this.companyInfo?.business || "目前沒有公司業務摘要。"}
            </div>
            <div className={styles.material_fact_preview_list}>
              {this.recentMaterialFacts.length > 0 ? (
                this.recentMaterialFacts.map((materialFact, idx) => (
                  <button
                    type="button"
                    className={styles.material_fact_preview}
                    key={`${materialFact.date_time}-${idx}`}
                    onClick={() =>
                      this.setState({
                        activeModalName: "companyInfo",
                        activeMaterialFact: materialFact,
                      })
                    }
                  >
                    <span>
                      {new Date(Date.parse(materialFact.date_time)).toLocaleDateString(
                        "af",
                      )}
                    </span>
                    <strong>{materialFact.title}</strong>
                    <IconChevronRight sideLength="14" />
                  </button>
                ))
              ) : (
                <div className={styles.empty_company_message}>目前沒有重大消息</div>
              )}
            </div>
          </section>
          {Util.isMobile ? (
            <>
              <SpeedDial defaultSid={this.sid} />
              <div
                className={`${styles.switch_hint_icon_for_mobile} ${styles.left} ${
                  this.state.switchDirection === "prev" ? styles.active : ""
                }`}
              />
              <div
                className={`${styles.switch_hint_icon_for_mobile} ${styles.right} ${
                  this.state.switchDirection === "next" ? styles.active : ""
                }`}
              />
            </>
          ) : (
            <>
              <div
                className={`${styles.switch_hint_icon_container_for_desktop} ${styles.left}`}
              >
                <div
                  className={`${styles.switch_hint_icon} ${styles.left} ${
                    this.state.switchDirection === "prev" ? styles.active : ""
                  }`}
                  onClick={this.handleClickPrevButton}
                />
              </div>
              <div
                className={`${styles.switch_hint_icon_container_for_desktop} ${styles.right}`}
              >
                <div
                  className={`${styles.switch_hint_icon} ${styles.right} ${
                    this.state.switchDirection === "next" ? styles.active : ""
                  }`}
                  onClick={this.handleClickNextButton}
                />
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  private get activeModal(): React.ReactElement<typeof Modal> | null {
    if (this.state.activeModalName === "updateOrCreateNote") {
      return (
        <StockMemoEditor
          sid={this.sid}
          defaultValue={this.props.sidCompanyInfoMap[this.sid]?.note || ""}
          hideModal={Util.getHideModalCallback(this)}
        />
      );
    } else if (this.state.activeModalName === "companyInfo") {
      return Util.isMobile ? (
        <BottomSheet
          onClickBackground={() =>
            this.setState({ activeModalName: null, activeMaterialFact: null })
          }
          canMaximize
        >
          {this.companyInfoSection}
        </BottomSheet>
      ) : (
        <Modal
          title="公司資訊"
          discardButtonProps={{
            children: "", // no use
            className: "transparent xs", // no use
            onClick: () =>
              this.setState({ activeModalName: null, activeMaterialFact: null }),
          }}
          layout="auto"
          noFooter
        >
          {this.companyInfoSection}
        </Modal>
      );
    }
    return null;
  }

  private get sid(): string {
    return this.props.router.params.sid ?? "";
  }

  private get listName(): string | null {
    const pathList = this.props.router.location.pathname.split("/");
    return pathList.length < 4 ? null : pathList[2];
  }

  private get fluctPriceClass(): string {
    const fluct_price = this.props.sidStockInfoMap[this.sid]?.fluct_price || 0;
    return `${styles.price_fluctuation} ${
      fluct_price > 0 ? styles.red : fluct_price < 0 ? styles.green : styles.gray
    }`;
  }

  private get fluctPriceString(): string {
    const fluct_price = this.props.sidStockInfoMap[this.sid]?.fluct_price || 0;
    return `${fluct_price > 0 ? "▲" : fluct_price < 0 ? "▼" : "-"}${
      fluct_price !== 0 ? Math.abs(fluct_price) : ""
    }${
      fluct_price !== 0
        ? ` (${(
            Math.abs(
              fluct_price / (this.props.sidStockInfoMap[this.sid].close - fluct_price),
            ) * 100
          ).toFixed(2)}%)`
        : ""
    }`;
  }

  private get tradeVolumeText(): string {
    return Math.round(
      (this.props.sidStockInfoMap[this.sid]?.quantity || 0) / 1000,
    ).toLocaleString();
  }

  private get averageCostText(): React.ReactNode {
    if (!this.hasInventory) return "-";
    return (
      <>
        <DollarSign />
        {(
          (this.props.sidCashInvestedMap[this.sid] || 0) /
          this.props.stockWarehouse[this.sid].length
        ).toFixed(2)}
      </>
    );
  }

  private get summaryRows(): {
    label: string;
    value: React.ReactNode;
    tone?: "red" | "green" | "gray";
  }[] {
    return [
      {
        label: "現金投入",
        value: (
          <>
            <DollarSign />
            {Math.round(this.props.sidCashInvestedMap[this.sid] || 0).toLocaleString()}
          </>
        ),
      },
      {
        label: "證券市值",
        value: (
          <>
            <DollarSign />
            {Math.round(this.state.marketValue)?.toLocaleString()}
          </>
        ),
      },
      {
        label: "庫存",
        value: `${(this.props.stockWarehouse[this.sid] || []).length.toLocaleString()} 股`,
      },
      { label: "平均成本", value: this.averageCostText },
      {
        label: "實現損益",
        value: (
          <>
            <DollarSign />
            {Math.round(this.finalGain).toLocaleString()}
          </>
        ),
        tone: this.finalGain > 0 ? "red" : this.finalGain < 0 ? "green" : "gray",
      },
      {
        label: "年化報酬率",
        value: (
          <>
            {(this.state.xirr * 100).toFixed(2)}
            <PercentSign />
          </>
        ),
        tone: this.state.xirr > 0 ? "red" : this.state.xirr < 0 ? "green" : "gray",
      },
    ];
  }

  private get tradeRecordCount(): number {
    return (this.props.sidTradeRecordsMap[this.sid] || []).length;
  }

  private get tradePlanCount(): number {
    return this.props.tradePlans.filter((plan) => plan.sid === this.sid).length;
  }

  private get companyInfo() {
    return this.props.sidCompanyInfoMap[this.sid];
  }

  private get recentMaterialFacts(): MaterialFact[] {
    return [...(this.companyInfo?.material_facts || [])]
      .sort((a, b) => Date.parse(b.date_time) - Date.parse(a.date_time))
      .slice(0, 3);
  }

  private get showHistoricalPriceEmptyState(): boolean {
    return (
      !this.props.isWaitingHistoricalPrices &&
      this.sid in this.props.sidHistoricalPricesMap &&
      this.state.historicalPriceChartDates.length === 0
    );
  }

  private getHistoricalPriceChartData(sid = this.sid): {
    dates: string[];
    values: number[];
  } {
    const dates: string[] = [];
    const values: number[] = [];
    if (sid in this.props.sidHistoricalPricesMap) {
      const data = this.props.sidHistoricalPricesMap[sid].daily;
      if (data) {
        const entries = Object.entries(data);
        entries.sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));
        for (const [date, price] of entries) {
          const formattedDate = date.split("-").slice(1).join("/");
          dates.push(formattedDate);
          values.push(price);
        }
      }
    }
    return { dates, values };
  }

  private get hasInventory(): boolean {
    return Boolean(this.props.stockWarehouse[this.sid]?.length);
  }

  private async calcInventoryHistogramChartData(sid = this.sid): Promise<number[]> {
    const worker = new Worker(
      new URL("../../../workers/histogramChartWorker.ts", import.meta.url),
    );
    worker.postMessage(this.props.sidTradeRecordsMap[sid] || []);
    return await new Promise<number[]>((resolve) => {
      worker.onmessage = (event) => {
        worker.terminate();
        resolve(event.data);
      };
    });
  }

  private calcXIRR(): number {
    return Util.calculateXIRR(
      this.props.sidTradeRecordsMap[this.sid] || [],
      [],
      this.props.cashDividendRecords.filter((record) => record.sid === this.sid),
      this.state.marketValue,
    );
  }

  private get finalGain(): number {
    return (
      (this.props.sidGainMap[this.sid] || 0) +
      (this.props.sidTotalCashDividendMap[this.sid] || 0)
    );
  }

  private handleTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    this.setState({ touchStartX: touch.clientX, touchStartY: touch.clientY });
  };

  private handleTouchMove = (e: TouchEvent): void => {
    const touch = e.changedTouches[0];
    if (!this.state.isScrollingVertically && !this.state.isScrollingHorizontally) {
      this.setState((state) => {
        if (Math.abs(touch.clientY - state.touchStartY) > this.SCROLLING_THRESHOLD) {
          return { isScrollingVertically: true } as State;
        } else if (
          Math.abs(touch.clientX - state.touchStartX) > this.SCROLLING_THRESHOLD
        ) {
          return { isScrollingHorizontally: true } as State;
        }
      });
    } else {
      if (!this.state.isScrollingHorizontally) return;
      this.setState((state) => {
        return { touchDiffX: touch.clientX - state.touchStartX };
      });
      if (this.state.touchDiffX <= -this.SWITCHING_THRESHOLD) {
        this.setState((state) => {
          if (!state.hasVibrated) {
            // if (navigator.vibrate) navigator.vibrate(20);
            return { hasVibrated: true, switchDirection: "next" };
          }
          return { switchDirection: "next" } as State;
        });
      } else if (this.state.touchDiffX >= this.SWITCHING_THRESHOLD) {
        this.setState((state) => {
          if (!state.hasVibrated) {
            // if (navigator.vibrate) navigator.vibrate(20);
            return { hasVibrated: true, switchDirection: "prev" };
          }
          return { switchDirection: "prev" } as State;
        });
      } else this.setState({ switchDirection: null });
    }
  };

  private handleTouchEnd = (): void => {
    if (this.state.switchDirection === "next") this.goToNextOne();
    else if (this.state.switchDirection === "prev") this.goToPrevOne();
    this.setState({
      touchStartX: 0,
      touchStartY: 0,
      touchDiffX: 0,
      switchDirection: null,
      isScrollingHorizontally: false,
      isScrollingVertically: false,
      hasVibrated: false,
    });
  };

  private handleClickPrevButton = (): void => {
    this.goToPrevOne();
  };

  private handleClickNextButton = (): void => {
    this.goToNextOne();
  };

  private handleScrollToTop = (): void => {
    let element: HTMLElement | null = this.mainRef.current;
    while (element?.parentElement) {
      element = element.parentElement;
      if (element.scrollHeight > element.clientHeight) {
        element.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  private retryFetchStockInfo = (): void => {
    this.props
      .dispatch(fetchSingleStockInfo(this.sid))
      .unwrap()
      .then(() => this.setState({ didStockInfoFail: false }))
      .catch(() => this.setState({ didStockInfoFail: true }));
  };

  private getSwipeSids(): string[] {
    const tab = this.listName;
    if (tab !== "holding" && tab !== "favorites") return [];

    const context = {
      tab: tab as MarketTab,
      searchText: this.props.marketSearchText,
      sortKey: this.props.marketSortKey,
      stockWarehouse: this.props.stockWarehouse,
      favorites: this.props.favorites,
      sidStockInfoMap: this.props.sidStockInfoMap,
      sidTradeRecordsMap: this.props.sidTradeRecordsMap,
      cashDividendRecords: this.props.cashDividendRecords,
    };
    const visibleSids = getVisibleMarketSids(context);
    if (visibleSids.includes(this.sid)) return visibleSids;
    return getVisibleMarketSids({ ...context, searchText: "" });
  }

  private goToPrevOne(): void {
    const sids = this.getSwipeSids();
    const prevIndex = sids.findIndex((e) => e === this.sid) - 1;
    if (prevIndex < 0) return;
    // if (navigator.vibrate) navigator.vibrate(10);
    this.switchToSid(
      this.props.router.location.pathname
        .replace(/\/+$/, "")
        .replace(/\/[^/]+$/, `/${sids[prevIndex]}`),
    );
  }

  private goToNextOne(): void {
    const sids = this.getSwipeSids();
    const nextIndex = sids.findIndex((e) => e === this.sid) + 1;
    if (nextIndex >= sids.length) return;
    // if (navigator.vibrate) navigator.vibrate(10);
    this.switchToSid(
      this.props.router.location.pathname
        .replace(/\/+$/, "")
        .replace(/\/[^/]+$/, `/${sids[nextIndex]}`),
    );
  }

  private switchToSid(path: string): void {
    if (this.pageSwitchTimer) {
      clearTimeout(this.pageSwitchTimer);
      this.pageSwitchTimer = null;
    }
    this.setState({ isPageSwitching: true });
    this.props.router.navigate(path, { replace: true });
    this.pageSwitchTimer = setTimeout(() => {
      this.setState({ isPageSwitching: false });
      this.pageSwitchTimer = null;
    }, 220);
  }

  private get isFavorite(): boolean {
    return this.props.favorites.includes(this.sid);
  }

  private changeFavStatus = (): void => {
    if (this.isFavorite) {
      this.props.dispatch(fakeRemoveFromFavorites(this.sid));
      this.props
        .dispatch(removeFromFavorites(this.sid))
        .unwrap()
        .catch(() => {
          this.props.dispatch(fakeAddToFavorites(this.sid));
          this.props.dispatch(
            pushToast({ type: "error", text: "收藏更新失敗，請稍後再試" }),
          );
        });
    } else {
      this.props.dispatch(fakeAddToFavorites(this.sid));
      this.props
        .dispatch(addToFavorites(this.sid))
        .unwrap()
        .catch(() => {
          this.props.dispatch(fakeRemoveFromFavorites(this.sid));
          this.props.dispatch(
            pushToast({ type: "error", text: "收藏更新失敗，請稍後再試" }),
          );
        });
    }
  };

  private get companyInfoSection(): React.ReactNode {
    return this.state.activeMaterialFact ? (
      <>
        <RoundButton
          className="p-12"
          onClick={() => this.setState({ activeMaterialFact: null })}
        >
          <IconChevronLeft />
        </RoundButton>
        <div
          className={`${styles.material_fact_outer} ${
            Util.isMobile ? styles.mobile : ""
          }`}
        >
          <div className={styles.title}>{this.state.activeMaterialFact.title}</div>
          <div className={styles.date_time}>
            {new Date(
              Date.parse(this.state.activeMaterialFact.date_time),
            ).toLocaleString("af")}
          </div>
          <div className={styles.description}>
            {this.state.activeMaterialFact.description.split("\n").map((line, idx) => {
              return <div key={idx}>{line}</div>;
            })}
          </div>
        </div>
      </>
    ) : (
      <div
        className={`${styles.company_info_outer} ${Util.isMobile ? styles.mobile : ""}`}
      >
        <div className={styles.title}>證券代號</div>
        <div className={styles.content}>{this.sid}</div>
        <div className={styles.title}>公司簡稱</div>
        <div className={styles.content}>
          {this.props.sidStockInfoMap[this.sid]?.name || "-"}
        </div>
        <div className={styles.title}>主要經營業務</div>
        <div className={styles.content}>
          {this.props.sidCompanyInfoMap[this.sid]?.business || "-"}
        </div>
        <div className={styles.title}>重大消息</div>
        {this.props.sidCompanyInfoMap[this.sid]?.material_facts.length > 0 ? (
          <div className={styles.material_fact_list}>
            {this.props.sidCompanyInfoMap[this.sid]?.material_facts.map((m, idx) => {
              return (
                <div className={styles.brief_material_fact} key={idx}>
                  <div className={styles.left}>
                    <div className={styles.title}>{m.title}</div>
                    <div className={styles.date}>
                      {new Date(Date.parse(m.date_time)).toLocaleDateString("af")}
                    </div>
                  </div>
                  <div className={styles.right}>
                    <RoundButton
                      className="p-12"
                      onClick={() => this.setState({ activeMaterialFact: m })}
                    >
                      <IconChevronRight />
                    </RoundButton>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.content}>無重大消息</div>
        )}
      </div>
    );
  }
}

export default connect(mapStateToProps)(withRouter(Details));
