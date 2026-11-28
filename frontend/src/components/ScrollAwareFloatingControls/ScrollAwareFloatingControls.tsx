import React, { memo, useLayoutEffect, useRef, useState } from "react";

import { useAppSelector } from "../../redux/hooks";
import { useIsNarrowLayout } from "../../utils/mediaQuery";
import styles from "./ScrollAwareFloatingControls.module.scss";

interface Props {
  children: React.ReactNode;
  className?: string;
}

interface ControlsState {
  isActivated: boolean;
  isVisible: boolean;
  shouldAnimate: boolean;
}

interface ScrollTracking {
  activationScrollTop: number;
  lastScrollTop: number;
  upwardDistance: number;
  downwardDistance: number;
}

function ScrollAwareFloatingControls({ children, className = "" }: Props) {
  const scrollTop = useAppSelector((state) => state.mainPage.scrollTop);
  const isNarrowLayout = useIsNarrowLayout();
  const [state, setState] = useState<ControlsState>({
    isActivated: false,
    isVisible: true,
    shouldAnimate: true,
  });
  const controlsRef = useRef<HTMLDivElement>(null);
  const trackingRef = useRef<ScrollTracking | null>(null);

  useLayoutEffect(() => {
    const tracking = trackingRef.current;
    if (!tracking) {
      const controlsElement = controlsRef.current;
      trackingRef.current = {
        activationScrollTop: controlsElement
          ? scrollTop + controlsElement.getBoundingClientRect().bottom
          : 0,
        lastScrollTop: scrollTop,
        upwardDistance: 0,
        downwardDistance: 0,
      };
      return;
    }
    if (!isNarrowLayout || tracking.lastScrollTop === scrollTop) return;

    const delta = scrollTop - tracking.lastScrollTop;
    tracking.lastScrollTop = scrollTop;

    if (!state.isActivated) {
      if (scrollTop >= tracking.activationScrollTop && delta > 0) {
        tracking.upwardDistance = 0;
        tracking.downwardDistance = 0;
        setState({ isActivated: true, isVisible: false, shouldAnimate: false });
      }
      return;
    }

    if (scrollTop < tracking.activationScrollTop) {
      tracking.upwardDistance = 0;
      tracking.downwardDistance = 0;
      setState({ isActivated: false, isVisible: true, shouldAnimate: true });
      return;
    }

    if (delta > 0) {
      tracking.downwardDistance += delta;
      tracking.upwardDistance = 0;
      if (tracking.downwardDistance >= 8 && state.isVisible) {
        setState((previous) => ({
          ...previous,
          isVisible: false,
          shouldAnimate: true,
        }));
      }
    } else if (delta < 0) {
      tracking.upwardDistance += Math.abs(delta);
      tracking.downwardDistance = 0;
      if (tracking.upwardDistance >= 12 && !state.isVisible) {
        setState((previous) => ({ ...previous, isVisible: true, shouldAnimate: true }));
      }
    }
  }, [isNarrowLayout, scrollTop, state.isActivated, state.isVisible]);

  const isActivated = isNarrowLayout && state.isActivated;
  return (
    <div
      ref={controlsRef}
      className={`${styles.main} ${className} ${isActivated ? styles.active : ""} ${
        isActivated && !state.isVisible ? styles.hidden : ""
      } ${isActivated && !state.shouldAnimate ? styles.no_transition : ""}`}
    >
      {children}
    </div>
  );
}

export default memo(ScrollAwareFloatingControls);
