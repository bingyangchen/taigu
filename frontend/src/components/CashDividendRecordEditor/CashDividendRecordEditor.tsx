import React, { MouseEventHandler, useId, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from "../../redux/slices/CashDividendRecordSlice";
import type { CashDividendRecord, SelectedStock } from "../../types";
import { getTodayDateString, isWeekend } from "../../utils/date";
import { NARROW_LAYOUT_QUERY, useMediaQuery } from "../../utils/mediaQuery";
import {
  formatEditorDate,
  formatNumber,
  formatRelativeEditorDate,
  getTotalCashDividend,
  makeSidHeldSharesMap,
  makeStockSuggestions,
  parseNumberText,
} from "../../utils/recordEditor";
import { useKeyboardViewport } from "../../utils/useKeyboardViewport";
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
  getFinishButtonId,
  getSubmitButtonId,
  HoldingChange,
  RecordEditorFrame,
  RecordSavedView,
  RecordSummary,
  type SummaryLine,
} from "../RecordEditor/RecordEditor";
import { useEditorSteps } from "../RecordEditor/useEditorSteps";
import StockPicker, {
  PENDING_KEYWORD_MESSAGE,
  type StockPickerHandle,
} from "../StockPicker/StockPicker";

interface Props {
  defaultSid?: string;
  record?: CashDividendRecord;
  hideModal: MouseEventHandler;
  presentation?: "modal" | "page";
}

type StepKey = "pick" | "date" | "amount";

const STEP_KEYS: StepKey[] = ["pick", "date", "amount"];

type DividendForm = { stock: SelectedStock | null; date: string; amountText: string };

type SavedDividend = { stock: SelectedStock; date: string; rows: SummaryLine[] };

function makeInitialForm(
  record: CashDividendRecord | undefined,
  defaultSid?: string,
): DividendForm {
  if (record) {
    return {
      stock: { sid: record.sid, name: record.company_name },
      date: record.deal_time,
      amountText: formatNumber(record.cash_dividend),
    };
  }
  return {
    stock: defaultSid ? { sid: defaultSid } : null,
    date: getTodayDateString(),
    amountText: "",
  };
}

function isSameForm(first: DividendForm, second: DividendForm): boolean {
  return (
    first.stock?.sid === second.stock?.sid &&
    first.date === second.date &&
    parseNumberText(first.amountText) === parseNumberText(second.amountText)
  );
}

function getFilledSteps(
  form: DividendForm,
  pendingKeyword: string,
  today: string,
): Record<StepKey, boolean> {
  return {
    pick: Boolean(form.stock) && pendingKeyword === "",
    date: form.date <= today,
    amount: parseNumberText(form.amountText) !== null,
  };
}

