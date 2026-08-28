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
import Nav from "../../utils/nav";
import Util from "../../utils/util";
import styles from "./Main.module.scss";

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

class Main extends React.Component<Props, State> {
  public state: State;
  private mainRef: React.RefObject<HTMLDivElement>;
  private subpages: Subpage[];
  private fetchStockInfoTimer: ReturnType<typeof setTimeout> | null;
  private scrollAnimationFrameId: number | null = null;
  private lastDispatchedScrollTop: number | null = null;
  public constructor(props: Props) {
    super(props);
    this.state = { isLoading: true, prevLocationPathname: null };
    this.mainRef = React.createRef();
    this.subpages = [];
    this.fetchStockInfoTimer = null;
  }

  public async componentDidMount(): Promise<void> {
    oncontextmenu = (e) => e.preventDefault();
    this.syncMobileScrollMode();
    this.mainRef.current?.addEventListener("scroll", this.handleScroll);
    window.addEventListener("scroll", this.handleScroll);

    try {
      const account = await this.props.dispatch(fetchAccountInfo()).unwrap();

      const independentPromises = Promise.allSettled([
        this.props.dispatch(openSession()).unwrap(),
        this.props.dispatch(fetchAllCashDividendRecords()).unwrap(),
        this.props.dispatch(fetchAllFavorites()).unwrap(),
        this.props.dispatch(fetchAllTradePlans()).unwrap(),
        this.props.dispatch(fetchRealtimeMarketIndex()).unwrap(),
        this.props.dispatch(fetchAllDiscounts()).unwrap(),
      ]);

      const res = await this.props.dispatch(fetchAllTradeRecords(account.id)).unwrap();

      await Promise.allSettled([
        this.fetchHoldingStockInfo(res.stockWarehouse),
        independentPromises,
      ]);
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

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.router.location.pathname !== this.props.router.location.pathname) {
      this.syncMobileScrollMode();
      if (this.shouldUseDocumentScroll) window.scrollTo(0, 0);
      else this.mainRef.current?.scrollTo(0, 0);
      this.lastDispatchedScrollTop = 0;
      this.props.dispatch(updateScrollTop(0));
      this.props.dispatch(fetchAccountInfo());
    }

    // Conditionally navigate back one more time
    if (prevProps.router.location.key !== this.props.router.location.key) {
      if (
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
    this.mainRef.current?.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("scroll", this.handleScroll);
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
          <Outlet />
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

      const scrollTop = this.shouldUseDocumentScroll
        ? window.scrollY
        : this.mainRef.current?.scrollTop;
      if (scrollTop === undefined || scrollTop === this.lastDispatchedScrollTop) return;

      this.lastDispatchedScrollTop = scrollTop;
      this.props.dispatch(updateScrollTop(scrollTop));
    });
  };

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
