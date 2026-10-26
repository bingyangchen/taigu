// The service worker imports this module too, and a service worker has no `window`,
// so this file must not import anything that reads it.
export const API_CACHE_NAME = "api-cache-v2";
export const LEGACY_API_CACHE_NAMES = ["api-cache", "taigu"];
export const API_CACHE_PATHS = new Set([
  "cash-dividends",
  "market/market-index",
  "market/market-index-historical-prices",
  "market/historical-prices",
  "market/intraday-prices",
  "trade-plans",
  "stock-memo/company-info",
  "favorites",
  "handling-fee/discount",
]);