export default function CashDividendRecordEditor({
  defaultSid,
  record,
  hideModal,
  presentation = "modal",
}: Props): React.ReactElement {
  const dispatch = useAppDispatch();
  const cashDividendRecords = useAppSelector(
    (state) => state.cashDividend.cashDividendRecords,
  );
  const hasLoadedDividends = useAppSelector((state) => state.cashDividend.hasLoaded);
  const isWaiting = useAppSelector((state) => state.cashDividend.isWaiting);
  const hasLoadedTrades = useAppSelector((state) => state.tradeRecord.hasLoaded);
  const tradeRecords = useAppSelector((state) => state.tradeRecord.tradeRecords);
  const stockWarehouse = useAppSelector((state) => state.tradeRecord.stockWarehouse);
  const sidStockInfoMap = useAppSelector((state) => state.stockInfo.sidStockInfoMap);

  const isNarrow = useMediaQuery(NARROW_LAYOUT_QUERY);
  const isCollapsible = presentation === "page" && isNarrow;
  const keyboardViewport = useKeyboardViewport(isCollapsible);
  const today = getTodayDateString();

  const [form, setForm] = useState<DividendForm>(() =>
    makeInitialForm(record, defaultSid),
  );
  const [initialForm, setInitialForm] = useState<DividendForm>(form);
  const [pendingKeyword, setPendingKeyword] = useState("");
  const [isShowingErrors, setIsShowingErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [saved, setSaved] = useState<SavedDividend | null>(null);

  const isSubmittingRef = useRef(false);
  const hasDeletedRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stockPickerRef = useRef<StockPickerHandle>(null);
  const dateFieldRef = useRef<EditorDateFieldHandle>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const formId = useId();
  const steps = useEditorSteps<StepKey, "title" | "finish">({
    stepKeys: STEP_KEYS,
    isCollapsible,
    isNew: !record,
    initialFilled: getFilledSteps(form, "", today),
    focusTargets: {
      pick: () => stockPickerRef.current?.focus(),
      date: () => dateFieldRef.current?.focus(),
      amount: () => amountInputRef.current?.focus(),
      submit: () => document.getElementById(getSubmitButtonId(formId))?.focus(),
      title: () => titleRef.current?.focus(),
      finish: () => document.getElementById(getFinishButtonId(formId))?.focus(),
    },
  });

  const amount = parseNumberText(form.amountText);
  const filled = getFilledSteps(form, pendingKeyword, today);
  const stockProblem = pendingKeyword
    ? PENDING_KEYWORD_MESSAGE
    : form.stock
      ? null
      : "請選擇股票";
  const dateProblem = form.date > today ? "入帳日期不能晚於今天" : null;
  const amountProblem = amount === null ? "請填寫入帳金額" : null;

  const totalBefore = form.stock
    ? getTotalCashDividend(cashDividendRecords, form.stock.sid)
    : 0;
  const totalAfter =
    form.stock && amount !== null
      ? getTotalCashDividend(cashDividendRecords, form.stock.sid, record?.id) + amount
      : null;

  const sidHeldSharesMap = useMemo(
    () => makeSidHeldSharesMap(tradeRecords, stockWarehouse),
    [stockWarehouse, tradeRecords],
  );
  const suggestions = useMemo(
    () =>
      hasLoadedTrades
        ? makeStockSuggestions({
            source: "holdings",
            tradeRecords,
            stockWarehouse,
            sidHeldSharesMap,
            sidStockInfoMap,
          })
        : null,
    [hasLoadedTrades, sidStockInfoMap, sidHeldSharesMap, stockWarehouse, tradeRecords],
  );

  const updateForm = (changes: Partial<DividendForm>): void => {
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
      ["pick", stockProblem],
      ["date", dateProblem],
      ["amount", amountProblem],
    ];
    const firstProblem = problems.find(([, problem]) => problem !== null);
    if (firstProblem) {
      steps.showProblem(firstProblem[0], firstProblem[0]);
      return;
    }
    if (!form.stock || amount === null) return;

    const stock = form.stock;
    const rows: SummaryLine[] = [
      { label: "入帳金額", value: `${formatNumber(amount)} 元` },
    ];
    if (hasLoadedDividends && totalAfter !== null) {
      rows.push({
        label: "累計現金股利",
        value: `${formatNumber(totalBefore)} → ${formatNumber(totalAfter)} 元`,
      });
    }
    const requestBody = { sid: stock.sid, deal_time: form.date, cash_dividend: amount };

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (record) {
        await dispatch(
          updateRecord({ id: record.id.toString(), ...requestBody }),
        ).unwrap();
      } else {
        await dispatch(createRecord(requestBody)).unwrap();
      }
    } catch {
      // The API layer reports a failed request with a toast or the quota upsell.
      return;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
    if (record) {
      close();
      return;
    }
    setSaved({ stock, date: form.date, rows });
    steps.focus("finish");
  };

  const handleAddAnother = (): void => {
    const nextForm: DividendForm = { ...makeInitialForm(undefined), date: form.date };
    setForm(nextForm);
    setInitialForm(nextForm);
    setIsShowingErrors(false);
    setSaved(null);
    steps.restart("title", getFilledSteps(nextForm, "", today));
  };

  const missing = [!form.stock && "股票", amountProblem && "入帳金額"].filter(
    (item): item is string => Boolean(item),
  );

  const stepList = (
    <>
      <EditorStep
        index={1}
        title="股票"
        state={steps.getStepState("pick", filled)}
        isCollapsible={isCollapsible}
        summary={
          form.stock
            ? `${form.stock.sid}${form.stock.name ? ` ${form.stock.name}` : ""}`
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
        <StockPicker
          ref={stockPickerRef}
          selectedStock={form.stock}
          suggestions={suggestions}
          errorMessage={isShowingErrors ? stockProblem : null}
          onChange={(stock) => updateForm({ stock })}
          onSelect={(stock) =>
            steps.advance(getFilledSteps({ ...form, stock }, "", today))
          }
          sidHeldSharesMap={hasLoadedTrades ? sidHeldSharesMap : undefined}
          onPendingKeywordChange={setPendingKeyword}
        />
      </EditorStep>
      <EditorStep
        index={2}
        title="入帳日期"
        state={steps.getStepState("date", filled)}
        isCollapsible={isCollapsible}
        summary={formatRelativeEditorDate(form.date, today)}
        flag={
          dateProblem
            ? { tone: "error", text: dateProblem }
            : isWeekend(form.date)
              ? { tone: "warning", text: "這天台股沒有開盤" }
              : null
        }
        onOpen={() => steps.openStepAndFocus("date")}
      >
        <EditorDateField
          ref={dateFieldRef}
          subject="入帳"
          value={form.date}
          today={today}
          error={dateProblem}
          onChange={(date) => updateForm({ date })}
        />
      </EditorStep>
      <EditorStep
        index={3}
        title="入帳金額"
        state={steps.getStepState("amount", filled)}
        isCollapsible={isCollapsible}
        summary={amount === null ? "還沒填" : `${form.amountText} 元`}
        flag={
          isShowingErrors && amountProblem
            ? { tone: "error", text: amountProblem }
            : null
        }
        onOpen={() => steps.openStepAndFocus("amount")}
      >
        <EditorNumberField
          ref={amountInputRef}
          label="入帳金額"
          unit="元"
          value={form.amountText}
          maxDecimals={0}
          inputMode="numeric"
          notice={
            isShowingErrors && amountProblem
              ? { tone: "error", text: amountProblem }
              : null
          }
          onChange={(amountText) => updateForm({ amountText })}
        />
      </EditorStep>
      {record && (
        <EditorDeleteSection
          buttonLabel="刪除現金股利"
          description="刪除後無法復原，這筆現金股利不會再計入收益分析。"
          onClick={() => setIsCheckingDelete(true)}
        />
      )}
    </>
  );

  const summary = (
    <RecordSummary
      heading={`${formatEditorDate(form.date, today)}${
        form.stock ? `・${form.stock.sid} ${form.stock.name ?? ""}` : ""
      }`}
      lines={[]}
      totalLabel="入帳金額"
      total={amount === null ? null : formatNumber(amount)}
      totalPlaceholder="填好入帳金額後顯示"
      holding={
        form.stock && hasLoadedDividends ? (
          <HoldingChange
            label={`${form.stock.sid} 累計現金股利`}
            before={formatNumber(totalBefore)}
            after={totalAfter === null ? null : formatNumber(totalAfter)}
            unit="元"
          />
        ) : null
      }
      warning={null}
      missing={missing}
      submitLabel={record ? "儲存變更" : "新增現金股利"}
      isSubmitting={isSubmitting}
      isKeyboardOpen={keyboardViewport !== null}
      formId={formId}
    />
  );

  return (
    <>
      <RecordEditorFrame
        presentation={presentation}
        title={`${record ? "編輯" : "新增"}現金股利`}
        titleRef={titleRef}
        isDirty={!saved && !isSameForm(form, initialForm)}
        isCollapsible={isCollapsible}
        keyboardViewport={saved ? null : keyboardViewport}
        onClose={close}
      >
        {saved ? (
          <RecordSavedView
            formId={formId}
            title="已新增現金股利"
            subtitle={`${saved.stock.sid} ${saved.stock.name ?? ""}・${formatEditorDate(
              saved.date,
              today,
            )}`}
            rows={saved.rows}
            note={`再記一筆會沿用入帳日期 ${formatEditorDate(saved.date, today)}。`}
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
          title="刪除現金股利？"
          description="刪除後，這筆現金股利不會再計入收益分析。"
          submitLabel="刪除現金股利"
          isWaiting={isWaiting}
          nested
          onDelete={async () => {
            await dispatch(deleteRecord(record.id)).unwrap();
            hasDeletedRef.current = true;
          }}
        >
          <DeletePreview
            title={`${record.sid} ${record.company_name}`}
            meta={record.deal_time}
            details={[
              {
                label: "入帳金額",
                value: (
                  <>
                    <DollarSign />
                    {record.cash_dividend.toLocaleString()}
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
