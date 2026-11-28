import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import React, {
  forwardRef,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import * as Icons from "../../icons";
import type { QuantityUnit, TradeSide } from "../../types";
import { getWeekdayName, isWeekend } from "../../utils/date";
import {
  formatEditorDate,
  normalizeNumberInput,
  quantityUnitToLabel,
  tradeSideToLabel,
} from "../../utils/recordEditor";
import type { KeyboardViewport } from "../../utils/useKeyboardViewport";
import Button from "../Button/Button";
import DestructiveActionSection from "../DestructiveActionSection/DestructiveActionSection";
import DiscardChangesModal from "../DiscardChangesModal/DiscardChangesModal";
import FormPageShell from "../FormPageShell/FormPageShell";
import LabeledInput from "../LabeledInput/LabeledInput";
import Modal from "../Modal/Modal";
import { useOfflineNoticeObstacle } from "../OfflineNotice/obstacles";
import SegmentedControl from "../SegmentedControl/SegmentedControl";
import styles from "./RecordEditor.module.scss";

export type StepState = "open" | "done" | "todo";

export type Notice = { tone: "error" | "warning"; text: string };

export function NoticeText({
  notice,
  id,
  className = "",
  isInline = false,
}: {
  notice: Notice;
  id?: string;
  className?: string;
  isInline?: boolean;
}): React.ReactElement {
  const Tag = isInline ? "span" : "p";
  return (
    <Tag
      id={id}
      className={[
        styles.notice,
        notice.tone === "error" ? styles.notice_error : styles.notice_warning,
        isInline && styles.notice_inline,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icons.IconExclamation sideLength="14" />
      <span>{notice.text}</span>
    </Tag>
  );
}

interface EditorStepProps {
  index: number;
  title: string;
  state: StepState;
  isCollapsible: boolean;
  summary: React.ReactNode;
  flag: Notice | null;
  onOpen: () => void;
  children: React.ReactNode;
}

export function EditorStep({
  index,
  title,
  state,
  isCollapsible,
  summary,
  flag,
  onOpen,
  children,
}: EditorStepProps): React.ReactElement {
  const bodyId = useId();
  const isCollapsed = isCollapsible && state !== "open";
  const mark = (
    <span className={styles.step_mark} aria-hidden="true">
      {state === "done" ? <Icons.IconCheck sideLength="13" /> : index}
    </span>
  );
  return (
    <section
      className={`${styles.step} ${isCollapsible ? styles.collapsible : ""}`}
      data-state={state}
      aria-label={title}
    >
      {isCollapsed ? (
        <button
          type="button"
          className={styles.step_head}
          aria-expanded="false"
          aria-controls={bodyId}
          onClick={onOpen}
        >
          {mark}
          <span className={styles.step_title}>
            <small>{title}</small>
            <span className={styles.step_summary}>{summary}</span>
            {flag && <NoticeText notice={flag} className={styles.step_flag} isInline />}
          </span>
          <span className={styles.step_edit} aria-hidden="true">
            修改
          </span>
        </button>
      ) : (
        <div className={styles.step_head}>
          {mark}
          <h2 className={styles.step_title}>
            <small>{title}</small>
          </h2>
        </div>
      )}
      <div className={styles.step_body} id={bodyId} hidden={isCollapsed}>
        {children}
      </div>
    </section>
  );
}

export interface EditorDateFieldHandle {
  focus: () => void;
}

interface EditorDateFieldProps {
  subject: "交易" | "入帳" | "折讓";
  value: string;
  today: string;
  error: string | null;
  warnsOnWeekend?: boolean;
  onChange: (_date: string) => void;
}

export const EditorDateField = forwardRef<EditorDateFieldHandle, EditorDateFieldProps>(
  function EditorDateField(
    { subject, value, today, error, warnsOnWeekend = true, onChange },
    ref,
  ) {
    const label = `${subject}日期`;
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));
    const notice: Notice | null = error
      ? { tone: "error", text: error }
      : warnsOnWeekend && isWeekend(value)
        ? {
            tone: "warning",
            text: `${formatEditorDate(value, today)}是週${getWeekdayName(
              value,
            )}，台股沒有開盤，請確認${subject}日期。`,
          }
        : null;
    const messageId = useId();

    return (
      <div className={styles.field}>
        <LabeledInput
          title={label}
          type="date"
          value={value}
          max={today}
          inputRef={inputRef}
          invalid={Boolean(error)}
          describedBy={notice ? messageId : undefined}
          onChange={(date) => {
            // A date picker's clear button empties the field; React then puts the
            // controlled value back, so the date is never empty.
            if (date !== "") onChange(date);
          }}
        />
        {notice && <NoticeText notice={notice} id={messageId} />}
      </div>
    );
  },
);

interface EditorNumberFieldProps {
  label: string;
  unit: string;
  value: string;
  maxDecimals: number;
  inputMode: "numeric" | "decimal";
  notice: Notice | null;
  hint?: React.ReactNode;
  labelAccessory?: React.ReactNode;
  onChange: (_text: string) => void;
}

function countSignificantCharacters(text: string): number {
  return text.replace(/[^\d.]/g, "").length;
}

function getCaretAfterSignificantCharacters(text: string, count: number): number {
  let seen = 0;
  for (let index = 0; index < text.length; index++) {
    if (seen === count) return index;
    if (/[\d.]/.test(text[index])) seen++;
  }
  return text.length;
}

/** A number input that keeps its own format (REC-R1) and its caret while it reformats. */
export const EditorNumberField = forwardRef<HTMLInputElement, EditorNumberFieldProps>(
  function EditorNumberField(
    {
      label,
      unit,
      value,
      maxDecimals,
      inputMode,
      notice,
      hint,
      labelAccessory,
      onChange,
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const pendingCaretRef = useRef<number | null>(null);
    const messageId = useId();
    const hintId = useId();
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    useLayoutEffect(() => {
      const input = inputRef.current;
      if (pendingCaretRef.current === null || !input) return;
      if (document.activeElement === input) {
        input.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
      }
      pendingCaretRef.current = null;
    });

    const handleChange = (rawText: string): void => {
      const nextText = normalizeNumberInput(rawText, value, maxDecimals);
      const caret = inputRef.current?.selectionStart ?? rawText.length;
      const significantBeforeCaret = countSignificantCharacters(
        rawText.slice(0, caret),
      );
      if (nextText === value) {
        // Nothing re-renders, and React puts the old value back with the caret at
        // the end; move the caret back to where the rejected keystroke was typed.
        // A deleted thousands separator comes back too, with the caret before it.
        const input = inputRef.current;
        const restoredCaret =
          rawText.length > value.length ? Math.max(0, caret - 1) : caret;
        requestAnimationFrame(() =>
          input?.setSelectionRange(restoredCaret, restoredCaret),
        );
        return;
      }
      pendingCaretRef.current = getCaretAfterSignificantCharacters(
        nextText,
        significantBeforeCaret,
      );
      onChange(nextText);
    };

    return (
      <div className={styles.field}>
        {labelAccessory && (
          <div className={styles.field_accessory}>{labelAccessory}</div>
        )}
        <LabeledInput
          title={label}
          inputMode={inputMode}
          value={value}
          inputRef={inputRef}
          suffix={unit}
          invalid={notice?.tone === "error"}
          describedBy={
            [notice && messageId, hint && hintId].filter(Boolean).join(" ") || undefined
          }
          onChange={handleChange}
        />
        {notice && <NoticeText notice={notice} id={messageId} />}
        {hint && (
          <div className={styles.field_hint} id={hintId}>
            {hint}
          </div>
        )}
      </div>
    );
  },
);

export function EditorTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (_text: string) => void;
}): React.ReactElement {
  return (
    <div className={styles.field}>
      <LabeledInput title={label} value={value} onChange={onChange} />
    </div>
  );
}

