import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import React, {
  MouseEvent,
  MouseEventHandler,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useLatestRef } from "../../utils/useLatestRef";
import styles from "./BottomSheet.module.scss";

/** Closes the sheet; `afterClose` runs once the sheet's history entry is gone. */
export type CloseBottomSheet = (afterClose?: () => void) => void;

interface Props {
  /**
   * A function child gets `close`. Use it for a button in the sheet that goes on to
   * change the URL or open a modal, which must wait for the sheet's history entry to
   * be popped first.
   */
  children?: React.ReactNode | ((close: CloseBottomSheet) => React.ReactNode);
  onClickBackground: MouseEventHandler;
  canMaximize?: boolean;
}

interface TouchState {
  touchStartY: number | null;
  touchEndY: number | null;
  touchDiffY: number | null;
  isMaximized: boolean;
}

const MAXIMIZE_THRESHOLD = 100;
const MINIMIZE_THRESHOLD = 100;
const TRANSITION_DURATION = 150;

export default function BottomSheet({
  children,
  onClickBackground,
  canMaximize,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [touchState, setTouchState] = useState<TouchState>({
    touchStartY: null,
    touchEndY: null,
    touchDiffY: null,
    isMaximized: false,
  });
  const [initialMainHeight, setInitialMainHeight] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);
  const timerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // The sheet pushes a "#!" entry when it opens and pops it when it closes, so that
  // Back closes the sheet instead of leaving the page.
  const keyBeforePushRef = useRef<string | null>(null);
  const isPushingHistoryEntryRef = useRef(false);
  const historyEntryKeyRef = useRef<string | null>(null);
  const isPoppingHistoryEntryRef = useRef(false);
  const finishAfterPopRef = useRef<(() => void) | null>(null);
  const latestRenderRef = useLatestRef({ location, navigate, onClickBackground });

  const setTimer = useCallback((callback: () => void, delay?: number): void => {
    timerIdsRef.current.push(setTimeout(callback, delay));
  }, []);

  const popHistoryEntry = useCallback(
    (finish: () => void): void => {
      finishAfterPopRef.current = finish;
      isPoppingHistoryEntryRef.current = true;
      latestRenderRef.current.navigate(-1);
    },
    [latestRenderRef],
  );

  const close = useCallback<CloseBottomSheet>(
    (afterClose) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      const finish = (): void => {
        latestRenderRef.current.onClickBackground({} as MouseEvent);
        afterClose?.();
      };
      if (isPushingHistoryEntryRef.current) {
        // The pop waits until the pushed entry lands.
        finishAfterPopRef.current = finish;
      } else if (
        historyEntryKeyRef.current !== null &&
        latestRenderRef.current.location.key === historyEntryKeyRef.current
      ) {
        popHistoryEntry(finish);
      } else {
        finish();
      }
    },
    [latestRenderRef, popHistoryEntry],
  );

  /** Pops the sheet's entry when a caller unmounts the sheet without `close`. */
  const leaveOnUnmount = useCallback((): void => {
    isClosingRef.current = true;
    timerIdsRef.current.forEach((timerId) => clearTimeout(timerId));
    const { location: latestLocation, navigate: latestNavigate } =
      latestRenderRef.current;
    const isOnHistoryEntry =
      isPushingHistoryEntryRef.current ||
      (historyEntryKeyRef.current !== null &&
        latestLocation.key === historyEntryKeyRef.current);
    if (isOnHistoryEntry && !isPoppingHistoryEntryRef.current) latestNavigate(-1);
  }, [latestRenderRef]);

  useLayoutEffect(() => {
    // A remount, as under StrictMode, starts over after `leaveOnUnmount`.
    isClosingRef.current = false;
    timerIdsRef.current = [];
    setTimer(() => {
      const { location: latestLocation, navigate: latestNavigate } =
        latestRenderRef.current;
      keyBeforePushRef.current = latestLocation.key;
      isPushingHistoryEntryRef.current = true;
      // Main goes back again when two adjacent entries share a URL and state, which
      // would pop this entry as soon as it lands on a URL that already ends in "#!".
      latestNavigate(
        { search: latestLocation.search, hash: "#!" },
        { state: { bottomSheetHistoryEntry: true } },
      );
      document.body.style.overscrollBehaviorY = "contain";
    });
    setInitialMainHeight(mainRef.current?.clientHeight ?? 0);
    return () => {
      document.body.style.overscrollBehaviorY = "initial";
      leaveOnUnmount();
    };
  }, [latestRenderRef, leaveOnUnmount, setTimer]);

  useLayoutEffect(() => {
    if (isPushingHistoryEntryRef.current) {
      if (location.hash !== "#!" || location.key === keyBeforePushRef.current) return;
      isPushingHistoryEntryRef.current = false;
      historyEntryKeyRef.current = location.key;
      const finishAfterPop = finishAfterPopRef.current;
      if (finishAfterPop) popHistoryEntry(finishAfterPop);
      return;
    }
    if (
      historyEntryKeyRef.current === null ||
      location.key === historyEntryKeyRef.current
    ) {
      return;
    }

    // The entry is gone: popped by `close`, or by Back, which closes the sheet.
    historyEntryKeyRef.current = null;
    isPoppingHistoryEntryRef.current = false;
    const finishAfterPop = finishAfterPopRef.current;
    finishAfterPopRef.current = null;
    if (finishAfterPop) finishAfterPop();
    else close();
  }, [location.hash, location.key, close, popHistoryEntry]);

  const isTouchingAndMoving =
    touchState.touchDiffY !== null && touchState.touchEndY !== null;
  const isTransitioning =
    touchState.touchDiffY === null && touchState.touchEndY !== null;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    const touch = e.touches[0];
    setTouchState((previous) => ({ ...previous, touchStartY: touch.clientY }));
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
    const touch = e.changedTouches[0];
    setTouchState((previous) => ({
      ...previous,
      touchDiffY: touch.clientY - (previous.touchStartY ?? 0),
      touchEndY: touch.clientY,
    }));
  };
  const handleTouchEnd = (): void => {
    const touchDiffY = touchState.touchDiffY ?? 0;
    const viewportHeight = getViewportHeight();
    let touchEndY: number | null = touchState.touchEndY;
    let isMaximized = touchState.isMaximized;
    if (!touchState.isMaximized) {
      if (canMaximize && -touchDiffY > MAXIMIZE_THRESHOLD) {
        touchEndY = 20;
        isMaximized = true;
      } else if (touchDiffY > initialMainHeight * 0.382) {
        touchEndY = viewportHeight;
        setTimer(() => close(), TRANSITION_DURATION);
      } else {
        touchEndY = viewportHeight - initialMainHeight;
        setTimer(
          () => setTouchState((previous) => ({ ...previous, touchEndY: null })),
          TRANSITION_DURATION,
        );
      }
    } else if (touchDiffY > MINIMIZE_THRESHOLD) {
      touchEndY = viewportHeight - initialMainHeight;
      setTimer(
        () =>
          setTouchState((previous) => ({
            ...previous,
            touchEndY: null,
            isMaximized: false,
          })),
        TRANSITION_DURATION,
      );
    } else {
      touchEndY = 20;
    }
    setTouchState((previous) => ({
      ...previous,
      touchEndY,
      isMaximized,
      touchDiffY: null,
    }));
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open: boolean) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal container={document.getElementById("modal-root") ?? undefined}>
        <Dialog.Overlay className={styles.background} />
        <Dialog.Content
          ref={mainRef}
          className={styles.main}
          // Radix warns about a dialog without a description unless this is given.
          aria-describedby={undefined}
          style={{
            top:
              isTouchingAndMoving || isTransitioning
                ? `${touchState.touchEndY}px`
                : undefined,
            transitionDuration: isTouchingAndMoving
              ? "0ms"
              : `${TRANSITION_DURATION}ms`,
            maxHeight:
              touchState.isMaximized || isTouchingAndMoving || isTransitioning
                ? "unset"
                : `${getViewportHeight() * 0.618}px`,
          }}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>操作選單</Dialog.Title>
          </VisuallyHidden.Root>
          <div
            className={styles.header}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          <div className={styles.body}>
            {typeof children === "function" ? children(close) : children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function getViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}
