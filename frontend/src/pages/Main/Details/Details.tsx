import { createSelector } from "@reduxjs/toolkit";
import React, { memo, useLayoutEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  BottomSheet,
  DollarSign,
  HistoricalPriceLineChart,
  InventoryHistogram,
  Modal,
  PercentSign,
  RoundButton,
  ScrollThresholdContainer,
  SegmentedControl,
  Skeleton,
  SkeletonOverlay,
  SpeedDial,
  StockIntradayLineChart,
  StockMemoEditor,
} from "../../../components";
import type { SegmentedControlOption } from "../../../components/SegmentedControl/SegmentedControl";
import {
  buildStockIntradayChartData,
  hasStockIntradayPlottedData,
} from "../../../components/StockIntradayLineChart/stockIntradayChartData";
import { formatStockChange } from "../../../components/stockPriceFormat";
import Tooltip from "../../../components/Tooltip/Tooltip";
import * as Icons from "../../../icons";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  changeStockDetailChartMode,
  type StockDetailChartMode,
} from "../../../redux/slices/MainPageSlice";
import {
  addToFavorites,
  fakeAddToFavorites,
  fakeRemoveFromFavorites,
  fetchCompanyInfo,
  removeFromFavorites,
} from "../../../redux/slices/MemoSlice";
import {
  fetchSingleStockHistoricalPrices,
  fetchSingleStockInfo,
  fetchSingleStockIntradayPrices,
} from "../../../redux/slices/StockInfoSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import type { RootState } from "../../../redux/store";
import { store } from "../../../redux/store";
import { COLORS } from "../../../styles/tokens";
import type { MarketTab, MaterialFact } from "../../../types";
import { formatDateWithWeekday, getTodayDateString } from "../../../utils/date";
import Env from "../../../utils/env";
import {
  calculateMarketValue,
  getVisibleMarketSids,
  makeStockPriceHistory,
} from "../../../utils/market";
import {
  CAN_HOVER_QUERY,
  useIsNarrowLayout,
  useMediaQuery,
} from "../../../utils/mediaQuery";
import { navigateBack } from "../../../utils/router";
import { useLatestRef } from "../../../utils/useLatestRef";
import { useMergedState } from "../../../utils/useMergedState";
import Util from "../../../utils/util";
import styles from "./Details.module.scss";

const CHART_MODE_TO_DAYS: Record<Exclude<StockDetailChartMode, "intraday">, number> = {
  "1M": 30,
  "1Q": 91,
  "1Y": 365,
};

const CHART_MODE_OPTIONS: SegmentedControlOption[] = [
  { label: "今日", value: "intraday" },
  { label: "1M", value: "1M", ariaLabel: "1M，最近 30 天" },
  { label: "1Q", value: "1Q", ariaLabel: "1Q，最近 91 天" },
  { label: "1Y", value: "1Y", ariaLabel: "1Y，最近 365 天" },
];

const selectNavigableSids = createSelector(
  [
    (_state: RootState, tab: MarketTab) => tab,
    (_state: RootState, _tab: MarketTab, searchText: string) => searchText,
    (state: RootState) => state.mainPage.marketSortKey,
    (state: RootState) => state.tradeRecord.stockWarehouse,
    (state: RootState) => state.memo.favorites,
    (state: RootState) => state.stockInfo.sidStockInfoMap,
    (state: RootState) => state.tradeRecord.sidTradeRecordsMap,
    (state: RootState) => state.cashDividend.cashDividendRecords,
    (_state: RootState, _tab: MarketTab, _searchText: string, xirrDate?: string) =>
      xirrDate,
  ],
  (
    tab,
    searchText,
    sortKey,
    stockWarehouse,
    favorites,
    sidStockInfoMap,
    sidTradeRecordsMap,
    cashDividendRecords,
  ) =>
    getVisibleMarketSids({
      tab,
      searchText,
      sortKey,
      stockWarehouse,
      favorites,
      sidStockInfoMap,
      sidTradeRecordsMap,
      cashDividendRecords,
    }),
  { memoizeOptions: { maxSize: 2 } },
);

function getAdjacentStockSid(
  rootState: RootState,
  stockListTab: MarketTab | null,
  sid: string,
  offset: -1 | 1,
): string | undefined {
  if (!stockListTab) return undefined;
  const { marketSearchText, marketSortKey } = rootState.mainPage;
  const xirrDate = marketSortKey === "xirr" ? new Date().toDateString() : undefined;
  let sids = selectNavigableSids(rootState, stockListTab, marketSearchText, xirrDate);
  let index = sids.indexOf(sid);
  if (index < 0 && marketSearchText.trim()) {
    sids = selectNavigableSids(rootState, stockListTab, "", xirrDate);
    index = sids.indexOf(sid);
  }
  return index >= 0 ? sids[index + offset] : undefined;
}

