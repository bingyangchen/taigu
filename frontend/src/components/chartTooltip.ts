import { COLORS } from "../styles/tokens";

export const NO_CHANGE_TEXT = "-- (--)";

export function makeTooltipTitle(text: string): string {
  return `<span style="font-weight:600;color:${COLORS.textPrimary};">${text}</span>`;
}

export function makeChangeTooltipLine(
  label: string,
  change: number | null,
  text: string,
): string {
  const color =
    change === null || change === 0
      ? COLORS.priceFlat
      : change > 0
        ? COLORS.priceUp
        : COLORS.priceDown;
  return `<span style="color:${color};">${label} ${text}</span>`;
}
