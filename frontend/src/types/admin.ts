import type { Platform } from "./account";

export type ActiveUserCount = { value: number; change: number | null };

export type UsageSummary = {
  yesterday: string;
  compared_with: string;
  dau: ActiveUserCount | null;
  wau: ActiveUserCount | null;
  mau: ActiveUserCount | null;
  registered: { value: number; change: number };
};

export type RetentionCell =
  | { status: "no_signups"; count: null; percent: null }
  | { status: "in_progress"; count: null; percent: null }
  | { status: "complete"; count: number; percent: number };

export type RetentionWeek = {
  week_start: string;
  signups: number;
  day_1: RetentionCell;
  day_7: RetentionCell;
  day_30: RetentionCell;
};

export type UsageResponse = {
  recording_started_on: string | null;
  summary: UsageSummary;

  /** The "90" range of DailyUsageResponse. */
  days: DailyUsage[];
  retention: RetentionWeek[];
};

export type DailyUsage = {
  date: string;
  dau: number;
  wau: number;
  mau: number;
  signups: number;
  is_incomplete: boolean;
};

export type DailyUsageRange = "90" | "all";

export type DailyUsageResponse = { days: DailyUsage[] };

export type SubscriptionStatusKey =
  | "trialing"
  | "auto_renewing"
  | "auto_renewal_stopped"
  | "unsubscribed";

export type TrialConversion = { month: string; trials: number; paid: number } & (
  | { conversion_rate: null; status: null; settles_on: null }
  | { conversion_rate: string; status: "settled"; settles_on: null }
  | { conversion_rate: string; status: "in_progress"; settles_on: string }
);

export type MonthlyPayment = { month: string; count: number; amount: number };

export type SubscriptionsResponse = {
  statuses: Record<SubscriptionStatusKey, number>;
  whitelisted: number;
  trial_conversions: TrialConversion[];
  monthly_payments: MonthlyPayment[];
};

export type AdminIssueReport = {
  id: number;
  email: string;
  platform: Platform | null;
  user_agent: string | null;
  body: string;
  created_at: string;
  is_handled: boolean;
};

export type IssueReportFilter = "unhandled" | "all";

export type IssueReportsResponse = {
  reports: AdminIssueReport[];
  next_cursor: string | null;
};

export type IssueReportHandledResponse = {
  report: AdminIssueReport;
  unhandled_count: number;
};