interface DetailsState {
  activeModalName: "companyInfo" | "updateOrCreateNote" | null;
  historicalPriceLineChart: React.ReactElement | null;
  intradayLineChart: React.ReactElement | null;
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
}

const INITIAL_STATE: DetailsState = {
  activeModalName: null,
  historicalPriceLineChart: null,
  intradayLineChart: null,
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
};

const SCROLLING_THRESHOLD = 10;
const SWITCHING_THRESHOLD = 85;

function Details() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNarrowLayout = useIsNarrowLayout();
  const canHover = useMediaQuery(CAN_HOVER_QUERY);
  const sid = params.sid ?? "";
  const [, , routeTab, routeSid] = location.pathname.split("/");
  const stockListTab: MarketTab | null =
    routeSid && (routeTab === "holding" || routeTab === "favorites") ? routeTab : null;
  const previousStockSid = useAppSelector((rootState) =>
    getAdjacentStockSid(rootState, stockListTab, sid, -1),
  );
  const nextStockSid = useAppSelector((rootState) =>
    getAdjacentStockSid(rootState, stockListTab, sid, 1),
  );
  const stockInfo = useAppSelector(
    (rootState) => rootState.stockInfo.sidStockInfoMap[sid],
  );
  const intradayPrices = useAppSelector(
    (rootState) => rootState.stockInfo.sidIntradayPricesMap[sid],
  );
  const historicalPrices = useAppSelector(
    (rootState) => rootState.stockInfo.sidHistoricalPricesMap[sid],
  );
  const isWaitingHistoricalPrices = useAppSelector(
    (rootState) => rootState.stockInfo.isWaitingHistoricalPrices,
  );
  const isWaitingIntradayPrices = useAppSelector(
    (rootState) => rootState.stockInfo.isWaitingIntradayPrices,
  );
  const inventory = useAppSelector(
    (rootState) => rootState.tradeRecord.stockWarehouse[sid],
  );
  const tradeRecords = useAppSelector(
    (rootState) => rootState.tradeRecord.sidTradeRecordsMap[sid],
  );
  const cashInvested = useAppSelector(
    (rootState) => rootState.tradeRecord.sidCashInvestedMap[sid],
  );
  const realizedGain = useAppSelector(
    (rootState) => rootState.tradeRecord.sidGainMap[sid],
  );
  const isWaitingTradeRecord = useAppSelector(
    (rootState) => rootState.tradeRecord.isWaiting,
  );
  const cashDividendRecords = useAppSelector(
    (rootState) => rootState.cashDividend.cashDividendRecords,
  );
  const sidTotalCashDividendMap = useAppSelector(
    (rootState) => rootState.cashDividend.sidTotalCashDividendMap,
  );
  const companyInfo = useAppSelector(
    (rootState) => rootState.memo.sidCompanyInfoMap[sid],
  );
  const favorites = useAppSelector((rootState) => rootState.memo.favorites);
  const tradePlans = useAppSelector((rootState) => rootState.tradePlan.tradePlans);
  const subscription = useAppSelector((rootState) => rootState.account.subscription);
  const stockDetailChartMode = useAppSelector(
    (rootState) => rootState.mainPage.stockDetailChartMode,
  );
  const stockPriceHistory = useMemo(
    () =>
      stockDetailChartMode === "intraday"
        ? null
        : makeStockPriceHistory(
            historicalPrices?.daily,
            CHART_MODE_TO_DAYS[stockDetailChartMode],
            getTodayDateString(),
          ),
    [historicalPrices, stockDetailChartMode],
  );
  const dispatch = useAppDispatch();
  const [state, setState, runAfterCommitCallbacks] =
    useMergedState<DetailsState>(INITIAL_STATE);
  const mainRef = useRef<HTMLDivElement>(null);
  const fetchStockInfoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUnmountedRef = useRef(false);

  const calculateXirr = (): number => {
    const latest = latestRenderRef.current;
    return Util.calculateXIRR(
      latest.tradeRecords ?? [],
      [],
      latest.cashDividendRecords.filter((record) => record.sid === latest.sid),
      latest.state.marketValue,
    );
  };

  const updateMarketValue = (): void => {
    const latest = latestRenderRef.current;
    const marketValue = calculateMarketValue(latest.stockInfo, latest.inventory || []);
    if (marketValue === latest.state.marketValue) return;
    setState({ marketValue }, () =>
      setState({ xirr: latestRenderRef.current.calculateXirr() }),
    );
  };

  const updateIntradayLineChart = (): void => {
    setState(() => {
      const latest = latestRenderRef.current;
      if (latest.stockDetailChartMode !== "intraday") return null;

      const latestIntradayPrices = latest.intradayPrices;
      if (
        !latest.isWaitingIntradayPrices &&
        (latestIntradayPrices === undefined ||
          !hasStockIntradayPlottedData(latestIntradayPrices))
      ) {
        return { intradayLineChart: null };
      }

      const chartData = buildStockIntradayChartData(
        latestIntradayPrices ?? { date: null },
      );
      const prevClosePrice = latestIntradayPrices?.yesterday_price ?? 0;
      if (!chartData.some(([, price]) => price !== null)) {
        return { intradayLineChart: null };
      }

      return {
        intradayLineChart: (
          <StockIntradayLineChart data={chartData} prevClosePrice={prevClosePrice} />
        ),
      };
    });
  };

  const updateHistoricalPriceLineChart = (): void => {
    setState(() => {
      const latest = latestRenderRef.current;
      if (latest.stockPriceHistory === null) return null;

      const { dates, values, previousValues } = latest.stockPriceHistory;
      if (!latest.isWaitingHistoricalPrices && dates.length === 0) {
        return { historicalPriceLineChart: null };
      }

      return {
        historicalPriceLineChart: (
          <HistoricalPriceLineChart
            dates={dates}
            values={values}
            previousValues={previousValues}
            isWaiting={latest.isWaitingHistoricalPrices}
          />
        ),
      };
    });
  };

  const startFetchStockInfoTimer = (timerSid: string): void => {
    if (fetchStockInfoTimerRef.current) {
      clearInterval(fetchStockInfoTimerRef.current);
      fetchStockInfoTimerRef.current = null;
    }
    fetchStockInfoTimerRef.current = setInterval(() => {
      dispatch(fetchSingleStockInfo(timerSid))
        .unwrap()
        .then(() => {
          if (timerSid === latestRenderRef.current.sid)
            setState({ didStockInfoFail: false });
        })
        .catch(() => {
          if (timerSid === latestRenderRef.current.sid)
            setState({ didStockInfoFail: true });
        });
      dispatch(fetchSingleStockIntradayPrices(timerSid));
    }, latestRenderRef.current.subscription.market_refresh_interval_seconds * 1000);
  };

  const loadStockDetail = async (loadedSid: string): Promise<void> => {
    const inventoryHistogramPrices =
      await calculateInventoryHistogramChartData(loadedSid);
    const isStale = (): boolean =>
      isUnmountedRef.current || loadedSid !== latestRenderRef.current.sid;
    if (isStale()) return;
    setState({
      inventoryHistogram: <InventoryHistogram prices={inventoryHistogramPrices} />,
      activeMaterialFact: null,
    });
    dispatch(fetchSingleStockInfo(loadedSid))
      .unwrap()
      .then(() => {
        if (isStale()) return;
        setState({ didStockInfoFail: false });
        latestRenderRef.current.updateMarketValue();
      })
      .catch(() => {
        if (!isStale()) setState({ didStockInfoFail: true });
      });
    dispatch(fetchSingleStockHistoricalPrices({ sid: loadedSid, frequency: "DAILY" }))
      .unwrap()
      .then(() => {
        if (isStale()) return;
        latestRenderRef.current.updateHistoricalPriceLineChart();
      });
    dispatch(fetchSingleStockIntradayPrices(loadedSid))
      .unwrap()
      .then(() => {
        if (isStale()) return;
        latestRenderRef.current.updateIntradayLineChart();
      });
    dispatch(fetchCompanyInfo(loadedSid));
    latestRenderRef.current.startFetchStockInfoTimer(loadedSid);
  };

  const handleTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    setState({ touchStartX: touch.clientX, touchStartY: touch.clientY });
  };

  const handleTouchMove = (e: TouchEvent): void => {
    const touch = e.changedTouches[0];
    const latestState = latestRenderRef.current.state;
    if (!latestState.isScrollingVertically && !latestState.isScrollingHorizontally) {
      setState((previous) => {
        if (Math.abs(touch.clientY - previous.touchStartY) > SCROLLING_THRESHOLD) {
          return { isScrollingVertically: true };
        } else if (
          Math.abs(touch.clientX - previous.touchStartX) > SCROLLING_THRESHOLD
        ) {
          return { isScrollingHorizontally: true };
        }
        return null;
      });
    } else {
      if (!latestState.isScrollingHorizontally) return;
      setState((previous) => ({ touchDiffX: touch.clientX - previous.touchStartX }));
      if (latestState.touchDiffX <= -SWITCHING_THRESHOLD) {
        setState((previous) =>
          previous.hasVibrated
            ? { switchDirection: "next" }
            : { hasVibrated: true, switchDirection: "next" },
        );
      } else if (latestState.touchDiffX >= SWITCHING_THRESHOLD) {
        setState((previous) =>
          previous.hasVibrated
            ? { switchDirection: "prev" }
            : { hasVibrated: true, switchDirection: "prev" },
        );
      } else setState({ switchDirection: null });
    }
  };

  const switchToStock = (targetSid: string | undefined): void => {
    if (!targetSid) return;
    const latest = latestRenderRef.current;
    const path = latest.location.pathname
      .replace(/\/+$/, "")
      .replace(/\/[^/]+$/, `/${targetSid}`);
    latest.navigate(path, { replace: true });
  };

  const handleTouchEnd = (): void => {
    const latest = latestRenderRef.current;
    if (latest.state.switchDirection === "next") switchToStock(latest.nextStockSid);
    else if (latest.state.switchDirection === "prev") {
      switchToStock(latest.previousStockSid);
    }
    setState({
      touchStartX: 0,
      touchStartY: 0,
      touchDiffX: 0,
      switchDirection: null,
      isScrollingHorizontally: false,
      isScrollingVertically: false,
      hasVibrated: false,
    });
  };

  // Timers, request callbacks and the touch listeners, which are set up once, act on
  // the props and state of the latest render.
  const latestRenderRef = useLatestRef({
    sid,
    stockListTab,
    location,
    navigate,
    stockInfo,
    inventory,
    tradeRecords,
    cashDividendRecords,
    intradayPrices,
    isWaitingIntradayPrices,
    historicalPrices,
    isWaitingHistoricalPrices,
    stockDetailChartMode,
    stockPriceHistory,
    subscription,
    previousStockSid,
    nextStockSid,
    state,
    calculateXirr,
    updateMarketValue,
    updateIntradayLineChart,
    updateHistoricalPriceLineChart,
    startFetchStockInfoTimer,
    loadStockDetail,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  });

  useLayoutEffect(() => {
    const latest = latestRenderRef.current;
    const touchTarget = latest.stockListTab ? mainRef.current : null;
    const handleTouchStartEvent = (e: TouchEvent): void =>
      latestRenderRef.current.handleTouchStart(e);
    const handleTouchMoveEvent = (e: TouchEvent): void =>
      latestRenderRef.current.handleTouchMove(e);
    const handleTouchEndEvent = (): void => latestRenderRef.current.handleTouchEnd();
    // Do not write this using React inline event handling
    touchTarget?.addEventListener("touchstart", handleTouchStartEvent, true);
    touchTarget?.addEventListener("touchmove", handleTouchMoveEvent, true);
    touchTarget?.addEventListener("touchend", handleTouchEndEvent, true);
    void latest.loadStockDetail(latest.sid);
    return () => {
      isUnmountedRef.current = true;
      touchTarget?.removeEventListener("touchstart", handleTouchStartEvent, true);
      touchTarget?.removeEventListener("touchmove", handleTouchMoveEvent, true);
      touchTarget?.removeEventListener("touchend", handleTouchEndEvent, true);
      if (fetchStockInfoTimerRef.current) {
        clearInterval(fetchStockInfoTimerRef.current);
        fetchStockInfoTimerRef.current = null;
      }
    };
  }, [latestRenderRef]);

  const lastCommitRef = useRef({
    sid,
    isWaitingTradeRecord,
    tradeRecords,
    stockDetailChartMode,
    inventory,
    stockInfo,
    historicalPrices,
    isWaitingHistoricalPrices,
    intradayPrices,
    isWaitingIntradayPrices,
  });
  useLayoutEffect(() => {
    const previous = lastCommitRef.current;
    lastCommitRef.current = {
      sid,
      isWaitingTradeRecord,
      tradeRecords,
      stockDetailChartMode,
      inventory,
      stockInfo,
      historicalPrices,
      isWaitingHistoricalPrices,
      intradayPrices,
      isWaitingIntradayPrices,
    };

    if (
      previous.isWaitingTradeRecord !== isWaitingTradeRecord ||
      previous.tradeRecords !== tradeRecords
    ) {
      const updateInventoryHistogram = async (): Promise<void> => {
        const prices = await calculateInventoryHistogramChartData(sid);
        setState({
          inventoryHistogram: <InventoryHistogram prices={prices} />,
          xirr: latestRenderRef.current.calculateXirr(),
        });
      };
      void updateInventoryHistogram();
    }
    if (previous.sid !== sid) {
      if (fetchStockInfoTimerRef.current) {
        clearInterval(fetchStockInfoTimerRef.current);
        fetchStockInfoTimerRef.current = null;
      }
      setState(
        {
          activeMaterialFact: null,
          didStockInfoFail: false,
          historicalPriceLineChart: null,
          intradayLineChart: null,
          inventoryHistogram: null,
          marketValue: 0,
          xirr: 0,
        },
        () => {
          const latest = latestRenderRef.current;
          void latest.loadStockDetail(latest.sid);
        },
      );
      return;
    }
    if (previous.stockDetailChartMode !== stockDetailChartMode) {
      if (stockDetailChartMode === "intraday") updateIntradayLineChart();
      else updateHistoricalPriceLineChart();
    }
    if (previous.inventory !== inventory || previous.stockInfo !== stockInfo) {
      updateMarketValue();
    }
    if (
      previous.historicalPrices !== historicalPrices ||
      previous.isWaitingHistoricalPrices !== isWaitingHistoricalPrices
    ) {
      updateHistoricalPriceLineChart();
    }
    if (
      previous.intradayPrices !== intradayPrices ||
      previous.isWaitingIntradayPrices !== isWaitingIntradayPrices
    ) {
      updateIntradayLineChart();
    }
  });

  // A class component runs its setState callbacks after componentDidUpdate, so this
  // effect comes after the ones above.
  useLayoutEffect(runAfterCommitCallbacks);

  const hasInventory = Boolean(inventory?.length);
  const fluctPrice = stockInfo?.fluct_price || 0;
  const fluctPriceClass = `${styles.price_fluctuation} ${
    fluctPrice > 0 ? styles.red : fluctPrice < 0 ? styles.green : styles.gray
  }`;
  const fluctPriceString = formatStockChange(
    fluctPrice,
    (stockInfo?.close ?? 0) - fluctPrice,
  );
  const tradeVolumeText = Math.round(
    (stockInfo?.quantity || 0) / 1000,
  ).toLocaleString();
  const inventoryLength = inventory?.length ?? 0;
  const averageCostText: React.ReactNode =
    !hasInventory || inventoryLength === 0 ? (
      "-"
    ) : (
      <>
        <DollarSign />
        {((cashInvested ?? 0) / inventoryLength).toFixed(2)}
      </>
    );
  const finalGain = (realizedGain ?? 0) + (sidTotalCashDividendMap[sid] || 0);
  const summaryRows: {
    label: string;
    value: React.ReactNode;
    tone?: "red" | "green" | "gray";
  }[] = [
    {
      label: "現金投入",
      value: (
        <>
          <DollarSign />
          {Math.round(cashInvested ?? 0).toLocaleString()}
        </>
      ),
    },
    {
      label: "證券市值",
      value: (
        <>
          <DollarSign />
          {Math.round(state.marketValue)?.toLocaleString()}
        </>
      ),
    },
    { label: "庫存", value: `${(inventory || []).length.toLocaleString()} 股` },
    { label: "平均成本", value: averageCostText },
    {
      label: "實現損益",
      value: (
        <>
          <DollarSign />
          {Math.round(finalGain).toLocaleString()}
        </>
      ),
      tone: finalGain > 0 ? "red" : finalGain < 0 ? "green" : "gray",
    },
    {
      label: "年化報酬率",
      value: (
        <>
          {(state.xirr * 100).toFixed(2)}
          <PercentSign />
        </>
      ),
      tone: state.xirr > 0 ? "red" : state.xirr < 0 ? "green" : "gray",
    },
  ];
  const tradeRecordCount = (tradeRecords ?? []).length;
  const tradePlanCount = tradePlans.filter((plan) => plan.sid === sid).length;
  const recentMaterialFacts: MaterialFact[] = [...(companyInfo?.material_facts || [])]
    .sort((a, b) => Date.parse(b.date_time) - Date.parse(a.date_time))
    .slice(0, 3);
  const historicalChartDateCount = stockPriceHistory?.dates.length ?? 0;
  const showHistoricalPriceEmptyState =
    !isWaitingHistoricalPrices &&
    historicalPrices !== undefined &&
    historicalChartDateCount === 0;
  const showIntradayEmptyState =
    !isWaitingIntradayPrices &&
    (intradayPrices === undefined || !hasStockIntradayPlottedData(intradayPrices));
  const showChartLoadingState =
    stockDetailChartMode === "intraday"
      ? isWaitingIntradayPrices &&
        (intradayPrices === undefined || !hasStockIntradayPlottedData(intradayPrices))
      : isWaitingHistoricalPrices && historicalChartDateCount === 0;
  const quoteDate = stockInfo?.date ? formatDateWithWeekday(stockInfo.date) : null;
  const isFavorite = favorites.includes(sid);

  const handleChartModeChange = (value: string): void => {
    dispatch(changeStockDetailChartMode(value as StockDetailChartMode));
  };
  const chartControls = (
    <div className={styles.chart_controls}>
      <SegmentedControl
        label="走勢區間"
        variant="subtle"
        options={CHART_MODE_OPTIONS}
        value={stockDetailChartMode}
        onChange={handleChartModeChange}
      />
    </div>
  );
  const returnToList = (): void => {
    navigateBack({ location, navigate }, `${Env.frontendRootPath}market`);
  };
  const handleScrollToTop = (): void => {
    let element: HTMLElement | null = mainRef.current;
    while (element?.parentElement) {
      element = element.parentElement;
      if (element.scrollHeight > element.clientHeight) {
        element.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const retryFetchStockInfo = (): void => {
    dispatch(fetchSingleStockInfo(sid))
      .unwrap()
      .then(() => setState({ didStockInfoFail: false }))
      .catch(() => setState({ didStockInfoFail: true }));
  };
  const changeFavStatus = (): void => {
    if (isFavorite) {
      dispatch(fakeRemoveFromFavorites(sid));
      dispatch(removeFromFavorites(sid))
        .unwrap()
        .catch(() => {
          dispatch(fakeAddToFavorites(sid));
          dispatch(pushToast({ type: "error", text: "收藏更新失敗，請稍後再試" }));
        });
    } else {
      dispatch(fakeAddToFavorites(sid));
      dispatch(addToFavorites(sid))
        .unwrap()
        .catch(() => {
          dispatch(fakeRemoveFromFavorites(sid));
          dispatch(pushToast({ type: "error", text: "收藏更新失敗，請稍後再試" }));
        });
    }
  };

  const companyInfoSection: React.ReactNode = (() => {
    return state.activeMaterialFact ? (
      <>
        <RoundButton size="l" onClick={() => setState({ activeMaterialFact: null })}>
          <Icons.IconChevronLeft />
        </RoundButton>
        <div
          className={`${styles.material_fact_outer} ${
            isNarrowLayout ? styles.mobile : ""
          }`}
        >
          <div className={styles.title}>{state.activeMaterialFact.title}</div>
          <div className={styles.date_time}>
            {new Date(Date.parse(state.activeMaterialFact.date_time)).toLocaleString(
              "af",
            )}
          </div>
          <div className={styles.description}>
            {state.activeMaterialFact.description.split("\n").map((line, idx) => {
              return <div key={idx}>{line}</div>;
            })}
          </div>
        </div>
      </>
    ) : (
      <div
        className={`${styles.company_info_outer} ${isNarrowLayout ? styles.mobile : ""}`}
      >
        <div className={styles.title}>證券代號</div>
        <div className={styles.content}>{sid}</div>
        <div className={styles.title}>公司簡稱</div>
        <div className={styles.content}>{stockInfo?.name || "-"}</div>
        <div className={styles.title}>主要經營業務</div>
        <div className={styles.content}>{companyInfo?.business || "-"}</div>
        <div className={styles.title}>重大消息</div>
        {(companyInfo?.material_facts.length ?? 0) > 0 ? (
          <div className={styles.material_fact_list}>
            {companyInfo?.material_facts.map((m, idx) => {
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
                      size="l"
                      onClick={() => setState({ activeMaterialFact: m })}
                    >
                      <Icons.IconChevronRight />
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
  })();

  const activeModal: React.ReactNode = (() => {
    if (state.activeModalName === "updateOrCreateNote") {
      return (
        <StockMemoEditor
          sid={sid}
          defaultValue={companyInfo?.note || ""}
          hideModal={() => setState({ activeModalName: null })}
        />
      );
    } else if (state.activeModalName === "companyInfo") {
      return isNarrowLayout ? (
        <BottomSheet
          onClickBackground={() =>
            setState({ activeModalName: null, activeMaterialFact: null })
          }
          canMaximize
        >
          {companyInfoSection}
        </BottomSheet>
      ) : (
        <Modal
          title="公司資訊"
          discardButtonProps={{
            children: "", // no use
            variant: "transparent", // no use
            onClick: () =>
              setState({ activeModalName: null, activeMaterialFact: null }),
          }}
          layout="auto"
          noFooter
        >
          {companyInfoSection}
        </Modal>
      );
    }
    return null;
  })();

  return (
    <>
      {activeModal}
      <div className={styles.main} ref={mainRef}>
        {isNarrowLayout && (
          <ScrollThresholdContainer>
            {(isScrolled) => (
              <div className={styles.mobile_back_button_container}>
                <RoundButton
                  onClick={returnToList}
                  size="l"
                  frosted={isScrolled}
                  hint_text="回列表"
                  aria-label="回列表"
                >
                  <Icons.IconChevronLeft sideLength="16" />
                </RoundButton>
              </div>
            )}
          </ScrollThresholdContainer>
        )}
        {isNarrowLayout && (
          <ScrollThresholdContainer>
            {(isScrolled) => (
              <button
                type="button"
                className={`${styles.mobile_favorite_button} ${
                  isScrolled ? styles.scrolled : ""
                } ${isFavorite ? styles.active : ""}`}
                onClick={changeFavStatus}
                aria-label={isFavorite ? "取消關注" : "加入關注"}
              >
                {isFavorite ? (
                  <Icons.IconHeartFill sideLength="20" />
                ) : (
                  <Icons.IconHeart sideLength="20" />
                )}
              </button>
            )}
          </ScrollThresholdContainer>
        )}
        {isNarrowLayout && stockInfo && (
          <ScrollThresholdContainer
            className={styles.stock_brief_info_container}
            scrolledClassName={styles.show}
            onClick={handleScrollToTop}
            role="button"
            tabIndex={0}
          >
            <div className={styles.company_name}>{stockInfo.name}</div>
            <div className={styles.sid}>{sid}</div>
          </ScrollThresholdContainer>
        )}
        {state.didStockInfoFail && (
          <div className={styles.inline_notice}>
            <span>資料暫時無法更新，畫面顯示的是最近一次取得的資訊。</span>
            <button type="button" onClick={retryFetchStockInfo}>
              重試
            </button>
          </div>
        )}
        <section className={`${styles.block} ${styles.hero_block}`}>
          <div className={styles.hero_toolbar}>
            {!isNarrowLayout && (
              <RoundButton
                onClick={returnToList}
                className={styles.toolbar_button}
                hint_text="回列表"
                aria-label="回列表"
              >
                <Icons.IconChevronLeft sideLength="17" />
              </RoundButton>
            )}
            <div className={styles.toolbar_spacer} />
            {!isNarrowLayout && (
              <button
                type="button"
                className={`${styles.icon_button} ${isFavorite ? styles.active : ""}`}
                onClick={changeFavStatus}
                aria-label={isFavorite ? "取消關注" : "加入關注"}
              >
                {isFavorite ? (
                  <Icons.IconHeartFill sideLength="18" />
                ) : (
                  <Icons.IconHeart sideLength="18" />
                )}
              </button>
            )}
            {!isNarrowLayout && (
              <>
                <button
                  type="button"
                  className={styles.icon_button}
                  aria-label="公司資訊"
                  onClick={() => {
                    setState({ activeModalName: "companyInfo" });
                  }}
                >
                  <Icons.IconBriefcase sideLength="18" />
                </button>
                <button
                  type="button"
                  className={styles.icon_button}
                  aria-label="編輯備註"
                  onClick={() => {
                    setState({ activeModalName: "updateOrCreateNote" });
                  }}
                >
                  <Icons.IconMemo sideLength="18" />
                </button>
              </>
            )}
          </div>
          <div className={styles.stock_info}>
            <div className={styles.stock_heading}>
              <h1 className={styles.company_name}>{stockInfo?.name || sid}</h1>
              <div className={styles.sid}>{sid}</div>
            </div>
            {stockInfo ? (
              <div className={styles.price}>
                <DollarSign />
                {stockInfo.close}
              </div>
            ) : (
              <Skeleton className={styles.price_skeleton} />
            )}
            <div className={styles.price_meta}>
              <span className={fluctPriceClass}>{fluctPriceString}</span>
              <span className={styles.trade_quantity}>成交 {tradeVolumeText} 張</span>
            </div>
            {quoteDate && (
              <div className={styles.quote_date}>
                行情日期 <time dateTime={stockInfo?.date}>{quoteDate}</time>
              </div>
            )}
            {isNarrowLayout && (
              <div className={styles.mobile_text_actions}>
                <button
                  type="button"
                  onClick={() => setState({ activeModalName: "companyInfo" })}
                  aria-label="公司資訊"
                >
                  <Icons.IconBriefcase sideLength="16" />
                  公司資訊
                </button>
                <button
                  type="button"
                  onClick={() => setState({ activeModalName: "updateOrCreateNote" })}
                  aria-label="編輯備註"
                >
                  <Icons.IconMemo sideLength="16" />
                  備註
                </button>
              </div>
            )}
          </div>
          {!isNarrowLayout && chartControls}
          <div
            className={styles.historical_price_chart_container}
            aria-label={
              stockDetailChartMode === "intraday"
                ? "今日走勢"
                : `最近 ${CHART_MODE_TO_DAYS[stockDetailChartMode]} 天收盤價走勢`
            }
          >
            {showChartLoadingState && (
              <SkeletonOverlay className={styles.chart_overlay} />
            )}
            <div key={stockDetailChartMode} className={styles.chart_panel}>
              {stockDetailChartMode === "intraday" ? (
                showIntradayEmptyState ? (
                  <div className={styles.empty_chart}>
                    <div>盤中尚未有成交資料</div>
                    <span>開盤後會顯示今日走勢。</span>
                  </div>
                ) : (
                  state.intradayLineChart
                )
              ) : showHistoricalPriceEmptyState ? (
                <div className={styles.empty_chart}>
                  <div>目前沒有歷史價格資料</div>
                  <span>稍後更新後會顯示走勢圖。</span>
                </div>
              ) : (
                state.historicalPriceLineChart
              )}
            </div>
          </div>
          {isNarrowLayout && chartControls}
        </section>
        <section className={`${styles.block} ${styles.summary_block}`}>
          <div className={styles.section_title}>投資摘要</div>
          <div className={styles.investment_info}>
            {summaryRows.map((row) => (
              <div className={styles.summary_row} key={row.label}>
                <span className={styles.upper}>{row.label}</span>
                <span className={`${styles.lower} ${row.tone ? styles[row.tone] : ""}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </section>
        {hasInventory && (
          <section className={`${styles.block} ${styles.inventory_block}`}>
            <div className={styles.section_header}>
              <div className={styles.section_title}>庫存分佈</div>
            </div>
            <div className={styles.inventory_histogram_container}>
              {state.inventoryHistogram}
            </div>
          </section>
        )}
        <section className={`${styles.block} ${styles.action_block}`}>
          <div className={styles.section_title}>紀錄與計畫</div>
          <div className={styles.action_list}>
            <Link
              to={`${Env.frontendRootPath}records?sid=${sid}`}
              className={styles.action_button}
            >
              <Icons.IconClockHistory sideLength="20" color={COLORS.textPrimary} />
              <span>查看交易紀錄</span>
              {tradeRecordCount === 0 && <em>尚無紀錄</em>}
            </Link>
            <Link
              to={`${Env.frontendRootPath}plans?sid=${sid}`}
              className={styles.action_button}
            >
              <Icons.IconThumbtack sideLength="20" color={COLORS.textPrimary} />
              <span>查看買賣計畫</span>
              {tradePlanCount > 0 && <em>{tradePlanCount} 個計畫</em>}
            </Link>
          </div>
        </section>
        <section className={`${styles.block} ${styles.company_block}`}>
          <div className={styles.section_header}>
            <div className={styles.section_title}>公司與重大消息</div>
            <button
              type="button"
              className={styles.text_button}
              onClick={() => setState({ activeModalName: "companyInfo" })}
            >
              完整資料
            </button>
          </div>
          <div className={styles.company_summary}>
            {companyInfo?.business || "目前沒有公司業務摘要。"}
          </div>
          <div className={styles.material_fact_preview_list}>
            {recentMaterialFacts.length > 0 ? (
              recentMaterialFacts.map((materialFact, idx) => (
                <button
                  type="button"
                  className={styles.material_fact_preview}
                  key={`${materialFact.date_time}-${idx}`}
                  onClick={() =>
                    setState({
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
                  <Icons.IconChevronRight sideLength="14" />
                </button>
              ))
            ) : (
              <div className={styles.empty_company_message}>目前沒有重大消息</div>
            )}
          </div>
        </section>
        <SpeedDial defaultSid={sid} />
        <div
          className={`${styles.switch_hint_icon_for_mobile} ${styles.left} ${
            state.switchDirection === "prev" ? styles.active : ""
          }`}
        />
        <div
          className={`${styles.switch_hint_icon_for_mobile} ${styles.right} ${
            state.switchDirection === "next" ? styles.active : ""
          }`}
        />
        {stockListTab && (!isNarrowLayout || canHover) ? (
          <>
            <div className={`${styles.stock_switch_control} ${styles.left}`}>
              <Tooltip content="上一檔">
                <button
                  type="button"
                  aria-label="上一檔"
                  aria-disabled={!previousStockSid}
                  tabIndex={previousStockSid ? 0 : -1}
                  onClick={() => switchToStock(previousStockSid)}
                >
                  <span aria-hidden="true">
                    <Icons.IconChevronLeft sideLength="18" />
                  </span>
                </button>
              </Tooltip>
            </div>
            <div className={`${styles.stock_switch_control} ${styles.right}`}>
              <Tooltip content="下一檔">
                <button
                  type="button"
                  aria-label="下一檔"
                  aria-disabled={!nextStockSid}
                  tabIndex={nextStockSid ? 0 : -1}
                  onClick={() => switchToStock(nextStockSid)}
                >
                  <span aria-hidden="true">
                    <Icons.IconChevronRight sideLength="18" />
                  </span>
                </button>
              </Tooltip>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

export default memo(Details);

async function calculateInventoryHistogramChartData(sid: string): Promise<number[]> {
  const worker = new Worker(
    new URL("../../../workers/histogramChartWorker.ts", import.meta.url),
    // The dev server serves the worker unbundled, so it must run as a module to import.
    { type: "module" },
  );
  // Read from store, not the selected trade records: loadStockDetail awaits this
  // worker, and the user may navigate to another stock before it finishes.
  worker.postMessage(store.getState().tradeRecord.sidTradeRecordsMap[sid] ?? []);
  return await new Promise<number[]>((resolve) => {
    worker.onmessage = (event) => {
      worker.terminate();
      resolve(event.data);
    };
  });
}
