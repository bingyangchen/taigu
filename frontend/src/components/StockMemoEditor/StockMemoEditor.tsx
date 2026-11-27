import { ChangeEvent, memo, MouseEvent, MouseEventHandler, useState } from "react";

import { AutoResizeTextarea, BottomSheet, Button, Modal } from "../../components";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { updateOrCreateMemo } from "../../redux/slices/MemoSlice";
import { pushToast } from "../../redux/slices/ToastSlice";
import { useIsNarrowLayout } from "../../utils/mediaQuery";
import styles from "./StockMemoEditor.module.scss";

interface Props {
  sid: string;
  defaultValue: string;
  hideModal: MouseEventHandler;
}

function StockMemoEditor({ sid, defaultValue, hideModal }: Props) {
  const isWaiting = useAppSelector((state) => state.memo.isWaiting);
  const dispatch = useAppDispatch();
  const isNarrowLayout = useIsNarrowLayout();
  const [initialSid] = useState(sid);
  const [value, setValue] = useState(defaultValue);
  const canSubmit = !isWaiting;

  const handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    if (!canSubmit) return;
    await dispatch(
      updateOrCreateMemo({ sid: initialSid, note: value.trim() }),
    ).unwrap();
    dispatch(pushToast({ type: "success", text: "備註已更新" }));
    hideModal(e);
  };

  const memoTextarea = (
    <AutoResizeTextarea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
      placeholder="還沒有備註，可以記下你的觀察或交易想法。"
      autoFocus
    />
  );

  if (isNarrowLayout) {
    return (
      <BottomSheet onClickBackground={hideModal} canMaximize>
        <div className={styles.sheet_content}>
          <div className={styles.sheet_header}>
            <h2>備註</h2>
          </div>
          <div className={styles.sheet_body}>{memoTextarea}</div>
          <div className={styles.sheet_footer}>
            <Button variant="transparent" size="action" onClick={hideModal}>
              捨棄
            </Button>
            <Button
              variant="primary_fill"
              size="action"
              disabled={!canSubmit}
              waiting={isWaiting}
              onClick={handleClickSubmit}
            >
              {defaultValue ? "送出" : "新增備註"}
            </Button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <Modal
      title="備註"
      discardButtonProps={{
        children: "捨棄",
        variant: "transparent",
        onClick: hideModal,
      }}
      submitButtonProps={{
        children: defaultValue ? "送出" : "新增備註",
        variant: "primary",
        disabled: !canSubmit,
        waiting: isWaiting,
        onClick: handleClickSubmit,
      }}
      layout="compact"
      noX
      silentBackground
    >
      {memoTextarea}
    </Modal>
  );
}

export default memo(StockMemoEditor);
