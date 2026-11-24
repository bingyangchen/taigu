import { memo } from "react";
import { Link } from "react-router-dom";

import { IconChevronRight } from "../../icons";
import { useAppSelector } from "../../redux/hooks";
import Env from "../../utils/env";
import {
  formatIndexChange,
  formatIndexPoints,
  formatMarketIndexDate,
  getSharedMarketIndexDate,
  makeMarketIndexQuote,
  MARKET_ID_TO_INDEX_NAME,
  MARKET_IDS,
} from "../../utils/marketIndex";
import MarketIndexLineChart from "../MarketIndexLineChart/MarketIndexLineChart";
import Skeleton from "../Skeleton/Skeleton";
import styles from "./MarketIndexSummary.module.scss";

function MarketIndexSummary() {
  const prices = useAppSelector((state) => state.stockInfo.marketIndexRealtimePrices);
  const dates = useAppSelector((state) => state.stockInfo.marketIndexRealtimeDates);
  const status = useAppSelector((state) => state.stockInfo.marketIndexRealtimeStatus);
  const quotes = {
    tse: makeMarketIndexQuote(prices.tse, dates.tse),
    otc: makeMarketIndexQuote(prices.otc, dates.otc),
  };
  const sharedDate = getSharedMarketIndexDate(quotes.tse, quotes.otc);
  const hasQuote = MARKET_IDS.some((market) => quotes[market].latestPrice !== null);
  const isLoading =
    !hasQuote && (status === "idle" || status === "loading" || status === "retrying");
  const statusText = isLoading
    ? "讀取行情中"
    : status === "failed"
      ? hasQuote
        ? "更新失敗，顯示上次行情"
        : "行情讀取失敗"
      : hasQuote
        ? null
        : "目前沒有行情";

  return (
    <Link
      className={styles.card}
      to={`${Env.frontendRootPath}market-index`}
      state={{ fromDashboard: true }}
      data-scroll-anchor="market-index"
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2>大盤指數</h2>
          {sharedDate && (
            <time className={styles.date} dateTime={sharedDate}>
              {formatMarketIndexDate(quotes.tse)}
            </time>
          )}
          {statusText && <span className={styles.date}>{statusText}</span>}
        </div>
        <span className={styles.action}>
          查看走勢 <IconChevronRight sideLength="12" />
        </span>
      </div>
      <div className={styles.markets}>
        {MARKET_IDS.map((market) => {
          const quote = quotes[market];
          return (
            <div className={styles.market} key={market}>
              <div className={styles.market_identity}>
                <span className={styles.market_name}>
                  {MARKET_ID_TO_INDEX_NAME[market]}
                </span>
                {!sharedDate && (
                  <span className={styles.date}>{formatMarketIndexDate(quote)}</span>
                )}
              </div>
              <div className={styles.chart} aria-hidden="true">
                {isLoading ? (
                  <Skeleton className={styles.loading_chart} />
                ) : (
                  quote.points.length > 0 && (
                    <MarketIndexLineChart
                      data={quote.points}
                      prevClosePrice={quote.previousClose}
                    />
                  )
                )}
              </div>
              <div className={styles.values}>
                {isLoading ? (
                  <>
                    <Skeleton width="4.5rem" height="1rem" />
                    <Skeleton width="3.5rem" height="0.625rem" />
                  </>
                ) : (
                  <>
                    <strong>
                      {quote.latestPrice === null
                        ? "--"
                        : formatIndexPoints(quote.latestPrice)}
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
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}

export default memo(MarketIndexSummary);
