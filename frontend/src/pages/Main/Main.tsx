import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";

import imgPersonFill from "../../assets/person-fill.svg";
import {
  Footer,
  HeaderForMain,
  LoadingScreen,
  MainSideBar,
  PageMeta,
  PlanUpsellModal,
  ToastList,
} from "../../components";
import * as Icons from "../../icons";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { fetchAccountInfo, openSession } from "../../redux/slices/AccountSlice";
import { fetchAllCashDividendRecords } from "../../redux/slices/CashDividendRecordSlice";
import { fetchAllDiscounts } from "../../redux/slices/HandlingFeeDiscountSlice";
import { updateScrollTop } from "../../redux/slices/MainPageSlice";
import { fetchAllFavorites } from "../../redux/slices/MemoSlice";
import {
  fetchRealtimeMarketIndex,
  fetchStockInfo,
} from "../../redux/slices/StockInfoSlice";
import { fetchAllTradePlans } from "../../redux/slices/TradePlanSlice";
import { fetchAllTradeRecords } from "../../redux/slices/TradeRecordSlice";
import type { StockWarehouse, Subpage } from "../../types";
import Env from "../../utils/env";
import { isSameUrlHistoryTraversal } from "../../utils/mainNavigation";
import { makeWidthAtLeastQuery, makeWidthBelowQuery } from "../../utils/mediaQuery";
import Nav from "../../utils/nav";
import { useLatestRef } from "../../utils/useLatestRef";
import Util from "../../utils/util";
import styles from "./Main.module.scss";
import {
  captureViewPosition,
  findScrollAnchor,
  getScrollTop,
  getViewHistory,
  restoreViewPosition,
  type ViewPosition,
} from "./viewHistory";

interface NavigationSnapshot {
  position: ViewPosition;
  hadContentFocus: boolean;
}

const scrollIntentEvents = ["wheel", "touchmove", "input"] as const;
const scrollKeys = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
]);
const scrollRestorationTimeoutMs = 5000;

