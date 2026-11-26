import { memo, MouseEvent, MouseEventHandler, useRef, useState } from "react";

import {
  CheckDeleteModal,
  DeletePreview,
  DestructiveActionSection,
  DollarSign,
  FormPageShell,
  LabeledInput,
  Modal,
} from "../../components";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  createDiscount,
  deleteDiscount,
  updateDiscount,
} from "../../redux/slices/HandlingFeeDiscountSlice";
import type { HandlingFeeDiscount } from "../../types";
import Util from "../../utils/util";
import type { Props as ButtonProps } from "../Button/Button";
import styles from "./HandlingFeeDiscountEditor.module.scss";

interface Props {
  record?: HandlingFeeDiscount;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  presentation?: "modal" | "page";
}

interface FormState {
  date: string;
  amount: number;
  memo: string;
}

function HandlingFeeDiscountEditor({ record, hideModal, onSave, presentation }: Props) {
  const isWaiting = useAppSelector((state) => state.handlingFeeDiscount.isWaiting);
  const dispatch = useAppDispatch();
  const [initialFormState] = useState<FormState>(() => ({
    date: record?.date ?? new Date().toLocaleDateString("af"),
    amount: record ? record.amount : NaN,
    memo: record?.memo ?? "",
  }));
  const [recordId] = useState(record?.id ?? null);
  const [date, setDate] = useState(initialFormState.date);
  const [amount, setAmount] = useState(initialFormState.amount);
  const [memo, setMemo] = useState(initialFormState.memo);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const shouldCloseAfterDeleteRef = useRef(false);

  const canSubmit = Boolean(date && !Object.is(amount, NaN) && !isWaiting);
  const isDirty =
    date !== initialFormState.date ||
    !Object.is(amount, initialFormState.amount) ||
    memo !== initialFormState.memo;

  const handleAmountChange = (value: string): void => {
    setAmount(value === "" ? NaN : parseInt(value) < 0 ? 0 : parseInt(value));
  };
  const hideDeleteModal = (e: MouseEvent): void => {
    if (shouldCloseAfterDeleteRef.current) {
      shouldCloseAfterDeleteRef.current = false;
      hideModal(e);
      return;
    }
    setIsCheckingDelete(false);
  };
  const handleConfirmDelete = async (): Promise<void> => {
    if (!record) return;
    await dispatch(deleteDiscount(record.id)).unwrap();
    shouldCloseAfterDeleteRef.current = true;
  };
  const handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    if (!canSubmit) throw Error("Cannot submit!");
    try {
      if (recordId) {
        await dispatch(
          updateDiscount({ id: recordId, date, amount, memo: memo || undefined }),
        ).unwrap();
      } else {
        await dispatch(
          createDiscount({ date, amount, memo: memo || undefined }),
        ).unwrap();
      }
      hideModal(e);
      onSave?.();
    } catch {
      hideModal(e);
    }
  };

  const title = `${record ? "編輯" : "新增"}折讓紀錄`;
  const discardButtonProps: ButtonProps = {
    children: "捨棄",
    variant: "transparent",
    onClick: hideModal,
  };
  const submitButtonProps: ButtonProps = {
    children: "送出",
    variant: "primary_fill",
    disabled: !canSubmit,
    waiting: isWaiting,
    onClick: handleClickSubmit,
    canTriggerByEnter: true,
  };
  const body = (
    <div className={styles.modal_inner}>
      <LabeledInput title="日期" type="date" value={date} onChange={setDate} />
      <LabeledInput
        title="折讓金額"
        type="number"
        inputMode="numeric"
        value={amount || amount === 0 ? amount.toString() : ""}
        onChange={handleAmountChange}
        autoFocus={!Util.isMobile && !record && Boolean(date)}
      />
      <LabeledInput title="備註" type="text" value={memo} onChange={setMemo} />
      {record && (
        <DestructiveActionSection
          buttonLabel="刪除折讓紀錄"
          description="刪除後無法復原，手續費分析會同步更新。"
          onClick={() => setIsCheckingDelete(true)}
        />
      )}
    </div>
  );
  return (
    <>
      {presentation === "page" ? (
        <FormPageShell
          title={title}
          discardButtonProps={discardButtonProps}
          isDirty={isDirty}
          submitButtonProps={submitButtonProps}
        >
          {body}
        </FormPageShell>
      ) : (
        <Modal
          title={title}
          discardButtonProps={discardButtonProps}
          submitButtonProps={submitButtonProps}
          layout={Util.isMobile ? "fullScreen" : "compact"}
          noX
          silentBackground
        >
          {body}
        </Modal>
      )}
      {isCheckingDelete && record && (
        <CheckDeleteModal
          hideModal={hideDeleteModal}
          title="刪除手續費折讓？"
          description="刪除後，這筆折讓不會再計入手續費分析。"
          submitLabel="刪除折讓紀錄"
          isWaiting={isWaiting}
          nested
          onDelete={handleConfirmDelete}
        >
          <DeletePreview
            title={record.memo || "手續費折讓"}
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

export default memo(HandlingFeeDiscountEditor);
