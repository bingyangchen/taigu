import type { MarketId, MarketIndexIntradayPrices } from "../types";

export const MARKET_IDS: readonly MarketId[] = ["tse", "otc"];
export const MARKET_ID_TO_INDEX_NAME: Record<MarketId, string> = {
  tse: "加權指數",
  otc: "櫃買指數",
};
export const MARKET_CLOSE_MINUTE = 270;

const indexNumberFormat = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 });

export function formatIndexPoints(value: number): string {
  return indexNumberFormat.format(value);
}

export function formatMarketMinute(minuteAfterOpen: number): string {
  const hour = 9 + Math.floor(minuteAfterOpen / 60);
  const minute = minuteAfterOpen % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function makeMarketIndexQuote(
  prices: MarketIndexIntradayPrices,
  date: string | null,
) {
  const points = Object.entries(prices).flatMap(
    ([minute, price]): [number, number][] =>
      typeof price === "number" &&
      Number.isFinite(price) &&
      /^(0|[1-9]\d*)$/.test(minute) &&
      Number(minute) <= MARKET_CLOSE_MINUTE
        ? [[Number(minute), price]]
        : [],
  );
  const latestPrice = points.at(-1)?.[1] ?? null;
  const previousClose = prices.yesterday_price ?? null;
  const change = latestPrice === null ? null : (prices.last_fluct_price ?? null);
  const percent =
    change !== null && previousClose !== null && previousClose !== 0
      ? (change / previousClose) * 100
      : null;
  return {
    points,
    latestPrice,
    previousClose,
    change,
    percent,
    date: latestPrice === null || date === "0000-00-00" ? null : date,
  };
}

export type MarketIndexQuote = ReturnType<typeof makeMarketIndexQuote>;

export function formatIndexChange(change: number | null, percent: number | null) {
  if (change === null) return "--";
  const direction = change > 0 ? "▲" : change < 0 ? "▼" : "";
  const percentText = percent === null ? "--" : `${Math.abs(percent).toFixed(2)}%`;
  return `${direction}${formatIndexPoints(Math.abs(change))} (${percentText})`;
}

export function getSharedMarketIndexDate(
  first: MarketIndexQuote,
  second: MarketIndexQuote,
): string | null {
  return first.date === second.date ? first.date : null;
}

export function formatMarketIndexDate(quote: MarketIndexQuote) {
  if (quote.latestPrice === null) return null;
  return quote.date ? `行情日期 ${quote.date.replaceAll("-", "/")}` : "行情日期不明";
}

export function makeMarketIndexHistory(
  closingPrices: Record<string, number> | undefined,
  { date, latestPrice }: MarketIndexQuote,
  limit: number,
) {
  const daily = { ...closingPrices };
  if (date !== null && latestPrice !== null) daily[date] = latestPrice;
  const dates = Object.keys(daily)
    .filter((day) => Number.isFinite(daily[day]))
    .sort()
    .slice(-limit);
  return { dates, values: dates.map((day) => daily[day]) };
}
