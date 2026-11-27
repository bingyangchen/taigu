export type StockWarehouse = { [sid: string]: number[] };

export type SuggestedStock = { sid: string; name: string; heldShares: number | null };

export type StockSuggestions = { title: string; stocks: SuggestedStock[] };

export type MaterialFact = { date_time: string; title: string; description: string };

export type CompanyInfo = {
  sid: string;
  company_name: string;
  business: string;
  note: string;
  material_facts: MaterialFact[];
};

export type StockInfo = {
  sid: string;
  name: string;
  quantity: number;
  close: number;
  fluct_price: number;

  // The trading date of the quote. Only `market/current-stock-info` returns it,
  // and the backend in production leaves it out until it is deployed with it.
  date?: string;
};

export type StockIntradayPrices = {
  date: string | null;
  yesterday_price?: number;
  last_fluct_price?: number;
  [minute: string]: number | string | null | undefined;
};

export type MarketId = "tse" | "otc";

export type MarketIndexIntradayPrices = {
  [minute: number]: number | undefined;
  yesterday_price?: number;
  last_fluct_price?: number;
};

export type MarketIndex = Record<MarketId, MarketIndexIntradayPrices> & {
  date: string | null;
  dates?: Record<MarketId, string | null>;
};
