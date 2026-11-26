import React, { memo, useLayoutEffect, useRef, useState } from "react";

import { useAppSelector } from "../../redux/hooks";
import Util from "../../utils/util";

interface Props {
  children: React.ReactNode;
  activeClassName: string;
  className: string;
  hiddenClassName: string;
  noTransitionClassName: string;
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

function ScrollAwareFloatingControls({
  children,
  activeClassName,
  className,
  hiddenClassName,
  noTransitionClassName,
}: Props) {
  const scrollTop = useAppSelector((state) => state.mainPage.scrollTop);
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
    if (!Util.isMobile || tracking.lastScrollTop === scrollTop) return;

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
  }, [scrollTop, state.isActivated, state.isVisible]);

  const isActivated = Util.isMobile && state.isActivated;
  return (
    <div
      ref={controlsRef}
      className={`${className} ${isActivated ? activeClassName : ""} ${
        isActivated && !state.isVisible ? hiddenClassName : ""
      } ${isActivated && !state.shouldAnimate ? noTransitionClassName : ""}`}
    >
      {children}
    </div>
  );
}

export default memo(ScrollAwareFloatingControls);
