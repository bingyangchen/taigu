import * as Dialog from "@radix-ui/react-dialog";
import React, { useRef } from "react";

import { Button } from "../../../components";
import * as Icons from "../../../icons";
import type { SubscriptionEntitlements } from "../../../types";
import styles from "./CancelSubscriptionDialog.module.scss";
import { formatDate } from "./date";

const impactItems = [
  "既有交易紀錄、股利、持股與關注不會被刪除。",
  "超過 Free 額度的資料仍會保留，但到期後可能無法新增超額項目。",
  "行情更新會從約每 30 秒改為約每 10 分鐘。",
];

export default function CancelSubscriptionDialog({
  subscription,
  isOpen,
  isWaiting,
  errorMessage,
  onClose,
  onConfirm,
}: {
  subscription: SubscriptionEntitlements;
  isOpen: boolean;
  isWaiting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}): React.ReactElement | null {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const periodEnd = formatDate(subscription.current_period_ends_at);
  const isWhitelisted = subscription.is_whitelisted === true;
  const isAwaitingRenewal = subscription.is_awaiting_renewal === true;

  if (!isOpen) return null;

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
              {getDescription(subscription)}
            </Dialog.Description>
          </header>

          {!isWhitelisted && (
            <>
              {!isAwaitingRenewal && (
                <div className={styles.retentionNotice}>
                  <Icons.IconInfoCircle sideLength="16" />
                  <p>
                    Standard 權益會保留至 <strong>{periodEnd}</strong>。到期後會切換為
                    Free。
                  </p>
                </div>
              )}

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
            </>
          )}

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

function getDescription(subscription: SubscriptionEntitlements): string {
  if (subscription.is_whitelisted === true) return "停止後不會再自動扣款。";
  if (subscription.is_awaiting_renewal === true) {
    const nextPeriodEnd = formatDate(subscription.next_period_ends_at ?? null);
    return `停止後不會再自動扣款。如果本期已經扣款成功，Standard 權益會保留到 ${nextPeriodEnd}；如果沒有，會立刻切換為 Free 方案。`;
  }
  return "停止後不會再於下次續費日扣款，你仍可使用 Standard 到本期結束。";
}
