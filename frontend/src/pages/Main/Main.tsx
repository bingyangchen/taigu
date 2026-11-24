import React from "react";
import { connect } from "react-redux";
import { Outlet } from "react-router-dom";

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
import type { AppDispatch, RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import type { StockWarehouse, Subpage } from "../../types";
import Env from "../../utils/env";
import { isSameUrlHistoryTraversal } from "../../utils/mainNavigation";
import Nav from "../../utils/nav";
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

function mapStateToProps(rootState: RootState) {
  const { username, avatar_url, subscription } = rootState.account;
  const { stockWarehouse } = rootState.tradeRecord;
  return { username, avatar_url, stockWarehouse, subscription };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  isLoading: boolean;
  prevLocationPathname: string | null;
}

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

class Main extends React.Component<Props, State> {
  public state: State;
  private readonly viewHistory = getViewHistory();
  private mainRef: React.RefObject<HTMLElement>;
  private contentRef: React.RefObject<HTMLDivElement>;
  private subpages: Subpage[];
  private fetchStockInfoTimer: ReturnType<typeof setTimeout> | null;
  private scrollAnimationFrameId: number | null = null;
  private lastDispatchedScrollTop: number | null = null;
  private removePageReturnListener: (() => void) | null = null;
  private pendingPosition: ViewPosition | null = null;
  private retryRestoringPosition: (() => void) | null = null;
  private stopRestoringPosition: (() => void) | null = null;
  public constructor(props: Props) {
    super(props);
    this.state = { isLoading: true, prevLocationPathname: null };
    this.mainRef = React.createRef();
    this.contentRef = React.createRef();
    this.subpages = [];
    this.fetchStockInfoTimer = null;
  }

  public async componentDidMount(): Promise<void> {
    oncontextmenu = (e) => e.preventDefault();
    this.syncMobileScrollMode();
    this.mainRef.current?.addEventListener("scroll", this.handleScroll);
    this.contentRef.current?.addEventListener("scroll", this.handleScroll);
    window.addEventListener("scroll", this.handleScroll);
    window.history.scrollRestoration = "manual";
    const position = this.getSavedPosition();
    if (position || this.props.router.navigationType !== "POP") {
      this.restorePosition(position ?? { top: 0 });
    } else {
      this.publishScrollTop();
    }
    this.removePageReturnListener = Util.addPageReturnListener(() =>
      this.props.dispatch(openSession()),
    );

    try {
      const account = await this.props.dispatch(fetchAccountInfo()).unwrap();
      if (account) {
        const independentPromises = Promise.allSettled([
          this.props.dispatch(openSession()).unwrap(),
          this.props.dispatch(fetchAllCashDividendRecords()).unwrap(),
          this.props.dispatch(fetchAllFavorites()).unwrap(),
          this.props.dispatch(fetchAllTradePlans()).unwrap(),
          this.props.dispatch(fetchRealtimeMarketIndex()).unwrap(),
          this.props.dispatch(fetchAllDiscounts()).unwrap(),
        ]);

        const res = await this.props
          .dispatch(fetchAllTradeRecords(account.id))
          .unwrap();

        await Promise.allSettled([
          this.fetchHoldingStockInfo(res.stockWarehouse),
          independentPromises,
        ]);
      }
    } catch (error) {
      console.error(
        "Failed to load critical user or trade records in componentDidMount:",
        error,
      );
    } finally {
      this.setState({ isLoading: false });
    }

    this.subpages = [
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
            src={this.props.avatar_url ? this.props.avatar_url : imgPersonFill}
            alt=""
            className={styles.user_avatar}
          />
        ),
        name: "帳號",
        path: `${Env.frontendRootPath}settings`,
      },
    ];

    this.fetchStockInfoTimer = setInterval(() => {
      this.fetchHoldingStockInfo();
      this.props.dispatch(fetchRealtimeMarketIndex());
    }, this.marketRefreshIntervalMs);
  }

  public getSnapshotBeforeUpdate(
    prevProps: Readonly<Props>,
  ): NavigationSnapshot | null {
    if (prevProps.router.location.key === this.props.router.location.key) return null;
    const position = this.capturePosition();
    if (!position) return null;
    return {
      position,
      hadContentFocus:
        this.contentRef.current?.contains(document.activeElement) ?? false,
    };
  }

  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot: NavigationSnapshot | null,
  ): void {
    if (snapshot)
      this.viewHistory.save(prevProps.router.location, { position: snapshot.position });

    const { location, navigationType } = this.props.router;
    const previousLocation = prevProps.router.location;
    if (prevProps.router.location.pathname !== location.pathname) {
      this.syncMobileScrollMode();
      this.restorePosition(
        this.getSavedPosition() ?? { top: 0 },
        snapshot?.hadContentFocus,
      );
      this.props.dispatch(fetchAccountInfo());
      this.props.dispatch(openSession());
    } else if (
      previousLocation.search !== location.search ||
      isSameUrlHistoryTraversal(previousLocation, location, navigationType)
    ) {
      this.restorePosition(
        this.getSavedPosition() ?? { top: 0 },
        snapshot?.hadContentFocus,
      );
    } else if (prevState.isLoading && !this.state.isLoading) {
      this.retryRestoringPosition?.();
    }

    // Conditionally navigate back one more time
    if (prevProps.router.location.key !== this.props.router.location.key) {
      window.history.scrollRestoration = "manual";
      if (
        location.hash &&
        prevProps.router.location.pathname === this.props.router.location.pathname &&
        prevProps.router.location.hash === this.props.router.location.hash &&
        prevProps.router.location.search === this.props.router.location.search &&
        prevProps.router.location.state === this.props.router.location.state
      ) {
        this.setState(
          { prevLocationPathname: prevProps.router.location.pathname },
          () => this.props.router.navigate(-1),
        );
      } else this.setState({ prevLocationPathname: null });
    }
  }

  public componentWillUnmount(): void {
    const position = this.capturePosition();
    if (position) this.viewHistory.save(this.props.router.location, { position });
    this.stopRestoringPosition?.();
    window.history.scrollRestoration = "auto";
    this.mainRef.current?.removeEventListener("scroll", this.handleScroll);
    this.contentRef.current?.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("scroll", this.handleScroll);
    this.removePageReturnListener?.();
    document.body.classList.remove("main-page-document-scroll");
    document.body.classList.remove("main-page-gradient-scroll");
    document.body.classList.remove("main-page-white-shell-scroll");
    if (this.scrollAnimationFrameId !== null) {
      cancelAnimationFrame(this.scrollAnimationFrameId);
      this.scrollAnimationFrameId = null;
    }
    if (this.fetchStockInfoTimer) {
      clearInterval(this.fetchStockInfoTimer);
      this.fetchStockInfoTimer = null;
    }
  }

  public render(): React.ReactNode {
    return (
      <main
        className={`${styles.main} ${
          this.shouldUseWhiteMobileShell ? styles.white_mobile_shell : ""
        } ${this.isMobileEditorRoute ? styles.mobile_editor_shell : ""} ${
          Nav.isAtDetailsPage || Nav.isAtMarketIndexDetailsPage
            ? styles.mobile_detail_shell
            : ""
        }`}
        ref={this.mainRef}
      >
        <PageMeta title="Taigu | 台股記帳" noindex />
        <ToastList />
        <PlanUpsellModal />
        {this.state.isLoading && <LoadingScreen />}
        {this.shouldShowHeader && <HeaderForMain />}
        <div className={styles.body}>
          {!Util.isMobile && (
            <MainSideBar
              avatarUrl={this.props.avatar_url ? this.props.avatar_url : imgPersonFill}
              username={this.props.username}
              subpages={Util.isMobile ? this.subpages : this.subpages.slice(0, 4)}
            />
          )}
          <div className={styles.content} ref={this.contentRef} tabIndex={-1}>
            <Outlet />
          </div>
        </div>
        {Util.isMobile && !this.isMobileEditorRoute && (
          <Footer subpages={this.subpages} />
        )}
      </main>
    );
  }

  private handleScroll = (): void => {
    if (this.scrollAnimationFrameId !== null) return;

    this.scrollAnimationFrameId = requestAnimationFrame(() => {
      this.scrollAnimationFrameId = null;
      this.publishScrollTop();
    });
  };

  private getScrollContainer(): Window | HTMLElement | null {
    if (window.matchMedia("(min-width: 960px)").matches) return this.contentRef.current;
    if (
      document.body.classList.contains("main-page-document-scroll") &&
      window.matchMedia("(max-width: 779px)").matches
    ) {
      return window;
    }
    return this.mainRef.current;
  }

  private publishScrollTop(): void {
    const container = this.getScrollContainer();
    if (!container) return;
    const top = getScrollTop(container);
    if (top === this.lastDispatchedScrollTop) return;
    this.lastDispatchedScrollTop = top;
    this.props.dispatch(updateScrollTop(top));
  }

  private capturePosition(): ViewPosition | null {
    if (this.pendingPosition) return this.pendingPosition;
    const container = this.getScrollContainer();
    const content = this.contentRef.current;
    if (!container || !content) return null;
    const page = this.getPageScrollContainer(content);
    return {
      ...captureViewPosition(container, page ? null : content),
      page: page ? captureViewPosition(page, page) : undefined,
      viewKey: this.getPageViewKey(content),
    };
  }

  private getSavedPosition(): ViewPosition | undefined {
    const { location, navigationType } = this.props.router;
    const position = this.viewHistory.get(location, navigationType)?.position;
    return position?.viewKey === this.getPageViewKey(this.contentRef.current)
      ? position
      : undefined;
  }

  private getPageViewKey(content: HTMLElement | null): string | undefined {
    return content?.querySelector<HTMLElement>("[data-scroll-view-key]")?.dataset
      .scrollViewKey;
  }

  private getPageScrollContainer(content: HTMLElement): HTMLElement | null {
    const selector = window.matchMedia("(min-width: 780px)").matches
      ? "[data-page-scroll]"
      : '[data-page-scroll="always"]';
    return content.querySelector<HTMLElement>(selector);
  }

  private restorePosition(position: ViewPosition, moveFocus = false): void {
    this.stopRestoringPosition?.();
    const content = this.contentRef.current;
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
        position.viewKey !== this.getPageViewKey(content)
      ) {
        return true;
      }
      const container = this.getScrollContainer();
      const page = this.getPageScrollContainer(content);
      const pagePosition = position.page ?? position;
      if (
        !container ||
        (this.state.isLoading &&
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
      this.publishScrollTop();

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
    this.pendingPosition = position;

    let timeout: number | undefined;
    const retry = () => {
      if (restore()) {
        this.stopRestoringPosition?.();
      } else if (!this.state.isLoading && timeout === undefined) {
        timeout = window.setTimeout(cancel, scrollRestorationTimeoutMs);
      }
    };
    this.retryRestoringPosition = retry;

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
      this.pendingPosition = null;
      this.retryRestoringPosition = null;
      this.stopRestoringPosition = null;
    };
    this.stopRestoringPosition = cancel;
    for (const event of scrollIntentEvents) {
      window.addEventListener(event, cancel, { capture: true, passive: true });
    }
    window.addEventListener("keydown", cancelOnScrollKey, true);
    retry();
  }

  private syncMobileScrollMode(): void {
    document.body.classList.toggle(
      "main-page-document-scroll",
      this.shouldUseDocumentScroll,
    );
    document.body.classList.toggle(
      "main-page-gradient-scroll",
      this.shouldUseDocumentScroll && !this.shouldUseWhiteMobileShell,
    );
    document.body.classList.toggle(
      "main-page-white-shell-scroll",
      this.shouldUseDocumentScroll && this.shouldUseWhiteMobileShell,
    );
  }

  private get shouldShowHeader(): boolean {
    return (
      Util.isMobile &&
      !this.isMobileEditorRoute &&
      !Nav.isAtDetailsPage &&
      !Nav.isAtMarketIndexDetailsPage
    );
  }

  private get shouldUseDocumentScroll(): boolean {
    return Util.isMobile && !this.isMobileEditorRoute;
  }

  private get shouldUseWhiteMobileShell(): boolean {
    return (
      this.isMobileEditorRoute ||
      this.props.router.location.pathname === `${Env.frontendRootPath}market` ||
      this.props.router.location.pathname === `${Env.frontendRootPath}records` ||
      this.props.router.location.pathname === `${Env.frontendRootPath}plans` ||
      Nav.isAtDetailsPage
    );
  }

  private get isMobileEditorRoute(): boolean {
    return [
      /^\/records\/(trade|cash-dividend)\/(new|\d+\/edit)$/u,
      /^\/plans\/(new|[^/]+\/edit)$/u,
      /^\/handling-fee\/discounts\/(new|\d+\/edit)$/u,
      /^\/search$/u,
    ].some((pattern) => pattern.test(this.props.router.location.pathname));
  }

  private fetchHoldingStockInfo = async (
    warehouseFromStore?: StockWarehouse,
  ): Promise<void> => {
    const warehouse = warehouseFromStore ?? this.props.stockWarehouse;
    const hodlingSids = Object.entries(warehouse)
      .filter(([, warehouse]) => warehouse.length > 0)
      .map(([sid]) => sid);
    await this.props.dispatch(fetchStockInfo(hodlingSids)).unwrap();
    this.setState({ isLoading: false });
  };

  private get marketRefreshIntervalMs(): number {
    return this.props.subscription.market_refresh_interval_seconds * 1000;
  }
}

export default connect(mapStateToProps)(withRouter(Main));