export function SideControl({
  value,
  onChange,
}: {
  value: TradeSide;
  onChange: (_side: TradeSide) => void;
}): React.ReactElement {
  return (
    <SegmentedControl
      label="買賣別"
      options={(["buy", "sell"] as TradeSide[]).map((side) => ({
        label: tradeSideToLabel[side],
        value: side,
      }))}
      value={value}
      onChange={(side) => onChange(side as TradeSide)}
    />
  );
}

export function QuantityUnitControl({
  value,
  onChange,
}: {
  value: QuantityUnit;
  onChange: (_unit: QuantityUnit) => void;
}): React.ReactElement {
  return (
    <SegmentedControl
      label="股數單位"
      options={[
        { label: quantityUnitToLabel.lot, value: "lot" },
        { label: quantityUnitToLabel.share, value: "share" },
      ]}
      value={value}
      optionWidth="52px"
      onChange={(unit) => onChange(unit as QuantityUnit)}
    />
  );
}

export function EditorDeleteSection({
  buttonLabel,
  description,
  onClick,
}: {
  buttonLabel: string;
  description: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <DestructiveActionSection
      className={styles.delete_section}
      buttonLabel={buttonLabel}
      description={description}
      onClick={onClick}
    />
  );
}

export type SummaryLine = { label: string; value: string };

