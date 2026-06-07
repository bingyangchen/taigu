import type { StockWarehouse } from "./stock";

export type TradeRecordState = {
  tradeRecords: TradeRecord[];
  sidTradeRecordsMap: { [sid: string]: TradeRecord[] };
  sidHandlingFeeMap: { [sid: string]: number };
  sidGainMap: { [sid: string]: number };
  sidCashInvestedMap: { [sid: string]: number };
  stockWarehouse: StockWarehouse;
  totalCashInvested: number;
  totalHandlingFee: number;
  cashInvestedChartData: (string | number)[][];
  tradeVolumeChartData: (string | number)[][];
  averageCashInvested: number;
  isWaiting: boolean;
};

export type CashDividendRecord = {
  id: number;
  deal_time: string;
  sid: string;
  company_name: string;
  cash_dividend: number;
};

export type TradePlan = {
  id: string;
  sid: string;
  company_name: string;
  plan_type: "buy" | "sell";
  target_price: number;
  target_quantity: number;
};

export type TradeRecord = {
  id: number;
  deal_time: string;
  sid: string;
  company_name: string;
  deal_price: number;
  deal_quantity: number;
  handling_fee: number;
};

export type TradeRecordSyncResponse = {
  last_revision: number;
  updates: TradeRecord[];
  deletes: number[];
  is_full_snapshot: boolean;
};

export type HandlingFeeDiscount = {
  id: number;
  date: string;
  amount: number;
  memo: string;
};
