import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { BeautifulBlock, Button, Modal, Skeleton } from "../../../components";
import { useAppDispatch } from "../../../redux/hooks";
import { fetchAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import type { SubscriptionEntitlements } from "../../../types";
import Api, { UNKNOWN_API_ERROR_MESSAGE } from "../../../utils/api";
import { SessionChangedError } from "../../../utils/session";
import CancelSubscriptionDialog from "./CancelSubscriptionDialog";
import styles from "./CurrentPlan.module.scss";
import { formatDate, getFirstPeriodEndDate } from "./date";

type BillingResponse = {
  subscription: SubscriptionEntitlements;
  prices: { month: number; year: number };
};

type CheckoutResponse = { action_url: string; params: Record<string, string | number> };

type BillingInterval = "month" | "year";

type PendingCheckout = { interval: BillingInterval; nextRenewalDate: string };

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(true);
  const [isBillingLoadFailed, setIsBillingLoadFailed] = useState(false);
  const latestBillingRequestId = useRef(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [cancelSubscriptionError, setCancelSubscriptionError] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  const loadBilling = useCallback(async (): Promise<void> => {
    const requestId = ++latestBillingRequestId.current;
    setIsBillingLoading(true);
    setIsBillingLoadFailed(false);
    try {
      const response = (await Api.sendRequest("billing/subscription", "get")) as
        | BillingResponse
        | undefined;

      // No response means Api is already taking the user to another page.
      if (response === undefined || requestId !== latestBillingRequestId.current)
        return;
      setBilling(response);
      setIsBillingLoading(false);
      void dispatch(fetchAccountInfo());
    } catch (error) {
      if (error instanceof SessionChangedError) return;
      if (requestId !== latestBillingRequestId.current) return;
      setIsBillingLoadFailed(true);
      setIsBillingLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(updateHeaderTitle("付款與方案"));
    void loadBilling();
  }, [dispatch, loadBilling]);

  useEffect(() => {
    // Going back from ECPay's payment page may restore this page as it was left,
    // with the confirmation dialog open and its button still waiting.
    function handlePageShow(event: PageTransitionEvent): void {
      if (!event.persisted) return;
      setIsWaiting(false);
      setPendingCheckout(null);
      void loadBilling();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadBilling]);

  useEffect(() => {
    // The dialog's trigger is gone after stopping auto-renewal, so focus moves to
    // the notice that reports the result.
    if (notice?.type === "success") noticeRef.current?.focus();
  }, [notice]);

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

  const noticeElement = notice && (
    <div
      ref={noticeRef}
      className={`${styles.notice} ${styles[notice.type]}`}
      role="status"
      tabIndex={-1}
    >
      {notice.text}
    </div>
  );

  if (isBillingLoadFailed) {
    return (
      <div className={styles.main}>
        {noticeElement}
        <div className={styles.loadFailure} role="alert">
          <p>暫時無法取得方案資料，請稍後再試。</p>
          <Button
            className={`white border l ${styles.reloadButton}`}
            onClick={() => void loadBilling()}
          >
            重新載入
          </Button>
        </div>
      </div>
    );
  }

  if (isBillingLoading || billing === null) {
    return (
      <div className={styles.main}>
        <CurrentPlanSkeleton />
      </div>
    );
  }

  const { subscription, prices } = billing;
  const isWhitelisted = subscription.is_whitelisted === true;
  const isStandard = subscription.plan === "standard";
  const isTrialing = subscription.status === "trialing";
  const isAwaitingRenewal = subscription.is_awaiting_renewal === true;
  const canCancelAutoRenewal =
    (isWithinPaidPeriod(subscription) || isAwaitingRenewal) &&
    !subscription.cancel_at_period_end;
  const hasStoppedAutoRenewal =
    isWithinPaidPeriod(subscription) &&
    subscription.cancel_at_period_end &&
    !isWhitelisted;
  const showWhitelistSummary =
    isWhitelisted &&
    !(isWithinPaidPeriod(subscription) && !subscription.cancel_at_period_end);
  const showUpgradeOptions =
    !isWithinPaidPeriod(subscription) && !isAwaitingRenewal && !isWhitelisted;
  const priceMonth = prices.month;
  const priceYear = prices.year;
  const yearlySavings = Math.max(priceMonth * 12 - priceYear, 0);
  const keyDate = showWhitelistSummary ? null : getKeyDate(subscription);
  const planBadgeLabel = showWhitelistSummary
    ? "使用中"
    : getPlanBadgeLabel(subscription);
  const planBadgeTone = showWhitelistSummary
    ? "planBadgeCurrent"
    : getPlanBadgeTone(subscription);
  const pendingPrice = pendingCheckout?.interval === "year" ? priceYear : priceMonth;
  const pendingIntervalLabel = pendingCheckout?.interval === "year" ? "年繳" : "月繳";
  const quotaRows: [string, number, number | null][] = [
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
  ];

  return (
    <div className={styles.main}>
      {noticeElement}

      <BeautifulBlock title="目前方案">
        <div className={styles.summary}>
          <div className={styles.summaryHeader}>
            <div className={styles.planIdentity}>
              <strong>{getPlanName(subscription)}</strong>
              <span className={`${styles.planBadge} ${styles[planBadgeTone]}`}>
                {planBadgeLabel}
              </span>
              {!showWhitelistSummary && (
                <span className={styles.planPrice}>
                  {getPlanPriceLabel(subscription, priceMonth, priceYear)}
                </span>
              )}
            </div>
          </div>
          {!showWhitelistSummary && <p>{getPlanDescription(subscription)}</p>}
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
          {showUpgradeOptions && isTrialing && (
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
            onSelect={(interval) => {
              rememberDialogTrigger();
              setPendingCheckout({
                interval,
                nextRenewalDate: getFirstPeriodEndDate(interval, new Date()),
              });
            }}
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
            <SubscriptionManagementPanel
              isAwaitingRenewal={isAwaitingRenewal}
              nextRenewalDate={formatDate(subscription.current_period_ends_at)}
              onStopAutoRenewal={handleOpenCancelDialog}
            />
          ) : (
            <SubscriptionStoppedPanel />
          )}
        </BeautifulBlock>
      )}

      {pendingCheckout && (
        <Modal
          title="確認訂閱 Standard"
          layout="compact"
          visualLayer="nested"
          discardButtonProps={{
            className: "secondary l",
            children: "取消",
            onClick: () => {
              setPendingCheckout(null);
              restoreDialogTriggerFocus();
            },
          }}
          submitButtonProps={{
            className: "primary_fill l",
            children: "前往綠界付款",
            waiting: isWaiting,
            onClick: () => handleStartSubscription(pendingCheckout.interval),
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
              <span>下次扣款日</span>
              <strong>{pendingCheckout.nextRenewalDate}</strong>
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

  // Neither dialog has a Radix trigger, so focus would fall to the page body when
  // it closes.
  function rememberDialogTrigger(): void {
    dialogTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function restoreDialogTriggerFocus(): void {
    requestAnimationFrame(() => dialogTriggerRef.current?.focus());
  }

  function handleOpenCancelDialog(): void {
    rememberDialogTrigger();
    setCancelSubscriptionError(null);
    setIsCancelDialogOpen(true);
  }

  function handleCloseCancelDialog(): void {
    if (isCancelingSubscription) return;
    setIsCancelDialogOpen(false);
    setCancelSubscriptionError(null);
    restoreDialogTriggerFocus();
  }

  async function handleCancelSubscription(): Promise<void> {
    setIsCancelingSubscription(true);
    setCancelSubscriptionError(null);
    try {
      const response = (await Api.sendRequest(
        "billing/subscription/cancel",
        "post",
        JSON.stringify({}),
        // The dialog shows the error itself.
        { silentOnFailure: true },
      )) as { subscription: SubscriptionEntitlements } | undefined;
      if (response === undefined) return;
      setBilling(
        (current) => current && { ...current, subscription: response.subscription },
      );
      setIsCancelDialogOpen(false);
      setNotice({ type: "success", text: getStopNotice(response.subscription) });
      dispatch(pushToast({ type: "success", text: "已停止自動續訂" }));
      void dispatch(fetchAccountInfo());
    } catch (error) {
      setCancelSubscriptionError(getCancelSubscriptionError(error));
    } finally {
      setIsCancelingSubscription(false);
    }
  }
}

function CurrentPlanSkeleton(): React.ReactElement {
  return (
    <>
      <BeautifulBlock title="目前方案">
        <div className={styles.summarySkeleton} aria-busy="true" aria-live="polite">
          <div className={styles.skeletonHeader}>
            <Skeleton size="large" />
            <Skeleton size="badge" />
            <Skeleton size="small" />
          </div>
          <Skeleton size="full" />
          <Skeleton size="medium" />
          <div className={styles.skeletonRows}>
            <Skeleton width="min(100%, 340px)" height={17} />
            <Skeleton width="min(86%, 300px)" height={17} />
          </div>
        </div>
      </BeautifulBlock>
      <BeautifulBlock title="方案選擇">
        <div className={styles.planSelectionSkeleton} aria-hidden="true">
          <Skeleton size="large" />
          <Skeleton size="full" />
          <Skeleton size="medium" />
          <div className={styles.skeletonBenefitGrid}>
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} />
          </div>
          <div className={styles.skeletonPlanOptions}>
            <Skeleton height={116} borderRadius={8} />
            <Skeleton height={116} borderRadius={8} />
          </div>
        </div>
      </BeautifulBlock>
    </>
  );
}

function SubscriptionManagementPanel({
  isAwaitingRenewal,
  nextRenewalDate,
  onStopAutoRenewal,
}: {
  isAwaitingRenewal: boolean;
  nextRenewalDate: string;
  onStopAutoRenewal: () => void;
}): React.ReactElement {
  return (
    <div className={styles.subscriptionManagement}>
      <div>
        <strong>自動續訂</strong>
        <p>
          {isAwaitingRenewal
            ? "本期的扣款結果還在確認中。停止後不會再自動扣款。"
            : `下次將於 ${nextRenewalDate} 自動扣款。你可以停止自動續訂，權益會保留到本期結束。`}
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

function isWithinPaidPeriod(subscription: SubscriptionEntitlements): boolean {
  return (
    subscription.is_current_period_active ??
    (subscription.plan === "standard" && subscription.status === "active")
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
  if (subscription.is_awaiting_renewal === true) {
    return "正在確認本期的扣款結果，確認前仍可使用 Standard 方案。";
  }
  if (isWithinPaidPeriod(subscription)) {
    return subscription.cancel_at_period_end
      ? `目前方案可使用至 ${formatDate(subscription.current_period_ends_at)}。到期後會切換為 Free，不會再自動扣款。`
      : "已啟用自動續訂，以下是目前的帳務摘要。";
  }
  if (subscription.ended_by_failed_renewal === true) {
    return "上一期的扣款沒有成功，自動續訂已經結束。重新訂閱即可恢復 Standard 方案。";
  }
  return "適合開始記錄台股交易；升級後可解除額度限制並取得更即時的行情更新。";
}

function getKeyDate(
  subscription: SubscriptionEntitlements,
): { label: string; value: string } | null {
  if (subscription.status === "trialing" && subscription.trial_ends_at) {
    return { label: "試用至", value: formatDate(subscription.trial_ends_at) };
  }
  if (subscription.is_awaiting_renewal === true) {
    return { label: "扣款日", value: formatDate(subscription.current_period_ends_at) };
  }
  if (isWithinPaidPeriod(subscription) && subscription.current_period_ends_at) {
    return {
      label: subscription.cancel_at_period_end ? "有效至" : "下次扣款日",
      value: formatDate(subscription.current_period_ends_at),
    };
  }
  return null;
}

function getStopNotice(subscription: SubscriptionEntitlements): string {
  if (subscription.is_whitelisted === true) return "已停止自動續訂，之後不會再扣款。";
  if (subscription.status === "canceled") return "已停止自動續訂，目前方案是 Free。";
  return `已停止自動續訂，Standard 權益會保留到 ${formatDate(subscription.current_period_ends_at)}。`;
}

function getUserFacingError(error: unknown, fallback: string): string {
  return error instanceof Error &&
    error.message &&
    error.message !== UNKNOWN_API_ERROR_MESSAGE
    ? error.message
    : fallback;
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
