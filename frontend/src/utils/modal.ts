import React, { MouseEventHandler } from "react";

export const closeActiveModalEventName = "taigu:close-active-modal";

/**
 * "quotaExceeded" closes the first opened modal that does not opt out and pops its
 * history entry; "navigation" closes every modal and leaves their history entries
 * for the caller to walk back.
 */
export type CloseModalReason = "quotaExceeded" | "navigation";

type CloseActiveModalDetail = {
  reason: CloseModalReason;
  handled: boolean;
  pendingCloseCount: number;
  historyEntryCount: number;
  done: () => void;
};

export type CloseActiveModalEvent = CustomEvent<CloseActiveModalDetail>;

/** Returns how many history entries the closed modals left behind. */
export async function requestCloseActiveModal(
  reason: CloseModalReason,
): Promise<number> {
  let resolveClose: () => void = () => {};
  const closePromise = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
  const detail: CloseActiveModalDetail = {
    reason,
    handled: false,
    pendingCloseCount: 0,
    historyEntryCount: 0,
    done: () => {
      detail.pendingCloseCount -= 1;
      if (detail.pendingCloseCount === 0) resolveClose();
    },
  };
  window.dispatchEvent(new CustomEvent(closeActiveModalEventName, { detail }));
  if (detail.pendingCloseCount === 0) resolveClose();
  await closePromise;
  await waitForNextFrame();
  return detail.historyEntryCount;
}

export async function goBackInHistory(entryCount: number): Promise<void> {
  // history.go() past the first entry fires no popstate, which would never resolve.
  const index: unknown = window.history.state?.idx;
  const reachableCount = Number.isInteger(index)
    ? Math.min(entryCount, index as number)
    : entryCount;
  if (reachableCount <= 0) return;
  await new Promise<void>((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    window.history.go(-reachableCount);
  });
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function getHideModalCallback(component: React.Component): MouseEventHandler {
  return (): void => {
    if (component.state && "activeModalName" in component.state) {
      component.setState({ activeModalName: null });
    } else throw Error("Lack of state: activeModalName");
  };
}
