import React from "react";
import { connect } from "react-redux";
import { Outlet } from "react-router-dom";

import imgPersonFill from "../../assets/person-fill.svg";
import {
  Footer,
  HeaderForMain,
  LoadingScreen,
  MainSideBar,
  ToastList,
} from "../../components";
import {
  IconChartHistogram,
  IconChartHistogramBold,
  IconClockHistory,
  IconClockHistoryBold,
  IconHome,
  IconHomeBold,
  IconThumbtack,
  IconThumbtackBold,
} from "../../icons";
import {
  fetchAccountInfo,
  refreshAccountInfoWithNonCacheResponse,
} from "../../redux/slices/AccountSlice";
import {
  fetchAllCashDividendRecords,
  refreshCashDividendRecordsWithNonCacheResponse,
} from "../../redux/slices/CashDividendRecordSlice";
import {
  fetchAllDiscounts,
  refreshDiscountsWithNonCacheResponse,
} from "../../redux/slices/HandlingFeeDiscountSlice";
import { updateScrollTop } from "../../redux/slices/MainPageSlice";
import {
  fetchAllFavorites,
  refreshAllCompanyInfoWithNonCacheResponse,
  refreshFavoritesWithNonCacheResponse,
} from "../../redux/slices/MemoSlice";
import {
  fetchRealtimeMarketIndex,
  fetchStockInfo,
  refreshMarketIndexWithNonCacheResponse,
} from "../../redux/slices/StockInfoSlice";
import {
  fetchAllTradePlans,
  refreshTradePlansWithNonCacheResponse,
} from "../../redux/slices/TradePlanSlice";
import {
  calculateTotalHandlingFee,
  fetchAllTradeRecords,
  refreshWithNonCacheResponse as refreshTradeRecordsWithNonCacheResponse,
} from "../../redux/slices/TradeRecordSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import type { Subpage } from "../../types";
import Env from "../../utils/env";
import Nav from "../../utils/nav";
import Util from "../../utils/util";
import styles from "./Main.module.scss";

