import React from "react";

import { Button, RoundButton } from "../../components";
import * as Icons from "../../icons";
import type { Props as ButtonProps } from "../Button/Button";
import DiscardChangesModal from "../DiscardChangesModal/DiscardChangesModal";
import styles from "./FormPageShell.module.scss";

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
  submitButtonProps?: ButtonProps;
  discardButtonProps?: ButtonProps;
  isDirty?: boolean;
  titleRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
}

interface State {
  isConfirmingDiscard: boolean;
}

export default class FormPageShell extends React.Component<Props, State> {
  public state: State = { isConfirmingDiscard: false };

  public render(): React.ReactNode {
    return (
      <>
        <section
          className={`${styles.main} ${this.props.className ?? ""}`}
          style={this.props.style}
        >
          <header className={styles.header}>
            <div className={styles.header_action}>
              {this.props.discardButtonProps && (
                <RoundButton
                  aria-label="返回"
                  className="p-12"
                  onClick={this.handleClickDiscard}
                >
                  <Icons.IconChevronLeft sideLength="16" />
                </RoundButton>
              )}
            </div>
            <h1
              ref={this.props.titleRef}
              tabIndex={this.props.titleRef ? -1 : undefined}
            >
              {this.props.title}
            </h1>
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
          <div
            className={`${styles.body} ${this.props.bodyClassName ?? ""}`}
            data-page-scroll="always"
          >
            {this.props.children}
          </div>
        </section>
        {this.state.isConfirmingDiscard && (
          <DiscardChangesModal
            onKeepEditing={this.hideDiscardConfirmation}
            onDiscard={this.handleConfirmDiscard}
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
