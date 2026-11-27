import React, { MouseEventHandler, useId, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  createDiscount,
  deleteDiscount,
  updateDiscount,
} from "../../redux/slices/HandlingFeeDiscountSlice";
import { selectNetHandlingFee } from "../../redux/slices/TradeRecordSlice";
import type { HandlingFeeDiscount } from "../../types";
import { getTodayDateString } from "../../utils/date";
import { getDiscountTitle } from "../../utils/handlingFeeDiscount";
import { NARROW_LAYOUT_QUERY, useMediaQuery } from "../../utils/mediaQuery";
import {
  formatEditorDate,
  formatNumber,
  formatRelativeEditorDate,
  parseNumberText,
} from "../../utils/recordEditor";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";
import DeletePreview from "../DeletePreview/DeletePreview";
import DollarSign from "../DollarSign/DollarSign";
import {
  EditorBody,
  EditorDateField,
  type EditorDateFieldHandle,
  EditorDeleteSection,
  EditorNumberField,
  EditorStep,
  EditorTextField,
  getFinishButtonId,
  getSubmitButtonId,
  HoldingChange,
  RecordEditorFrame,
  RecordSavedView,
  RecordSummary,
  type SummaryLine,
} from "../RecordEditor/RecordEditor";
import { useEditorSteps } from "../RecordEditor/useEditorSteps";
import { useKeyboardViewport } from "../RecordEditor/useKeyboardViewport";

interface Props {
  record?: HandlingFeeDiscount;
  hideModal: MouseEventHandler;
  presentation?: "modal" | "page";
}

type StepKey = "date" | "amount";

const STEP_KEYS: StepKey[] = ["date", "amount"];

type DiscountForm = { date: string; amountText: string; memo: string };

type SavedDiscount = { title: string; date: string; rows: SummaryLine[] };

function makeInitialForm(record: HandlingFeeDiscount | undefined): DiscountForm {
  if (record) {
    return {
      date: record.date,
      amountText: formatNumber(record.amount),
      memo: record.memo,
    };
  }
  return { date: getTodayDateString(), amountText: "", memo: "" };
}

function isSameForm(first: DiscountForm, second: DiscountForm): boolean {
  return (
    first.date === second.date &&
    parseNumberText(first.amountText) === parseNumberText(second.amountText) &&
    first.memo.trim() === second.memo.trim()
  );
}

function getFilledSteps(form: DiscountForm, today: string): Record<StepKey, boolean> {
  return {
    date: form.date <= today,
    amount: parseNumberText(form.amountText) !== null,
  };
}

