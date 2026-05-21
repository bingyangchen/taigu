import React, { MouseEventHandler } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  CashDividendRecordModal,
  FormPageShell,
  HandlingFeeDiscountModal,
  TradePlanModal,
  TradeRecordModal,
} from "../../../components";
import { useAppSelector } from "../../../redux/hooks";
import Env from "../../../utils/env";

function useCloseEditor(fallbackPath: string): MouseEventHandler {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key === "default") {
      navigate(fallbackPath, { replace: true });
      return;
    }
    navigate(-1);
  };
}

function MissingEditorTarget({
  title,
  fallbackPath,
}: {
  title: string;
  fallbackPath: string;
}) {
  const closeEditor = useCloseEditor(fallbackPath);
  return (
    <FormPageShell
      title={title}
      discardButtonProps={{
        children: "返回",
        className: "transparent l",
        onClick: closeEditor,
      }}
    >
      找不到這筆資料，可能已經被刪除或尚未載入完成。
    </FormPageShell>
  );
}

export function TradeRecordCreateRoute(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const closeEditor = useCloseEditor(`${Env.frontendRootPath}records`);
  return (
    <TradeRecordModal
      defaultSid={searchParams.get("sid") ?? undefined}
      hideModal={closeEditor}
      presentation="page"
    />
  );
}

export function TradeRecordEditRoute(): React.ReactElement {
  const { recordId } = useParams();
  const record = useAppSelector((state) =>
    state.tradeRecord.tradeRecords.find((record) => record.id.toString() === recordId),
  );
  const closeEditor = useCloseEditor(`${Env.frontendRootPath}records`);

  if (!record) {
    return (
      <MissingEditorTarget
        title="編輯交易紀錄"
        fallbackPath={`${Env.frontendRootPath}records`}
      />
    );
  }
  return (
    <TradeRecordModal record={record} hideModal={closeEditor} presentation="page" />
  );
}

export function CashDividendRecordCreateRoute(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const closeEditor = useCloseEditor(`${Env.frontendRootPath}records`);
  return (
    <CashDividendRecordModal
      defaultSid={searchParams.get("sid") ?? undefined}
      hideModal={closeEditor}
      presentation="page"
    />
  );
}

export function CashDividendRecordEditRoute(): React.ReactElement {
  const { recordId } = useParams();
  const record = useAppSelector((state) =>
    state.cashDividend.cashDividendRecords.find(
      (record) => record.id.toString() === recordId,
    ),
  );
  const closeEditor = useCloseEditor(`${Env.frontendRootPath}records`);

  if (!record) {
    return (
      <MissingEditorTarget
        title="編輯現金股利"
        fallbackPath={`${Env.frontendRootPath}records`}
      />
    );
  }
  return (
    <CashDividendRecordModal
      record={record}
      hideModal={closeEditor}
      presentation="page"
    />
  );
}

export function TradePlanCreateRoute(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const closeEditor = useCloseEditor(`${Env.frontendRootPath}plans`);
  return (
    <TradePlanModal
      defaultSid={searchParams.get("sid") ?? undefined}
      hideModal={closeEditor}
      presentation="page"
    />
  );
}

export function TradePlanEditRoute(): React.ReactElement {
  const { planId } = useParams();
  const plan = useAppSelector((state) =>
    state.tradePlan.tradePlans.find((plan) => plan.id.toString() === planId),
  );
  const closeEditor = useCloseEditor(`${Env.frontendRootPath}plans`);

  if (!plan) {
    return (
      <MissingEditorTarget
        title="編輯買賣計畫"
        fallbackPath={`${Env.frontendRootPath}plans`}
      />
    );
  }
  return <TradePlanModal plan={plan} hideModal={closeEditor} presentation="page" />;
}

export function HandlingFeeDiscountCreateRoute(): React.ReactElement {
  const closeEditor = useCloseEditor(`${Env.frontendRootPath}handling-fee`);
  return <HandlingFeeDiscountModal hideModal={closeEditor} presentation="page" />;
}

export function HandlingFeeDiscountEditRoute(): React.ReactElement {
  const { discountId } = useParams();
  const discount = useAppSelector((state) =>
    state.handlingFeeDiscount.handlingFeeDiscountRecords.find(
      (discount) => discount.id.toString() === discountId,
    ),
  );
  const closeEditor = useCloseEditor(`${Env.frontendRootPath}handling-fee`);

  if (!discount) {
    return (
      <MissingEditorTarget
        title="編輯折讓紀錄"
        fallbackPath={`${Env.frontendRootPath}handling-fee`}
      />
    );
  }
  return (
    <HandlingFeeDiscountModal
      record={discount}
      hideModal={closeEditor}
      presentation="page"
    />
  );
}
