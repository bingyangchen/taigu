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

export type CreateHandlingFeeDiscountRequestBody = {
  date: string;
  amount: number;
  memo?: string;
};

export type UpdateHandlingFeeDiscountRequestBody = {
  id: number;
  date?: string;
  amount?: number;
  memo?: string;
};
