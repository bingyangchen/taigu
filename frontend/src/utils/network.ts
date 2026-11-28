import { useEffect, useSyncExternalStore } from "react";

import { useLatestRef } from "./useLatestRef";
import Util from "./util";

// ACCT-R18: the browser may report a network before the network works, so market
// data waits this long after a restore before it is fetched again.
const MARKET_REFRESH_DELAY_AFTER_RESTORE_MS = 2000;

// ACCT-R18's 「瀏覽器的回報」: the events plus `navigator.onLine` read when the page
// opens, returns to view or comes back from the bfcache, because a browser may send no
// event while the page is hidden or frozen.
let isBrowserOnline = typeof navigator === "undefined" ? true : navigator.onLine;
let offlineSince = isBrowserOnline ? null : Date.now();
const listeners = new Set<() => void>();

/** Reads the browser's report again and tells the listeners if it changed. */
export function updateNetworkStatus(): void {
  if (navigator.onLine === isBrowserOnline) return;
  isBrowserOnline = navigator.onLine;
  offlineSince = isBrowserOnline ? null : Date.now();
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  Util.addPageReturnListener(updateNetworkStatus);
}

export function isOnline(): boolean {
  return isBrowserOnline;
}

/** When the browser started reporting no network, or null while it reports one. */
export function getOfflineSince(): number | null {
  return offlineSince;
}

/** Calls the listener each time the reported status changes. */
export function addNetworkStatusListener(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(addNetworkStatusListener, isOnline, () => true);
}

/**
 * Calls `refresh` a while after the network is back (ACCT-R18), so a page fetches its
 * market data again without waiting for the next interval.
 */
export function useMarketRefreshAfterRestore(refresh: () => void): void {
  const refreshRef = useLatestRef(refresh);
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = addNetworkStatusListener(() => {
      window.clearTimeout(timer);
      if (!isOnline()) return;
      timer = window.setTimeout(
        () => refreshRef.current(),
        MARKET_REFRESH_DELAY_AFTER_RESTORE_MS,
      );
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [refreshRef]);
}
