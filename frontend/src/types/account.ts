export type Platform = "web" | "pwa";

export type SubscriptionPlan = "free" | "standard";

export type PlanQuotaResource = "records" | "trade_plans" | "holdings" | "favorites";

export type SubscriptionEntitlements = {
  plan: SubscriptionPlan;
  status: "trialing" | "active" | "past_due" | "canceled";
  billing_interval: "month" | "year";
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  is_current_period_active?: boolean;
  is_whitelisted?: boolean;
  market_refresh_interval_seconds: number;
  quota: {
    monthly_records: number | null;
    monthly_trade_plans: number | null;
    holdings: number | null;
    favorites: number | null;
  };
  usage: {
    monthly_records: number;
    monthly_trade_plans: number;
    holdings: number;
    favorites: number;
  };
};

export type AccountSubscription = Pick<
  SubscriptionEntitlements,
  "plan" | "market_refresh_interval_seconds"
>;

export type Account = {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  is_superuser: boolean;
  subscription: AccountSubscription;
};
