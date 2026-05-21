import React from "react";

import { Button, Modal, RoundButton } from "../../components";
import { IconChevronLeft } from "../../icons";
import type { Props as ButtonProps } from "../Button/Button";
import styles from "./FormPageShell.module.scss";

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
  submitButtonProps?: ButtonProps;
  discardButtonProps?: ButtonProps;
  isDirty?: boolean;
}

interface State {
  isConfirmingDiscard: boolean;
}

export default class FormPageShell extends React.Component<Props, State> {
  public state: State = { isConfirmingDiscard: false };

  public render(): React.ReactNode {
    return (
      <>
        <section className={styles.main}>
          <header className={styles.header}>
            <div className={styles.header_action}>
              {this.props.discardButtonProps && (
                <RoundButton
                  aria-label="返回"
                  className="p-12"
                  onClick={this.handleClickDiscard}
                >
                  <IconChevronLeft sideLength="16" />
                </RoundButton>
              )}
            </div>
            <h1>{this.props.title}</h1>
            <div className={styles.header_action}>
              {this.props.submitButtonProps && (
                <Button
                  className={`transparent s ${styles.submit_button}`}
                  disabled={this.props.submitButtonProps.disabled}
                  waiting={this.props.submitButtonProps.waiting}
                  canTriggerByEnter={this.props.submitButtonProps.canTriggerByEnter}
                  onClick={this.props.submitButtonProps.onClick}
                >
                  {this.props.submitButtonProps.children}
                </Button>
              )}
            </div>
          </header>
          <div className={styles.body}>{this.props.children}</div>
        </section>
        {this.state.isConfirmingDiscard && (
          <Modal
            title="捨棄變更？"
            description="離開後，尚未送出的內容不會被儲存。"
            discardButtonProps={{
              children: "繼續編輯",
              className: "transparent l",
              onClick: this.hideDiscardConfirmation,
            }}
            submitButtonProps={{
              children: "捨棄變更",
              className: "dangerous l",
              onClick: this.handleConfirmDiscard,
            }}
            noX
            visualLayer="nested"
            manageBodyScroll={false}
            manageHistory={false}
          />
        )}
      </>
    );
  }

  private handleClickDiscard = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (this.props.isDirty) {
      this.setState({ isConfirmingDiscard: true });
      return;
    }
    this.props.discardButtonProps?.onClick?.(e);
  };

  private hideDiscardConfirmation = (): void => {
    this.setState({ isConfirmingDiscard: false });
  };

  private handleConfirmDiscard = (e: React.MouseEvent<HTMLButtonElement>): void => {
    this.props.discardButtonProps?.onClick?.(e);
  };
}
