import { makeChangeTooltipLine, NO_CHANGE_TEXT } from "./chartTooltip";

const stockPriceFormat = new Intl.NumberFormat("zh-TW", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatStockPrice(value: number): string {
  return stockPriceFormat.format(value);
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
  const percent =
    previousPrice === 0
      ? "--"
      : `${Math.abs((change / previousPrice) * 100).toFixed(2)}%`;
  const sign = change > 0 ? "▲" : change < 0 ? "▼" : "";
  return makeChangeTooltipLine(
    label,
    change,
    `${sign}${formatStockPrice(Math.abs(change))} (${percent})`,
  );
}
