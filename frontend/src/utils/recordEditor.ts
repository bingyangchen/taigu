import type {
  CashDividendRecord,
  QuantityUnit,
  StockInfo,
  StockSuggestions,
  StockWarehouse,
  TradeRecord,
  TradeSide,
} from "../types";
import { dateStringToDate, getDaysBetween, getWeekdayName } from "./date";

export const tradeSideToLabel: Record<TradeSide, string> = {
  buy: "買進",
  sell: "賣出",
};

export const quantityUnitToLabel: Record<QuantityUnit, string> = {
  lot: "張",
  share: "股",
};

export const MAX_PRICE_DECIMALS = 4;

const SHARES_PER_LOT = 1000;
const MAX_LOT_DECIMALS = 3;
export const BUY_HANDLING_FEE_RATE = 0.001425;
export const SECURITIES_TRANSACTION_TAX_RATE = 0.003;
export const SELL_HANDLING_FEE_RATE =
  BUY_HANDLING_FEE_RATE + SECURITIES_TRANSACTION_TAX_RATE;

const PRICE_LIMIT_RATIO = 0.1;

const RECENT_STOCK_LIMIT = 5;
const QUANTITY_UNIT_STORAGE_KEY = "record_editor_quantity_unit";

export function formatEditorDate(dateString: string, todayDateString: string): string {
  const date = dateStringToDate(dateString);
  const year =
    date.getFullYear() === dateStringToDate(todayDateString).getFullYear()
      ? ""
      : `${date.getFullYear()}/`;
  return `${year}${date.getMonth() + 1}/${date.getDate()}（${getWeekdayName(dateString)}）`;
}

export function formatRelativeEditorDate(
  dateString: string,
  todayDateString: string,
): string {
  const daysAgo = getDaysBetween(dateString, todayDateString);
  const prefix = daysAgo === 0 ? "今天 " : daysAgo === 1 ? "昨天 " : "";
  return `${prefix}${formatEditorDate(dateString, todayDateString)}`;
}

export function formatPercentage(rate: number): string {
  return `${formatNumber(rate * 100, 4)}%`;
}

export function formatNumber(value: number, maximumFractionDigits: number = 0): string {
  return value.toLocaleString("en-US", { maximumFractionDigits });
}

/** Formats a stored price with every decimal it has, so a legacy price is shown as saved. */
export function formatStoredPrice(price: number): string {
  return price.toLocaleString("en-US", { maximumFractionDigits: 20 });
}

export function parseNumberText(text: string): number | null {
  const digits = text.replace(/,/g, "");
  if (digits === "" || digits === ".") return null;
  return Number(digits);
}

function formatIntegerDigits(digits: string): string {
  return digits === "" ? "" : Number(digits).toLocaleString("en-US");
}

function countDecimals(text: string): number {
  const dotIndex = text.indexOf(".");
  return dotIndex < 0 ? 0 : text.length - dotIndex - 1;
}

/**
 * A keystroke that would add a decimal beyond `maxDecimals` is ignored, so
 * `previousText` is returned; pasted text, and text that already had more decimals
 * such as a legacy price, is cut to `maxDecimals`.
 */
export function normalizeNumberInput(
  nextText: string,
  previousText: string,
  maxDecimals: number,
): string {
  const unwantedCharacters = maxDecimals > 0 ? /[^\d.]/g : /[^\d]/g;
  const cleaned = nextText.replace(unwantedCharacters, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex < 0) return formatIntegerDigits(cleaned);
  const integerDigits = cleaned.slice(0, dotIndex);
  let decimalDigits = cleaned.slice(dotIndex + 1).replace(/\./g, "");
  if (decimalDigits.length > maxDecimals) {
    const previousDigits = previousText.replace(/,/g, "");
    const isOneKeystroke = cleaned.length === previousDigits.length + 1;
    if (isOneKeystroke && countDecimals(previousDigits) <= maxDecimals) {
      return previousText;
    }
    decimalDigits = decimalDigits.slice(0, maxDecimals);
  }
  const integerText = integerDigits === "" ? "0" : formatIntegerDigits(integerDigits);
  return `${integerText}.${decimalDigits}`;
}

export function getMaxQuantityDecimals(unit: QuantityUnit): number {
  return unit === "lot" ? MAX_LOT_DECIMALS : 0;
}

export function getSharesFromQuantityText(
  quantityText: string,
  unit: QuantityUnit,
): number | null {
  const quantity = parseNumberText(quantityText);
  if (quantity === null) return null;
  return unit === "lot" ? Math.round(quantity * SHARES_PER_LOT) : quantity;
}