export default function HandlingFeeDiscountEditor({
  record,
  hideModal,
  presentation = "modal",
}: Props): React.ReactElement {
  const dispatch = useAppDispatch();
  const isWaiting = useAppSelector((state) => state.handlingFeeDiscount.isWaiting);
  const netHandlingFee = useAppSelector(selectNetHandlingFee);
  const hasLoadedNetHandlingFee = useAppSelector(
    (state) => state.tradeRecord.hasLoaded && state.handlingFeeDiscount.hasLoaded,
  );

  const isNarrow = useMediaQuery(NARROW_LAYOUT_QUERY);
  const isCollapsible = presentation === "page" && isNarrow;
  const keyboardViewport = useKeyboardViewport(isCollapsible);
  const today = getTodayDateString();

  const [form, setForm] = useState<DiscountForm>(() => makeInitialForm(record));
  const [initialForm, setInitialForm] = useState<DiscountForm>(form);
  const [isShowingErrors, setIsShowingErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [saved, setSaved] = useState<SavedDiscount | null>(null);

  const isSubmittingRef = useRef(false);
  const hasDeletedRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dateFieldRef = useRef<EditorDateFieldHandle>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const formId = useId();
  const steps = useEditorSteps<StepKey, "title" | "finish">({
    stepKeys: STEP_KEYS,
    isCollapsible,
    isNew: !record,
    initialFilled: getFilledSteps(form, today),
    focusTargets: {
      date: () => dateFieldRef.current?.focus(),
      amount: () => amountInputRef.current?.focus(),
      submit: () => document.getElementById(getSubmitButtonId(formId))?.focus(),
      title: () => titleRef.current?.focus(),
      finish: () => document.getElementById(getFinishButtonId(formId))?.focus(),
    },
  });

  const amount = parseNumberText(form.amountText);
  const filled = getFilledSteps(form, today);
  const dateProblem = form.date > today ? "折讓日期不能晚於今天" : null;
  const amountProblem = amount === null ? "請填寫折讓金額" : null;
  const netHandlingFeeAfter =
    amount === null ? null : netHandlingFee + (record?.amount ?? 0) - amount;

  const updateForm = (changes: Partial<DiscountForm>): void => {
    setForm((current) => ({ ...current, ...changes }));
  };

  const close = (): void => hideModal({} as React.MouseEvent);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    setIsShowingErrors(true);
    const problems: [StepKey, string | null][] = [
      ["date", dateProblem],
      ["amount", amountProblem],
    ];
    const firstProblem = problems.find(([, problem]) => problem !== null);
    if (firstProblem) {
      steps.showProblem(firstProblem[0], firstProblem[0]);
      return;
    }
    if (amount === null) return;

    const memo = form.memo.trim();
    const rows: SummaryLine[] = [
      { label: "折讓金額", value: `${formatNumber(amount)} 元` },
    ];
    if (hasLoadedNetHandlingFee && netHandlingFeeAfter !== null) {
      rows.push({
        label: "累積手續費",
        value: `${formatNumber(netHandlingFee)} → ${formatNumber(netHandlingFeeAfter)} 元`,
      });
    }
    const requestBody = { date: form.date, amount, memo };

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (record) {
        await dispatch(updateDiscount({ id: record.id, ...requestBody })).unwrap();
      } else {
        await dispatch(createDiscount(requestBody)).unwrap();
      }
    } catch {
      // The API layer reports a failed request with a toast.
      return;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
    if (record) {
      close();
      return;
    }
    setSaved({ title: getDiscountTitle(memo), date: form.date, rows });
    steps.focus("finish");
  };

  const handleAddAnother = (): void => {
    const nextForm: DiscountForm = { ...makeInitialForm(undefined), date: form.date };
    setForm(nextForm);
    setInitialForm(nextForm);
    setIsShowingErrors(false);
    setSaved(null);
    steps.restart("title", getFilledSteps(nextForm, today));
  };

  const amountNotice =
    isShowingErrors && amountProblem
      ? { tone: "error" as const, text: amountProblem }
      : null;

  const stepList = (
    <>
      <EditorStep
        index={1}
        title="折讓日期"
        state={steps.getStepState("date", filled)}
        isCollapsible={isCollapsible}
        summary={formatRelativeEditorDate(form.date, today)}
        flag={dateProblem ? { tone: "error", text: dateProblem } : null}
        onOpen={() => steps.openStepAndFocus("date")}
      >
        <EditorDateField
          ref={dateFieldRef}
          subject="折讓"
          value={form.date}
          today={today}
          error={dateProblem}
          warnsOnWeekend={false}
          onChange={(date) => updateForm({ date })}
        />
      </EditorStep>
      <EditorStep
        index={2}
        title="金額與備註"
        state={steps.getStepState("amount", filled)}
        isCollapsible={isCollapsible}
        summary={
          amount === null
            ? "還沒填"
            : `${form.amountText} 元${form.memo.trim() ? `・${form.memo.trim()}` : ""}`
        }
        flag={amountNotice}
        onOpen={() => steps.openStepAndFocus("amount")}
      >
        <EditorNumberField
          ref={amountInputRef}
          label="折讓金額"
          unit="元"
          value={form.amountText}
          maxDecimals={0}
          inputMode="numeric"
          notice={amountNotice}
          onChange={(amountText) => updateForm({ amountText })}
        />
        <EditorTextField
          label="備註（選填）"
          value={form.memo}
          onChange={(memo) => updateForm({ memo })}
        />
      </EditorStep>
      {record && (
        <EditorDeleteSection
          buttonLabel="刪除折讓紀錄"
          description="刪除後無法復原，手續費分析會同步更新。"
          onClick={() => setIsCheckingDelete(true)}
        />
      )}
    </>
  );

  const summary = (
    <RecordSummary
      heading={`${formatEditorDate(form.date, today)}・${getDiscountTitle(form.memo)}`}
      lines={[]}
      totalLabel="折讓金額"
      total={amount === null ? null : formatNumber(amount)}
      totalPlaceholder="填好折讓金額後顯示"
      holding={
        hasLoadedNetHandlingFee ? (
          <HoldingChange
            label="累積手續費"
            before={formatNumber(netHandlingFee)}
            after={
              netHandlingFeeAfter === null ? null : formatNumber(netHandlingFeeAfter)
            }
            unit="元"
          />
        ) : null
      }
      warning={null}
      missing={amountProblem ? ["折讓金額"] : []}
      submitLabel={record ? "儲存變更" : "新增折讓紀錄"}
      isSubmitting={isSubmitting}
      isKeyboardOpen={keyboardViewport !== null}
      formId={formId}
    />
  );

  return (
    <>
      <RecordEditorFrame
        presentation={presentation}
        title={`${record ? "編輯" : "新增"}折讓紀錄`}
        titleRef={titleRef}
        isDirty={!saved && !isSameForm(form, initialForm)}
        isCollapsible={isCollapsible}
        keyboardViewport={saved ? null : keyboardViewport}
        onClose={close}
      >
        {saved ? (
          <RecordSavedView
            formId={formId}
            title="已新增折讓紀錄"
            subtitle={`${saved.title}・${formatEditorDate(saved.date, today)}`}
            rows={saved.rows}
            note={`再記一筆會沿用折讓日期 ${formatEditorDate(saved.date, today)}。`}
            onAddAnother={handleAddAnother}
            onFinish={close}
          />
        ) : (
          <EditorBody
            formId={formId}
            onSubmit={handleSubmit}
            steps={stepList}
            summary={summary}
          />
        )}
      </RecordEditorFrame>
      {isCheckingDelete && record && (
        <CheckDeleteModal
          hideModal={() => {
            if (hasDeletedRef.current) close();
            else setIsCheckingDelete(false);
          }}
          title="刪除手續費折讓？"
          description="刪除後，這筆折讓不會再計入手續費分析。"
          submitLabel="刪除折讓紀錄"
          isWaiting={isWaiting}
          nested
          onDelete={async () => {
            await dispatch(deleteDiscount(record.id)).unwrap();
            hasDeletedRef.current = true;
          }}
        >
          <DeletePreview
            title={getDiscountTitle(record.memo)}
            meta={record.date}
            details={[
              {
                label: "折讓金額",
                value: (
                  <>
                    <DollarSign />
                    {record.amount.toLocaleString()}
                  </>
                ),
              },
            ]}
          />
        </CheckDeleteModal>
      )}
    </>
  );
}
