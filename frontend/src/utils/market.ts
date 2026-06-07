import type {
  CashDividendRecord,
  MarketSortKey,
  MarketTab,
  StockInfo,
  StockWarehouse,
  TradeRecord,
} from "../types";
import Util from "./util";

export const calculateMarketValue = (
  stockInfo: StockInfo | undefined,
  inventoryCosts: number[],
): number => {
  return (stockInfo?.close ?? 0) * inventoryCosts.length;
};

export const getSidMarketValueMap = (
  sidStockInfoMap: { [sid: string]: StockInfo },
  stockWarehouse: { [sid: string]: number[] },
): { [sid: string]: number } => {
  const result: { [sid: string]: number } = {};
  for (const [sid, inventoryCosts] of Object.entries(stockWarehouse)) {
    result[sid] = calculateMarketValue(sidStockInfoMap[sid], inventoryCosts);
  }
  return result;
};

export const getTotalMarketValue = (
  sidStockInfoMap: { [sid: string]: StockInfo },
  stockWarehouse: { [sid: string]: number[] },
): number => {
  let result = 0;
  for (const [sid, inventoryCosts] of Object.entries(stockWarehouse)) {
    result += calculateMarketValue(sidStockInfoMap[sid], inventoryCosts);
  }
  return result;
};

export interface MarketSidsContext {
  tab: MarketTab;
  searchText: string;
  sortKey: MarketSortKey;
  stockWarehouse: StockWarehouse;
  favorites: string[];
  sidStockInfoMap: { [sid: string]: StockInfo | undefined };
  sidTradeRecordsMap: { [sid: string]: TradeRecord[] };
  cashDividendRecords: CashDividendRecord[];
}

export function getAllMarketSids(
  tab: MarketTab,
  stockWarehouse: StockWarehouse,
  favorites: string[],
): string[] {
  return tab === "holding" ? Object.keys(stockWarehouse) : favorites;
}

export function getStockName(
  sid: string,
  sidStockInfoMap: MarketSidsContext["sidStockInfoMap"],
  sidTradeRecordsMap: MarketSidsContext["sidTradeRecordsMap"],
): string {
  return (
    sidStockInfoMap[sid]?.name ?? sidTradeRecordsMap[sid]?.[0]?.company_name ?? sid
  );
}

export function getStockXirr(
  sid: string,
  stockInfo: StockInfo | undefined,
  stockWarehouse: StockWarehouse,
  sidTradeRecordsMap: MarketSidsContext["sidTradeRecordsMap"],
  cashDividendRecords: CashDividendRecord[],
): number {
  const inventoryCosts = stockWarehouse[sid] ?? [];
  const marketValue = calculateMarketValue(stockInfo, inventoryCosts);
  return Util.calculateXIRR(
    sidTradeRecordsMap[sid] || [],
    [],
    cashDividendRecords.filter((record) => record.sid === sid),
    marketValue,
  );
}

function getAbsoluteFluctPercent(stockInfo: StockInfo | undefined): number {
  if (!stockInfo || stockInfo.fluct_price === 0) return 0;
  const previousClose = stockInfo.close - stockInfo.fluct_price;
  if (previousClose === 0) return 0;
  return Math.abs(stockInfo.fluct_price / previousClose);
}

function compareMarketSids(
  leftSid: string,
  rightSid: string,
  context: MarketSidsContext,
): number {
  if (context.sortKey === "name") {
    return getStockName(
      leftSid,
      context.sidStockInfoMap,
      context.sidTradeRecordsMap,
    ).localeCompare(
      getStockName(rightSid, context.sidStockInfoMap, context.sidTradeRecordsMap),
      "zh-Hant",
    );
  }
  if (context.sortKey === "xirr") {
    return (
      getStockXirr(
        rightSid,
        context.sidStockInfoMap[rightSid],
        context.stockWarehouse,
        context.sidTradeRecordsMap,
        context.cashDividendRecords,
      ) -
      getStockXirr(
        leftSid,
        context.sidStockInfoMap[leftSid],
        context.stockWarehouse,
        context.sidTradeRecordsMap,
        context.cashDividendRecords,
      )
    );
  }
  if (context.sortKey === "fluct") {
    return (
      getAbsoluteFluctPercent(context.sidStockInfoMap[rightSid]) -
      getAbsoluteFluctPercent(context.sidStockInfoMap[leftSid])
    );
  }
  return (
    calculateMarketValue(
      context.sidStockInfoMap[rightSid],
      context.stockWarehouse[rightSid] ?? [],
    ) -
    calculateMarketValue(
      context.sidStockInfoMap[leftSid],
      context.stockWarehouse[leftSid] ?? [],
    )
  );
}

export function getVisibleMarketSids(context: MarketSidsContext): string[] {
  const keyword = context.searchText.trim().toLowerCase();
  return getAllMarketSids(context.tab, context.stockWarehouse, context.favorites)
    .filter((sid) => {
      if (!keyword) return true;
      const name = getStockName(
        sid,
        context.sidStockInfoMap,
        context.sidTradeRecordsMap,
      ).toLowerCase();
      return sid.toLowerCase().includes(keyword) || name.includes(keyword);
    })
    .sort((leftSid, rightSid) => compareMarketSids(leftSid, rightSid, context));
}
