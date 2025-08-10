import styles from "./Modal.module.scss";

import React, { MouseEvent } from "react";
import ReactDOM from "react-dom";

import { Button, RoundButton } from "..";
import { IconXLarge } from "../../icons";
import { IRouter, withRouter } from "../../router";
import Util from "../../utils/util";
import { Props as ButtonProps } from "../Button/Button";

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
  private modalRoot: HTMLElement;
  public constructor(props: Props) {
    super(props);
    this.state = {};
    this.modalRoot = document.getElementById("modal-root")!;
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
  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot?: any,
  ): void {
    if (
      prevProps.router.location.hash === "##" &&
      this.props.router.location.hash === ""
    ) {
      this.handleClickDiscard({} as MouseEvent);
    }
  }
  public componentWillUnmount(): void {
    document.body.style.overscrollBehaviorY = "initial";
    Util.changePWAThemeColor("#fff");
    if (this.props.router.location.hash === "##") {
      this.props.router.navigate(-1);
    }
  }
  public render(): React.ReactNode {
    return ReactDOM.createPortal(
      <div className={styles.background} onClick={this.handleClickBackground}>
        <div
          className={`${styles.main} ${
            this.props.layout === "auto"
              ? styles.auto
              : this.props.layout === "fullScreen"
                ? styles.full_screen
                : styles.compact
          } ${this.props.transparent ? styles.transparent : ""}`}
        >
          <div className={styles.header} onClick={(e) => e.stopPropagation()}>
            {this.props.title && (
              <div className={styles.header_title}>{this.props.title}</div>
            )}
            {!this.props.noX && (
              <RoundButton className="p-12" onClick={this.handleClickDiscard}>
                <IconXLarge sideLength="16" />
              </RoundButton>
            )}
          </div>
          <div className={styles.body} onClick={(e) => e.stopPropagation()}>
            {this.props.description && (
              <div className={styles.description}>{this.props.description}</div>
            )}
            {this.props.children}
          </div>
          {(this.props.submitButtonProps || this.props.discardButtonProps) &&
          !this.props.noFooter ? (
            <div className={styles.footer} onClick={(e) => e.stopPropagation()}>
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
          ) : (
            <div className={styles.fake_footer} onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      </div>,
      this.modalRoot,
    );
  }
  private handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    await this.props.submitButtonProps?.onClick?.(e);
  };
  private handleClickDiscard = async (e: MouseEvent): Promise<void> => {
    await this.props.discardButtonProps?.onClick?.(e);
  };
  private handleClickBackground = (e: MouseEvent): void => {
    e.stopPropagation();
    if (!this.props.silentBackground) this.handleClickDiscard(e);
  };
}

export default withRouter(Modal);
