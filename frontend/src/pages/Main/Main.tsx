import imgPersonFill from "../../assets/person-fill.svg";
import styles from "./Main.module.scss";

import React from "react";
import { connect } from "react-redux";
import { Outlet } from "react-router-dom";

import {
  Footer,
  HeaderForMain,
  LoadingScreen,
  NavBarForMain,
  ToastList,
} from "../../components";
import {
  IconClockHistory,
  IconHome,
  IconLightbulb,
  IconMarket,
} from "../../icons";
import {
  fetchAccountInfo,
  refreshAccountInfoWithNonCacheResponse,
} from "../../redux/slices/AccountSlice";
import {
  fetchAllCashDividendRecords,
  refreshCashDividendRecordsWithNonCacheResponse,
} from "../../redux/slices/CashDividendRecordSlice";
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
  fetchAllTradeRecords,
  refreshWithNonCacheResponse as refreshTradeRecordsWithNonCacheResponse,
} from "../../redux/slices/TradeRecordSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import type { Subpage } from "../../types";
import Env from "../../utils/env";
import Nav from "../../utils/nav";
import Util from "../../utils/util";

function mapStateToProps(rootState: RootState) {
  const { username, avatar_url } = rootState.account;
  const { stockWarehouse } = rootState.tradeRecord;
  const { favorites } = rootState.memo;
  return { username, avatar_url, stockWarehouse, favorites };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  isLoading: boolean;
  isFunctionBarActive: boolean;
  prevLocationPathname: string | null;
}

