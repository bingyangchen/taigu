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
import type { SegmentedControlOption } from "../../../components/SegmentedControl/SegmentedControl";
import { IconChevronLeft } from "../../../icons";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
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

interface ChartRange extends SegmentedControlOption {
  // How many of the latest points the historical charts show; null shows the
  // intraday charts.
  historyLimit: number | null;
}

const CHART_RANGES: ChartRange[] = [
  { label: "今日", value: "intraday", historyLimit: null },
  { label: "1M", value: "1M", ariaLabel: "1M，最近 30 筆", historyLimit: 30 },
  { label: "1Q", value: "1Q", ariaLabel: "1Q，最近 91 筆", historyLimit: 91 },
  { label: "1Y", value: "1Y", ariaLabel: "1Y，最近 365 筆", historyLimit: 365 },
  { label: "ALL", value: "ALL", ariaLabel: "ALL，全部", historyLimit: Infinity },
];

function getChartRange(value: string): ChartRange {
  const range = CHART_RANGES.find((option) => option.value === value);
  if (!range) throw new Error(`Unknown chart range: ${value}`);
  return range;
}

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
  isHistorical,
  status,
  onRetry,
}: {
  isHistorical: boolean;
  status: MarketIndexQueryStatus;
  onRetry: () => void;
}) {
  const trend = isHistorical ? "歷史走勢" : "盤中走勢";
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
  historyLimit,
  market,
  quote,
  sharedDate,
  isSharedIntradayError,
}: {
  historyLimit: ChartRange["historyLimit"];
  market: MarketId;
  quote: MarketIndexQuote;
  sharedDate: string | null;
  isSharedIntradayError: boolean;
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
  const history = useMemo(
    () =>
      historyLimit === null
        ? null
        : makeMarketIndexHistory(closingPrices, quote, historyLimit),
    [closingPrices, quote, historyLimit],
  );
  const isHistorical = history !== null;
  const status = isHistorical ? historicalStatus : intradayStatus;
  const hasChart = isHistorical
    ? history.dates.length > 0 &&
      (historicalStatus === "ready" || closingPrices !== undefined)
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
              dates={history.dates}
              values={history.values}
              previousValues={history.previousValues}
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
            isHistorical={isHistorical}
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
  const [range, setRange] = useState<ChartRange>(CHART_RANGES[0]);
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
    range.historyLimit === null &&
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
      <SpeedDial />
      <div className={styles.surface}>
        <div className={styles.toolbar}>
          <SegmentedControl
            label="兩個指數的走勢區間"
            optionWidth="var(--range-option-width)"
            options={CHART_RANGES}
            value={range.value}
            onChange={(value) => setRange(getChartRange(value))}
          />
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
              historyLimit={range.historyLimit}
              quote={quotes[market]}
              sharedDate={sharedDate}
              isSharedIntradayError={isSharedIntradayError}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
