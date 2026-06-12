export type StockWarehouse = { [sid: string]: number[] };

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
};

export type StockIntradayPrices = {
  date: string | null;
  yesterday_price?: number;
  last_fluct_price?: number;
  [minute: string]: number | string | null | undefined;
};

export type MarketIndex = {
  date: string;
  tse: { [number: string]: number } & {
    yesterday_price?: number;
    last_fluct_price?: number;
  };
  otc: { [number: string]: number } & {
    yesterday_price?: number;
    last_fluct_price?: number;
  };
};
