import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import React from "react";

import { Button, RoundButton } from "../../components";
import { IconXLarge } from "../../icons";
import { IRouter, withRouter } from "../../router";
import Util from "../../utils/util";
import { Props as ButtonProps } from "../Button/Button";
import styles from "./Modal.module.scss";

interface Props extends IRouter {
  title?: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  submitButtonProps?: ButtonProps;
  discardButtonProps?: ButtonProps;
  silentBackground?: boolean;
  noX?: boolean;
  noFooter?: boolean;
  layout?: "compact" | "auto" | "fullScreen";
  transparent?: boolean;
}

interface State {}

class Modal extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public componentDidMount(): void {
    setTimeout(() => {
      this.props.router.navigate("##");
      if (this.props.layout !== "fullScreen" || this.props.transparent) {
        Util.changePWAThemeColor("#888");
      }
      document.body.style.overscrollBehaviorY = "contain";
    });
  }
  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      prevProps.router.location.hash === "##" &&
      this.props.router.location.hash === ""
    ) {
      this.handleClickDiscard({} as React.MouseEvent<Element>);
    }
  }
  public componentWillUnmount(): void {
    document.body.style.overscrollBehaviorY = "initial";
    Util.changePWAThemeColor("#d1eeff");
    if (this.props.router.location.hash === "##") {
      this.props.router.navigate(-1);
    }
  }
  public render(): React.ReactNode {
    return (
      <Dialog.Root open onOpenChange={this.handleOpenChange}>
        <Dialog.Portal container={document.getElementById("modal-root") ?? undefined}>
          <Dialog.Overlay className={styles.background} />
          <Dialog.Content
            className={`${styles.main} ${
              this.props.layout === "auto"
                ? styles.auto
                : this.props.layout === "fullScreen"
                  ? styles.full_screen
                  : styles.compact
            } ${this.props.transparent ? styles.transparent : ""}`}
            onEscapeKeyDown={this.handleEscapeKeyDown}
            onInteractOutside={this.handleInteractOutside}
          >
            <div className={styles.header}>
              {this.props.title && (
                <Dialog.Title asChild>
                  <div className={styles.header_title}>{this.props.title}</div>
                </Dialog.Title>
              )}
              {!this.props.title && (
                <VisuallyHidden.Root asChild>
                  <Dialog.Title>對話視窗</Dialog.Title>
                </VisuallyHidden.Root>
              )}
              {!this.props.noX && (
                <RoundButton
                  aria-label="關閉"
                  className="p-12"
                  onClick={this.handleClickDiscard}
                >
                  <IconXLarge sideLength="16" />
                </RoundButton>
              )}
            </div>
            <div className={styles.body}>
              {this.props.description && (
                <Dialog.Description asChild>
                  <div className={styles.description}>{this.props.description}</div>
                </Dialog.Description>
              )}
              {this.props.children}
            </div>
            {!this.props.noFooter && (
              <div className={styles.footer}>
                {this.props.discardButtonProps && (
                  <Button
                    className={this.props.discardButtonProps.className}
                    disabled={this.props.discardButtonProps.disabled}
                    waiting={this.props.discardButtonProps.waiting}
                    canTriggerByEnter={this.props.discardButtonProps.canTriggerByEnter}
                    onClick={this.handleClickDiscard}
                  >
                    {this.props.discardButtonProps.children}
                  </Button>
                )}
                {this.props.submitButtonProps && (
                  <Button
                    className={this.props.submitButtonProps.className}
                    disabled={this.props.submitButtonProps.disabled}
                    waiting={this.props.submitButtonProps.waiting}
                    canTriggerByEnter={this.props.submitButtonProps.canTriggerByEnter}
                    onClick={this.handleClickSubmit}
                  >
                    {this.props.submitButtonProps.children}
                  </Button>
                )}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
  private handleOpenChange = (open: boolean): void => {
    if (!open) {
      this.handleClickDiscard({} as React.MouseEvent<Element>).catch(() => {});
    }
  };
  private handleClickSubmit = async (e: React.MouseEvent<Element>): Promise<void> => {
    await this.props.submitButtonProps?.onClick?.(
      e as React.MouseEvent<HTMLButtonElement>,
    );
  };
  private handleClickDiscard = async (e: React.MouseEvent<Element>): Promise<void> => {
    await this.props.discardButtonProps?.onClick?.(
      e as React.MouseEvent<HTMLButtonElement>,
    );
  };
  private handleEscapeKeyDown = (e: KeyboardEvent): void => {
    e.preventDefault();
    this.handleClickDiscard({} as React.MouseEvent<Element>).catch(() => {});
  };
  private handleInteractOutside = (e: Event): void => {
    if (this.props.silentBackground) {
      e.preventDefault();
    }
  };
}

export default withRouter(Modal);
