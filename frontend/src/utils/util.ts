import {
  CashDividendRecord,
  HandlingFeeDiscount,
  Platform,
  TradePlan,
  TradeRecord,
} from "../types";
import { PWA_QUERY } from "./mediaQuery";

export default class Util {
  public static get isPWA(): boolean {
    return window.matchMedia(PWA_QUERY).matches;
  }

  public static get platform(): Platform {
    return Util.isPWA ? "pwa" : "web";
  }

  public static addPageReturnListener(listener: () => void): () => void {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") listener();
    };
    const handlePageShow = (event: PageTransitionEvent): void => {
      // `persisted` means the page was restored from the back-forward cache.
      if (event.persisted) listener();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }

  public static debounce = <T>(
    func: (..._args: T[]) => void,
    delay: number,
  ): ((..._args: T[]) => void) => {
    let timer: ReturnType<typeof setTimeout>;
    return (...params: T[]) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => func(...params), delay);
    };
  };

  public static isTradeRecord(
    target: TradeRecord | CashDividendRecord | TradePlan | HandlingFeeDiscount,
  ): target is TradeRecord {
    return "deal_quantity" in target && "deal_time" in target;
  }

  public static validateAndSanitizeUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return null;
      }
      return urlObj.href;
    } catch {
      return null;
    }
  }

  public static calculateXIRR(
    tradeRecords: TradeRecord[],
    handlingFeeDiscountRecords: HandlingFeeDiscount[],
    cashDividendRecords: CashDividendRecord[],
    totalMarketValue: number,
  ): number {
    if (tradeRecords.length <= 1) return 0;

    const msPerDay = 1000 * 60 * 60 * 24;
    const firstDateMs = Math.min(
      ...tradeRecords.map((record) => Date.parse(record.deal_time)),
    );
    const cashFlowMap = new Map<number, number>();

    tradeRecords.forEach((record) => {
      const cashFlow =
        -1 * record.deal_price * record.deal_quantity - record.handling_fee;
      const key = Math.round((Date.parse(record.deal_time) - firstDateMs) / msPerDay);
      cashFlowMap.set(key, (cashFlowMap.get(key) ?? 0) + cashFlow);
    });

    handlingFeeDiscountRecords.forEach((record) => {
      const cashFlow = record.amount;
      const key = Math.round((Date.parse(record.date) - firstDateMs) / msPerDay);
      cashFlowMap.set(key, (cashFlowMap.get(key) ?? 0) + cashFlow);
    });

    cashDividendRecords.forEach((record) => {
      const cashFlow = record.cash_dividend;
      const key = Math.round((Date.parse(record.deal_time) - firstDateMs) / msPerDay);
      cashFlowMap.set(key, (cashFlowMap.get(key) ?? 0) + cashFlow);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const key = Math.round((today.getTime() - firstDateMs) / msPerDay);
    cashFlowMap.set(key, (cashFlowMap.get(key) ?? 0) + totalMarketValue);

    if (cashFlowMap.size < 2) return 0;

    const cashFlowData = Array.from(cashFlowMap.entries()).map(([days, amount]) => {
      return { days, amount };
    });

    // NPV function: Σ(CF_i / (1 + rate)^(days_i / 365))
    const npv = (r: number): number => {
      return cashFlowData.reduce((sum, cf) => {
        const years = cf.days / 365;
        if (r <= -1) return Infinity;
        return sum + cf.amount / Math.pow(1 + r, years);
      }, 0);
    };

    // Bisection method
    const maxIterations = 100;
    const tolerance = 1e-6;
    let minRate = -0.99;
    let maxRate = 10;
    for (let i = 0; i < maxIterations; i++) {
      const midRate = (minRate + maxRate) / 2;
      const npvMid = npv(midRate);

      if (Math.abs(npvMid) < tolerance) return midRate;

      if (npvMid > 0) minRate = midRate;
      else maxRate = midRate;

      if (Math.abs(maxRate - minRate) < tolerance) return midRate;
    }
    return (minRate + maxRate) / 2;
  }
}
