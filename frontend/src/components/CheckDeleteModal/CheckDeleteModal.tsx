import React, { MouseEvent, MouseEventHandler, ReactNode } from "react";

import { Modal } from "../../components";

interface Props {
  hideModal: MouseEventHandler;
  onDelete: () => Promise<void>;
  isWaiting: boolean;
  children: ReactNode;
}

interface State {}

class CheckDeleteModal extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  public render(): React.ReactNode {
    return (
      <Modal
        title="刪除"
        discardButtonProps={{
          children: "取消",
          className: "transparent l",
          onClick: this.props.hideModal,
        }}
        submitButtonProps={{
          children: "刪除",
          className: "dangerous l",
          disabled: this.props.isWaiting,
          waiting: this.props.isWaiting,
          onClick: this.handleClickCheckDelete,
        }}
        noX
      >
        {this.props.children}
      </Modal>
    );
  }

  private handleClickCheckDelete = async (e: MouseEvent): Promise<void> => {
    await this.props.onDelete();
    this.props.hideModal(e);
  };
}

export default CheckDeleteModal;
