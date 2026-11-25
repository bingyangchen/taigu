import React, {
  MouseEventHandler,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { fetchSingleStockInfo } from "../../redux/slices/StockInfoSlice";
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from "../../redux/slices/TradeRecordSlice";
import type { QuantityUnit, SelectedStock, TradeRecord, TradeSide } from "../../types";
import { getTodayDateString, isWeekend } from "../../utils/date";
import { NARROW_LAYOUT_QUERY, useMediaQuery } from "../../utils/mediaQuery";
import {
  BUY_HANDLING_FEE_RATE,
  calculateDefaultHandlingFee,
  calculateTradeAmount,
  calculateTradeTotal,
  findOversoldSell,
  formatEditorDate,
  formatNumber,
  formatPercentage,
  formatQuantityFieldText,
  formatQuantityWithShares,
  formatQuantityWithUnit,
  formatRelativeEditorDate,
  formatStoredPrice,
  getHeldShares,
  getInitialQuantityUnit,
  getMaxQuantityDecimals,
  getPriceLimitRange,
  getRememberedQuantityUnit,
  getSharesFromQuantityText,
  getSignedShares,
  getTradeSide,
  makeSidHeldSharesMap,
  makeStockSuggestions,
  MAX_PRICE_DECIMALS,
  parseNumberText,
  quantityUnitToLabel,
  rememberQuantityUnit,
  SECURITIES_TRANSACTION_TAX_RATE,
  SELL_HANDLING_FEE_RATE,
  tradeSideToLabel,
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
  getFinishButtonId,
  getSubmitButtonId,
  HoldingChange,
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
import styles from "./TradeRecordEditor.module.scss";

interface Props {
  defaultSid?: string;
  record?: TradeRecord;
  hideModal: MouseEventHandler;
  presentation?: "modal" | "page";
}

type StepKey = "pick" | "date" | "quantity" | "fee";

const STEP_KEYS: StepKey[] = ["pick", "date", "quantity", "fee"];

type TradeForm = {
  side: TradeSide;
  stock: SelectedStock | null;
  date: string;
  unit: QuantityUnit;
  quantityText: string;
  priceText: string;
  isFeeManual: boolean;
  manualFeeText: string;
};

type SavedTrade = {
  side: TradeSide;
  stock: SelectedStock;
  date: string;
  rows: SummaryLine[];
};

function makeInitialForm(
  record: TradeRecord | undefined,
  defaultSid?: string,
): TradeForm {
  if (record) {
    const side = getTradeSide(record);
    const shares = Math.abs(record.deal_quantity);
    const unit = getInitialQuantityUnit(shares);
    return {
      side,
      stock: { sid: record.sid, name: record.company_name },
      date: record.deal_time,
      unit,
      quantityText: formatQuantityFieldText(shares, unit),
      priceText: formatStoredPrice(record.deal_price),
      isFeeManual:
        record.handling_fee !==
        calculateDefaultHandlingFee(record.deal_price, shares, side),
      manualFeeText: formatNumber(record.handling_fee),
    };
  }
  return {
    side: "buy",
    stock: defaultSid ? { sid: defaultSid } : null,
    date: getTodayDateString(),
    unit: getRememberedQuantityUnit(),
    quantityText: "",
    priceText: "",
    isFeeManual: false,
    manualFeeText: "",
  };
}

function getAutoFee(
  form: TradeForm,
  shares: number | null,
  price: number | null,
): number | null {
  if (shares === null || price === null) return null;
  return calculateDefaultHandlingFee(price, shares, form.side);
}

function getFormValues(form: TradeForm): {
  shares: number | null;
  price: number | null;
  fee: number | null;
} {
  const shares = getSharesFromQuantityText(form.quantityText, form.unit);
  const price = parseNumberText(form.priceText);
  const fee = form.isFeeManual
    ? parseNumberText(form.manualFeeText)
    : getAutoFee(form, shares, price);
  return { shares, price, fee };
}

function isSameForm(first: TradeForm, second: TradeForm): boolean {
  const firstValues = getFormValues(first);
  const secondValues = getFormValues(second);
  return (
    first.side === second.side &&
    first.stock?.sid === second.stock?.sid &&
    first.date === second.date &&
    firstValues.shares === secondValues.shares &&
    firstValues.price === secondValues.price &&
    firstValues.fee === secondValues.fee
  );
}

function getFilledSteps(
  form: TradeForm,
  pendingKeyword: string,
  today: string,
): Record<StepKey, boolean> {
  const { shares, price, fee } = getFormValues(form);
  return {
    pick: Boolean(form.stock) && pendingKeyword === "",
    date: form.date <= today,
    quantity: shares !== null && shares > 0 && price !== null,
    fee: fee !== null,
  };
}

function formatShares(shares: number): string {
  return shares < 0 ? `不足 ${formatNumber(-shares)}` : formatNumber(shares);
}

export default function TradeRecordEditor({
  defaultSid,
  record,
  hideModal,
  presentation = "modal",
}: Props): React.ReactElement {
  const dispatch = useAppDispatch();
  const tradeRecords = useAppSelector((state) => state.tradeRecord.tradeRecords);
  const hasLoadedRecords = useAppSelector((state) => state.tradeRecord.hasLoaded);
  const stockWarehouse = useAppSelector((state) => state.tradeRecord.stockWarehouse);
  const isWaiting = useAppSelector((state) => state.tradeRecord.isWaiting);
  const sidStockInfoMap = useAppSelector((state) => state.stockInfo.sidStockInfoMap);

  const isNarrow = useMediaQuery(NARROW_LAYOUT_QUERY);
  const isCollapsible = presentation === "page" && isNarrow;
  const keyboardViewport = useKeyboardViewport(isCollapsible);
  const today = getTodayDateString();

  const [form, setForm] = useState<TradeForm>(() =>
    makeInitialForm(record, defaultSid),
  );
  const [initialForm, setInitialForm] = useState<TradeForm>(form);
  const [pendingKeyword, setPendingKeyword] = useState("");
  const [isShowingErrors, setIsShowingErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [saved, setSaved] = useState<SavedTrade | null>(null);

  const isSubmittingRef = useRef(false);
  const hasDeletedRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stockPickerRef = useRef<StockPicker>(null);
  const dateFieldRef = useRef<EditorDateFieldHandle>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const feeInputRef = useRef<HTMLInputElement>(null);

  const formId = useId();
  const steps = useEditorSteps<StepKey, "price" | "title" | "finish">({
    stepKeys: STEP_KEYS,
    isCollapsible,
    isNew: !record,
    initialFilled: getFilledSteps(form, "", today),
    focusTargets: {
      pick: () => stockPickerRef.current?.focus(),
      date: () => dateFieldRef.current?.focus(),
      quantity: () => quantityInputRef.current?.focus(),
      price: () => priceInputRef.current?.focus(),
      fee: () => feeInputRef.current?.focus(),
      submit: () => document.getElementById(getSubmitButtonId(formId))?.focus(),
      title: () => titleRef.current?.focus(),
      finish: () => document.getElementById(getFinishButtonId(formId))?.focus(),
    },
  });

  const sid = form.stock?.sid;
  useEffect(() => {
    if (sid) dispatch(fetchSingleStockInfo(sid));
  }, [dispatch, sid]);

  const { shares, price, fee } = getFormValues(form);
  const autoFee = getAutoFee(form, shares, price);
  const filled = getFilledSteps(form, pendingKeyword, today);
  const sideLabel = tradeSideToLabel[form.side];

  const stockProblem = pendingKeyword
    ? PENDING_KEYWORD_MESSAGE
    : form.stock
      ? null
      : "請選擇股票";
  const dateProblem = form.date > today ? "交易日期不能晚於今天" : null;
  const quantityProblem =
    shares === null ? "請填寫成交股數" : shares === 0 ? "成交股數要大於 0" : null;
  const priceProblem = price === null ? "請填寫成交單價" : null;
  const feeProblem =
    shares !== null && price !== null && fee === null ? "請填寫手續費用" : null;

  const tradeAmount =
    shares !== null && price !== null ? calculateTradeAmount(price, shares) : null;
  const total =
    tradeAmount === null || fee === null
      ? null
      : calculateTradeTotal(tradeAmount, fee, form.side);
  const heldNow = form.stock ? getHeldShares(tradeRecords, form.stock.sid) : 0;
  const heldAfter =
    form.stock && shares !== null
      ? getHeldShares(tradeRecords, form.stock.sid, record?.id) +
        getSignedShares(shares, form.side)
      : null;
  const oversoldSell =
    hasLoadedRecords && form.stock && shares !== null && shares > 0
      ? findOversoldSell({
          tradeRecords,
          sid: form.stock.sid,
          date: form.date,
          signedShares: getSignedShares(shares, form.side),
          editedRecord: record,
        })
      : null;
  const oversoldWarning = oversoldSell
    ? `存下這筆之後，${formatEditorDate(oversoldSell.date, today)}的賣出會比當時的庫存多 ${formatNumber(
        oversoldSell.shortShares,
      )} 股。如果有更早的買進還沒記，可以先補記。`
    : null;
  const priceRange =
    form.stock && form.date === today && price !== null && price > 0
      ? getPriceLimitRange(sidStockInfoMap[form.stock.sid])
      : null;
  const priceLimitWarning =
    form.stock &&
    priceRange &&
    price !== null &&
    (price < priceRange.lower || price > priceRange.upper)
      ? `${form.stock.sid} 今天的成交價應在 ${formatNumber(
          priceRange.lower,
          2,
        )} 到 ${formatNumber(priceRange.upper, 2)} 元之間，請確認單價有沒有打錯。`
      : null;

  const sidHeldSharesMap = useMemo(
    () => makeSidHeldSharesMap(tradeRecords, stockWarehouse),
    [stockWarehouse, tradeRecords],
  );
  const suggestions = useMemo(
    () =>
      hasLoadedRecords
        ? makeStockSuggestions({
            source: form.side === "buy" ? "recent" : "holdings",
            tradeRecords,
            stockWarehouse,
            sidHeldSharesMap,
            sidStockInfoMap,
          })
        : null,
    [
      form.side,
      hasLoadedRecords,
      sidStockInfoMap,
      sidHeldSharesMap,
      stockWarehouse,
      tradeRecords,
    ],
  );

  const updateForm = (changes: Partial<TradeForm>): void => {
    setForm((current) => ({ ...current, ...changes }));
  };

  const handleSelectStock = (stock: SelectedStock): void => {
    steps.advance(getFilledSteps({ ...form, stock }, "", today));
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
      ["date", "date", dateProblem],
      ["quantity", "quantity", quantityProblem],
      ["quantity", "price", priceProblem],
      ["fee", "fee", feeProblem],
    ];
    const firstProblem = problems.find(([, , problem]) => problem !== null);
    if (firstProblem) {
      steps.showProblem(firstProblem[0], firstProblem[1]);
      return;
    }
    if (!form.stock || shares === null || price === null || fee === null) return;
    if (tradeAmount === null || total === null) return;

    const stock = form.stock;
    const rows: SummaryLine[] = [
      {
        label: "成交",
        value: `${formatQuantityWithShares(shares, form.unit)} × ${formatStoredPrice(price)} 元`,
      },
      {
        label: form.side === "buy" ? "應付金額" : "應收金額",
        value: `${formatNumber(total)} 元`,
      },
    ];
    if (hasLoadedRecords && heldAfter !== null) {
      rows.push({
        label: "庫存",
        value: `${formatShares(heldNow)} → ${formatShares(heldAfter)} 股`,
      });
    }
    const requestBody = {
      sid: stock.sid,
      deal_time: form.date,
      deal_price: price,
      deal_quantity: getSignedShares(shares, form.side),
      handling_fee: fee,
    };

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
    } catch (error) {
      // The API layer reports a failed request with a toast or the quota upsell.
      return;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
    dispatch(fetchSingleStockInfo(stock.sid));
    if (record) {
      close();
      return;
    }
    rememberQuantityUnit(form.unit);
    setSaved({ side: form.side, stock, date: form.date, rows });
    steps.focus("finish");
  };

  const handleAddAnother = (): void => {
    const nextForm: TradeForm = {
      ...makeInitialForm(undefined),
      side: form.side,
      unit: form.unit,
      date: form.date,
    };
    setForm(nextForm);
    setInitialForm(nextForm);
    setIsShowingErrors(false);
    setSaved(null);
    steps.restart("title");
  };

  const quantityFlag: Notice | null =
    isShowingErrors && (quantityProblem || priceProblem)
      ? {
          tone: "error",
          text:
            quantityProblem && priceProblem
              ? shares === 0
                ? "成交股數要大於 0，請填寫成交單價"
                : "請填寫成交股數與單價"
              : (quantityProblem ?? priceProblem ?? ""),
        }
      : priceLimitWarning
        ? { tone: "warning", text: "單價超出今天的漲跌停範圍" }
        : null;

  const feeSummary =
    fee !== null ? (
      <>
        {formatNumber(fee)} 元
        {form.isFeeManual ? (
          <span className={styles.summary_note}>已手動修改</span>
        ) : (
          !record && <span className={styles.summary_note}>試算</span>
        )}
      </>
    ) : form.isFeeManual ? (
      <>
        還沒填<span className={styles.summary_note}>已手動修改</span>
      </>
    ) : (
      "填好股數與單價後自動試算"
    );
  const feeHint = form.isFeeManual ? (
    <>
      你改過這個金額，之後改股數或單價時不會覆蓋。試算是{" "}
      {autoFee === null ? "--" : `${formatNumber(autoFee)} 元`}。
      <button
        type="button"
        className={styles.reset_fee_button}
        onClick={() => updateForm({ isFeeManual: false })}
      >
        改回試算
      </button>
    </>
  ) : autoFee === null ? (
    "填好股數與單價後自動試算"
  ) : form.side === "buy" ? (
    `依成交金額 × ${formatPercentage(BUY_HANDLING_FEE_RATE)} 試算，可以改成券商通知上的金額`
  ) : (
    `依成交金額 × ${formatPercentage(SELL_HANDLING_FEE_RATE)} 試算，包含手續費與 ${formatPercentage(SECURITIES_TRANSACTION_TAX_RATE)} 證交稅；要改的話，請填券商通知上手續費加交易稅的合計`
  );

  const missing = [
    !form.stock && "股票",
    (shares === null || price === null) && "股數與單價",
    feeProblem && "手續費用",
  ].filter((item): item is string => Boolean(item));

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
          suggestions={suggestions}
          sidHeldSharesMap={hasLoadedRecords ? sidHeldSharesMap : undefined}
          errorMessage={isShowingErrors ? stockProblem : null}
          onChange={(stock) => updateForm({ stock })}
          onSelect={handleSelectStock}
          onPendingKeywordChange={setPendingKeyword}
        />
      </EditorStep>
      <EditorStep
        index={2}
        title="交易日期"
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
          subject="交易"
          value={form.date}
          today={today}
          error={dateProblem}
          onChange={(date) => updateForm({ date })}
        />
      </EditorStep>
      <EditorStep
        index={3}
        title="股數與單價"
        state={steps.getStepState("quantity", filled)}
        isCollapsible={isCollapsible}
        summary={
          filled.quantity
            ? `${formatQuantityWithUnit(shares ?? 0, form.unit)} × ${formatStoredPrice(price ?? 0)} 元`
            : shares !== null || price !== null
              ? "還沒填完"
              : "還沒填"
        }
        flag={quantityFlag}
        onOpen={() => steps.openStepAndFocus("quantity")}
      >
        <EditorNumberField
          ref={quantityInputRef}
          label="成交股數"
          unit={quantityUnitToLabel[form.unit]}
          value={form.quantityText}
          maxDecimals={getMaxQuantityDecimals(form.unit)}
          inputMode={form.unit === "lot" ? "decimal" : "numeric"}
          notice={
            isShowingErrors && quantityProblem
              ? { tone: "error", text: quantityProblem }
              : oversoldWarning
                ? { tone: "warning", text: oversoldWarning }
                : null
          }
          hint={
            form.unit === "share"
              ? undefined
              : shares
                ? `共 ${formatNumber(shares)} 股`
                : "1 張是 1,000 股，可以填小數，例如 1.5 張"
          }
          labelAccessory={
            <QuantityUnitControl value={form.unit} onChange={handleChangeUnit} />
          }
          onChange={(quantityText) => updateForm({ quantityText })}
        />
        <EditorNumberField
          ref={priceInputRef}
          label="成交單價"
          unit="元"
          value={form.priceText}
          maxDecimals={MAX_PRICE_DECIMALS}
          inputMode="decimal"
          notice={
            priceLimitWarning
              ? { tone: "warning", text: priceLimitWarning }
              : isShowingErrors && priceProblem
                ? { tone: "error", text: priceProblem }
                : null
          }
          onChange={(priceText) => updateForm({ priceText })}
        />
      </EditorStep>
      <EditorStep
        index={4}
        title="手續費用"
        state={steps.getStepState("fee", filled)}
        isCollapsible={isCollapsible}
        summary={feeSummary}
        flag={
          isShowingErrors && feeProblem ? { tone: "error", text: feeProblem } : null
        }
        onOpen={() => steps.openStepAndFocus("fee")}
      >
        <EditorNumberField
          ref={feeInputRef}
          label="手續費用"
          unit="元"
          value={
            form.isFeeManual
              ? form.manualFeeText
              : autoFee === null
                ? ""
                : formatNumber(autoFee)
          }
          maxDecimals={0}
          inputMode="numeric"
          notice={
            isShowingErrors && feeProblem ? { tone: "error", text: feeProblem } : null
          }
          hint={feeHint}
          labelAccessory={
            form.isFeeManual && <span className={styles.manual_tag}>已手動修改</span>
          }
          onChange={(manualFeeText) => updateForm({ isFeeManual: true, manualFeeText })}
        />
      </EditorStep>
      {record && (
        <EditorDeleteSection
          buttonLabel="刪除交易紀錄"
          description="刪除後無法復原，投資績效、持股與手續費統計會同步更新。"
          onClick={() => setIsCheckingDelete(true)}
        />
      )}
    </>
  );

  const summary = (
    <RecordSummary
      heading={`${formatEditorDate(form.date, today)}・${sideLabel}${
        form.stock ? `・${form.stock.sid} ${form.stock.name ?? ""}` : ""
      }`}
      lines={
        tradeAmount === null
          ? []
          : [
              { label: "成交金額", value: `${formatNumber(tradeAmount)} 元` },
              {
                label: "手續費用",
                value: fee === null ? "--" : `${formatNumber(fee)} 元`,
              },
            ]
      }
      totalLabel={form.side === "buy" ? "應付金額" : "應收金額"}
      total={total === null ? null : formatNumber(total)}
      totalPlaceholder={
        tradeAmount === null ? "填好股數與單價後計算" : "填好手續費用後計算"
      }
      holding={
        form.stock && hasLoadedRecords ? (
          <HoldingChange
            label="庫存"
            before={formatShares(heldNow)}
            after={heldAfter === null ? null : formatShares(heldAfter)}
            unit="股"
          />
        ) : null
      }
      warning={oversoldWarning}
      missing={missing}
      submitLabel={record ? "儲存變更" : `新增${sideLabel}紀錄`}
      isSubmitting={isSubmitting}
      isKeyboardOpen={keyboardViewport !== null}
      formId={formId}
    />
  );

  return (
    <>
      <RecordEditorFrame
        presentation={presentation}
        title={`${record ? "編輯" : "新增"}交易紀錄`}
        titleRef={titleRef}
        isDirty={!saved && !isSameForm(form, initialForm)}
        isCollapsible={isCollapsible}
        keyboardViewport={saved ? null : keyboardViewport}
        onClose={close}
      >
        {saved ? (
          <RecordSavedView
            formId={formId}
            title={`已新增${tradeSideToLabel[saved.side]}紀錄`}
            subtitle={`${saved.stock.sid} ${saved.stock.name ?? ""}・${formatEditorDate(
              saved.date,
              today,
            )}`}
            rows={saved.rows}
            note={`再記一筆會沿用交易日期 ${formatEditorDate(saved.date, today)}。`}
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
          title="刪除交易紀錄？"
          description="刪除後，這筆紀錄會從投資績效、持股與手續費統計中移除。"
          submitLabel="刪除交易紀錄"
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
                label: "成交價",
                value: (
                  <>
                    <DollarSign />
                    {record.deal_price.toLocaleString()}
                  </>
                ),
              },
              {
                label: "類型",
                value: tradeSideToLabel[getTradeSide(record)],
                tone: getTradeSide(record),
              },
              {
                label: "股數",
                value: `${Math.abs(record.deal_quantity).toLocaleString()} 股`,
              },
            ]}
          />
        </CheckDeleteModal>
      )}
    </>
  );
}