function Main() {
  const username = useAppSelector((rootState) => rootState.account.username);
  const avatarUrl = useAppSelector((rootState) => rootState.account.avatar_url);
  const subscription = useAppSelector((rootState) => rootState.account.subscription);
  const stockWarehouse = useAppSelector(
    (rootState) => rootState.tradeRecord.stockWarehouse,
  );
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [viewHistory] = useState(getViewHistory);
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollAnimationFrameIdRef = useRef<number | null>(null);
  const lastDispatchedScrollTopRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<ViewPosition | null>(null);
  const retryRestoringPositionRef = useRef<(() => void) | null>(null);
  const stopRestoringPositionRef = useRef<(() => void) | null>(null);

  const isMobileEditorRoute = isMobileEditorPath(location.pathname);
  const shouldUseDocumentScroll = Util.isMobile && !isMobileEditorRoute;
  const shouldUseWhiteMobileShell =
    isMobileEditorRoute ||
    location.pathname === `${Env.frontendRootPath}market` ||
    location.pathname === `${Env.frontendRootPath}records` ||
    location.pathname === `${Env.frontendRootPath}plans` ||
    Nav.isAtDetailsPage;
  const shouldShowHeader =
    Util.isMobile &&
    !isMobileEditorRoute &&
    !Nav.isAtDetailsPage &&
    !Nav.isAtMarketIndexDetailsPage;

  const getScrollContainer = (): Window | HTMLElement | null => {
    if (window.matchMedia(makeWidthAtLeastQuery("lg")).matches)
      return contentRef.current;
    if (
      document.body.classList.contains("main-page-document-scroll") &&
      window.matchMedia(makeWidthBelowQuery("md")).matches
    ) {
      return window;
    }
    return mainRef.current;
  };

  const publishScrollTop = (): void => {
    const container = getScrollContainer();
    if (!container) return;
    const top = getScrollTop(container);
    if (top === lastDispatchedScrollTopRef.current) return;
    lastDispatchedScrollTopRef.current = top;
    dispatch(updateScrollTop(top));
  };

  const capturePosition = (): ViewPosition | null => {
    if (pendingPositionRef.current) return pendingPositionRef.current;
    const container = getScrollContainer();
    const content = contentRef.current;
    if (!container || !content) return null;
    const page = getPageScrollContainer(content);
    return {
      ...captureViewPosition(container, page ? null : content),
      page: page ? captureViewPosition(page, page) : undefined,
      viewKey: getPageViewKey(content),
    };
  };

  const getSavedPosition = (): ViewPosition | undefined => {
    const latest = latestRenderRef.current;
    const position = viewHistory.get(latest.location, latest.navigationType)?.position;
    return position?.viewKey === getPageViewKey(contentRef.current)
      ? position
      : undefined;
  };

  const restorePosition = (position: ViewPosition, moveFocus = false): void => {
    stopRestoringPositionRef.current?.();
    const content = contentRef.current;
    if (!content) return;

    const restoredScrollTops = new Map<Window | HTMLElement, number>();
    const hasMovedSinceRestore = (container: Window | HTMLElement) => {
      const restoredTop = restoredScrollTops.get(container);
      if (restoredTop === undefined) return false;
      const element =
        container instanceof HTMLElement ? container : document.scrollingElement;
      if (!element) return false;
      const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
      return Math.abs(getScrollTop(container) - Math.min(restoredTop, maxTop)) > 1;
    };

    const restore = () => {
      if (
        position.viewKey !== undefined &&
        position.viewKey !== getPageViewKey(content)
      ) {
        return true;
      }
      const container = getScrollContainer();
      const page = getPageScrollContainer(content);
      const pagePosition = position.page ?? position;
      if (
        !container ||
        (latestRenderRef.current.isLoading &&
          (position.top > 0 || pagePosition.top > 0 || pagePosition.anchor))
      ) {
        return false;
      }
      if (hasMovedSinceRestore(container) || (page && hasMovedSinceRestore(page))) {
        return true;
      }
      let shellPosition = pagePosition;
      if (page) shellPosition = position.page ? position : { top: 0 };
      const reachedShellPosition = restoreViewPosition(
        container,
        content,
        shellPosition,
      );
      const reachedPagePosition = page
        ? restoreViewPosition(page, page, pagePosition)
        : true;
      restoredScrollTops.set(container, getScrollTop(container));
      if (page) restoredScrollTops.set(page, getScrollTop(page));
      publishScrollTop();

      if (
        document.activeElement === document.body ||
        document.activeElement === content
      ) {
        const target =
          pagePosition.focusedAnchorId &&
          findScrollAnchor(content, pagePosition.focusedAnchorId);
        if (target) target.focus({ preventScroll: true });
        else if (moveFocus) content.focus({ preventScroll: true });
      }
      return reachedShellPosition && reachedPagePosition;
    };

    if (restore() || typeof ResizeObserver === "undefined") return;
    pendingPositionRef.current = position;

    let timeout: number | undefined;
    const retry = () => {
      if (restore()) {
        stopRestoringPositionRef.current?.();
      } else if (!latestRenderRef.current.isLoading && timeout === undefined) {
        timeout = window.setTimeout(cancel, scrollRestorationTimeoutMs);
      }
    };
    retryRestoringPositionRef.current = retry;

    // A loading view can be too short to reach its saved position or lack the saved row.
    const observer = new ResizeObserver(retry);
    const observeContent = () => {
      observer.disconnect();
      observer.observe(content);
      for (const child of Array.from(content.children)) observer.observe(child);
    };
    const childrenObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.target === content)) observeContent();
      retry();
    });
    childrenObserver.observe(content, { childList: true, subtree: true });
    observeContent();

    const cancelOnScrollKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || !scrollKeys.has(event.key)) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      cancel();
    };
    const cancel = () => {
      observer.disconnect();
      childrenObserver.disconnect();
      window.clearTimeout(timeout);
      for (const event of scrollIntentEvents)
        window.removeEventListener(event, cancel, true);
      window.removeEventListener("keydown", cancelOnScrollKey, true);
      pendingPositionRef.current = null;
      retryRestoringPositionRef.current = null;
      stopRestoringPositionRef.current = null;
    };
    stopRestoringPositionRef.current = cancel;
    for (const event of scrollIntentEvents) {
      window.addEventListener(event, cancel, { capture: true, passive: true });
    }
    window.addEventListener("keydown", cancelOnScrollKey, true);
    retry();
  };

  const syncMobileScrollMode = (): void => {
    const latest = latestRenderRef.current;
    document.body.classList.toggle(
      "main-page-document-scroll",
      latest.shouldUseDocumentScroll,
    );
    document.body.classList.toggle(
      "main-page-gradient-scroll",
      latest.shouldUseDocumentScroll && !latest.shouldUseWhiteMobileShell,
    );
    document.body.classList.toggle(
      "main-page-white-shell-scroll",
      latest.shouldUseDocumentScroll && latest.shouldUseWhiteMobileShell,
    );
  };

  const fetchHoldingStockInfo = async (
    warehouseFromStore?: StockWarehouse,
  ): Promise<void> => {
    const warehouse = warehouseFromStore ?? latestRenderRef.current.stockWarehouse;
    const holdingSids = Object.entries(warehouse)
      .filter(([, warehouse]) => warehouse.length > 0)
      .map(([sid]) => sid);
    await dispatch(fetchStockInfo(holdingSids)).unwrap();
    setIsLoading(false);
  };

  // Listeners, observers, timers and async continuations act on the latest render.
  const latestRenderRef = useLatestRef({
    location,
    navigationType,
    isLoading,
    stockWarehouse,
    subscription,
    shouldUseDocumentScroll,
    shouldUseWhiteMobileShell,
    publishScrollTop,
    capturePosition,
    getSavedPosition,
    restorePosition,
    syncMobileScrollMode,
    fetchHoldingStockInfo,
  });

  // Leaving a page replaces its DOM, and no hook runs between the render and that DOM
  // update, so the render reads the page's scroll position and focus while the DOM
  // still shows it.
  const committed = latestRenderRef.current;
  const navigationSnapshot: NavigationSnapshot | null = (() => {
    if (committed.location.key === location.key) return null;
    const position = committed.capturePosition();
    if (!position) return null;
    return {
      position,
      hadContentFocus: contentRef.current?.contains(document.activeElement) ?? false,
    };
  })();

  useLayoutEffect(() => {
    const latest = latestRenderRef.current;
    const mainElement = mainRef.current;
    const contentElement = contentRef.current;
    let isUnmounted = false;
    let fetchStockInfoTimer: ReturnType<typeof setInterval> | null = null;
    const handleScroll = (): void => {
      if (scrollAnimationFrameIdRef.current !== null) return;

      scrollAnimationFrameIdRef.current = requestAnimationFrame(() => {
        scrollAnimationFrameIdRef.current = null;
        latestRenderRef.current.publishScrollTop();
      });
    };

    oncontextmenu = (e) => e.preventDefault();
    latest.syncMobileScrollMode();
    mainElement?.addEventListener("scroll", handleScroll);
    contentElement?.addEventListener("scroll", handleScroll);
    window.addEventListener("scroll", handleScroll);
    window.history.scrollRestoration = "manual";
    const position = latest.getSavedPosition();
    if (position || latest.navigationType !== "POP") {
      latest.restorePosition(position ?? { top: 0 });
    } else {
      latest.publishScrollTop();
    }
    const removePageReturnListener = Util.addPageReturnListener(() =>
      dispatch(openSession()),
    );

    const loadAccountData = async (): Promise<void> => {
      try {
        const account = await dispatch(fetchAccountInfo()).unwrap();
        if (account) {
          void dispatch(fetchRealtimeMarketIndex());
          const independentPromises = Promise.allSettled([
            dispatch(openSession()).unwrap(),
            dispatch(fetchAllCashDividendRecords()).unwrap(),
            dispatch(fetchAllFavorites()).unwrap(),
            dispatch(fetchAllTradePlans()).unwrap(),
            dispatch(fetchAllDiscounts()).unwrap(),
          ]);

          const res = await dispatch(fetchAllTradeRecords(account.id)).unwrap();

          await Promise.allSettled([
            latestRenderRef.current.fetchHoldingStockInfo(res.stockWarehouse),
            independentPromises,
          ]);
        }
      } catch (error) {
        console.error("Failed to load critical user or trade records on mount:", error);
      } finally {
        setIsLoading(false);
      }

      if (isUnmounted) return;
      fetchStockInfoTimer = setInterval(() => {
        latestRenderRef.current.fetchHoldingStockInfo();
        dispatch(fetchRealtimeMarketIndex());
      }, latestRenderRef.current.subscription.market_refresh_interval_seconds * 1000);
    };
    void loadAccountData();

    const savePositionOnLeave = (): void => {
      const leaving = latestRenderRef.current;
      const lastPosition = leaving.capturePosition();
      if (lastPosition) viewHistory.save(leaving.location, { position: lastPosition });
    };

    return () => {
      isUnmounted = true;
      savePositionOnLeave();
      stopRestoringPositionRef.current?.();
      window.history.scrollRestoration = "auto";
      mainElement?.removeEventListener("scroll", handleScroll);
      contentElement?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      removePageReturnListener();
      document.body.classList.remove("main-page-document-scroll");
      document.body.classList.remove("main-page-gradient-scroll");
      document.body.classList.remove("main-page-white-shell-scroll");
      if (scrollAnimationFrameIdRef.current !== null) {
        cancelAnimationFrame(scrollAnimationFrameIdRef.current);
        scrollAnimationFrameIdRef.current = null;
      }
      if (fetchStockInfoTimer) clearInterval(fetchStockInfoTimer);
    };
  }, [dispatch, latestRenderRef, viewHistory]);

  useLayoutEffect(() => {
    const previousLocation = committed.location;
    if (navigationSnapshot) {
      viewHistory.save(previousLocation, { position: navigationSnapshot.position });
    }

    if (previousLocation.pathname !== location.pathname) {
      syncMobileScrollMode();
      restorePosition(
        getSavedPosition() ?? { top: 0 },
        navigationSnapshot?.hadContentFocus,
      );
      dispatch(fetchAccountInfo());
      dispatch(openSession());
    } else if (
      previousLocation.search !== location.search ||
      isSameUrlHistoryTraversal(previousLocation, location, navigationType)
    ) {
      restorePosition(
        getSavedPosition() ?? { top: 0 },
        navigationSnapshot?.hadContentFocus,
      );
    } else if (committed.isLoading && !isLoading) {
      retryRestoringPositionRef.current?.();
    }

    // Conditionally navigate back one more time
    if (previousLocation.key !== location.key) {
      window.history.scrollRestoration = "manual";
      if (
        location.hash &&
        previousLocation.pathname === location.pathname &&
        previousLocation.hash === location.hash &&
        previousLocation.search === location.search &&
        previousLocation.state === location.state
      ) {
        navigate(-1);
      }
    }
  });

  const subpages: Subpage[] = useMemo(
    () => [
      {
        icon: <Icons.IconHome sideLength="100%" />,
        icon_bold: <Icons.IconHomeBold sideLength="100%" />,
        name: "儀表板",
        path: Env.frontendRootPath,
      },
      {
        icon: <Icons.IconChartHistogram sideLength="100%" />,
        icon_bold: <Icons.IconChartHistogramBold sideLength="100%" />,
        name: "市場",
        path: `${Env.frontendRootPath}market`,
      },
      {
        icon: <Icons.IconClockHistory sideLength="100%" />,
        icon_bold: <Icons.IconClockHistoryBold sideLength="100%" />,
        name: "歷史紀錄",
        path: `${Env.frontendRootPath}records`,
      },
      {
        icon: <Icons.IconThumbtack sideLength="100%" />,
        icon_bold: <Icons.IconThumbtackBold sideLength="100%" />,
        name: "買賣計畫",
        path: `${Env.frontendRootPath}plans`,
      },
      {
        icon: (
          <img
            src={avatarUrl ? avatarUrl : imgPersonFill}
            alt=""
            className={styles.user_avatar}
          />
        ),
        name: "帳號",
        path: `${Env.frontendRootPath}settings`,
      },
    ],
    [avatarUrl],
  );

  const isMarketIndexPage = Nav.isAtMarketIndexDetailsPage;
  return (
    <main
      className={`${styles.main} ${
        shouldUseWhiteMobileShell ? styles.white_mobile_shell : ""
      } ${isMobileEditorRoute ? styles.mobile_editor_shell : ""} ${
        Nav.isAtDetailsPage || isMarketIndexPage ? styles.mobile_detail_shell : ""
      } ${isMarketIndexPage ? styles.market_index_shell : ""}`}
      ref={mainRef}
    >
      <PageMeta title="Taigu | 台股記帳" noindex />
      <ToastList />
      <PlanUpsellModal />
      {isLoading && <LoadingScreen />}
      {shouldShowHeader && <HeaderForMain />}
      <div className={styles.body}>
        {(!Util.isMobile || isMarketIndexPage) && (
          <div className={styles.sidebar}>
            <MainSideBar
              avatarUrl={avatarUrl ? avatarUrl : imgPersonFill}
              username={username}
              subpages={subpages.slice(0, 4)}
            />
          </div>
        )}
        <div className={styles.content} ref={contentRef} tabIndex={-1}>
          <Outlet />
        </div>
      </div>
      {(Util.isMobile || isMarketIndexPage) && !isMobileEditorRoute && (
        <div className={styles.footer}>
          <Footer subpages={subpages} />
        </div>
      )}
    </main>
  );
}

export default memo(Main);

function isMobileEditorPath(pathname: string): boolean {
  return [
    /^\/records\/(trade|cash-dividend)\/(new|\d+\/edit)$/u,
    /^\/plans\/(new|[^/]+\/edit)$/u,
    /^\/handling-fee\/discounts\/(new|\d+\/edit)$/u,
    /^\/search$/u,
  ].some((pattern) => pattern.test(pathname));
}

function getPageViewKey(content: HTMLElement | null): string | undefined {
  return content?.querySelector<HTMLElement>("[data-scroll-view-key]")?.dataset
    .scrollViewKey;
}

function getPageScrollContainer(content: HTMLElement): HTMLElement | null {
  const selector = window.matchMedia(makeWidthAtLeastQuery("md")).matches
    ? "[data-page-scroll]"
    : '[data-page-scroll="always"]';
  return content.querySelector<HTMLElement>(selector);
}