export function formatQuantityFieldText(shares: number, unit: QuantityUnit): string {
  return unit === "lot"
    ? formatNumber(shares / SHARES_PER_LOT, MAX_LOT_DECIMALS)
    : formatNumber(shares);
}

export function formatQuantityWithUnit(shares: number, unit: QuantityUnit): string {
  return `${formatQuantityFieldText(shares, unit)} ${quantityUnitToLabel[unit]}`;
}

export function formatQuantityWithShares(shares: number, unit: QuantityUnit): string {
  return unit === "lot"
    ? `${formatQuantityWithUnit(shares, unit)}（${formatNumber(shares)} 股）`
    : formatQuantityWithUnit(shares, unit);
}

export function getInitialQuantityUnit(shares: number): QuantityUnit {
  return shares % SHARES_PER_LOT === 0 ? "lot" : "share";
}

// Storage can throw, such as when the browser blocks site data; the unit is only a
// convenience, so the editor falls back to lots instead of failing.
export function getRememberedQuantityUnit(): QuantityUnit {
  try {
    return window.localStorage.getItem(QUANTITY_UNIT_STORAGE_KEY) === "share"
      ? "share"
      : "lot";
  } catch {
    return "lot";
  }
}

export function rememberQuantityUnit(unit: QuantityUnit): void {
  try {
    window.localStorage.setItem(QUANTITY_UNIT_STORAGE_KEY, unit);
  } catch {
    return;
  }
}

export function calculateDefaultHandlingFee(
  price: number,
  shares: number,
  side: TradeSide,
): number {
  if (price === 0) return 0;
  const rate = side === "buy" ? BUY_HANDLING_FEE_RATE : SELL_HANDLING_FEE_RATE;
  return Math.max(1, Math.floor(price * shares * rate));
}

export function calculateTradeAmount(price: number, shares: number): number {
  // Rounds the product at 12 significant digits first, so binary error such as
  // 1.005 × 100 = 100.49999… still rounds half up to 101.
  return Math.round(Number((price * shares).toPrecision(12)));
}

export function calculateTradeTotal(
  tradeAmount: number,
  fee: number,
  side: TradeSide,
): number {
  return side === "buy" ? tradeAmount + fee : tradeAmount - fee;
}

export function getTradeSide(record: TradeRecord): TradeSide {
  return record.deal_quantity > 0 ? "buy" : "sell";
}

export function getSignedShares(shares: number, side: TradeSide): number {
  return side === "buy" ? shares : -shares;
}

export function getHeldShares(
  tradeRecords: TradeRecord[],
  sid: string,
  excludedRecordId?: number,
): number {
  return tradeRecords
    .filter((record) => record.sid === sid && record.id !== excludedRecordId)
    .reduce((sum, record) => sum + record.deal_quantity, 0);
}

export function getTotalCashDividend(
  cashDividendRecords: CashDividendRecord[],
  sid: string,
  excludedRecordId?: number,
): number {
  return cashDividendRecords
    .filter((record) => record.sid === sid && record.id !== excludedRecordId)
    .reduce((sum, record) => sum + record.cash_dividend, 0);
}

export type OversoldSell = { date: string; shortShares: number };

type OrderedTrade = { id: number; date: string; shares: number };

function compareTrades(first: OrderedTrade, second: OrderedTrade): number {
  return first.date.localeCompare(second.date) || first.id - second.id;
}

function makeIdToRunningShares(trades: OrderedTrade[]): Map<number, number> {
  const idToRunningShares = new Map<number, number>();
  let runningShares = 0;
  for (const trade of [...trades].sort(compareTrades)) {
    runningShares += trade.shares;
    idToRunningShares.set(trade.id, runningShares);
  }
  return idToRunningShares;
}

function getRunningSharesBefore(trades: OrderedTrade[], target: OrderedTrade): number {
  return trades
    .filter((trade) => compareTrades(trade, target) < 0)
    .reduce((sum, trade) => sum + trade.shares, 0);
}

/**
 * Finds the sell REC-R24 warns about: the first sell from the edited date on whose
 * running shares drop below zero, and below what the saved records give.
 */
