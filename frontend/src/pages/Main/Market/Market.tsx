import React from "react";
import { connect } from "react-redux";

import { DetailCard, SegmentedControl, SpeedDial } from "../../../components";
import {
  changeMarketPageSubpage,
  updateHeaderTitle,
} from "../../../redux/slices/MainPageSlice";
import { fetchStockInfo } from "../../../redux/slices/StockInfoSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import Env from "../../../utils/env";
import Util from "../../../utils/util";
import styles from "./Market.module.scss";

function mapStateToProps(rootState: RootState) {
  const { stockWarehouse } = rootState.tradeRecord;
  const { favorites } = rootState.memo;
  const { marketPageSubpageName: activeSubpageName } = rootState.mainPage;
  return { stockWarehouse, favorites, activeSubpageName };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  numberToShow: number;
}

class Market extends React.Component<Props, State> {
  private fetchFavoriteStockInfoTimer: ReturnType<typeof setInterval> | null;

  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { numberToShow: 15 };
    this.fetchFavoriteStockInfoTimer = null;
  }
  public componentDidMount(): void {
    this.props.dispatch(updateHeaderTitle("市場"));
    if (this.props.activeSubpageName === "favorites") {
      this.fetchFavoriteStockInfo();
    }
    this.fetchFavoriteStockInfoTimer = setInterval(() => {
      if (this.props.activeSubpageName === "favorites") {
        this.fetchFavoriteStockInfo();
      }
    }, 15000);
  }

  public componentWillUnmount(): void {
    this.props.dispatch(updateHeaderTitle(null));
    if (this.fetchFavoriteStockInfoTimer) {
      clearInterval(this.fetchFavoriteStockInfoTimer);
      this.fetchFavoriteStockInfoTimer = null;
    }
  }

  private fetchFavoriteStockInfo = async (): Promise<void> => {
    if (this.props.favorites.length > 0) {
      await this.props.dispatch(fetchStockInfo(this.props.favorites)).unwrap();
    }
  };

  private handleFavoritesClick = async (): Promise<void> => {
    this.props.dispatch(changeMarketPageSubpage("favorites"));
    await this.fetchFavoriteStockInfo();
  };

  private handleSubpageChange = (value: string): void => {
    if (value === "favorites") {
      this.handleFavoritesClick().catch(() => {});
      return;
    }
    this.props.dispatch(changeMarketPageSubpage("holding"));
  };

  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.floating_pill_wrapper}>
          <SegmentedControl
            label="市場資料分類"
            optionWidth="50px"
            options={[
              { label: "持股", value: "holding" },
              { label: "最愛", value: "favorites" },
            ]}
            value={this.props.activeSubpageName}
            variant="floating"
            onChange={this.handleSubpageChange}
          />
        </div>
        <div className={styles.list}>
          {this.emptySection}
          {(this.props.activeSubpageName === "holding"
            ? Object.keys(this.props.stockWarehouse)
            : this.props.favorites
          ).map((sid, idx) => {
            return (
              <DetailCard
                key={idx}
                sid={sid}
                includeWarehouseInfo={this.props.activeSubpageName === "holding"}
                onClick={() => {
                  this.props.router.navigate(
                    `${Env.frontendRootPath}market/${this.props.activeSubpageName}/${sid}`,
                  );
                }}
              />
            );
          })}
        </div>
        {Util.isMobile && <SpeedDial />}
      </div>
    );
  }

  private get emptySection(): React.ReactNode {
    if (
      this.props.activeSubpageName === "holding" &&
      Object.keys(this.props.stockWarehouse).length === 0
    ) {
      return (
        <div className={styles.empty_section}>目前沒有任何持股，倉庫裡只剩落葉...</div>
      );
    }
    if (
      this.props.activeSubpageName === "favorites" &&
      this.props.favorites.length === 0
    ) {
      return (
        <div className={styles.empty_section}>
          目前沒有任何最愛，點擊股票資訊頁右上角的愛心按鈕把它加入最愛吧！
        </div>
      );
    }
    return null;
  }
}

export default connect(mapStateToProps)(withRouter(Market));
