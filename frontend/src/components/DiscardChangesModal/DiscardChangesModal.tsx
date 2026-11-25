import React, { MouseEventHandler } from "react";

import Modal from "../Modal/Modal";

interface Props {
  onKeepEditing: () => void;
  onDiscard: MouseEventHandler<HTMLButtonElement>;
}

export default function DiscardChangesModal({
  onKeepEditing,
  onDiscard,
}: Props): React.ReactElement {
  return (
    <Modal
      title="捨棄變更？"
      description="離開後，尚未送出的內容不會被儲存。"
      discardButtonProps={{
        children: "繼續編輯",
        className: "transparent l",
        onClick: onKeepEditing,
      }}
      submitButtonProps={{
        children: "捨棄變更",
        className: "dangerous l",
        onClick: onDiscard,
      }}
      noX
      visualLayer="nested"
      manageBodyScroll={false}
      manageHistory={false}
    />
  );
}
