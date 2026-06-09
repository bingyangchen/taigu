import React from "react";
import { useNavigate } from "react-router-dom";

import * as Icons from "../../icons";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { closePlanUpsell } from "../../redux/slices/PlanUpsellSlice";
import type { PlanQuotaResource } from "../../types";
import Env from "../../utils/env";
import { requestCloseActiveModal } from "../../utils/modalEvents";
import Modal from "../Modal/Modal";
import styles from "./PlanUpsellModal.module.scss";

const titleByResource: Record<PlanQuotaResource, string> = {
  records: "這個月的新增額度已用完",
  trade_plans: "這個月的買賣計畫額度已用完",
  holdings: "持股檔數已達 Free 上限",
  favorites: "關注清單已達 Free 上限",
};

const standardBenefits = [
  "交易紀錄與現金股利不限筆數",
  "買賣計畫、持股與關注清單不限量",
  "行情約每 30 秒更新",
];

export default function PlanUpsellModal(): React.ReactElement | null {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isOpen, resource, message } = useAppSelector((state) => state.planUpsell);

  if (!isOpen || !resource) return null;

  const title = titleByResource[resource];

  function handleClose(): void {
    dispatch(closePlanUpsell());
  }

  async function handleViewPlan(): Promise<void> {
    await requestCloseActiveModal({ popHistory: false });
    navigate(`${Env.frontendRootPath}settings/current-plan`, { replace: true });
  }

  return (
    <Modal
      title={
        <div className={styles.title}>
          <span>{title}</span>
        </div>
      }
      layout="auto"
      discardButtonProps={{
        className: "transparent l",
        children: "稍後再說",
        onClick: handleClose,
      }}
      submitButtonProps={{
        className: "primary_fill l",
        children: "查看 Standard 方案",
        onClick: handleViewPlan,
      }}
    >
      <div className={styles.content}>
        <div className={styles.limitNote}>
          <span>目前限制</span>
          <strong>{message}</strong>
        </div>
        <div className={styles.hero}>
          <p>升級 Standard 後，你將可獲得：</p>
        </div>
        <div className={styles.benefits} aria-label="Standard 方案包含">
          {standardBenefits.map((benefit) => (
            <div className={styles.benefit} key={benefit}>
              <Icons.IconShieldCheck sideLength="17" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
        <p className={styles.footerNote}>
          前往付款與方案頁後，可以先確認價格、付款週期與方案內容。
        </p>
      </div>
    </Modal>
  );
}
