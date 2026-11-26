import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  MarketIndexHistoricalLineChart,
  MarketIndexIntradayLineChart,
  RoundButton,
  SegmentedControl,
  Skeleton,
  SpeedDial,
} from "../../../components";
import { IconChevronLeft } from "../../../icons";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { changeMarketIndexHistoricalDaysToShow } from "../../../redux/slices/MainPageSlice";
import {
  fetchMarketIndexHistoricalPrices,
  fetchRealtimeMarketIndex,
  type MarketIndexQueryStatus,
} from "../../../redux/slices/StockInfoSlice";
import type { MarketId } from "../../../types";
import Env from "../../../utils/env";
import {
  formatIndexChange,
  formatIndexPoints,
  formatMarketIndexDate,
  getSharedMarketIndexDate,
  makeMarketIndexHistory,
  makeMarketIndexQuote,
  MARKET_ID_TO_INDEX_NAME,
  MARKET_IDS,
  type MarketIndexQuote,
} from "../../../utils/marketIndex";
import { navigateBack } from "../../../utils/router";
import styles from "./MarketIndexDetails.module.scss";

type ChartMode = "intraday" | "historical";

const CHART_MODES = [
  { label: "今日", value: "intraday" },
  { label: "歷史", value: "historical" },
];

const HISTORICAL_RANGES = [
  { label: "1M", value: "30", ariaLabel: "1M，最近 30 筆" },
  { label: "1Q", value: "91", ariaLabel: "1Q，最近 91 筆" },
  { label: "1Y", value: "365", ariaLabel: "1Y，最近 365 筆" },
  { label: "ALL", value: "Infinity", ariaLabel: "ALL，全部" },
];

function RetryButton({
  isRetrying,
  onRetry,
}: {
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <button
      aria-disabled={isRetrying}
      className={styles.retry}
      type="button"
      onClick={isRetrying ? undefined : onRetry}
    >
      重試
    </button>
  );
}

function ChartStatus({
  mode,
  status,
  onRetry,
}: {
  mode: ChartMode;
  status: MarketIndexQueryStatus;
  onRetry: () => void;
}) {
  const trend = mode === "historical" ? "歷史走勢" : "盤中走勢";
  const isRetrying = status === "retrying";
  const isLoading = status === "loading" || status === "idle" || isRetrying;
  return (
    <div className={styles.chart_status}>
      <div role="status">
        {isLoading ? (
          <>
            <Skeleton size="small" />
            <span>正在載入{trend}</span>
          </>
        ) : status === "failed" ? (
          <span>{trend}讀取失敗</span>
        ) : (
          <span>目前沒有{trend}</span>
        )}
      </div>
      {(status === "failed" || isRetrying) && (
        <RetryButton isRetrying={isRetrying} onRetry={onRetry} />
      )}
    </div>
  );
}

function MarketChart({
  mode,
  market,
  quote,
  sharedDate,
  isSharedIntradayError,
  days,
}: {
  mode: ChartMode;
  market: MarketId;
  quote: MarketIndexQuote;
  sharedDate: string | null;
  isSharedIntradayError: boolean;
  days: number;
}) {
  const dispatch = useAppDispatch();
  const closingPrices = useAppSelector(
    (state) => state.stockInfo.marketIndexHistoricalPricesMap[market],
  );
  const historicalStatus = useAppSelector(
    (state) => state.stockInfo.marketIndexHistoricalStatus[market],
  );
  const intradayStatus = useAppSelector(
    (state) => state.stockInfo.marketIndexRealtimeStatus,
  );
  const { dates, values } = useMemo(
    () => makeMarketIndexHistory(closingPrices, quote, days),
    [closingPrices, quote, days],
  );
  const isHistorical = mode === "historical";
  const status = isHistorical ? historicalStatus : intradayStatus;
  const hasChart = isHistorical
    ? dates.length > 0 && (historicalStatus === "ready" || closingPrices !== undefined)
    : quote.points.length > 0;
  const name = MARKET_ID_TO_INDEX_NAME[market];
  const label = `${name}${isHistorical ? "歷史" : "今日"}走勢（點）`;
  const quoteDate = sharedDate ? null : formatMarketIndexDate(quote);
  const showPreviousClose = !isHistorical && hasChart && quote.previousClose !== null;

  return (
    <section className={styles.market} aria-labelledby={`market-index-${market}`}>
      <h2 id={`market-index-${market}`}>{name}</h2>
      <div className={styles.quote}>
        <strong>
          {quote.latestPrice === null ? "--" : formatIndexPoints(quote.latestPrice)}
        </strong>
        <span
          className={
            quote.change && quote.change > 0
              ? styles.up
              : quote.change && quote.change < 0
                ? styles.down
                : undefined
          }
        >
          {formatIndexChange(quote.change, quote.percent)}
        </span>
      </div>
      <div className={styles.chart_caption}>
        {quoteDate && <span>{quoteDate}</span>}
        {showPreviousClose && <span className={styles.previous_close}>昨收</span>}
      </div>
      <div className={styles.plot}>
        {hasChart ? (
          isHistorical ? (
            <MarketIndexHistoricalLineChart
              dates={dates}
              values={values}
              label={label}
            />
          ) : (
            <MarketIndexIntradayLineChart
              data={quote.points}
              prevClosePrice={quote.previousClose}
              label={label}
            />
          )
        ) : !isSharedIntradayError ? (
          <ChartStatus
            mode={mode}
            status={status}
            onRetry={() =>
              isHistorical
                ? dispatch(fetchMarketIndexHistoricalPrices({ market }))
                : dispatch(fetchRealtimeMarketIndex())
            }
          />
        ) : null}
      </div>
      {hasChart && status === "failed" && (
        <p className={styles.update_error} role="status">
          更新失敗，顯示上次取得的走勢
        </p>
      )}
    </section>
  );
}

