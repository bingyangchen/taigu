import type { Location, NavigationType } from "react-router-dom";

import { getMainTabPath } from "../../utils/mainNavigation";
import { getDocumentSessionVersion } from "../../utils/session";

type ScrollAnchor = { id: string; offset: number };

type ScrollPosition = { top: number; anchor?: ScrollAnchor; focusedAnchorId?: string };

export type ViewPosition = ScrollPosition & { page?: ScrollPosition; viewKey?: string };

type ListView = {
  numberToShow: number;
  searchKeyword?: string | null;
  daysToShow?: number;
};
type ViewHistoryEntry = { position?: ViewPosition; list?: ListView };

const maxSavedViews = 100;
const anchorSelector = "[data-scroll-anchor]";

class ViewHistory {
  private readonly historyKeyToView = new Map<string, ViewHistoryEntry>();
  private readonly tabPathToView = new Map<string, ViewHistoryEntry>();

  public constructor(private readonly sessionVersion: string) {}

  public isCurrentSession(): boolean {
    if (getDocumentSessionVersion() === this.sessionVersion) return true;
    this.historyKeyToView.clear();
    this.tabPathToView.clear();
    return false;
  }

  public get(
    location: Location,
    navigationType: NavigationType,
  ): ViewHistoryEntry | undefined {
    if (!this.isCurrentSession()) return undefined;
    if (navigationType === "POP") return this.historyKeyToView.get(location.key);
    if (location.state?.restoreMainTab !== true) return undefined;
    const tabPath = getMainTabPath(location);
    return tabPath ? this.tabPathToView.get(tabPath) : undefined;
  }

  public save(location: Location, view: ViewHistoryEntry): void {
    if (!this.isCurrentSession()) return;
    const historyKey = location.key;
    const previous = this.historyKeyToView.get(historyKey);
    this.historyKeyToView.delete(historyKey);
    this.historyKeyToView.set(historyKey, { ...previous, ...view });
    if (this.historyKeyToView.size > maxSavedViews) {
      const [oldestKey] = this.historyKeyToView.keys();
      this.historyKeyToView.delete(oldestKey);
    }
    const tabPath = getMainTabPath(location);
    if (tabPath)
      this.tabPathToView.set(tabPath, { ...this.tabPathToView.get(tabPath), ...view });
  }
}

let viewHistory = new ViewHistory(getDocumentSessionVersion());

export function getViewHistory(): ViewHistory {
  if (!viewHistory.isCurrentSession()) {
    viewHistory = new ViewHistory(getDocumentSessionVersion());
  }
  return viewHistory;
}

export function getScrollTop(container: Window | HTMLElement): number {
  return Math.max(
    0,
    container instanceof HTMLElement ? container.scrollTop : window.scrollY,
  );
}

function getViewportTop(container: Window | HTMLElement): number {
  return container instanceof HTMLElement ? container.getBoundingClientRect().top : 0;
}

export function captureViewPosition(
  container: Window | HTMLElement,
  content: HTMLElement | null,
): ScrollPosition {
  const top = getScrollTop(container);
  if (!content) return { top };
  const viewportTop = getViewportTop(container);
  const viewportHeight =
    container instanceof HTMLElement ? container.clientHeight : window.innerHeight;
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && content.contains(focused)) {
    const id = focused.dataset.scrollAnchor;
    if (id) {
      const rect = focused.getBoundingClientRect();
      const offset = rect.top - viewportTop;
      if (rect.bottom > viewportTop && offset < viewportHeight) {
        return { top, anchor: { id, offset }, focusedAnchorId: id };
      }
    }
  }

  if (top === 0) return { top };

  const bounds = content.getBoundingClientRect();
  const left = Math.max(0, bounds.left);
  const right = Math.min(window.innerWidth, bounds.right);
  const visibleTop = Math.max(0, viewportTop);
  const visibleBottom = Math.min(window.innerHeight, viewportTop + viewportHeight);
  for (const distance of [1, 24, 72, 144]) {
    const y = visibleTop + distance;
    if (y >= visibleBottom) break;
    for (const fraction of [0.25, 0.5, 0.75]) {
      const x = left + (right - left) * fraction;
      for (const element of document.elementsFromPoint(x, y)) {
        const row = element.closest<HTMLElement>(anchorSelector);
        const id = row?.dataset.scrollAnchor;
        if (row && id && content.contains(row)) {
          return {
            top,
            anchor: { id, offset: row.getBoundingClientRect().top - viewportTop },
          };
        }
      }
    }
  }
  return { top };
}

export function findScrollAnchor(content: HTMLElement, id: string): HTMLElement | null {
  return content.querySelector<HTMLElement>(`[data-scroll-anchor="${CSS.escape(id)}"]`);
}

export function restoreViewPosition(
  container: Window | HTMLElement,
  content: HTMLElement,
  position: ScrollPosition,
): boolean {
  const currentTop = getScrollTop(container);
  const anchor = position.anchor && findScrollAnchor(content, position.anchor.id);
  const top =
    anchor && position.anchor
      ? Math.max(
          0,
          currentTop +
            anchor.getBoundingClientRect().top -
            getViewportTop(container) -
            position.anchor.offset,
        )
      : position.top;

  if (Math.abs(currentTop - top) > 1) container.scrollTo({ top, left: 0 });
  return (
    (!position.anchor || Boolean(anchor)) &&
    Math.abs(getScrollTop(container) - top) <= 1
  );
}