class Main extends React.Component<Props, State> {
  public state: State;
  private channel: BroadcastChannel;
  private mainRef: React.RefObject<HTMLDivElement>;
  private subpages: Subpage[];
  private fetchAllStockInfoTimer: NodeJS.Timer | null;
  public constructor(props: Props) {
    super(props);
    this.state = {
      isLoading: true,
      isFunctionBarActive: false,
      prevLocationPathname: null,
    };
    this.channel = new BroadcastChannel(Env.broadcastChannelName);
    this.channel.addEventListener("message", this.handleNonCacheResponse);
    this.mainRef = React.createRef();
    this.subpages = [
      {
        icon: <IconHome sideLength="100%" />,
        name: "總覽",
        path: Env.frontendRootPath,
      },
      {
        icon: <IconMarket sideLength="100%" />,
        name: "持倉細況",
        path: `${Env.frontendRootPath}stock-list`,
      },
      {
        icon: <IconClockHistory sideLength="95%" />,
        name: "歷史紀錄",
        path: `${Env.frontendRootPath}records`,
      },
      {
        icon: <IconLightbulb sideLength="100%" />,
        name: "買賣計畫",
        path: `${Env.frontendRootPath}plans`,
      },
      // {
      //     icon: <IconAppAdd sideLength="90%" />,
      //     name: "輔助工具",
      //     path: `${Env.frontendRootPath}tools`,
      // },
    ];
    this.fetchAllStockInfoTimer = null;
  }
  public async componentDidMount(): Promise<void> {
    oncontextmenu = (e) => e.preventDefault();
    this.mainRef.current!.addEventListener("scroll", this.handleScroll);
    // if ("Notification" in window) Notification.requestPermission();

    // Fetch data
    try {
      await Promise.all([
        this.props.dispatch(fetchAccountInfo()).unwrap(),
        this.props.dispatch(fetchAllTradeRecords()).unwrap(),
        this.props.dispatch(fetchAllCashDividendRecords()).unwrap(),
        this.props.dispatch(fetchAllFavorites()).unwrap(),
        this.props.dispatch(fetchAllTradePlans()).unwrap(),
        this.props.dispatch(fetchRealtimeMarketIndex()).unwrap(),
      ]);
      await this.fetchNecessaryStockInfo();
    } catch (e) {}

    this.fetchAllStockInfoTimer = setInterval(() => {
      this.fetchNecessaryStockInfo();
      this.props.dispatch(fetchRealtimeMarketIndex());
    }, 15000);
  }
  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot?: any
  ): void {
    if (
      prevProps.router.location.pathname !== this.props.router.location.pathname
    ) {
      this.mainRef.current!.scrollTo(0, 0);
      this.props.dispatch(fetchAccountInfo());
    }

    // Conditionally navigate back one more time
    if (prevProps.router.location.key !== this.props.router.location.key) {
      if (
        prevProps.router.location.pathname ===
          this.props.router.location.pathname &&
        prevProps.router.location.hash === this.props.router.location.hash &&
        prevProps.router.location.search ===
          this.props.router.location.search &&
        prevProps.router.location.state === this.props.router.location.state
      ) {
        this.setState(
          {
            prevLocationPathname: prevProps.router.location.pathname,
          },
          () => this.props.router.navigate(-1)
        );
      } else this.setState({ prevLocationPathname: null });
    }
  }
  public componentWillUnmount(): void {
    this.mainRef.current!.removeEventListener("scroll", this.handleScroll);
    clearInterval(this.fetchAllStockInfoTimer!);
    this.fetchAllStockInfoTimer = null;
    this.channel.close();
  }
  public render(): React.ReactNode {
    return (
      <main className={styles.main} ref={this.mainRef}>
        <ToastList />
        {this.state.isLoading && <LoadingScreen />}
        {Util.isMobile && (
          <HeaderForMain
            avatarUrl={this.props.avatar_url || imgPersonFill}
            handleClickAvatar={this.showMainFunctionBar}
          />
        )}
        <div className={styles.body}>
          <NavBarForMain
            avatarUrl={this.props.avatar_url || imgPersonFill}
            username={this.props.username}
            subpages={this.subpages}
            isActiveInShortScreen={
              Util.isMobile && this.state.isFunctionBarActive
            }
            hide={this.hideMainFunctionBar}
          />
          <Outlet />
        </div>
        {Util.isMobile && <Footer subpages={this.subpages.slice(0, 4)} />}
      </main>
    );
  }
  private showMainFunctionBar = (): void => {
    this.setState({ isFunctionBarActive: true });
  };
  private hideMainFunctionBar = (): void => {
    this.setState({ isFunctionBarActive: false });
  };
  private handleScroll = (): void => {
    this.props.dispatch(updateScrollTop(this.mainRef.current!.scrollTop));
  };
  private handleNonCacheResponse = async (
    e: MessageEvent<{
      authorized: boolean;
      url: string;
      data: any;
    }>
  ): Promise<void> => {
    if (e.data.authorized) {
      const data = e.data.data.data;
      if (/account\/me[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshAccountInfoWithNonCacheResponse(data));
      } else if (/stock\/trade-records[/]?$/gs.test(e.data.url)) {
        await this.props
          .dispatch(refreshTradeRecordsWithNonCacheResponse(data))
          .unwrap();
        this.fetchNecessaryStockInfo();
      } else if (/stock\/cash-dividends[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(
          refreshCashDividendRecordsWithNonCacheResponse(data)
        );
      } else if (/stock\/market-index[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshMarketIndexWithNonCacheResponse(data));
      } else if (/memo\/trade-plans[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshTradePlansWithNonCacheResponse(data));
      } else if (/memo\/company-info[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshAllCompanyInfoWithNonCacheResponse(data));
      } else if (/memo\/favorites[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshFavoritesWithNonCacheResponse(data));
      }
    } else {
      Nav.goToWelcomePage(
        this.props.router.location.pathname + this.props.router.location.search
      );
    }
  };
  private fetchNecessaryStockInfo = async (): Promise<void> => {
    const hodlingSids = Object.entries(this.props.stockWarehouse)
      .filter(([sid, warehouse]) => warehouse.length > 0)
      .map(([sid, warehouse]) => sid);
    const sids = Array.from(new Set([...hodlingSids, ...this.props.favorites]));
    await this.props.dispatch(fetchStockInfo(sids)).unwrap();
    this.setState({ isLoading: false });
  };
}

export default connect(mapStateToProps)(withRouter(Main));
