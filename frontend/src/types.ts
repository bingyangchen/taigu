export type UpdateAccountInfoRequestBody = { username?: string; avatar_url?: string };

export type UpdateCashDividendRecordRequestBody = {
  id: string;
  sid: string;
  deal_time: string;
  cash_dividend: number;
};

export type CreateCashDividendRecordRequestBody = Omit<
  UpdateCashDividendRecordRequestBody,
  "id"
>;

export type UpdateOrCreateMemoRequestBody = { sid: string; note: string };

export type UpdateTradePlanRequestBody = {
  id: string;
  sid: string;
  plan_type: "buy" | "sell";
  target_price: number;
  target_quantity: number;
};

export type CreateTradePlanRequestBody = Omit<UpdateTradePlanRequestBody, "id">;

export type UpdateTradeRecordRequestBody = {
  id: string;
  sid: string;
  deal_time: string;
  deal_price: number;
  deal_quantity: number;
  handling_fee: number;
};

export type CreateTradeRecordRequestBody = Omit<UpdateTradeRecordRequestBody, "id">;

export type Subpage = {
  icon: JSX.Element;
  icon_bold?: JSX.Element;
  name: string;
  path: string;
};

export type Account = {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
};

export type StockWarehouse = { [sid: string]: number[] };

export type CashDividendRecord = {
  id: number;
  deal_time: string;
  sid: string;
  company_name: string;
  cash_dividend: number;
};

export type ToastMessage = { type: "success" | "error"; text: string };

export type CompanyInfo = {
  sid: string;
  company_name: string;
  business: string;
  note: string;
  material_facts: MaterialFact[];
};

export type MaterialFact = { date_time: string; title: string; description: string };

export type StockInfo = {
  sid: string;
  name: string;
  quantity: number;
  close: number;
  fluct_price: number;
};

export type IndexPriceInfo = { date: string; fluct_price: number; price: number };

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

export type MarketIndex = {
  tse: { [number: string]: { date: string; fluct_price: number; price: number } };
  otc: { [number: string]: { date: string; fluct_price: number; price: number } };
};

export type GraphQL = { query: string; variables?: { [key: string]: any } };
