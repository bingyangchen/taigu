import { MouseEvent, MouseEventHandler, ReactNode } from "react";

import { Modal } from "../../components";
import styles from "./CheckDeleteModal.module.scss";

interface Props {
  hideModal: MouseEventHandler;
  onDelete: () => Promise<void>;
  isWaiting: boolean;
  children: ReactNode;
  title?: string;
  description?: string;
  submitLabel?: string;
  nested?: boolean;
}

export default function CheckDeleteModal({
  hideModal,
  onDelete,
  isWaiting,
  children,
  title,
  description,
  submitLabel,
  nested,
}: Props) {
  const handleClickCheckDelete = async (e: MouseEvent): Promise<void> => {
    await onDelete();
    hideModal(e);
  };

  return (
    <Modal
      title={title ?? "刪除"}
      description={description}
      manageHistory={!nested}
      manageBodyScroll={!nested}
      visualLayer={nested ? "nested" : "base"}
      discardButtonProps={{
        children: "取消",
        variant: "transparent",
        onClick: hideModal,
      }}
      submitButtonProps={{
        children: submitLabel ?? "刪除",
        variant: "dangerous",
        disabled: isWaiting,
        waiting: isWaiting,
        onClick: handleClickCheckDelete,
      }}
      noX
    >
      <div className={styles.inner}>{children}</div>
    </Modal>
  );
}
