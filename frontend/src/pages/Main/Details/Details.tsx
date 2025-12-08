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
  StockMemoModal,
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
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import { MaterialFact } from "../../../types";
import Env from "../../../utils/env";
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
  const { sidTotalCashDividendMap } = rootState.cashDividend;
  const { sidHistoricalPricesMap, isWaitingHistoricalPrices } = rootState.stockInfo;
  const { sidCompanyInfoMap, favorites } = rootState.memo;
  const { scrollTop } = rootState.mainPage;
  return {
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
    isWaitingHistoricalPrices,
    isWaitingTradeRecord,
    mainScrollTop: scrollTop,
  };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  activeModalName: "companyInfo" | "updateOrCreateNote" | null;
  historicalPriceChartData: (Date | string | number)[][];
  marketValue: number;
  rateOfReturn: number;
  inventoryHistogram: React.ReactElement | null;
  touchStartX: number;
  touchStartY: number;
  touchDiffX: number;
  switchDirection: "prev" | "next" | null;
  isScrollingHorizontally: boolean;
  isScrollingVertically: boolean;
  hasVibrated: boolean;
  activeMaterialFact: MaterialFact | null;
}

class Details extends React.Component<Props, State> {
  public state: State;
  private mainRef: React.RefObject<HTMLDivElement>;
  private fetchStockInfoTimer: ReturnType<typeof setInterval> | null = null;
  private readonly SCROLLING_THRESHOLD: number = 10;
  private readonly SWITCHING_THRESHOLD: number = 85;
  private readonly SHOW_FLOATING_INFO_THRESHOLD: number = 120;
  public constructor(props: Props) {
    super(props);
    this.state = {
      activeModalName: null,
      historicalPriceChartData: [],
      marketValue: 0,
      rateOfReturn: 0,
      inventoryHistogram: null,
      touchStartX: 0,
      touchStartY: 0,
      touchDiffX: 0,
      switchDirection: null,
      isScrollingHorizontally: false,
      isScrollingVertically: false,
      hasVibrated: false,
      activeMaterialFact: null,
    };
    this.mainRef = React.createRef();
  }
  public async componentDidMount(): Promise<void> {
    if (this.listName !== null) {
      // Do not write this using React inline event handling
      this.mainRef.current!.addEventListener("touchstart", this.handleTouchStart, true);
      this.mainRef.current!.addEventListener("touchmove", this.handleTouchMove, true);
      this.mainRef.current!.addEventListener("touchend", this.handleTouchEnd, true);
    }
    this.setState({
      inventoryHistogram: (
        <InventoryHistogram data={await this.calcInventoryHistogramChartData()} />
      ),
      activeMaterialFact: null,
    });
    this.props
      .dispatch(fetchSingleStockInfo(this.sid))
      .unwrap()
      .then(() => {
        this.setState(
          (state, props) => {
            return {
              marketValue: calculateMarketValue(
                props.sidStockInfoMap[this.sid],
                props.stockWarehouse[this.sid] || [],
              ),
            };
          },
          () => {
            this.setState({ rateOfReturn: this.calcRateOfReturn() });
          },
        );
      });
    this.props
      .dispatch(fetchSingleStockHistoricalPrices({ sid: this.sid, frequency: "DAILY" }))
      .unwrap()
      .then(() => {
        this.setState({ historicalPriceChartData: this.getHistoricalPriceChartData() });
      });
    this.props.dispatch(fetchCompanyInfo(this.sid));

    this.fetchStockInfoTimer = setInterval(() => {
      this.props.dispatch(fetchSingleStockInfo(this.sid)).unwrap();
    }, 15000);
  }
  public async componentDidUpdate(prevProps: Readonly<Props>): Promise<void> {
    if (prevProps.isWaitingTradeRecord !== this.props.isWaitingTradeRecord) {
      this.setState({
        inventoryHistogram: (
          <InventoryHistogram data={await this.calcInventoryHistogramChartData()} />
        ),
        rateOfReturn: this.calcRateOfReturn(),
      });
    }
    if (prevProps.router.params.sid !== this.props.router.params.sid) {
      if (this.fetchStockInfoTimer) {
        clearInterval(this.fetchStockInfoTimer);
        this.fetchStockInfoTimer = null;
      }
      this.componentDidMount();
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
        () => this.setState({ rateOfReturn: this.calcRateOfReturn() }),
      );
    }
    if (
      prevProps.sidHistoricalPricesMap[this.sid] !==
      this.props.sidHistoricalPricesMap[this.sid]
    ) {
      this.setState({ historicalPriceChartData: this.getHistoricalPriceChartData() });
    }
  }
  public componentWillUnmount(): void {
    if (this.listName !== null) {
      this.mainRef.current!.removeEventListener("touchstart", this.handleTouchStart);
      this.mainRef.current!.removeEventListener("touchmove", this.handleTouchMove);
      this.mainRef.current!.removeEventListener("touchend", this.handleTouchEnd);
    }

    if (this.fetchStockInfoTimer) {
      clearInterval(this.fetchStockInfoTimer);
      this.fetchStockInfoTimer = null;
    }
  }
  public render(): React.ReactNode {
    return (
      <>
        {this.activeModal}
        <div className={styles.main} ref={this.mainRef}>
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
              >
                <IconChevronLeft sideLength="16" />
              </RoundButton>
            </div>
          )}
          {Util.isMobile && this.sid in this.props.sidStockInfoMap && (
            <div
              className={`${styles.stock_brief_info_container} ${
                this.props.mainScrollTop > this.SHOW_FLOATING_INFO_THRESHOLD
                  ? styles.show
                  : ""
              }`}
              onClick={this.handleScrollToTop}
            >
              <div className={styles.company_name}>
                {this.props.sidStockInfoMap[this.sid].name}
              </div>
              <div className={styles.sid}>{this.sid}</div>
            </div>
          )}
          <div className={styles.block}>
            {!Util.isMobile && (
              <div className={styles.desktop_back_button_container}>
                <RoundButton
                  onClick={() => this.props.router.navigate(-1)}
                  className="p-12"
                  hint_text="回列表"
                >
                  <IconChevronLeft sideLength="16" />
                </RoundButton>
              </div>
            )}
            <div className={styles.add_to_fav}>
              <div className={styles.add_to_fav_inner} onClick={this.changeFavStatus}>
                {!this.isFavorite ? (
                  <div className={styles.heart_outer}>
                    <IconHeart sideLength={Util.isMobile ? "20" : "18"} />
                  </div>
                ) : (
                  <div className={styles.heart_fill_outer}>
                    <IconHeartFill sideLength={Util.isMobile ? "20" : "18"} />
                  </div>
                )}
              </div>
            </div>
            <div className={styles.stock_info}>
              <div className={styles.company_name}>
                {this.props.sidStockInfoMap[this.sid]?.name || "-"}
              </div>
              <div className={styles.sid}>{this.sid}</div>
              <div className={styles.price}>
                <DollarSign />
                {this.props.sidStockInfoMap[this.sid]?.close || 0}
              </div>
              <div className={this.fluctPriceClass}>{this.fluctPriceString}</div>
              <div className={styles.trade_quantity}>
                成交{" "}
                {Math.round(
                  (this.props.sidStockInfoMap[this.sid]?.quantity || 0) / 1000,
                ).toLocaleString()}{" "}
                張
              </div>
            </div>
            <div
              className={`${styles.historical_price_chart_container} ${
                this.props.isWaitingHistoricalPrices ||
                this.state.historicalPriceChartData.length <= 1
                  ? styles.is_waiting
                  : ""
              }`}
            >
              <HistoricalPriceLineChart
                data={this.state.historicalPriceChartData}
                isWaiting={
                  this.props.isWaitingHistoricalPrices ||
                  this.state.historicalPriceChartData.length <= 1
                }
              />
            </div>
          </div>
          <div className={styles.block}>
            <div className={styles.investment_info}>
              <div className={styles.cube}>
                <span className={styles.upper}>現金投入</span>
                <span className={styles.lower}>
                  <DollarSign />
                  {Math.round(
                    this.props.sidCashInvestedMap[this.sid] || 0,
                  ).toLocaleString()}
                </span>
              </div>
              <div className={styles.cube}>
                <span className={styles.upper}>證券市值</span>
                <span className={styles.lower}>
                  <DollarSign />
                  {Math.round(this.state.marketValue)?.toLocaleString()}
                </span>
              </div>
              <div className={styles.cube}>
                <span className={styles.upper}>庫存</span>
                <span className={styles.lower}>
                  {(this.props.stockWarehouse[this.sid] || []).length}
                  <span className={styles.text}>股</span>
                </span>
              </div>
              <div className={styles.cube}>
                <span className={styles.upper}>平均成本</span>
                <span className={styles.lower}>
                  <DollarSign />
                  {(this.hasInventory
                    ? (this.props.sidCashInvestedMap[this.sid] || 0) /
                      this.props.stockWarehouse[this.sid].length
                    : 0
                  ).toFixed(2)}
                </span>
              </div>
            </div>
            {this.hasInventory && (
              <>
                <div className={styles.inventory_title}>庫存分佈</div>
                <div className={styles.inventory_histogram_container}>
                  {this.state.inventoryHistogram}
                </div>
              </>
            )}
          </div>
          <div className={styles.block}>
            <div className={styles.performance}>
              <div className={styles.cube}>
                <span className={styles.upper}>實現損益</span>
                <span
                  className={`${styles.lower} ${
                    this.finalGain > 0
                      ? styles.red
                      : this.finalGain < 0
                        ? styles.green
                        : styles.gray
                  }`}
                >
                  <DollarSign />
                  {Math.round(this.finalGain).toLocaleString()}
                </span>
              </div>
              <div className={styles.cube}>
                <span className={styles.upper}>報酬率</span>
                <span
                  className={`${styles.lower} ${
                    this.state.rateOfReturn > 0
                      ? styles.red
                      : this.state.rateOfReturn < 0
                        ? styles.green
                        : styles.gray
                  }`}
                >
                  {this.state.rateOfReturn.toFixed(2)}
                  <PercentSign />
                </span>
              </div>
            </div>
          </div>
          <div className={styles.block}>
            <div className={styles.cube_list}>
              <Link
                to={`${Env.frontendRootPath}records?sid=${this.sid}`}
                className={styles.cube}
              >
                <IconClockHistory sideLength="30" color="#888" />
                交易紀錄
              </Link>
              <Link
                to={`${Env.frontendRootPath}plans?sid=${this.sid}`}
                className={styles.cube}
              >
                <IconThumbtack sideLength="30" color="#888" />
                買賣計畫
              </Link>
              <div
                className={styles.cube}
                onClick={() => {
                  this.setState({ activeModalName: "companyInfo" });
                }}
              >
                <IconBriefcase sideLength="30" color="#888" />
                公司資訊
              </div>
              <div
                className={styles.cube}
                onClick={() => {
                  this.setState({ activeModalName: "updateOrCreateNote" });
                }}
              >
                <IconMemo sideLength="30" color="#888" />
                備註
              </div>
            </div>
          </div>
          <SpeedDial defaultSid={this.sid} />
          {Util.isMobile ? (
            <>
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
        <StockMemoModal
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
    return this.props.router.params.sid!;
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
  private getHistoricalPriceChartData(): (Date | string | number)[][] {
    // Add dummy because we want the price axis to show in the right-hand side.
    const result: (Date | string | number)[][] = [];
    if (this.sid in this.props.sidHistoricalPricesMap) {
      const data = this.props.sidHistoricalPricesMap[this.sid].daily;
      if (data) {
        for (const [date, price] of Object.entries(data)) {
          result.push([date, 0, price]);
        }
      }
    }
    result.sort((a, b) => Date.parse(a[0] as string) - Date.parse(b[0] as string));
    result.forEach(
      (row) => (row[0] = (row[0] as string).split("-").slice(1).join("/")),
    );
    result.splice(0, 0, ["日期", "dummy", "價格"]);
    return result;
  }
  private get hasInventory(): boolean {
    return Boolean(
      this.props.stockWarehouse[this.sid] && this.props.stockWarehouse[this.sid].length,
    );
  }
  private async calcInventoryHistogramChartData(): Promise<(string | number)[][]> {
    const worker = new Worker(
      new URL("../../../workers/histogramChartWorker.ts", import.meta.url),
    );
    worker.postMessage(this.props.sidTradeRecordsMap[this.sid] || []);
    return await new Promise((resolve) => {
      worker.onmessage = (event) => {
        worker.terminate();
        resolve(event.data);
      };
    });
  }
  private calcRateOfReturn(): number {
    return this.props.sidCashInvestedMap[this.sid]
      ? ((this.state.marketValue -
          (this.props.sidCashInvestedMap[this.sid] || 0) +
          this.finalGain -
          (this.props.sidHandlingFeeMap[this.sid] || 0)) /
          this.props.sidCashInvestedMap[this.sid]) *
          100
      : 0;
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
            if (navigator.vibrate) navigator.vibrate(20);
            return { hasVibrated: true, switchDirection: "next" };
          }
          return { switchDirection: "next" } as State;
        });
      } else if (this.state.touchDiffX >= this.SWITCHING_THRESHOLD) {
        this.setState((state) => {
          if (!state.hasVibrated) {
            if (navigator.vibrate) navigator.vibrate(20);
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
    while (element && element.parentElement) {
      element = element.parentElement;
      if (element.scrollHeight > element.clientHeight) {
        element.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  private goToPrevOne(): void {
    const sids =
      this.listName === "holding"
        ? Object.keys(this.props.stockWarehouse)
        : this.props.favorites;
    const prevIndex = sids.findIndex((e) => e === this.sid) - 1;
    if (prevIndex < 0) return;
    if (navigator.vibrate) navigator.vibrate(10);
    this.componentWillUnmount();
    this.props.router.navigate(
      this.props.router.location.pathname
        .replace(/\/+$/, "")
        .replace(/\/[^/]+$/, `/${sids[prevIndex]}`),
      { replace: true },
    );
  }
  private goToNextOne(): void {
    const sids =
      this.listName === "holding"
        ? Object.keys(this.props.stockWarehouse)
        : this.props.favorites;
    const nextIndex = sids.findIndex((e) => e === this.sid) + 1;
    if (nextIndex >= sids.length) return;
    if (navigator.vibrate) navigator.vibrate(10);
    this.componentWillUnmount();
    this.props.router.navigate(
      this.props.router.location.pathname
        .replace(/\/+$/, "")
        .replace(/\/[^/]+$/, `/${sids[nextIndex]}`),
      { replace: true },
    );
  }
  private get isFavorite(): boolean {
    return this.props.favorites.includes(this.sid);
  }
  private changeFavStatus = (): void => {
    if (this.isFavorite) {
      this.props.dispatch(fakeRemoveFromFavorites(this.sid));
      this.props.dispatch(removeFromFavorites(this.sid));
    } else {
      this.props.dispatch(fakeAddToFavorites(this.sid));
      this.props.dispatch(addToFavorites(this.sid));
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
