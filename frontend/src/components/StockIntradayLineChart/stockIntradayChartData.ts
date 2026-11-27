import type { StockIntradayPrices } from "../../types";

const METADATA_KEYS = new Set(["date", "yesterday_price", "last_fluct_price"]);

export function getStockIntradayMinutePrices(
  prices: StockIntradayPrices,
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const [key, value] of Object.entries(prices)) {
    if (METADATA_KEYS.has(key)) continue;
    const minute = Number.parseInt(key, 10);
    if (!Number.isNaN(minute) && typeof value === "number") {
      result[minute] = value;
    }
  }
  return result;
}

export function hasStockIntradayPlottedData(prices: StockIntradayPrices): boolean {
  return Object.keys(getStockIntradayMinutePrices(prices)).length > 0;
}

export function buildStockIntradayChartData(
  prices: StockIntradayPrices,
): [number, number | null][] {
  const minutePrices = getStockIntradayMinutePrices(prices);
  const chartData: [number, number | null][] = [];
  for (let minute = 0; minute <= 270; minute += 1) {
    chartData.push([minute, minutePrices[minute] ?? null]);
  }
  return chartData;
}

export function getStockIntradayMinPrice(
  data: [number, number | null][],
  prevClosePrice: number,
): number {
  return Math.min(...data.map((point) => point[1] ?? prevClosePrice));
}

export function getStockIntradayMaxPrice(
  data: [number, number | null][],
  prevClosePrice: number,
): number {
  return Math.max(...data.map((point) => point[1] ?? prevClosePrice));
}