export default function MarketIndexDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<ChartMode>("intraday");
  const days = useAppSelector(
    (state) => state.mainPage.marketIndexHistoricalDaysToShow,
  );
  const prices = useAppSelector((state) => state.stockInfo.marketIndexRealtimePrices);
  const dates = useAppSelector((state) => state.stockInfo.marketIndexRealtimeDates);
  const status = useAppSelector((state) => state.stockInfo.marketIndexRealtimeStatus);
  const quotes = useMemo(
    () => ({
      tse: makeMarketIndexQuote(prices.tse, dates.tse),
      otc: makeMarketIndexQuote(prices.otc, dates.otc),
    }),
    [prices, dates],
  );
  const sharedDate = getSharedMarketIndexDate(quotes.tse, quotes.otc);
  const isSharedIntradayError =
    mode === "intraday" &&
    (status === "failed" || status === "retrying") &&
    quotes.tse.latestPrice === null &&
    quotes.otc.latestPrice === null;

  useEffect(() => {
    for (const market of MARKET_IDS)
      dispatch(fetchMarketIndexHistoricalPrices({ market }));
  }, [dispatch]);

  function returnToDashboard() {
    if (location.state?.fromDashboard) {
      navigateBack({ location, navigate }, Env.frontendRootPath);
    } else {
      navigate(Env.frontendRootPath, { replace: true });
    }
  }

  return (
    <div className={styles.main}>
      <header className={styles.heading}>
        <RoundButton
          onClick={returnToDashboard}
          className={styles.back}
          hint_text="回儀表板"
        >
          <IconChevronLeft sideLength="16" />
        </RoundButton>
        <div className={styles.title}>
          <h1>大盤指數</h1>
          {sharedDate && (
            <time className={styles.shared_date} dateTime={sharedDate}>
              {formatMarketIndexDate(quotes.tse)}
            </time>
          )}
        </div>
      </header>
      <div className={styles.speed_dial}>
        <SpeedDial />
      </div>
      <div className={styles.surface}>
        <div className={styles.toolbar}>
          <SegmentedControl
            label="兩個指數的走勢類型"
            optionWidth="var(--mode-option-width)"
            options={CHART_MODES}
            value={mode}
            onChange={(value) => setMode(value as ChartMode)}
          />
          {mode === "historical" && (
            <SegmentedControl
              label="兩個指數的歷史區間"
              optionWidth="var(--range-option-width)"
              options={HISTORICAL_RANGES}
              value={String(days)}
              onChange={(value) =>
                dispatch(changeMarketIndexHistoricalDaysToShow(Number(value)))
              }
            />
          )}
        </div>
        {isSharedIntradayError && (
          <div className={styles.shared_error}>
            <span role="status">
              {status === "retrying" ? "正在載入盤中走勢" : "盤中行情讀取失敗"}
            </span>
            <RetryButton
              isRetrying={status === "retrying"}
              onRetry={() => dispatch(fetchRealtimeMarketIndex())}
            />
          </div>
        )}
        <div className={styles.markets}>
          {MARKET_IDS.map((market) => (
            <MarketChart
              key={market}
              market={market}
              mode={mode}
              quote={quotes[market]}
              sharedDate={sharedDate}
              isSharedIntradayError={isSharedIntradayError}
              days={days}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
