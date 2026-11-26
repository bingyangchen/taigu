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

interface Props {
  children?: React.ReactNode;
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
  const previousHashRef = useRef(location.hash);
  const latestRenderRef = useLatestRef({ location, navigate, onClickBackground });

  const handleClickBackground = useCallback(
    (e: MouseEvent): void => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      if (latestRenderRef.current.location.hash === "#!") {
        latestRenderRef.current.navigate(-1);
      }
      setTimeout(() => latestRenderRef.current.onClickBackground(e));
    },
    [latestRenderRef],
  );

  useLayoutEffect(() => {
    setTimeout(() => {
      const { location: latestLocation, navigate: latestNavigate } =
        latestRenderRef.current;
      latestNavigate({ search: latestLocation.search, hash: "#!" });
      document.body.style.overscrollBehaviorY = "contain";
    });
    setInitialMainHeight(mainRef.current?.clientHeight ?? 0);
    return () => {
      document.body.style.overscrollBehaviorY = "initial";
    };
  }, [latestRenderRef]);

  useLayoutEffect(() => {
    const previousHash = previousHashRef.current;
    previousHashRef.current = location.hash;
    if (previousHash === "#!" && location.hash === "") {
      handleClickBackground({} as MouseEvent);
    }
  }, [location.hash, handleClickBackground]);

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
        setTimeout(() => handleClickBackground({} as MouseEvent), TRANSITION_DURATION);
      } else {
        touchEndY = viewportHeight - initialMainHeight;
        setTimeout(
          () => setTouchState((previous) => ({ ...previous, touchEndY: null })),
          TRANSITION_DURATION,
        );
      }
    } else if (touchDiffY > MINIMIZE_THRESHOLD) {
      touchEndY = viewportHeight - initialMainHeight;
      setTimeout(
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
        if (!open) handleClickBackground({} as MouseEvent);
      }}
    >
      <Dialog.Portal container={document.getElementById("modal-root") ?? undefined}>
        <Dialog.Overlay className={styles.background} />
        <Dialog.Content
          ref={mainRef}
          className={styles.main}
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
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function getViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}
