import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { BeautifulBlock, BeautifulRow, Button } from "../../../components";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { fetchAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import type { BillingCard, SubscriptionEntitlements } from "../../../types";
import Api from "../../../utils/api";
import CancelSubscriptionDialog, {
  type CancelSubscriptionFeedback,
} from "./CancelSubscriptionDialog";
import styles from "./CurrentPlan.module.scss";

declare global {
  interface Window {
    ECPay?: {
      initialize: (
        environment: "Stage" | "Prod",
        displayMode: 1,
        callback: (errorMessage: string | null) => void,
      ) => void;
      addBindingCard: (
        token: string,
        language: "zh-TW" | "en-US",
        callback: (errorMessage: string | null) => void,
      ) => void;
      getBindCardPayToken: (
        callback: (
          result: { BindCardPayToken: string },
          errorMessage: string | null,
        ) => void,
      ) => void;
    };
  }
}

type BillingResponse = {
  subscription: SubscriptionEntitlements;
  card: BillingCard | null;
  prices: { month: number; year: number };
};

type BindTokenResponse = {
  token: string;
  sdk_environment: "Stage" | "Prod";
  sdk_url: string;
};

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

const scriptUrls = [
  "https://code.jquery.com/jquery-3.7.1.min.js",
  "https://cdn.jsdelivr.net/npm/node-forge@0.7.0/dist/forge.min.js",
];

let isEcpayInitialized = false;

const paymentMethodHighlightDurationMs = 1500;

export default function CurrentPlan(): React.ReactElement {
  const dispatch = useAppDispatch();
  const accountSubscription = useAppSelector((state) => state.account.subscription);
  const [searchParams, setSearchParams] = useSearchParams();
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isBindingCard, setIsBindingCard] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
  const [cancelSubscriptionError, setCancelSubscriptionError] = useState<string | null>(
    null,
  );
  const [cancelSubscriptionFeedback, setCancelSubscriptionFeedback] =
    useState<CancelSubscriptionFeedback>({ reason: "", detail: "" });
  const [isCardBindingPanelOpen, setIsCardBindingPanelOpen] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isPaymentMethodHighlighted, setIsPaymentMethodHighlighted] = useState(false);
  const paymentMethodSectionRef = useRef<HTMLDivElement>(null);
  const paymentMethodHighlightTimeoutRef = useRef<number | null>(null);
  const isSubmittingCardBindingRef = useRef(false);

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
  const card = billing?.card ?? null;
  const isStandard = subscription.plan === "standard";
  const isTrialing = subscription.status === "trialing";
  const isActiveStandard = isStandard && subscription.status === "active";
  const hasCard = Boolean(card);
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

  const refreshBilling = useCallback(async (): Promise<void> => {
    const response = (await Api.sendRequest("billing/me", "get")) as BillingResponse;
    setBilling(response);
    await dispatch(fetchAccountInfo()).unwrap();
  }, [dispatch]);

  useEffect(() => {
    dispatch(updateHeaderTitle("付款與方案"));
    void refreshBilling();
  }, [dispatch, refreshBilling]);

  useEffect(() => {
    const bindResult = searchParams.get("bind");
    const clearBindResultFromUrl = (): void => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("bind");
      setSearchParams(nextSearchParams, { replace: true });
    };

    if (bindResult === "success") {
      setIsCardBindingPanelOpen(false);
      setNotice({ type: "success", text: "信用卡綁定成功，可以繼續選擇方案。" });
      dispatch(pushToast({ type: "success", text: "信用卡綁定成功" }));
      clearBindResultFromUrl();
    } else if (bindResult === "failed") {
      const text = "信用卡綁定未完成，請確認卡號或稍後再試。";
      setNotice({ type: "error", text });
      dispatch(pushToast({ type: "error", text }));
      clearBindResultFromUrl();
    }
  }, [dispatch, searchParams, setSearchParams]);

  useEffect(() => {
    return () => {
      if (paymentMethodHighlightTimeoutRef.current !== null) {
        window.clearTimeout(paymentMethodHighlightTimeoutRef.current);
      }
    };
  }, []);

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
          {!isActiveStandard &&
            (isTrialing ? (
              !hasCard && (
                <div className={styles.upgradeHint}>
                  綁定信用卡後可選擇月繳或年繳續用。
                </div>
              )
            ) : (
              <div className={styles.upgradeHint}>升級前需先綁定信用卡。</div>
            ))}
        </div>
      </BeautifulBlock>

      {showUpgradeOptions && (
        <BeautifulBlock title="方案選擇">
          {hasCard ? (
            <>
              <div className={styles.planSummary}>
                <strong>
                  {isTrialing ? "試用後繼續使用 Standard" : "升級 Standard"}
                </strong>
              </div>
              <PlanActionGroup
                cardLast4={card?.card_4_no ?? null}
                isWaiting={isWaiting}
                primaryLabels={{
                  month: isTrialing
                    ? `續用月繳 NT$${priceMonth}`
                    : `升級月繳 NT$${priceMonth}`,
                  year: isTrialing
                    ? `續用年繳 NT$${priceYear}`
                    : `升級年繳 NT$${priceYear}`,
                }}
                secondaryLabels={{
                  month: isTrialing ? "彈性按月付款" : "彈性按月付款",
                  year: yearlySavings > 0 ? `約省 NT$${yearlySavings}` : "一次付款一年",
                }}
                onSelect={handleStartSubscription}
              />
            </>
          ) : (
            <>
              <div className={styles.planSummary}>
                <strong>{isTrialing ? "試用後繼續使用 Standard" : "Standard"}</strong>
                <span>
                  解除額度限制，取得更即時的行情更新。月繳 NT${priceMonth}，年繳 NT$
                  {priceYear}。
                </span>
              </div>
              <div className={styles.stepList}>
                <div className={styles.stepRow}>
                  <span>1</span>
                  <div>
                    <strong>綁定信用卡</strong>
                    <p>綁定後才能選擇月繳或年繳。</p>
                  </div>
                </div>
                <div className={styles.stepRow}>
                  <span>2</span>
                  <div>
                    <strong>選擇月繳或年繳</strong>
                    <p>確認方案後才會扣款。</p>
                  </div>
                </div>
              </div>
              <div className={styles.buttonGroup}>
                <Button className="primary l" onClick={handleScrollToPaymentMethod}>
                  前往綁定信用卡
                </Button>
              </div>
            </>
          )}
        </BeautifulBlock>
      )}

      <div
        ref={paymentMethodSectionRef}
        className={`${styles.paymentMethodSection} ${
          isPaymentMethodHighlighted ? styles.paymentMethodHighlight : ""
        }`}
      >
        <PaymentMethodBlock
          card={card}
          isBindingCard={isBindingCard}
          isExpanded={isCardBindingPanelOpen}
          onBindCard={handleBindCard}
          onCancel={handleCancelCardBinding}
        />
      </div>

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

  function handleScrollToPaymentMethod(): void {
    paymentMethodSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setIsPaymentMethodHighlighted(true);
    if (paymentMethodHighlightTimeoutRef.current !== null) {
      window.clearTimeout(paymentMethodHighlightTimeoutRef.current);
    }
    paymentMethodHighlightTimeoutRef.current = window.setTimeout(() => {
      setIsPaymentMethodHighlighted(false);
      paymentMethodHighlightTimeoutRef.current = null;
    }, paymentMethodHighlightDurationMs);
  }

  async function handleBindCard(): Promise<void> {
    setIsBindingCard(true);
    setNotice(null);
    try {
      setIsCardBindingPanelOpen(true);
      if (isTrialing && hasCard) {
        await waitForNextPaint();
      }
      const response = (await Api.sendRequest(
        "billing/card-binding/init",
        "post",
        new URLSearchParams(),
      )) as BindTokenResponse;
      await loadEcpayScripts(response.sdk_url);
      await initializeEcpay(response.sdk_environment, response.token);
    } catch (error) {
      clearEcpayPayment();
      setIsCardBindingPanelOpen(false);
      const text = getUserFacingError(
        error,
        "信用卡綁定未完成，請確認卡號或稍後再試。",
      );
      setNotice({ type: "error", text });
      dispatch(pushToast({ type: "error", text }));
    } finally {
      setIsBindingCard(false);
    }
  }

  async function handleStartSubscription(interval: "month" | "year"): Promise<void> {
    setIsWaiting(true);
    setNotice(null);
    try {
      await Api.sendRequest(
        "billing/standard-subscription",
        "post",
        JSON.stringify({ billing_interval: interval }),
      );
      dispatch(pushToast({ type: "success", text: "Standard 訂閱已啟用" }));
      await refreshBilling();
    } catch (error) {
      const text = getUserFacingError(
        error,
        "訂閱未完成，請確認信用卡狀態或稍後再試。",
      );
      setNotice({ type: "error", text });
      dispatch(pushToast({ type: "error", text }));
    } finally {
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
        "billing/cancel-subscription",
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

  function handleCancelCardBinding(): void {
    clearEcpayPayment();
    setIsCardBindingPanelOpen(false);
    setNotice(null);
  }

  async function initializeEcpay(
    environment: "Stage" | "Prod",
    token: string,
  ): Promise<void> {
    if (!isEcpayInitialized) {
      await new Promise<void>((resolve, reject) => {
        if (!window.ECPay) {
          reject(new Error("綠界付款元件尚未載入"));
          return;
        }
        window.ECPay.initialize(environment, 1, (errorMessage) => {
          if (errorMessage) reject(new Error(errorMessage));
          else resolve();
        });
      });
      isEcpayInitialized = true;
    }

    clearEcpayPayment();
    await waitForNextPaint();

    await new Promise<void>((resolve, reject) => {
      if (!window.ECPay) {
        reject(new Error("綠界付款元件尚未載入"));
        return;
      }
      window.ECPay.addBindingCard(token, "zh-TW", (errorMessage) => {
        if (errorMessage) reject(new Error(errorMessage));
        else resolve();
      });
    });
    document.querySelector(`.${styles.hiddenSdkButton}`)?.remove();
    document.querySelector(`.${styles.submitHint}`)?.remove();
    const submitButton = document.createElement("button");
    submitButton.className = `button primary_fill l ${styles.hiddenSdkButton}`;
    submitButton.type = "button";
    const submitButtonContent = document.createElement("span");
    submitButtonContent.className = "button__content";
    submitButtonContent.textContent = "送出信用卡綁定";
    submitButton.appendChild(submitButtonContent);
    submitButton.onclick = () => void submitBindCardPayToken();
    const submitHint = document.createElement("p");
    submitHint.className = styles.submitHint;
    submitHint.textContent = "送出後可能需要完成 3D 驗證。";
    const paymentElement = document.getElementById("ECPayPayment");
    paymentElement?.appendChild(submitButton);
    paymentElement?.appendChild(submitHint);
  }

  async function submitBindCardPayToken(): Promise<void> {
    if (isSubmittingCardBindingRef.current) return;
    isSubmittingCardBindingRef.current = true;
    setIsWaiting(true);
    setSdkSubmitButtonWaiting(true);
    setNotice(null);
    let isRedirectingToThreeD = false;
    try {
      const bindCardPayToken = await new Promise<string>((resolve, reject) => {
        if (!window.ECPay) {
          reject(new Error("綠界付款元件尚未載入"));
          return;
        }
        window.ECPay.getBindCardPayToken((result, errorMessage) => {
          if (errorMessage) reject(new Error(errorMessage));
          else resolve(result.BindCardPayToken);
        });
      });
      const response = await Api.sendRequest(
        "billing/card-binding/confirm",
        "post",
        JSON.stringify({ bind_card_pay_token: bindCardPayToken }),
      );
      if (response.three_d_url) {
        isRedirectingToThreeD = true;
        window.location.href = response.three_d_url;
        return;
      }
      await refreshBilling();
      setIsCardBindingPanelOpen(false);
      setNotice({ type: "success", text: "信用卡綁定成功，可以繼續選擇方案。" });
      dispatch(pushToast({ type: "success", text: "信用卡綁定成功" }));
    } catch (error) {
      const text = getUserFacingError(
        error,
        "信用卡綁定未完成，請確認卡號或稍後再試。",
      );
      setNotice({ type: "error", text });
      dispatch(pushToast({ type: "error", text }));
    } finally {
      if (!isRedirectingToThreeD) {
        isSubmittingCardBindingRef.current = false;
        setSdkSubmitButtonWaiting(false);
        setIsWaiting(false);
      }
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

function PlanActionGroup({
  cardLast4,
  isWaiting,
  primaryLabels,
  secondaryLabels,
  onSelect,
}: {
  cardLast4: string | null;
  isWaiting: boolean;
  primaryLabels: { month: string; year: string };
  secondaryLabels: { month: string; year: string };
  onSelect: (interval: "month" | "year") => Promise<void>;
}): React.ReactElement {
  const cardLabel = cardLast4 ? `•••• ${cardLast4}` : "已綁定信用卡";

  return (
    <div className={`${styles.planActionGroup} ${styles.planActions}`}>
      <div className={styles.planButtons}>
        <Button
          className="primary_fill l"
          waiting={isWaiting}
          onClick={() => onSelect("month")}
        >
          <span className={styles.planButtonMain}>{primaryLabels.month}</span>
          <span className={styles.planButtonSub}>{secondaryLabels.month}</span>
        </Button>
        <Button
          className="primary_fill l"
          waiting={isWaiting}
          onClick={() => onSelect("year")}
        >
          <span className={styles.planButtonMain}>{primaryLabels.year}</span>
          <span className={styles.savingsBadge}>{secondaryLabels.year}</span>
        </Button>
      </div>
      <p>{`使用信用卡 ${cardLabel}。確認方案後才會扣款。`}</p>
    </div>
  );
}

function PaymentMethodBlock({
  card,
  isBindingCard,
  isExpanded,
  onBindCard,
  onCancel,
}: {
  card: BillingCard | null;
  isBindingCard: boolean;
  isExpanded: boolean;
  onBindCard: () => Promise<void>;
  onCancel: () => void;
}): React.ReactElement {
  const cardLabel = card?.card_4_no ? `•••• ${card.card_4_no}` : "尚未綁定";

  return (
    <BeautifulBlock title="付款方式">
      <BeautifulRow label="信用卡">{cardLabel}</BeautifulRow>
      <p className={styles.paymentHint}>
        信用卡資料由綠界科技安全處理，Taigu 不會保存完整卡號。
      </p>
      <div className={styles.actionPanel}>
        <Button
          className="secondary l"
          waiting={isBindingCard}
          onClick={isExpanded ? onCancel : onBindCard}
        >
          {isExpanded
            ? card
              ? "取消更換"
              : "取消"
            : card
              ? "更換信用卡"
              : "綁定信用卡"}
        </Button>
        <div id="ECPayPayment" className={styles.ecpayPayment}></div>
      </div>
    </BeautifulBlock>
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
    return "付款未完成，更新付款方式後可恢復 Standard 權益。";
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
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
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

function waitForNextPaint(): Promise<void> {
  // ECPay renders into #ECPayPayment only after layout; double rAF waits for paint.
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function clearEcpayPayment(): void {
  document.querySelector(`.${styles.hiddenSdkButton}`)?.remove();
  document.querySelector(`.${styles.submitHint}`)?.remove();
  const paymentElement = document.getElementById("ECPayPayment");
  if (paymentElement) {
    paymentElement.replaceChildren();
  }
}

function setSdkSubmitButtonWaiting(isWaiting: boolean): void {
  const submitButton = document.querySelector<HTMLButtonElement>(
    `.${styles.hiddenSdkButton}`,
  );
  if (!submitButton) return;
  submitButton.disabled = isWaiting;
  submitButton.setAttribute("aria-busy", isWaiting ? "true" : "false");
  submitButton.classList.toggle("waiting", isWaiting);
  if (isWaiting) {
    submitButton.setAttribute("data-waiting", "");
  } else {
    submitButton.removeAttribute("data-waiting");
    submitButton.removeAttribute("aria-busy");
  }
}

async function loadEcpayScripts(sdkUrl: string): Promise<void> {
  for (const url of [...scriptUrls, sdkUrl]) {
    await loadScript(url);
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("無法載入綠界付款元件"));
    document.body.appendChild(script);
  });
}