function mapStateToProps(rootState: RootState) {
  const { username, avatar_url } = rootState.account;
  const { stockWarehouse } = rootState.tradeRecord;
  return { username, avatar_url, stockWarehouse };
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
  private channel: BroadcastChannel;
  private mainRef: React.RefObject<HTMLDivElement>;
  private subpages: Subpage[];
  private fetchStockInfoTimer: ReturnType<typeof setTimeout> | null;
  public constructor(props: Props) {
    super(props);
    this.state = { isLoading: true, prevLocationPathname: null };
    this.channel = new BroadcastChannel(Env.broadcastChannelName);
    this.channel.addEventListener("message", this.handleNonCacheResponse);
    this.mainRef = React.createRef();
    this.subpages = [];
    this.fetchStockInfoTimer = null;
  }
  public async componentDidMount(): Promise<void> {
    oncontextmenu = (e) => e.preventDefault();
    this.mainRef.current?.addEventListener("scroll", this.handleScroll);

    try {
      await Promise.all([
        this.props.dispatch(fetchAccountInfo()).unwrap(),
        this.props.dispatch(fetchAllTradeRecords()).unwrap(),
        this.props.dispatch(fetchAllCashDividendRecords()).unwrap(),
        this.props.dispatch(fetchAllFavorites()).unwrap(),
        this.props.dispatch(fetchAllTradePlans()).unwrap(),
        this.props.dispatch(fetchRealtimeMarketIndex()).unwrap(),
        this.props.dispatch(fetchAllDiscounts()).unwrap(),
      ]);
      await Promise.all([
        this.props.dispatch(calculateTotalHandlingFee()).unwrap(),
        this.fetchHoldingStockInfo(),
      ]);
    } catch (e) {}

    this.subpages = [
      {
        icon: <IconHome sideLength="100%" />,
        icon_bold: <IconHomeBold sideLength="100%" />,
        name: "儀表板",
        path: Env.frontendRootPath,
      },
      {
        icon: <IconChartHistogram sideLength="100%" />,
        icon_bold: <IconChartHistogramBold sideLength="100%" />,
        name: "市場",
        path: `${Env.frontendRootPath}market`,
      },
      {
        icon: <IconClockHistory sideLength="100%" />,
        icon_bold: <IconClockHistoryBold sideLength="100%" />,
        name: "歷史紀錄",
        path: `${Env.frontendRootPath}records`,
      },
      {
        icon: <IconThumbtack sideLength="100%" />,
        icon_bold: <IconThumbtackBold sideLength="100%" />,
        name: "買賣計畫",
        path: `${Env.frontendRootPath}plans`,
      },
      {
        icon: (
          <img
            src={this.props.avatar_url || imgPersonFill}
            alt=""
            className={styles.user_avatar}
          />
        ),
        name: "設定",
        path: `${Env.frontendRootPath}settings`,
      },
    ];

    this.fetchStockInfoTimer = setInterval(() => {
      this.fetchHoldingStockInfo();
      this.props.dispatch(fetchRealtimeMarketIndex());
    }, 15000);
  }
  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.router.location.pathname !== this.props.router.location.pathname) {
      this.mainRef.current!.scrollTo(0, 0);
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
    if (this.fetchStockInfoTimer) {
      clearInterval(this.fetchStockInfoTimer);
      this.fetchStockInfoTimer = null;
    }
    this.channel.close();
  }
  public render(): React.ReactNode {
    return (
      <main className={styles.main} ref={this.mainRef}>
        <ToastList />
        {this.state.isLoading && <LoadingScreen />}
        {Util.isMobile && <HeaderForMain />}
        <div className={styles.body}>
          {!Util.isMobile && (
            <MainSideBar
              avatarUrl={this.props.avatar_url || imgPersonFill}
              username={this.props.username}
              subpages={Util.isMobile ? this.subpages : this.subpages.slice(0, 4)}
            />
          )}
          <Outlet />
        </div>
        {Util.isMobile && <Footer subpages={this.subpages} />}
      </main>
    );
  }
  private handleScroll = (): void => {
    this.props.dispatch(updateScrollTop(this.mainRef.current!.scrollTop));
  };
  private handleNonCacheResponse = async (
    e: MessageEvent<{ authorized: boolean; url: string; data: any }>,
  ): Promise<void> => {
    if (e.data.authorized) {
      if (/account\/me[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshAccountInfoWithNonCacheResponse(e.data.data));
      } else if (/stock\/trade-records[/]?$/gs.test(e.data.url)) {
        await this.props
          .dispatch(refreshTradeRecordsWithNonCacheResponse(e.data.data.data))
          .unwrap();
        this.fetchHoldingStockInfo();
      } else if (/stock\/cash-dividends[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(
          refreshCashDividendRecordsWithNonCacheResponse(e.data.data.data),
        );
      } else if (/stock\/market-index[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshMarketIndexWithNonCacheResponse(e.data.data));
      } else if (/memo\/trade-plans[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshTradePlansWithNonCacheResponse(e.data.data.data));
      } else if (/memo\/company-info[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshAllCompanyInfoWithNonCacheResponse(e.data.data));
      } else if (/memo\/favorites[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshFavoritesWithNonCacheResponse(e.data.data.data));
      } else if (/handling-fee\/discount[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshDiscountsWithNonCacheResponse(e.data.data.data));
      }
    } else {
      Nav.goToWelcomePage(
        this.props.router.location.pathname + this.props.router.location.search,
      );
    }
  };
  private fetchHoldingStockInfo = async (): Promise<void> => {
    const hodlingSids = Object.entries(this.props.stockWarehouse)
      .filter(([sid, warehouse]) => warehouse.length > 0)
      .map(([sid, warehouse]) => sid);
    await this.props.dispatch(fetchStockInfo(hodlingSids)).unwrap();
    this.setState({ isLoading: false });
  };
}

export default connect(mapStateToProps)(withRouter(Main));