export function findOversoldSell({
  tradeRecords,
  sid,
  date,
  signedShares,
  editedRecord,
}: {
  tradeRecords: TradeRecord[];
  sid: string;
  date: string;
  signedShares: number;
  editedRecord?: TradeRecord;
}): OversoldSell | null {
  const toTrade = (record: TradeRecord): OrderedTrade => ({
    id: record.id,
    date: record.deal_time,
    shares: record.deal_quantity,
  });
  const otherTrades = tradeRecords
    .filter((record) => record.sid === sid && record.id !== editedRecord?.id)
    .map(toTrade);
  const thisTrade: OrderedTrade = {
    id: editedRecord?.id ?? Number.POSITIVE_INFINITY,
    date,
    shares: signedShares,
  };
  const savedTrades =
    editedRecord && editedRecord.sid === sid
      ? [...otherTrades, toTrade(editedRecord)]
      : otherTrades;
  const tradesWithThis = [...otherTrades, thisTrade];
  const runningWithThis = makeIdToRunningShares(tradesWithThis);
  const runningSaved = makeIdToRunningShares(savedTrades);
  const fromDate =
    editedRecord && editedRecord.deal_time < date ? editedRecord.deal_time : date;

  for (const trade of [...tradesWithThis].sort(compareTrades)) {
    if (trade.date < fromDate || trade.shares >= 0) continue;
    const running = runningWithThis.get(trade.id) ?? 0;
    const savedRunning =
      runningSaved.get(trade.id) ?? getRunningSharesBefore(savedTrades, trade);
    if (running < 0 && running < savedRunning) {
      return { date: trade.date, shortShares: -running };
    }
  }
  return null;
}

export type PriceRange = { lower: number; upper: number };

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getPriceLimitRange(
  stockInfo: StockInfo | undefined,
): PriceRange | null {
  if (!stockInfo || !(stockInfo.close > 0)) return null;
  const previousClose = stockInfo.close - stockInfo.fluct_price;
  if (!(previousClose > 0)) return null;
  return {
    lower: roundToCents(previousClose * (1 - PRICE_LIMIT_RATIO)),
    upper: roundToCents(previousClose * (1 + PRICE_LIMIT_RATIO)),
  };
}

export function getRecentlyRecordedSids(tradeRecords: TradeRecord[]): string[] {
  const sids: string[] = [];
  for (const record of [...tradeRecords].sort(
    (first, second) => second.id - first.id,
  )) {
    if (!sids.includes(record.sid)) sids.push(record.sid);
    if (sids.length === RECENT_STOCK_LIMIT) break;
  }
  return sids;
}

/**
 * Sums every trade as the REC-R23 summary does instead of counting the warehouse, so
 * the shares listed in the stock field never disagree with the summary.
 */
export function makeSidHeldSharesMap(
  tradeRecords: TradeRecord[],
  stockWarehouse: StockWarehouse,
): { [sid: string]: number } {
  const sidSharesMap: { [sid: string]: number } = {};
  for (const tradeRecord of tradeRecords) {
    sidSharesMap[tradeRecord.sid] =
      (sidSharesMap[tradeRecord.sid] ?? 0) + tradeRecord.deal_quantity;
  }
  const result: { [sid: string]: number } = {};
  for (const sid of Object.keys(stockWarehouse)) {
    const heldShares = sidSharesMap[sid] ?? 0;

    // A stock sold before its buys were recorded can sum to 0 or less; HOLD-R1 has
    // no holdings for it, so no count is shown.
    if (heldShares > 0) result[sid] = heldShares;
  }
  return result;
}

export function makeStockSuggestions({
  source,
  tradeRecords,
  stockWarehouse,
  sidHeldSharesMap,
  sidStockInfoMap,
}: {
  source: "recent" | "holdings";
  tradeRecords: TradeRecord[];
  stockWarehouse: StockWarehouse;
  sidHeldSharesMap: { [sid: string]: number };
  sidStockInfoMap: { [sid: string]: StockInfo };
}): StockSuggestions | null {
  const sidNameMap: { [sid: string]: string } = {};
  for (const tradeRecord of tradeRecords) {
    sidNameMap[tradeRecord.sid] ??= tradeRecord.company_name;
  }
  const [title, sids] =
    source === "recent"
      ? ["最近記過", getRecentlyRecordedSids(tradeRecords)]
      : ["持有中", Object.keys(stockWarehouse).sort()];
  if (sids.length === 0) return null;
  return {
    title,
    stocks: sids.map((sid) => ({
      sid,
      name: sidNameMap[sid] ?? sidStockInfoMap[sid]?.name ?? "",
      heldShares: sidHeldSharesMap[sid] ?? null,
    })),
  };
}
