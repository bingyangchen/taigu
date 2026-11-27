import { COLORS } from "../styles/tokens";

export function formatStockPrice(value: number): string {
  return value.toFixed(2);
}

export function makeStockTooltipTitle(text: string): string {
  return `<span style="font-weight:600;color:${COLORS.textPrimary};">${text}</span>`;
}

export function makeStockPriceTooltipLine(price: number): string {
  return `價格 $${formatStockPrice(price)}`;
}

export function makeStockChangeTooltipLine(
  label: string,
  price: number,
  previousPrice: number | null,
): string {
  if (previousPrice === null) return `${label} -- (--)`;
  const change = Math.round((price - previousPrice) * 100) / 100;
  const percent =
    previousPrice === 0
      ? "--"
      : `${Math.abs((change / previousPrice) * 100).toFixed(2)}%`;
  const color =
    change > 0 ? COLORS.priceUp : change < 0 ? COLORS.priceDown : COLORS.priceFlat;
  const sign = change > 0 ? "▲" : change < 0 ? "▼" : "";
  return `<span style="color:${color};">${label} ${sign}${formatStockPrice(Math.abs(change))} (${percent})</span>`;
}
