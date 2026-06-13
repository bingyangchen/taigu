import type { StockIntradayPrices } from "../../types";

export const RED = "#d4493f";
export const GREEN = "#1aa260";

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

export function splitStockIntradayDataIntoColoredSegments(
  data: [number, number | null][],
  prevClosePrice: number,
): Array<{ data: [number, number | null][]; color: string }> {
  if (data.length === 0) return [];

  const segments: Array<{ data: [number, number | null][]; color: string }> = [];
  let currentSegment: [number, number | null][] = [];
  let currentColor: string | null = null;

  for (let i = 0; i < data.length; i += 1) {
    const point = data[i];
    const value = point[1];
    const pointColor: string =
      value === null ? (currentColor ?? GREEN) : value > prevClosePrice ? RED : GREEN;

    if (
      currentColor !== null &&
      currentColor !== pointColor &&
      currentSegment.length > 0
    ) {
      const previousPoint = data[i - 1];
      const previousValue = previousPoint[1];

      if (previousValue !== null && value !== null) {
        const startX = previousPoint[0];
        const startY = previousValue;
        const endX = point[0];
        const endY = value;
        const ratio = (prevClosePrice - startY) / (endY - startY);

        if (ratio > 0 && ratio < 1) {
          const intersectionPoint: [number, number] = [
            startX + ratio * (endX - startX),
            prevClosePrice,
          ];
          currentSegment.push(intersectionPoint);
          segments.push({ data: [...currentSegment], color: currentColor });
          currentSegment = [intersectionPoint, point];
        } else {
          currentSegment.push(point);
          segments.push({ data: [...currentSegment], color: currentColor });
          currentSegment = [point];
        }
      } else {
        currentSegment.push(point);
        segments.push({ data: [...currentSegment], color: currentColor });
        currentSegment = [point];
      }
      currentColor = pointColor;
    } else {
      if (currentColor === null) currentColor = pointColor;
      currentSegment.push(point);
    }
  }

  if (currentSegment.length > 0 && currentColor !== null) {
    segments.push({ data: currentSegment, color: currentColor });
  }

  return segments;
}