interface RecordSummaryProps {
  heading: string;
  lines: SummaryLine[];
  totalLabel: string | null;
  total: string | null;
  totalPlaceholder?: string;
  holding: React.ReactNode;
  warning: string | null;
  missing: string[];
  submitLabel: string;
  isSubmitting: boolean;
  isKeyboardOpen: boolean;
  formId: string;
}

export function getSubmitButtonId(formId: string): string {
  return `${formId}-submit`;
}

export function RecordSummary({
  heading,
  lines,
  totalLabel,
  total,
  totalPlaceholder,
  holding,
  warning,
  missing,
  submitLabel,
  isSubmitting,
  isKeyboardOpen,
  formId,
}: RecordSummaryProps): React.ReactElement {
  const offlineNoticeObstacleRef = useOfflineNoticeObstacle();
  return (
    <aside
      className={`${styles.summary} ${isKeyboardOpen ? styles.keyboard_open : ""}`}
      aria-label="這筆紀錄的金額"
    >
      {!isKeyboardOpen && <p className={styles.summary_heading}>{heading}</p>}
      {!isKeyboardOpen && lines.length > 0 && (
        <dl className={styles.summary_lines}>
          {lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {totalLabel && (
        <div className={styles.summary_total}>
          <span>{totalLabel}</span>
          {total === null ? (
            <strong className={styles.placeholder}>{totalPlaceholder}</strong>
          ) : (
            <strong>
              {total}
              <small>元</small>
            </strong>
          )}
        </div>
      )}
      {!totalLabel && lines.length === 0 && totalPlaceholder && (
        <p className={styles.summary_placeholder}>{totalPlaceholder}</p>
      )}
      {!isKeyboardOpen && holding && (
        <div className={styles.summary_holding}>{holding}</div>
      )}
      {!isKeyboardOpen && warning && (
        <NoticeText
          notice={{ tone: "warning", text: warning }}
          className={styles.summary_alert}
        />
      )}
      {!isKeyboardOpen && missing.length > 0 && (
        <p className={styles.summary_missing}>還沒填：{missing.join("、")}</p>
      )}
      <Button
        ref={offlineNoticeObstacleRef}
        id={getSubmitButtonId(formId)}
        type="submit"
        form={formId}
        variant="primary_fill"
        size="action"
        className={styles.primary_button}
        waiting={isSubmitting}
      >
        {submitLabel}
      </Button>
    </aside>
  );
}

export function HoldingChange({
  label,
  before,
  after,
  unit,
}: {
  label: string;
  before: string;
  after: string | null;
  unit: string;
}): React.ReactElement {
  return (
    <>
      <span className={styles.muted}>{label}</span>
      <strong>{before}</strong>
      {after !== null && (
        <>
          <span className={styles.muted} aria-hidden="true">
            →
          </span>
          <VisuallyHidden.Root>變成</VisuallyHidden.Root>
          <strong>{after}</strong>
        </>
      )}
      <span>{unit}</span>
    </>
  );
}

export function getFinishButtonId(formId: string): string {
  return `${formId}-finish`;
}

interface RecordSavedViewProps {
  formId: string;
  title: string;
  subtitle: string;
  rows: SummaryLine[];
  note?: string;
  onAddAnother: () => void;
  onFinish: () => void;
}

export function RecordSavedView({
  formId,
  title,
  subtitle,
  rows,
  note,
  onAddAnother,
  onFinish,
}: RecordSavedViewProps): React.ReactElement {
  const titleId = useId();
  const offlineNoticeObstacleRef = useOfflineNoticeObstacle();
  return (
    <div className={styles.saved}>
      <div className={styles.saved_mark} aria-hidden="true">
        <Icons.IconCheck sideLength="28" />
      </div>
      <h2 id={titleId}>{title}</h2>
      <p className={styles.saved_subtitle}>{subtitle}</p>
      <dl className={styles.saved_card}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.saved_actions} ref={offlineNoticeObstacleRef}>
        <Button type="button" variant="light" size="action" onClick={onAddAnother}>
          再記一筆
        </Button>
        <Button
          id={getFinishButtonId(formId)}
          type="button"
          variant="primary_fill"
          size="action"
          // Focus moves here, so a screen reader reads the title with the button.
          aria-describedby={titleId}
          onClick={onFinish}
        >
          完成
        </Button>
      </div>
      {note && <p className={styles.saved_note}>{note}</p>}
    </div>
  );
}

interface RecordEditorFrameProps {
  presentation: "modal" | "page";
  title: string;
  titleRef: React.Ref<HTMLHeadingElement>;
  isDirty: boolean;
  isCollapsible: boolean;
  keyboardViewport: KeyboardViewport | null;
  onClose: () => void;
  children: React.ReactNode;
}

function isExpandedComboboxEvent(event: KeyboardEvent): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest('[role="combobox"][aria-expanded="true"]') !== null
  );
}

