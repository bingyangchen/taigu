import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { BeautifulBlock, Button, Modal } from "../../../components";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { fetchAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import type { SubscriptionEntitlements } from "../../../types";
import Api from "../../../utils/api";
import CancelSubscriptionDialog, {
  type CancelSubscriptionFeedback,
} from "./CancelSubscriptionDialog";
import styles from "./CurrentPlan.module.scss";

type BillingResponse = {
  subscription: SubscriptionEntitlements;
  prices: { month: number; year: number };
};

type CheckoutResponse = { action_url: string; params: Record<string, string | number> };

type BillingInterval = "month" | "year";

const fallbackSubscription: SubscriptionEntitlements = {
  plan: "free",
  status: "canceled",
  billing_interval: "month",
  trial_ends_at: null,
  current_period_ends_at: null,
  cancel_at_period_end: false,
  market_refresh_interval_seconds: 600,
  quota: { monthly_records: 20, monthly_trade_plans: 10, holdings: 10, favorites: 10 },
  usage: { monthly_records: 0, monthly_trade_plans: 0, holdings: 0, favorites: 0 },
};

const standardBenefitItems = [
  "交易紀錄與現金股利不限筆數",
  "買賣計畫不限筆數",
  "持股與關注清單不限檔數",
  "行情約每 30 秒更新",
];
const confirmationBenefitItems = [
  "付款會在綠界標準付款頁完成",
  "付款成功後立即啟用 Standard",
  "後續依所選週期由綠界自動扣款",
];

export default function CurrentPlan(): React.ReactElement {
  const dispatch = useAppDispatch();
  const accountSubscription = useAppSelector((state) => state.account.subscription);
  const [searchParams, setSearchParams] = useSearchParams();
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
  const [pendingBillingInterval, setPendingBillingInterval] =
    useState<BillingInterval | null>(null);
  const [cancelSubscriptionError, setCancelSubscriptionError] = useState<string | null>(
    null,
  );
  const [cancelSubscriptionFeedback, setCancelSubscriptionFeedback] =
    useState<CancelSubscriptionFeedback>({ reason: "", detail: "" });
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const subscription = useMemo<SubscriptionEntitlements>(
    () =>
      billing?.subscription ?? {
        ...fallbackSubscription,
        plan: accountSubscription.plan,
        market_refresh_interval_seconds:
          accountSubscription.market_refresh_interval_seconds,
      },
    [accountSubscription, billing],
  );
  const isStandard = subscription.plan === "standard";
  const isTrialing = subscription.status === "trialing";
  const isActiveStandard = isStandard && subscription.status === "active";
  const canCancelAutoRenewal =
    subscription.plan === "standard" &&
    subscription.status === "active" &&
    !subscription.cancel_at_period_end;
  const hasStoppedAutoRenewal =
    subscription.plan === "standard" &&
    subscription.status === "active" &&
    subscription.cancel_at_period_end;
  const showUpgradeOptions = !isActiveStandard;
  const priceMonth = billing?.prices.month ?? 65;
  const priceYear = billing?.prices.year ?? 700;
  const yearlySavings = Math.max(priceMonth * 12 - priceYear, 0);
  const keyDate = getKeyDate(subscription);
  const pendingPrice =
    pendingBillingInterval === "year"
      ? priceYear
      : pendingBillingInterval === "month"
        ? priceMonth
        : null;
  const pendingIntervalLabel =
    pendingBillingInterval === "year"
      ? "年繳"
      : pendingBillingInterval === "month"
        ? "月繳"
        : "";

  const refreshBilling = useCallback(async (): Promise<void> => {
    const response = (await Api.sendRequest(
      "billing/subscription",
      "get",
    )) as BillingResponse;
    setBilling(response);
    await dispatch(fetchAccountInfo()).unwrap();
  }, [dispatch]);

  useEffect(() => {
    dispatch(updateHeaderTitle("付款與方案"));
    void refreshBilling();
  }, [dispatch, refreshBilling]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "ecpay") return;
    setNotice({
      type: "info",
      text: "若已完成付款，系統會在收到綠界通知後更新方案狀態。",
    });
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("checkout");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const quotaRows = useMemo<[string, number, number | null][]>(
    () => [
      [
        "交易與股利",
        subscription.usage.monthly_records,
        subscription.quota.monthly_records,
      ],
      [
        "買賣計畫",
        subscription.usage.monthly_trade_plans,
        subscription.quota.monthly_trade_plans,
      ],
      ["持股", subscription.usage.holdings, subscription.quota.holdings],
      ["關注", subscription.usage.favorites, subscription.quota.favorites],
    ],
    [subscription],
  );

  return (
    <div className={styles.main}>
      {notice && (
        <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.text}</div>
      )}

      <BeautifulBlock title="目前方案">
        <div className={styles.summary}>
          <div className={styles.summaryHeader}>
            <div className={styles.planIdentity}>
              <strong>{getPlanName(subscription)}</strong>
              <span
                className={`${styles.planBadge} ${
                  styles[getPlanBadgeTone(subscription)]
                }`}
              >
                {getPlanBadgeLabel(subscription)}
              </span>
              <span className={styles.planPrice}>
                {getPlanPriceLabel(subscription, priceMonth, priceYear)}
              </span>
            </div>
          </div>
          <p>{getPlanDescription(subscription)}</p>
          <div className={styles.summaryGrid}>
            {keyDate && (
              <div>
                <span>{keyDate.label}</span>
                <strong>{keyDate.value}</strong>
              </div>
            )}
            <div>
              <span>行情更新</span>
              <strong>約每 {subscription.market_refresh_interval_seconds} 秒</strong>
            </div>
          </div>
          {isStandard && (
            <div className={styles.quotaInline}>
              <span>額度</span>
              <strong>交易與股利、買賣計畫、持股、關注皆不限量</strong>
            </div>
          )}
          {!isActiveStandard && isTrialing && (
            <div className={styles.upgradeHint}>
              選擇付款週期後會前往綠界標準付款頁完成訂閱。
            </div>
          )}
        </div>
      </BeautifulBlock>

      {showUpgradeOptions && (
        <BeautifulBlock title="方案選擇">
          <div className={styles.planSummary}>
            <strong>{isTrialing ? "選擇續用方式" : "升級 Standard"}</strong>
            <span>
              Standard 可解除 Free 額度限制，並取得約每 30
              秒更新的行情。付款流程會在綠界標準付款頁完成。
            </span>
          </div>
          <BenefitSummary
            title="Standard 包含"
            items={standardBenefitItems}
            className={styles.benefitSummary}
          />
          <PlanActionGroup
            isWaiting={isWaiting}
            priceMonth={priceMonth}
            priceYear={priceYear}
            yearlySavings={yearlySavings}
            onSelect={setPendingBillingInterval}
          />
        </BeautifulBlock>
      )}

      {!isStandard && (
        <BeautifulBlock title="額度使用">
          <div className={styles.quotaList}>
            {quotaRows.map(([label, used, quota]) => (
              <div className={styles.quotaRow} key={label.toString()}>
                <div className={styles.quotaMeta}>
                  <span>{label}</span>
                  <strong>
                    {quota === null
                      ? "不限量"
                      : `本月 ${used.toLocaleString()} / ${quota}`}
                  </strong>
                </div>
                {quota !== null && (
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressBar}
                      style={{ width: `${Math.min((used / quota) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </BeautifulBlock>
      )}

      {(canCancelAutoRenewal || hasStoppedAutoRenewal) && (
        <BeautifulBlock title="訂閱管理">
          {canCancelAutoRenewal ? (
            <SubscriptionManagementPanel onStopAutoRenewal={handleOpenCancelDialog} />
          ) : (
            <SubscriptionStoppedPanel />
          )}
        </BeautifulBlock>
      )}

      {pendingBillingInterval && pendingPrice !== null && (
        <Modal
          title="確認訂閱 Standard"
          layout="compact"
          visualLayer="nested"
          discardButtonProps={{
            className: "secondary l",
            children: "取消",
            onClick: () => setPendingBillingInterval(null),
          }}
          submitButtonProps={{
            className: "primary_fill l",
            children: "前往綠界付款",
            waiting: isWaiting,
            onClick: () => handleStartSubscription(pendingBillingInterval),
          }}
        >
          <p className={styles.confirmNotice}>
            請確認方案內容。下一步會前往綠界標準付款頁，付款完成後由綠界通知 Taigu
            啟用方案。
          </p>
          <div className={styles.confirmSubscription}>
            <div>
              <span>方案</span>
              <strong>Standard</strong>
            </div>
            <div>
              <span>付款週期</span>
              <strong>{pendingIntervalLabel}</strong>
            </div>
            <div>
              <span>每期金額</span>
              <strong>NT${pendingPrice.toLocaleString()}</strong>
            </div>
            <div>
              <span>付款服務</span>
              <strong>綠界全方位金流</strong>
            </div>
          </div>
          <BenefitSummary
            title="確認事項"
            items={confirmationBenefitItems}
            className={styles.confirmBenefits}
          />
        </Modal>
      )}

      <CancelSubscriptionDialog
        subscription={subscription}
        isOpen={isCancelDialogOpen}
        isWaiting={isCancelingSubscription}
        errorMessage={cancelSubscriptionError}
        onClose={handleCloseCancelDialog}
        onConfirm={handleCancelSubscription}
        onReasonChange={setCancelSubscriptionFeedback}
      />
    </div>
  );

  async function handleStartSubscription(interval: BillingInterval): Promise<void> {
    setIsWaiting(true);
    setNotice(null);
    try {
      const response = (await Api.sendRequest(
        "billing/subscription",
        "post",
        JSON.stringify({ plan: "standard", billing_interval: interval }),
      )) as CheckoutResponse;
      submitCheckoutForm(response);
    } catch (error) {
      const text = getUserFacingError(error, "訂閱未建立，請稍後再試或確認付款資料。");
      setNotice({ type: "error", text });
      dispatch(pushToast({ type: "error", text }));
      setIsWaiting(false);
    }
  }

  function handleOpenCancelDialog(): void {
    setCancelSubscriptionError(null);
    setIsCancelDialogOpen(true);
  }

  function handleCloseCancelDialog(): void {
    if (isCancelingSubscription) return;
    setIsCancelDialogOpen(false);
    setCancelSubscriptionError(null);
  }

  async function handleCancelSubscription(): Promise<void> {
    setIsCancelingSubscription(true);
    setCancelSubscriptionError(null);
    try {
      await Api.sendRequest(
        "billing/subscription/cancel",
        "post",
        JSON.stringify({
          reason: cancelSubscriptionFeedback.reason || null,
          reason_detail: cancelSubscriptionFeedback.detail || null,
        }),
      );
      setIsCancelDialogOpen(false);
      await refreshBilling();
      const periodEnd = formatDate(subscription.current_period_ends_at);
      const text = `已停止自動續訂，Standard 權益會保留到 ${periodEnd}。`;
      setNotice({ type: "success", text });
      dispatch(pushToast({ type: "success", text: "已停止自動續訂" }));
    } catch (error) {
      setCancelSubscriptionError(getCancelSubscriptionError(error));
    } finally {
      setIsCancelingSubscription(false);
    }
  }
}

function SubscriptionManagementPanel({
  onStopAutoRenewal,
}: {
  onStopAutoRenewal: () => void;
}): React.ReactElement {
  return (
    <div className={styles.subscriptionManagement}>
      <div>
        <strong>自動續訂</strong>
        <p>
          目前 Standard
          會在下次續費日自動續訂。你可以停止下次扣款，權益會保留到本期結束。
        </p>
      </div>
      <Button
        className={`dangerous l border ${styles.stopAutoRenewalButton}`}
        onClick={onStopAutoRenewal}
      >
        停止自動續訂
      </Button>
    </div>
  );
}

function SubscriptionStoppedPanel(): React.ReactElement {
  return (
    <div className={`${styles.subscriptionManagement} ${styles.subscriptionStopped}`}>
      <div>
        <strong>已停止自動續訂</strong>
        <p>Standard 權益會保留到本期結束。到期後會切換為 Free，不會再自動扣款。</p>
      </div>
    </div>
  );
}

function BenefitSummary({
  title,
  items,
  className,
}: {
  title: string;
  items: string[];
  className: string;
}): React.ReactElement {
  return (
    <div className={className}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PlanActionGroup({
  isWaiting,
  priceMonth,
  priceYear,
  yearlySavings,
  onSelect,
}: {
  isWaiting: boolean;
  priceMonth: number;
  priceYear: number;
  yearlySavings: number;
  onSelect: (interval: BillingInterval) => void;
}): React.ReactElement {
  return (
    <div className={`${styles.planActionGroup} ${styles.planActions}`}>
      <div className={styles.planOptions}>
        <Button
          className={`transparent l ${styles.planOptionButton}`}
          waiting={isWaiting}
          onClick={() => onSelect("month")}
        >
          <span className={styles.planOptionContent}>
            <span className={styles.planOptionHeader}>
              <span className={styles.planOptionName}>月繳</span>
            </span>
            <span className={styles.planOptionPrice}>NT${priceMonth}</span>
            <span className={styles.planOptionMeta}>每月自動續訂，保留彈性</span>
          </span>
        </Button>
        <Button
          className={`transparent l ${styles.planOptionButton} ${styles.recommendedPlanOption}`}
          waiting={isWaiting}
          onClick={() => onSelect("year")}
        >
          <span className={styles.planOptionContent}>
            <span className={styles.planOptionHeader}>
              <span className={styles.planOptionName}>年繳</span>
              <span className={styles.recommendedBadge}>推薦</span>
            </span>
            <span className={styles.planOptionPrice}>NT${priceYear}</span>
            <span className={styles.planOptionMeta}>
              {yearlySavings > 0
                ? `每年自動續訂，省 NT$${yearlySavings}`
                : "每年自動續訂"}
            </span>
          </span>
        </Button>
      </div>
    </div>
  );
}

function getPlanName(subscription: SubscriptionEntitlements): string {
  return subscription.plan === "standard" ? "Standard" : "Free";
}

function getPlanBadgeLabel(subscription: SubscriptionEntitlements): string {
  if (subscription.plan === "standard" && subscription.status === "trialing") {
    return "試用中";
  }
  if (subscription.plan === "standard") {
    return subscription.billing_interval === "year" ? "年繳" : "月繳";
  }
  return "使用中";
}

function getPlanBadgeTone(subscription: SubscriptionEntitlements): string {
  if (subscription.plan === "free") {
    return "planBadgeCurrent";
  }
  if (subscription.status === "trialing") {
    return "planBadgeTrial";
  }
  return "planBadgeBilling";
}

function getPlanPriceLabel(
  subscription: SubscriptionEntitlements,
  priceMonth: number,
  priceYear: number,
): string {
  if (subscription.plan === "free" || subscription.status === "trialing") {
    return "NT$0";
  }
  return subscription.billing_interval === "year"
    ? `NT$${priceYear}/年`
    : `NT$${priceMonth}/月`;
}

function getPlanDescription(subscription: SubscriptionEntitlements): string {
  if (subscription.plan === "standard" && subscription.status === "trialing") {
    return "試用期間可使用 Standard 全部額度。試用結束後會回到 Free。";
  }
  if (subscription.plan === "standard" && subscription.status === "active") {
    return subscription.cancel_at_period_end
      ? `目前方案可使用至 ${formatDate(subscription.current_period_ends_at)}。到期後會切換為 Free，不會再自動扣款。`
      : "已啟用自動續訂，以下是目前的帳務摘要。";
  }
  if (subscription.status === "past_due") {
    return "付款未完成，重新完成付款後可恢復 Standard 權益。";
  }
  return "適合開始記錄台股交易；升級後可解除額度限制並取得更即時的行情更新。";
}

function getKeyDate(
  subscription: SubscriptionEntitlements,
): { label: string; value: string } | null {
  if (subscription.status === "trialing" && subscription.trial_ends_at) {
    return { label: "試用至", value: formatDate(subscription.trial_ends_at) };
  }
  if (subscription.status === "active" && subscription.current_period_ends_at) {
    return {
      label: subscription.cancel_at_period_end ? "有效至" : "下次續費",
      value: formatDate(subscription.current_period_ends_at),
    };
  }
  if (subscription.status === "canceled" && subscription.current_period_ends_at) {
    return { label: "有效至", value: formatDate(subscription.current_period_ends_at) };
  }
  return null;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getUserFacingError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getCancelSubscriptionError(error: unknown): string {
  if (
    error instanceof TypeError ||
    (error instanceof Error && /fetch|network/i.test(error.message)) ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  ) {
    return "網路連線不穩，尚未完成變更。請確認連線後再試一次。";
  }
  return getUserFacingError(error, "暫時無法停止自動續訂，請稍後再試。");
}

function submitCheckoutForm(checkout: CheckoutResponse): void {
  const form = document.createElement("form");
  form.method = "post";
  form.action = checkout.action_url;
  form.style.display = "none";
  Object.entries(checkout.params).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}
