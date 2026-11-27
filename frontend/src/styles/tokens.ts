import tokenExports from "./tokens.module.scss";

const CHART_CATEGORY_PREFIX = "color-chart-category-";

function getToken(name: string): string {
  const value = tokenExports[name];
  if (value === undefined) throw new Error(`Unknown design token: ${name}`);
  return value;
}

function getColor(name: string): string {
  return getToken(`color-${name}`);
}

function getChartCategoryColors(): string[] {
  return Object.keys(tokenExports)
    .filter((name) => name.startsWith(CHART_CATEGORY_PREFIX))
    .map((name) => Number(name.slice(CHART_CATEGORY_PREFIX.length)))
    .sort((a, b) => a - b)
    .map((index) => getToken(`${CHART_CATEGORY_PREFIX}${index}`));
}

// Appended to an opaque color token, which is 6-digit hex, to make it fully
// transparent.
export const TRANSPARENT_ALPHA = "00";

// The color tokens that ECharts options and SVG icons need. Opaque colors are 6-digit
// hex.
export const COLORS = {
  textPrimary: getColor("text-primary"),
  textSecondary: getColor("text-secondary"),
  textAccent: getColor("text-accent"),
  bgSurface: getColor("bg-surface"),
  borderDefault: getColor("border-default"),
  borderSubtle: getColor("border-subtle"),
  priceUp: getColor("price-up"),
  priceDown: getColor("price-down"),
  priceFlat: getColor("price-flat"),
  chartUp: getColor("chart-up"),
  chartDown: getColor("chart-down"),
  chartAccent: getColor("chart-accent"),
  chartAccentSoft: getColor("chart-accent-soft"),
  chartAccentFaint: getColor("chart-accent-faint"),
  chartAccentWash: getColor("chart-accent-wash"),
  chartCategories: getChartCategoryColors(),
  chartMuted: getColor("chart-muted"),
  chartInactive: getColor("chart-inactive"),
  chartIncompleteArea: getColor("chart-incomplete-area"),
};

// Font sizes in px, for ECharts. The front-end charts' tick labels use chartTick, and
// their tooltips use xs, a fixed size because a tooltip shows data rather than a use
// in the type size table that switches with the viewport width.
export const FONT_SIZES = {
  chartTick: parseFloat(getToken("font-size-chart-tick")),
  xs: parseFloat(getToken("font-size-xs")),
};

// Each value is the width in px where the wider layout starts.
export const BREAKPOINTS = {
  sm: parseFloat(getToken("breakpoint-sm")),
  md: parseFloat(getToken("breakpoint-md")),
  lg: parseFloat(getToken("breakpoint-lg")),
  xl: parseFloat(getToken("breakpoint-xl")),
  "2xl": parseFloat(getToken("breakpoint-2xl")),
};

export type Breakpoint = keyof typeof BREAKPOINTS;

// A viewport narrower or shorter than these, in px, gets the narrow layout.
export const NARROW_LAYOUT_SIZE = {
  width: parseFloat(getToken("narrow-layout-width")),
  height: parseFloat(getToken("narrow-layout-height")),
};
