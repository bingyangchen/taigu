import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import React, { useCallback, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button, RoundButton } from "../../components";
import * as Icons from "../../icons";
import {
  type CloseActiveModalEvent,
  closeActiveModalEventName,
} from "../../utils/modal";
import { useLatestRef } from "../../utils/useLatestRef";
import { Props as ButtonProps } from "../Button/Button";
import styles from "./Modal.module.scss";

interface Props {
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

const layoutToClassName: Record<NonNullable<Props["layout"]>, string> = {
  compact: styles.compact,
  auto: styles.auto,
  fullScreen: styles.full_screen,
  editor: styles.editor,
};

export default function Modal(props: Props) {
  const {
    title,
    description,
    children,
    submitButtonProps,
    discardButtonProps,
    silentBackground,
    noX,
    noFooter,
    layout,
    transparent,
    manageHistory,
    visualLayer,
    onEscapeKeyDown,
  } = props;
  const location = useLocation();
  const navigate = useNavigate();

  // Timers, the global close event and the unmount cleanup act on the props and
  // location of the latest render, not on those of the render that set them up.
  const latestRenderRef = useLatestRef({ props, location, navigate });

  const isClosingFromGlobalEventRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // The location this modal's history entry was pushed on top of. Back from the
  // entry lands on it again, even when another modal pushed its own entry above.
  const keyBeforeHistoryEntryRef = useRef<string | null>(null);
  const historyEntryKeyRef = useRef<string | null>(null);
  const previousLocationRef = useRef(location);

  const isOnHistoryEntry = useCallback(
    (): boolean =>
      historyEntryKeyRef.current !== null &&
      latestRenderRef.current.location.key === historyEntryKeyRef.current,
    [latestRenderRef],
  );
  const pushHistoryEntry = useCallback((): void => {
    const { location: latestLocation, navigate: latestNavigate } =
      latestRenderRef.current;
    keyBeforeHistoryEntryRef.current = latestLocation.key;
    historyEntryKeyRef.current = null;
    // Main and Settings go back again when two adjacent entries share a URL and
    // state, which would pop a modal opened on top of another. A state object of
    // its own keeps this entry apart from the one below it.
    latestNavigate(
      { search: latestLocation.search, hash: "##" },
      { state: { modalHistoryEntry: true } },
    );
  }, [latestRenderRef]);

  /**
   * The browser's Back button pops this modal's history entry. When the discard
   * handler keeps the modal open, such as an editor asking 「捨棄變更？」, the entry
   * is pushed again so that the next Back still reaches the modal first.
   */
  const restoreHistoryEntryIfStillOpen = useCallback((): void => {
    if (isUnmountedRef.current || keyBeforeHistoryEntryRef.current !== null) return;
    pushHistoryEntry();
  }, [pushHistoryEntry]);

  const handleClickDiscard = useCallback(
    async (e: React.MouseEvent<Element>): Promise<void> => {
      await latestRenderRef.current.props.discardButtonProps?.onClick?.(
        e as React.MouseEvent<HTMLButtonElement>,
      );
    },
    [latestRenderRef],
  );

  /** Releases the body scroll and pops this modal's history entry when it unmounts. */
  const leaveOnUnmount = useCallback((): void => {
    const { props: latestProps, navigate: latestNavigate } = latestRenderRef.current;
    if (latestProps.manageBodyScroll !== false) {
      document.body.style.overscrollBehaviorY = "initial";
    }
    if (
      latestProps.manageHistory !== false &&
      !isClosingFromGlobalEventRef.current &&
      isOnHistoryEntry()
    ) {
      latestNavigate(-1);
    }
  }, [isOnHistoryEntry, latestRenderRef]);

  useLayoutEffect(() => {
    isUnmountedRef.current = false;
    const handleGlobalCloseActiveModalEvent = (event: Event): void => {
      const { detail } = event as CloseActiveModalEvent;
      const latestProps = latestRenderRef.current.props;
      if (detail.reason === "quotaExceeded") {
        if (detail.handled || latestProps.staysOpenOnQuotaExceeded) return;
        detail.handled = true;
      }
      detail.pendingCloseCount += 1;
      if (detail.reason === "navigation" && keyBeforeHistoryEntryRef.current !== null) {
        detail.historyEntryCount += 1;
      }
      isClosingFromGlobalEventRef.current = true;
      if (detail.reason === "quotaExceeded" && isOnHistoryEntry()) {
        latestRenderRef.current.navigate(-1);
      }
      const close = latestProps.onCloseByApp
        ? async () => await latestRenderRef.current.props.onCloseByApp?.()
        : () => handleClickDiscard({} as React.MouseEvent<Element>);
      close()
        .catch(() => {})
        .finally(() => detail.done());
    };

    window.addEventListener(
      closeActiveModalEventName,
      handleGlobalCloseActiveModalEvent,
    );
    setTimeout(() => {
      const latestProps = latestRenderRef.current.props;
      if (latestProps.manageHistory !== false && !isUnmountedRef.current) {
        pushHistoryEntry();
      }
      if (latestProps.manageBodyScroll !== false) {
        document.body.style.overscrollBehaviorY = "contain";
      }
    });
    return () => {
      isUnmountedRef.current = true;
      window.removeEventListener(
        closeActiveModalEventName,
        handleGlobalCloseActiveModalEvent,
      );
      leaveOnUnmount();
    };
  }, [
    handleClickDiscard,
    isOnHistoryEntry,
    latestRenderRef,
    leaveOnUnmount,
    pushHistoryEntry,
  ]);

  useLayoutEffect(() => {
    const previousLocation = previousLocationRef.current;
    previousLocationRef.current = location;
    if (manageHistory === false) return;
    if (location.key === previousLocation.key) return;
    if (
      historyEntryKeyRef.current === null &&
      keyBeforeHistoryEntryRef.current !== null &&
      location.key !== keyBeforeHistoryEntryRef.current &&
      location.hash === "##"
    ) {
      historyEntryKeyRef.current = location.key;
      return;
    }
    if (isClosingFromGlobalEventRef.current) return;
    const hasLeftHistoryEntry =
      (historyEntryKeyRef.current !== null &&
        location.key === keyBeforeHistoryEntryRef.current) ||
      (previousLocation.hash === "##" && location.hash === "");
    if (hasLeftHistoryEntry) {
      historyEntryKeyRef.current = null;
      keyBeforeHistoryEntryRef.current = null;
      handleClickDiscard({} as React.MouseEvent<Element>)
        .catch(() => {})
        .finally(() => setTimeout(restoreHistoryEntryIfStillOpen));
    }
  }, [location, manageHistory, handleClickDiscard, restoreHistoryEntryIfStillOpen]);

  const handleClickSubmit = async (e: React.MouseEvent<Element>): Promise<void> => {
    await submitButtonProps?.onClick?.(e as React.MouseEvent<HTMLButtonElement>);
  };
  const handleEscapeKeyDown = (e: KeyboardEvent): void => {
    e.preventDefault();
    if (onEscapeKeyDown) {
      onEscapeKeyDown(e);
      return;
    }
    handleClickDiscard({} as React.MouseEvent<Element>).catch(() => {});
  };
  const handleInteractOutside = (e: Event): void => {
    const isOnToast = e.target instanceof Element && e.target.closest("#toast-root");
    if (silentBackground || isOnToast) {
      e.preventDefault();
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open: boolean) => {
        if (!open) handleClickDiscard({} as React.MouseEvent<Element>).catch(() => {});
      }}
    >
      <Dialog.Portal container={document.getElementById("modal-root") ?? undefined}>
        <Dialog.Overlay
          className={`${styles.background} ${
            visualLayer === "nested" ? styles.nested_background : ""
          }`}
        />
        <Dialog.Content
          className={`${styles.main} ${layoutToClassName[layout ?? "compact"]} ${
            transparent ? styles.transparent : ""
          } ${visualLayer === "nested" ? styles.nested : ""}`}
          onEscapeKeyDown={handleEscapeKeyDown}
          onInteractOutside={handleInteractOutside}
          // Radix warns about a dialog without a description unless this is given.
          {...(!description && { "aria-describedby": undefined })}
        >
          <div className={styles.header}>
            {title && (
              <Dialog.Title asChild>
                <div className={styles.header_title}>{title}</div>
              </Dialog.Title>
            )}
            {!title && (
              <VisuallyHidden.Root asChild>
                <Dialog.Title>對話視窗</Dialog.Title>
              </VisuallyHidden.Root>
            )}
            {!noX && (
              <RoundButton aria-label="關閉" size="l" onClick={handleClickDiscard}>
                <Icons.IconXLarge sideLength="16" />
              </RoundButton>
            )}
          </div>
          <div className={styles.body}>
            {description && (
              <Dialog.Description asChild>
                <div className={styles.description}>{description}</div>
              </Dialog.Description>
            )}
            {children}
          </div>
          {!noFooter && (
            <div className={styles.footer}>
              {discardButtonProps && (
                <Button
                  {...discardButtonProps}
                  size="action"
                  onClick={handleClickDiscard}
                />
              )}
              {submitButtonProps && (
                <Button
                  {...submitButtonProps}
                  size="action"
                  onClick={handleClickSubmit}
                />
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
