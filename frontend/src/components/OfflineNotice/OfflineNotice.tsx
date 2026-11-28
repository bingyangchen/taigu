import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import { getOfflineSince, updateNetworkStatus, useIsOnline } from "../../utils/network";
import { useKeyboardViewport } from "../../utils/useKeyboardViewport";
import { useIsLoadingScreenShown } from "../LoadingScreen/LoadingScreen";
import {
  addOfflineNoticeObstacleListener,
  getOfflineNoticeObstacles,
} from "./obstacles";
import styles from "./OfflineNotice.module.scss";

// ACCT-R18: a short drop in the signal shows nothing, so the screen does not flash.
const OFFLINE_NOTICE_DELAY_MS = 3000;

// When the page holding a notice was drawn. A page that replaces another with its own
// notice in the same render, such as the settings page after the dashboard, keeps it,
// so moving between them does not start the delay again.
let drawnSince: number | null = null;
let mountedCount = 0;

// The toast list reads it to stack above the notice instead of covering it.
const TOAST_CLEARANCE_PROPERTY = "--offline-notice-clearance";

/**
 * Where the notice sits in the narrow layout: above the bottom navigation bar beside
 * the speed dial, at the bottom of a page without that bar, or in the bottom right
 * corner as in the wide layout.
 */
type NarrowPlacement = "aboveNavigationBar" | "bottom" | "corner";

const narrowPlacementToClassName: Record<NarrowPlacement, string> = {
  aboveNavigationBar: styles.above_navigation_bar,
  bottom: styles.bottom,
  corner: "",
};

/** ACCT-R18's notice that the device has no network while a page is in use. */
export default function OfflineNotice({
  narrowPlacement,
}: {
  narrowPlacement: NarrowPlacement;
}) {
  const isOnline = useIsOnline();
  const [pageDrawnAt] = useState(() => drawnSince ?? Date.now());
  const [hasBeenOfflineLongEnough, setHasBeenOfflineLongEnough] = useState(
    () => getOfflineDelayLeft(pageDrawnAt) === 0,
  );

  // On iOS the on-screen keyboard carries elements fixed to the bottom up above it,
  // where the notice would cover the field being typed in (see architecture.md).
  const isKeyboardOpen = useKeyboardViewport(!isOnline) !== null;
  const isOverLoadingScreen = useIsLoadingScreenShown();
  const isShown = !isOnline && hasBeenOfflineLongEnough && !isKeyboardOpen;
  const noticeRef = useRef<HTMLDivElement>(null);

  // The page's own loading screen covers the bottom navigation bar and the speed dial,
  // so the notice spans the bottom as on a page without them.
  const placement =
    isOverLoadingScreen && narrowPlacement === "aboveNavigationBar"
      ? "bottom"
      : narrowPlacement;

  useLayoutEffect(() => {
    // ACCT-R18 reads the browser's report again when the page is drawn.
    if (mountedCount === 0 && drawnSince === null) updateNetworkStatus();
    mountedCount += 1;
    drawnSince ??= pageDrawnAt;
    return () => {
      mountedCount -= 1;
      if (mountedCount === 0) drawnSince = null;
    };
  }, [pageDrawnAt]);

  useEffect(() => {
    const delayLeft = getOfflineDelayLeft(pageDrawnAt);
    setHasBeenOfflineLongEnough(delayLeft === 0);
    if (delayLeft === null || delayLeft === 0) return;
    const timer = window.setTimeout(() => setHasBeenOfflineLongEnough(true), delayLeft);
    return () => window.clearTimeout(timer);
  }, [isOnline, pageDrawnAt]);

  useLayoutEffect(() => {
    const notice = noticeRef.current;
    if (!isShown || !notice) return;

    const place = (): void => {
      notice.style.removeProperty("--obstacle-clearance");
      const spot = notice.getBoundingClientRect();
      let clearance = 0;
      for (const obstacle of getOfflineNoticeObstacles()) {
        // The notice sits under dialogs, so a button inside one is not in its way.
        if (obstacle.closest('[role="dialog"]')) continue;
        if (overlaps(obstacle.getBoundingClientRect(), spot)) {
          clearance = Math.max(
            clearance,
            window.innerHeight - obstacle.getBoundingClientRect().top,
          );
        }
      }
      if (clearance > 0) {
        notice.style.setProperty("--obstacle-clearance", `${clearance}px`);
      }
      const placed = notice.getBoundingClientRect();
      const focused = document.activeElement;
      const coversField =
        isTextField(focused) && overlaps(focused.getBoundingClientRect(), placed);
      notice.classList.toggle(styles.hidden, coversField);

      // Writing to the root restyles the whole document, so only a change is written.
      const toastClearance = coversField ? "" : `${window.innerHeight - placed.top}px`;
      const root = document.documentElement.style;
      if (root.getPropertyValue(TOAST_CLEARANCE_PROPERTY) !== toastClearance) {
        root.setProperty(TOAST_CLEARANCE_PROPERTY, toastClearance);
      }
    };

    // Scrolling fires on every frame; measuring once per frame is enough.
    let frame: number | null = null;
    const schedulePlace = (): void => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        place();
      });
    };

    place();
    const resizeObserver = new ResizeObserver(schedulePlace);
    const observe = (): void => {
      resizeObserver.disconnect();
      resizeObserver.observe(notice);
      for (const obstacle of getOfflineNoticeObstacles()) {
        resizeObserver.observe(obstacle);
      }
    };
    observe();
    const unsubscribe = addOfflineNoticeObstacleListener(() => {
      observe();
      schedulePlace();
    });
    window.addEventListener("resize", schedulePlace);
    document.addEventListener("focusin", schedulePlace);
    document.addEventListener("focusout", schedulePlace);

    // Captures the scrolling of any container, which moves an obstacle or the focused
    // field when they are not fixed to the viewport.
    window.addEventListener("scroll", schedulePlace, { capture: true, passive: true });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      unsubscribe();
      resizeObserver.disconnect();
      window.removeEventListener("resize", schedulePlace);
      document.removeEventListener("focusin", schedulePlace);
      document.removeEventListener("focusout", schedulePlace);
      window.removeEventListener("scroll", schedulePlace, { capture: true });
      document.documentElement.style.removeProperty(TOAST_CLEARANCE_PROPERTY);
    };
  }, [isShown, placement]);

  if (!isShown) return null;
  return ReactDOM.createPortal(
    <div
      ref={noticeRef}
      className={`${styles.main} ${narrowPlacementToClassName[placement]} ${
        isOverLoadingScreen ? styles.over_loading_screen : ""
      }`}
      role="status"
    >
      <p className={styles.title}>沒有網路連線</p>
      <p className={styles.detail}>連上網路前，畫面上的資料不會更新。</p>
    </div>,
    document.body,
  );
}

/**
 * How long until the notice shows, 0 once it may, or null while there is a network.
 * ACCT-R18 counts the delay from when the browser reports no network, or from when the
 * page is drawn if it reported none before then.
 */
function getOfflineDelayLeft(pageDrawnAt: number): number | null {
  const offlineSince = getOfflineSince();
  if (offlineSince === null) return null;
  const countedFrom = Math.max(offlineSince, pageDrawnAt);
  return Math.max(0, OFFLINE_NOTICE_DELAY_MS - (Date.now() - countedFrom));
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// ACCT-R18: the notice never covers the field the user is typing in.
function isTextField(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable || element instanceof HTMLTextAreaElement) return true;
  return (
    element instanceof HTMLInputElement &&
    ![
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit",
    ].includes(element.type)
  );
}
