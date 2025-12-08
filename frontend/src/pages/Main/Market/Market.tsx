import React from "react";
import { connect } from "react-redux";

import { DetailCard, SpeedDial } from "../../../components";
import { changeMarketPageSubpage } from "../../../redux/slices/MainPageSlice";
import { fetchStockInfo } from "../../../redux/slices/StockInfoSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import Env from "../../../utils/env";
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
  sliderPosition: number;
}

class Market extends React.Component<Props, State> {
  private holdingButtonRef = React.createRef<HTMLButtonElement>();
  private favoritesButtonRef = React.createRef<HTMLButtonElement>();
  private containerRef = React.createRef<HTMLDivElement>();
  private fetchFavoriteStockInfoTimer: ReturnType<typeof setInterval> | null;

  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { numberToShow: 15, sliderPosition: 0 };
    this.fetchFavoriteStockInfoTimer = null;
  }
  public componentDidMount(): void {
    requestAnimationFrame(() => this.updateSliderPosition());
    window.addEventListener("resize", this.updateSliderPosition);
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
    window.removeEventListener("resize", this.updateSliderPosition);
    if (this.fetchFavoriteStockInfoTimer) {
      clearInterval(this.fetchFavoriteStockInfoTimer);
      this.fetchFavoriteStockInfoTimer = null;
    }
  }
  public componentDidUpdate(prevProps: Props): void {
    if (prevProps.activeSubpageName !== this.props.activeSubpageName) {
      this.updateSliderPosition();
    }
  }
  private updateSliderPosition = (): void => {
    const activeButton =
      this.props.activeSubpageName === "holding"
        ? this.holdingButtonRef.current
        : this.favoritesButtonRef.current;
    const container = this.containerRef.current;

    if (activeButton && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const position = buttonRect.left - containerRect.left;
      this.setState({ sliderPosition: position });
    }
  };
  private fetchFavoriteStockInfo = async (): Promise<void> => {
    if (this.props.favorites.length > 0) {
      await this.props.dispatch(fetchStockInfo(this.props.favorites)).unwrap();
    }
  };
  private handleFavoritesClick = async (): Promise<void> => {
    this.props.dispatch(changeMarketPageSubpage("favorites"));
    await this.fetchFavoriteStockInfo();
  };
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.floating_pill_wrapper}>
          <div ref={this.containerRef} className={styles.floating_pill}>
            <div
              className={styles.active_indicator}
              style={{ transform: `translateX(${this.state.sliderPosition}px)` }}
            />
            <button
              ref={this.holdingButtonRef}
              className={`${styles.tab_button} ${this.props.activeSubpageName === "holding" ? styles.active : ""}`}
              onClick={() => this.props.dispatch(changeMarketPageSubpage("holding"))}
            >
              持股
            </button>
            <button
              ref={this.favoritesButtonRef}
              className={`${styles.tab_button} ${this.props.activeSubpageName === "favorites" ? styles.active : ""}`}
              onClick={this.handleFavoritesClick}
            >
              觀察
            </button>
          </div>
        </div>
        <div className={styles.list}>
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
        <SpeedDial />
      </div>
    );
  }
}

export default connect(mapStateToProps)(withRouter(Market));