export function RecordEditorFrame({
  presentation,
  title,
  titleRef,
  isDirty,
  isCollapsible,
  keyboardViewport,
  onClose,
  children,
}: RecordEditorFrameProps): React.ReactElement {
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);

  if (presentation === "page") {
    return (
      <FormPageShell
        title={title}
        titleRef={titleRef}
        isDirty={isDirty}
        discardButtonProps={{ children: "返回", onClick: onClose }}
        className={`${isCollapsible ? styles.narrow_page : ""} ${
          keyboardViewport ? styles.keyboard_viewport : ""
        }`}
        bodyClassName={styles.page_body}
        style={
          keyboardViewport
            ? { top: keyboardViewport.offsetTop, height: keyboardViewport.height }
            : undefined
        }
      >
        {children}
      </FormPageShell>
    );
  }

  const requestClose = (): void => {
    if (isDirty) setIsConfirmingDiscard(true);
    else onClose();
  };
  return (
    <>
      <Modal
        title={
          <h1 className={styles.modal_title} ref={titleRef} tabIndex={-1}>
            {title}
          </h1>
        }
        layout="editor"
        noFooter
        discardButtonProps={{ children: "關閉", onClick: requestClose }}
        onEscapeKeyDown={(event) => {
          if (!isExpandedComboboxEvent(event)) requestClose();
        }}
        onCloseByApp={onClose}
        staysOpenOnQuotaExceeded
      >
        {children}
      </Modal>
      {isConfirmingDiscard && (
        <DiscardChangesModal
          onKeepEditing={() => setIsConfirmingDiscard(false)}
          onDiscard={onClose}
        />
      )}
    </>
  );
}

export function EditorBody({
  formId,
  onSubmit,
  steps,
  summary,
}: {
  formId: string;
  onSubmit: (_event: React.FormEvent<HTMLFormElement>) => void;
  steps: React.ReactNode;
  summary: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={styles.body}>
      <form className={styles.steps} id={formId} noValidate onSubmit={onSubmit}>
        {steps}
      </form>
      {summary}
    </div>
  );
}
