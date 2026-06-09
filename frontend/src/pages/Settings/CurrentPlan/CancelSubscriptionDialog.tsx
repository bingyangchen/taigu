import * as Dialog from "@radix-ui/react-dialog";
import React, { useRef, useState } from "react";

import { Button } from "../../../components";
import * as Icons from "../../../icons";
import type { SubscriptionEntitlements } from "../../../types";
import styles from "./CancelSubscriptionDialog.module.scss";

type CancelReason =
  | "暫時不需要 Standard"
  | "價格不符合目前需求"
  | "使用頻率不高"
  | "功能還不符合期待"
  | "其他";

const cancelReasons: CancelReason[] = [
  "暫時不需要 Standard",
  "價格不符合目前需求",
  "使用頻率不高",
  "功能還不符合期待",
  "其他",
];

const impactItems = [
  "既有交易紀錄、股利、持股與關注不會被刪除。",
  "超過 Free 額度的資料仍會保留，但到期後可能無法新增超額項目。",
  "行情更新會從約每 30 秒改為約每 10 分鐘。",
  "你可以在到期前重新啟用自動續訂。",
];

export type CancelSubscriptionFeedback = { reason: CancelReason | ""; detail: string };

export default function CancelSubscriptionDialog({
  subscription,
  isOpen,
  isWaiting,
  errorMessage,
  onClose,
  onConfirm,
  onReasonChange,
}: {
  subscription: SubscriptionEntitlements;
  isOpen: boolean;
  isWaiting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onReasonChange: (feedback: CancelSubscriptionFeedback) => void;
}): React.ReactElement | null {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [reason, setReason] = useState<CancelReason | "">("");
  const [detail, setDetail] = useState("");
  const periodEnd = formatDate(subscription.current_period_ends_at);

  if (!isOpen) return null;

  function handleReasonChange(nextReason: CancelReason): void {
    const nextDetail = nextReason === "其他" ? detail : "";
    setReason(nextReason);
    if (nextReason !== "其他") setDetail("");
    onReasonChange({ reason: nextReason, detail: nextDetail });
  }

  function handleDetailChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    const nextDetail = event.target.value;
    setDetail(nextDetail);
    onReasonChange({ reason, detail: nextDetail });
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !isWaiting && onClose()}>
      <Dialog.Portal container={document.getElementById("modal-root") ?? undefined}>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content
          className={styles.dialog}
          onEscapeKeyDown={(event) => {
            if (isWaiting) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isWaiting) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
        >
          <header className={styles.header}>
            <Dialog.Title asChild>
              <h2 ref={titleRef} tabIndex={-1}>
                停止 Standard 自動續訂？
              </h2>
            </Dialog.Title>
            <Dialog.Description className={styles.description}>
              停止後不會再於下次續費日扣款，你仍可使用 Standard 到本期結束。
            </Dialog.Description>
          </header>

          <div className={styles.retentionNotice}>
            <Icons.IconInfoCircle sideLength="16" />
            <p>
              Standard 權益會保留至 <strong>{periodEnd}</strong>。到期後會切換為 Free。
            </p>
          </div>

          <section className={styles.impactSection}>
            <h3>到期後會發生什麼？</h3>
            <ul>
              {impactItems.map((item) => (
                <li key={item}>
                  <span className={styles.impactIcon} aria-hidden="true">
                    i
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.reasonSection}>
            <div className={styles.reasonHeader}>
              <span>可以告訴我們原因嗎？</span>
              <p>選填，幫助我們改善 Taigu。</p>
            </div>
            <div className={styles.reasonList}>
              {cancelReasons.map((option) => (
                <label key={option} className={styles.reasonOption}>
                  <input
                    type="radio"
                    name="cancel-subscription-reason"
                    value={option}
                    checked={reason === option}
                    disabled={isWaiting}
                    onChange={() => handleReasonChange(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {reason === "其他" && (
              <textarea
                className={styles.reasonDetail}
                value={detail}
                placeholder="想補充的原因"
                disabled={isWaiting}
                onChange={handleDetailChange}
              />
            )}
          </section>

          <footer className={styles.footer}>
            <p className={styles.refundHint}>確認後不會立即退款或刪除資料。</p>
            {errorMessage && <div className={styles.inlineError}>{errorMessage}</div>}
            <div className={styles.footerActions}>
              <Button
                className={`primary_fill l ${styles.keepButton}`}
                disabled={isWaiting}
                onClick={onClose}
              >
                保留自動續訂
              </Button>
              <Button
                className={`dangerous l border ${styles.stopButton}`}
                waiting={isWaiting}
                onClick={() => {
                  void onConfirm();
                }}
              >
                停止自動續訂
              </Button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
