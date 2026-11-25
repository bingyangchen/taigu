import React, { MouseEventHandler, useId, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { createPlan, deletePlan, updatePlan } from "../../redux/slices/TradePlanSlice";
import type { QuantityUnit, SelectedStock, TradePlan, TradeSide } from "../../types";
import { NARROW_LAYOUT_QUERY, useMediaQuery } from "../../utils/mediaQuery";
import {
  calculateDefaultHandlingFee,
  calculateTradeAmount,
  formatNumber,
  formatQuantityFieldText,
  formatQuantityWithShares,
  formatQuantityWithUnit,
  formatStoredPrice,
  getInitialQuantityUnit,
  getMaxQuantityDecimals,
  getRememberedQuantityUnit,
  getSharesFromQuantityText,
  MAX_PRICE_DECIMALS,
  parseNumberText,
  quantityUnitToLabel,
  tradeSideToLabel,
} from "../../utils/recordEditor";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";
import DeletePreview from "../DeletePreview/DeletePreview";
import DollarSign from "../DollarSign/DollarSign";
import {
  EditorBody,
  EditorDeleteSection,
  EditorNumberField,
  EditorStep,
  getFinishButtonId,
  getSubmitButtonId,
  type Notice,
  QuantityUnitControl,
  RecordEditorFrame,
  RecordSavedView,
  RecordSummary,
  SideControl,
  type SummaryLine,
} from "../RecordEditor/RecordEditor";
import { useEditorSteps } from "../RecordEditor/useEditorSteps";
import { useKeyboardViewport } from "../RecordEditor/useKeyboardViewport";
import StockPicker, { PENDING_KEYWORD_MESSAGE } from "../StockPicker/StockPicker";

interface Props {
  defaultSid?: string;
  plan?: TradePlan;
  hideModal: MouseEventHandler;
  presentation?: "modal" | "page";
}

type StepKey = "pick" | "target";

const STEP_KEYS: StepKey[] = ["pick", "target"];

type PlanForm = {
  side: TradeSide;
  stock: SelectedStock | null;
  unit: QuantityUnit;
  quantityText: string;
  priceText: string;
};

type SavedPlan = { title: string; subtitle: string; rows: SummaryLine[] };

function makeInitialForm(plan: TradePlan | undefined, defaultSid?: string): PlanForm {
  if (plan) {
    const unit = getInitialQuantityUnit(plan.target_quantity);
    return {
      side: plan.plan_type,
      stock: { sid: plan.sid, name: plan.company_name },
      unit,
      quantityText: formatQuantityFieldText(plan.target_quantity, unit),
      priceText: formatStoredPrice(plan.target_price),
    };
  }
  return {
    side: "buy",
    stock: defaultSid ? { sid: defaultSid } : null,
    unit: getRememberedQuantityUnit(),
    quantityText: "",
    priceText: "",
  };
}

function getFormValues(form: PlanForm): {
  shares: number | null;
  price: number | null;
} {
  return {
    shares: getSharesFromQuantityText(form.quantityText, form.unit),
    price: parseNumberText(form.priceText),
  };
}

function getFilledSteps(
  form: PlanForm,
  pendingKeyword: string,
): Record<StepKey, boolean> {
  const { shares, price } = getFormValues(form);
  return {
    pick: Boolean(form.stock) && pendingKeyword === "",
    target: shares !== null && price !== null,
  };
}

function isSameForm(first: PlanForm, second: PlanForm): boolean {
  const firstValues = getFormValues(first);
  const secondValues = getFormValues(second);
  return (
    first.side === second.side &&
    first.stock?.sid === second.stock?.sid &&
    firstValues.shares === secondValues.shares &&
    firstValues.price === secondValues.price
  );
}

export default function TradePlanEditor({
  defaultSid,
  plan,
  hideModal,
  presentation = "modal",
}: Props): React.ReactElement {
  const dispatch = useAppDispatch();
  const isWaiting = useAppSelector((state) => state.tradePlan.isWaiting);

  const isNarrow = useMediaQuery(NARROW_LAYOUT_QUERY);
  const isCollapsible = presentation === "page" && isNarrow;
  const keyboardViewport = useKeyboardViewport(isCollapsible);

  const [form, setForm] = useState<PlanForm>(() => makeInitialForm(plan, defaultSid));
  const [initialForm, setInitialForm] = useState<PlanForm>(form);
  const [pendingKeyword, setPendingKeyword] = useState("");
  const [isShowingErrors, setIsShowingErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [saved, setSaved] = useState<SavedPlan | null>(null);

  const isSubmittingRef = useRef(false);
  const hasDeletedRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stockPickerRef = useRef<StockPicker>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const formId = useId();
  const steps = useEditorSteps<StepKey, "price" | "title" | "finish">({
    stepKeys: STEP_KEYS,
    isCollapsible,
    isNew: !plan,
    initialFilled: getFilledSteps(form, ""),
    focusTargets: {
      pick: () => stockPickerRef.current?.focus(),
      target: () => quantityInputRef.current?.focus(),
      price: () => priceInputRef.current?.focus(),
      submit: () => document.getElementById(getSubmitButtonId(formId))?.focus(),
      title: () => titleRef.current?.focus(),
      finish: () => document.getElementById(getFinishButtonId(formId))?.focus(),
    },
  });

  const { shares, price } = getFormValues(form);
  const filled = getFilledSteps(form, pendingKeyword);
  const sideLabel = tradeSideToLabel[form.side];

  const stockProblem = pendingKeyword
    ? PENDING_KEYWORD_MESSAGE
    : form.stock
      ? null
      : "請選擇股票";
  const quantityProblem = shares === null ? "請填寫目標股數" : null;
  const priceProblem = price === null ? "請填寫目標價格" : null;

  const amountLines: SummaryLine[] =
    shares !== null && price !== null && shares > 0 && price > 0
      ? [
          {
            label: "成交金額",
            value: `${formatNumber(calculateTradeAmount(price, shares))} 元`,
          },
          {
            label: "預估手續費",
            value: `${formatNumber(calculateDefaultHandlingFee(price, shares, form.side))} 元`,
          },
        ]
      : [];

  const updateForm = (changes: Partial<PlanForm>): void => {
    setForm((current) => ({ ...current, ...changes }));
  };

  const handleChangeUnit = (unit: QuantityUnit): void => {
    if (unit === form.unit) return;
    updateForm({
      unit,
      quantityText: shares === null ? "" : formatQuantityFieldText(shares, unit),
    });
  };

  const close = (): void => hideModal({} as React.MouseEvent);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    setIsShowingErrors(true);
    const problems: [StepKey, "price" | StepKey, string | null][] = [
      ["pick", "pick", stockProblem],
      ["target", "target", quantityProblem],
      ["target", "price", priceProblem],
    ];
    const firstProblem = problems.find(([, , problem]) => problem !== null);
    if (firstProblem) {
      steps.showProblem(firstProblem[0], firstProblem[1]);
      return;
    }
    if (!form.stock || shares === null || price === null) return;

    const stock = form.stock;
    const requestBody = {
      sid: stock.sid,
      plan_type: form.side,
      target_price: price,
      target_quantity: shares,
    };
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (plan) await dispatch(updatePlan({ id: plan.id, ...requestBody })).unwrap();
      else await dispatch(createPlan(requestBody)).unwrap();
    } catch (error) {
      // The API layer reports a failed request with a toast or the quota upsell.
      return;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
    if (plan) {
      close();
      return;
    }
    setSaved({
      title: `已新增${sideLabel}計畫`,
      subtitle: `${stock.sid} ${stock.name ?? ""}`,
      rows: [
        {
          label: "目標",
          value: `${formatQuantityWithShares(shares, form.unit)} × ${formatStoredPrice(price)} 元`,
        },
        ...amountLines,
      ],
    });
    steps.focus("finish");
  };

  const handleAddAnother = (): void => {
    const nextForm: PlanForm = {
      ...makeInitialForm(undefined),
      side: form.side,
      unit: form.unit,
    };
    setForm(nextForm);
    setInitialForm(nextForm);
    setIsShowingErrors(false);
    setSaved(null);
    steps.restart("title");
  };

  const missing = [
    !form.stock && "股票",
    (shares === null || price === null) && "目標股數與價格",
  ].filter((item): item is string => Boolean(item));

  const targetFlag: Notice | null =
    isShowingErrors && (quantityProblem || priceProblem)
      ? {
          tone: "error",
          text:
            quantityProblem && priceProblem
              ? "請填寫目標股數與價格"
              : (quantityProblem ?? priceProblem ?? ""),
        }
      : null;

  const stepList = (
    <>
      <EditorStep
        index={1}
        title="買賣與股票"
        state={steps.getStepState("pick", filled)}
        isCollapsible={isCollapsible}
        summary={
          form.stock
            ? `${sideLabel}・${form.stock.sid}${form.stock.name ? ` ${form.stock.name}` : ""}`
            : "還沒填"
        }
        flag={
          pendingKeyword
            ? { tone: "error", text: PENDING_KEYWORD_MESSAGE }
            : isShowingErrors && stockProblem
              ? { tone: "error", text: stockProblem }
              : null
        }
        onOpen={() => steps.openStepAndFocus("pick")}
      >
        <SideControl value={form.side} onChange={(side) => updateForm({ side })} />
        <StockPicker
          ref={stockPickerRef}
          selectedStock={form.stock}
          errorMessage={isShowingErrors ? stockProblem : null}
          onChange={(stock) => updateForm({ stock })}
          onSelect={(stock) => steps.advance(getFilledSteps({ ...form, stock }, ""))}
          onPendingKeywordChange={setPendingKeyword}
        />
      </EditorStep>
      <EditorStep
        index={2}
        title="目標股數與價格"
        state={steps.getStepState("target", filled)}
        isCollapsible={isCollapsible}
        summary={
          filled.target
            ? `${formatQuantityWithUnit(shares ?? 0, form.unit)} × ${formatStoredPrice(price ?? 0)} 元`
            : shares !== null || price !== null
              ? "還沒填完"
              : "還沒填"
        }
        flag={targetFlag}
        onOpen={() => steps.openStepAndFocus("target")}
      >
        <EditorNumberField
          ref={quantityInputRef}
          label="目標股數"
          unit={quantityUnitToLabel[form.unit]}
          value={form.quantityText}
          maxDecimals={getMaxQuantityDecimals(form.unit)}
          inputMode={form.unit === "lot" ? "decimal" : "numeric"}
          notice={
            isShowingErrors && quantityProblem
              ? { tone: "error", text: quantityProblem }
              : null
          }
          hint={
            form.unit === "lot" && shares ? `共 ${formatNumber(shares)} 股` : undefined
          }
          labelAccessory={
            <QuantityUnitControl value={form.unit} onChange={handleChangeUnit} />
          }
          onChange={(quantityText) => updateForm({ quantityText })}
        />
        <EditorNumberField
          ref={priceInputRef}
          label="目標價格"
          unit="元"
          value={form.priceText}
          maxDecimals={MAX_PRICE_DECIMALS}
          inputMode="decimal"
          notice={
            isShowingErrors && priceProblem
              ? { tone: "error", text: priceProblem }
              : null
          }
          onChange={(priceText) => updateForm({ priceText })}
        />
      </EditorStep>
      {plan && (
        <EditorDeleteSection
          buttonLabel="刪除買賣計畫"
          description="刪除後無法復原，這個目標價提醒會從買賣計畫中移除。"
          onClick={() => setIsCheckingDelete(true)}
        />
      )}
    </>
  );

  return (
    <>
      <RecordEditorFrame
        presentation={presentation}
        title={`${plan ? "編輯" : "新增"}買賣計畫`}
        titleRef={titleRef}
        isDirty={!saved && !isSameForm(form, initialForm)}
        isCollapsible={isCollapsible}
        keyboardViewport={saved ? null : keyboardViewport}
        onClose={close}
      >
        {saved ? (
          <RecordSavedView
            formId={formId}
            title={saved.title}
            subtitle={saved.subtitle}
            rows={saved.rows}
            onAddAnother={handleAddAnother}
            onFinish={close}
          />
        ) : (
          <EditorBody
            formId={formId}
            onSubmit={handleSubmit}
            steps={stepList}
            summary={
              <RecordSummary
                heading={`${sideLabel}計畫${
                  form.stock ? `・${form.stock.sid} ${form.stock.name ?? ""}` : ""
                }`}
                lines={amountLines}
                totalLabel={null}
                total={null}
                totalPlaceholder={
                  shares === null || price === null
                    ? "填好目標股數與價格後計算"
                    : undefined
                }
                holding={null}
                warning={null}
                missing={missing}
                submitLabel={plan ? "儲存變更" : `新增${sideLabel}計畫`}
                isSubmitting={isSubmitting}
                isKeyboardOpen={keyboardViewport !== null}
                formId={formId}
              />
            }
          />
        )}
      </RecordEditorFrame>
      {isCheckingDelete && plan && (
        <CheckDeleteModal
          hideModal={() => {
            if (hasDeletedRef.current) close();
            else setIsCheckingDelete(false);
          }}
          title="刪除買賣計畫？"
          description="刪除後，這個目標價提醒不會再出現在買賣計畫中。"
          submitLabel="刪除買賣計畫"
          isWaiting={isWaiting}
          nested
          onDelete={async () => {
            await dispatch(deletePlan(plan.id)).unwrap();
            hasDeletedRef.current = true;
          }}
        >
          <DeletePreview
            title={`${plan.sid} ${plan.company_name}`}
            details={[
              {
                label: "目標價",
                value: (
                  <>
                    <DollarSign />
                    {plan.target_price.toLocaleString()}
                  </>
                ),
              },
              {
                label: "類型",
                value: tradeSideToLabel[plan.plan_type],
                tone: plan.plan_type,
              },
              { label: "股數", value: `${plan.target_quantity.toLocaleString()} 股` },
            ]}
          />
        </CheckDeleteModal>
      )}
    </>
  );
}
