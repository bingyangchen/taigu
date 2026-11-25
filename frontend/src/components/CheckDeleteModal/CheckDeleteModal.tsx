import React, { MouseEvent, MouseEventHandler, ReactNode } from "react";

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
        title={this.props.title ?? "刪除"}
        description={this.props.description}
        manageHistory={!this.props.nested}
        manageBodyScroll={!this.props.nested}
        visualLayer={this.props.nested ? "nested" : "base"}
        discardButtonProps={{
          children: "取消",
          className: "transparent l",
          onClick: this.props.hideModal,
        }}
        submitButtonProps={{
          children: this.props.submitLabel ?? "刪除",
          className: "dangerous l",
          disabled: this.props.isWaiting,
          waiting: this.props.isWaiting,
          onClick: this.handleClickCheckDelete,
        }}
        noX
      >
        <div className={styles.inner}>{this.props.children}</div>
      </Modal>
    );
  }

  private handleClickCheckDelete = async (e: MouseEvent): Promise<void> => {
    await this.props.onDelete();
    this.props.hideModal(e);
  };
}

export default CheckDeleteModal;
