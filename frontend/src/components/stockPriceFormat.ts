import { makeChangeTooltipLine, NO_CHANGE_TEXT } from "./chartTooltip";

const stockPriceFormat = new Intl.NumberFormat("zh-TW", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatStockPrice(value: number): string {
  return stockPriceFormat.format(value);
}

function getDirection(change: number): string {
  return change > 0 ? "▲" : change < 0 ? "▼" : "";
}

function formatChangePercent(change: number, previousPrice: number): string {
  return previousPrice === 0
    ? "--"
    : `${Math.abs((change / previousPrice) * 100).toFixed(2)}%`;
}

function formatChangeWithPercent(change: number, previousPrice: number): string {
  return `${getDirection(change)}${formatStockPrice(Math.abs(change))} (${formatChangePercent(change, previousPrice)})`;
}

/** The change of a price from the previous close, as "▲2.50 (0.12%)", or "-" when flat. */
export function formatStockChange(change: number, previousClose: number): string {
  return change === 0 ? "-" : formatChangeWithPercent(change, previousClose);
}

export function makeStockPriceTooltipLine(price: number): string {
  return `價格 $${formatStockPrice(price)}`;
}

export function makeStockChangeTooltipLine(
  label: string,
  price: number,
  previousPrice: number | null,
): string {
  if (previousPrice === null) return makeChangeTooltipLine(label, null, NO_CHANGE_TEXT);
  const change = Math.round((price - previousPrice) * 100) / 100;
  return makeChangeTooltipLine(
    label,
    change,
    formatChangeWithPercent(change, previousPrice),
  );
}
