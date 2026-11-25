import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import React from "react";

import { Button, RoundButton } from "../../components";
import * as Icons from "../../icons";
import {
  type CloseActiveModalEvent,
  closeActiveModalEventName,
} from "../../utils/modal";
import { IRouter, withRouter } from "../../utils/router";
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
  layout?: "compact" | "auto" | "fullScreen" | "editor";
  transparent?: boolean;
  manageHistory?: boolean;
  manageBodyScroll?: boolean;
  visualLayer?: "base" | "nested";

  /** Replaces the default Escape handling, which runs the discard button. */
  onEscapeKeyDown?: (_event: KeyboardEvent) => void;

  staysOpenOnQuotaExceeded?: boolean;

  /**
   * Runs instead of the discard button when the app closes the modal, such as when
   * the user leaves for the plan page. Pass it when the discard button asks for
   * confirmation.
   */
  onCloseByApp?: () => void | Promise<void>;
}

interface State {}

const layoutToClassName: Record<NonNullable<Props["layout"]>, string> = {
  compact: styles.compact,
  auto: styles.auto,
  fullScreen: styles.full_screen,
  editor: styles.editor,
};

class Modal extends React.Component<Props, State> {
  public state: State;
  private isClosingFromGlobalEvent: boolean;
  private isUnmounted: boolean = false;

  // The location this modal's history entry was pushed on top of. Back from the
  // entry lands on it again, even when another modal pushed its own entry above.
  private keyBeforeHistoryEntry: string | null = null;
  private historyEntryKey: string | null = null;
  public constructor(props: Props) {
    super(props);
    this.state = {};
    this.isClosingFromGlobalEvent = false;
  }
  public componentDidMount(): void {
    window.addEventListener(
      closeActiveModalEventName,
      this.handleGlobalCloseActiveModalEvent,
    );
    setTimeout(() => {
      if (this.shouldManageHistory && !this.isUnmounted) this.pushHistoryEntry();
      if (this.shouldManageBodyScroll) {
        document.body.style.overscrollBehaviorY = "contain";
      }
    });
  }
  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (!this.shouldManageHistory) return;
    const { location } = this.props.router;
    if (location.key === prevProps.router.location.key) return;
    if (
      this.historyEntryKey === null &&
      this.keyBeforeHistoryEntry !== null &&
      location.key !== this.keyBeforeHistoryEntry &&
      location.hash === "##"
    ) {
      this.historyEntryKey = location.key;
      return;
    }
    if (this.isClosingFromGlobalEvent) return;
    const hasLeftHistoryEntry =
      (this.historyEntryKey !== null && location.key === this.keyBeforeHistoryEntry) ||
      (prevProps.router.location.hash === "##" && location.hash === "");
    if (hasLeftHistoryEntry) {
      this.historyEntryKey = null;
      this.keyBeforeHistoryEntry = null;
      this.handleClickDiscard({} as React.MouseEvent<Element>)
        .catch(() => {})
        .finally(() => setTimeout(this.restoreHistoryEntryIfStillOpen));
    }
  }
  public componentWillUnmount(): void {
    this.isUnmounted = true;
    window.removeEventListener(
      closeActiveModalEventName,
      this.handleGlobalCloseActiveModalEvent,
    );
    if (this.shouldManageBodyScroll) {
      document.body.style.overscrollBehaviorY = "initial";
    }
    if (
      this.shouldManageHistory &&
      !this.isClosingFromGlobalEvent &&
      this.isOnHistoryEntry
    ) {
      this.props.router.navigate(-1);
    }
  }
  public render(): React.ReactNode {
    return (
      <Dialog.Root open onOpenChange={this.handleOpenChange}>
        <Dialog.Portal container={document.getElementById("modal-root") ?? undefined}>
          <Dialog.Overlay
            className={`${styles.background} ${
              this.props.visualLayer === "nested" ? styles.nested_background : ""
            }`}
          />
          <Dialog.Content
            className={`${styles.main} ${
              layoutToClassName[this.props.layout ?? "compact"]
            } ${this.props.transparent ? styles.transparent : ""} ${
              this.props.visualLayer === "nested" ? styles.nested : ""
            }`}
            onEscapeKeyDown={this.handleEscapeKeyDown}
            onInteractOutside={this.handleInteractOutside}
            // Radix warns about a dialog without a description unless this is given.
            {...(!this.props.description && { "aria-describedby": undefined })}
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
                  <Icons.IconXLarge sideLength="16" />
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
  private get hasHistoryEntry(): boolean {
    return this.keyBeforeHistoryEntry !== null;
  }
  private get isOnHistoryEntry(): boolean {
    return (
      this.historyEntryKey !== null &&
      this.props.router.location.key === this.historyEntryKey
    );
  }
  private pushHistoryEntry(): void {
    const { location, navigate } = this.props.router;
    this.keyBeforeHistoryEntry = location.key;
    this.historyEntryKey = null;
    // Main and Settings go back again when two adjacent entries share a URL and
    // state, which would pop a modal opened on top of another. A state object of
    // its own keeps this entry apart from the one below it.
    navigate(
      { search: location.search, hash: "##" },
      { state: { modalHistoryEntry: true } },
    );
  }
  /**
   * The browser's Back button pops this modal's history entry. When the discard
   * handler keeps the modal open, such as an editor asking 「捨棄變更？」, the entry
   * is pushed again so that the next Back still reaches the modal first.
   */
  private restoreHistoryEntryIfStillOpen = (): void => {
    if (this.isUnmounted || this.hasHistoryEntry) return;
    this.pushHistoryEntry();
  };

  private handleOpenChange = (open: boolean): void => {
    if (!open) {
      this.handleClickDiscard({} as React.MouseEvent<Element>).catch(() => {});
    }
  };
  private get shouldManageHistory(): boolean {
    return this.props.manageHistory !== false;
  }
  private get shouldManageBodyScroll(): boolean {
    return this.props.manageBodyScroll !== false;
  }
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
    if (this.props.onEscapeKeyDown) {
      this.props.onEscapeKeyDown(e);
      return;
    }
    this.handleClickDiscard({} as React.MouseEvent<Element>).catch(() => {});
  };
  private handleInteractOutside = (e: Event): void => {
    const isOnToast = e.target instanceof Element && e.target.closest("#toast-root");
    if (this.props.silentBackground || isOnToast) {
      e.preventDefault();
    }
  };
  private handleGlobalCloseActiveModalEvent = (event: Event): void => {
    const { detail } = event as CloseActiveModalEvent;
    if (detail.reason === "quotaExceeded") {
      if (detail.handled || this.props.staysOpenOnQuotaExceeded) return;
      detail.handled = true;
    }
    detail.pendingCloseCount += 1;
    if (detail.reason === "navigation" && this.hasHistoryEntry) {
      detail.historyEntryCount += 1;
    }
    this.isClosingFromGlobalEvent = true;
    if (detail.reason === "quotaExceeded" && this.isOnHistoryEntry) {
      this.props.router.navigate(-1);
    }
    const close = this.props.onCloseByApp
      ? async () => await this.props.onCloseByApp?.()
      : () => this.handleClickDiscard({} as React.MouseEvent<Element>);
    close()
      .catch(() => {})
      .finally(() => detail.done());
  };
}

export default withRouter(Modal);
