import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { DollarSign, Modal, RoundButton, SearchKeywordInput } from "../../components";
import { IconChevronLeft, IconMagnifier } from "../../icons";
import type { AppDispatch, RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import type { StockInfo } from "../../types";
import Api from "../../utils/api";
import Env from "../../utils/env";
import Util from "../../utils/util";
import styles from "./StockSearchModal.module.scss";

class StockSearchLRUCache {
  private readonly CACHE_KEY = "stock_search_lru_cache";
  private readonly MAX_SIZE = 10;

  public add(sid: string): void {
    const cache = this.getAll();
    const filteredCache = cache.filter((cached) => cached !== sid);
    const newCache = [sid, ...filteredCache];
    const trimmedCache = newCache.slice(0, this.MAX_SIZE);
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(trimmedCache));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }

  public getAll(): string[] {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      return [];
    }
  }
}

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.tradePlan;
  return { isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  hideModal: MouseEventHandler;
  fullScreenPage?: boolean;
  dispatch: AppDispatch;
}

interface State {
  searchKeyword: string;
  searchResults: StockInfo[];
  completedSearchKeyword: string | null;
}

class StockSearchModal extends React.Component<Props, State> {
  public state: State;
  private stockSearchCache: StockSearchLRUCache;

  public constructor(props: Props) {
    super(props);
    this.state = { searchKeyword: "", searchResults: [], completedSearchKeyword: null };
    this.stockSearchCache = new StockSearchLRUCache();
  }

  public componentDidMount(): void {
    if (this.props.fullScreenPage) {
      setTimeout(() => {
        this.props.router.navigate("##");
        document.body.style.overscrollBehaviorY = "contain";
      });
    }
    if (this.state.searchKeyword === "") this.loadCachedItems();
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      this.props.fullScreenPage &&
      prevProps.router.location.hash === "##" &&
      this.props.router.location.hash === ""
    ) {
      this.props.hideModal({} as MouseEvent);
    }
  }

  public componentWillUnmount(): void {
    if (!this.props.fullScreenPage) return;
    document.body.style.overscrollBehaviorY = "initial";
    if (this.props.router.location.hash === "##") {
      this.props.router.navigate(-1);
    }
  }

  public render(): React.ReactNode {
    if (this.props.fullScreenPage) {
      return (
        <div className={styles.page}>
          <div className={styles.page_header}>
            <RoundButton
              aria-label="返回"
              className="p-12"
              onClick={this.props.hideModal}
            >
              <IconChevronLeft sideLength="18" />
            </RoundButton>
            <div className={styles.page_search_input_outer}>
              {this.renderSearchInput()}
            </div>
          </div>
          {this.renderFullScreenPageBody()}
        </div>
      );
    }

    return (
      <Modal
        discardButtonProps={{
          children: "",
          className: "transparent xs",
          onClick: this.props.hideModal,
        }}
        layout="fullScreen"
        transparent
        noFooter
        noX
      >
        <div className={styles.modal_inner}>
          <div className={styles.search_input_outer}>{this.renderSearchInput()}</div>
          {this.renderResults()}
        </div>
      </Modal>
    );
  }

  private renderSearchInput(): React.ReactNode {
    return (
      <SearchKeywordInput
        placeholder="輸入證券代號或名稱"
        keyword={this.state.searchKeyword}
        autoFocus
        size="l"
        onChange={(searchKeyword) => {
          this.setState({ searchKeyword: searchKeyword });
          this.debouncedSearch(searchKeyword);
        }}
      />
    );
  }

  private renderResults(): React.ReactNode {
    if (this.state.searchResults.length === 0) return null;

    return (
      <div className={styles.result}>
        {this.state.searchResults.map((stockInfo, idx) => {
          return (
            <div
              className={this.getRowClassName(stockInfo.fluct_price)}
              key={idx}
              onClick={(e) => this.handleClickResult(e, stockInfo.sid)}
            >
              <div className={styles.company}>
                <div className={styles.name}>{stockInfo.name}</div>
                <div className={styles.sid}>{stockInfo.sid}</div>
              </div>
              <div className={styles.price}>
                <div className={styles.price}>
                  <DollarSign />
                  {stockInfo.close}
                </div>
                <div className={styles.price_fluct}>
                  {`${
                    stockInfo.fluct_price > 0
                      ? "▲"
                      : stockInfo.fluct_price < 0
                        ? "▼"
                        : "-"
                  }
                  ${stockInfo.fluct_price !== 0 ? Math.abs(stockInfo.fluct_price) : ""}
                  ${
                    stockInfo.fluct_price !== 0
                      ? "(" +
                        (
                          Math.abs(stockInfo.fluct_price / stockInfo.close) * 100
                        ).toFixed(1) +
                        "%)"
                      : ""
                  }`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  private renderFullScreenPageBody(): React.ReactNode {
    if (this.state.searchResults.length > 0) return this.renderResults();
    return this.renderEmptyState();
  }

  private renderEmptyState(): React.ReactNode {
    const hasCompletedKeyword =
      this.state.completedSearchKeyword !== null &&
      this.state.completedSearchKeyword.trim().length > 0;

    return (
      <div className={styles.empty_state}>
        <div className={styles.empty_state_icon}>
          <IconMagnifier sideLength="24" />
        </div>
        <div className={styles.empty_state_text}>
          <div className={styles.empty_state_title}>
            {hasCompletedKeyword ? "找不到符合的股票" : "搜尋台股"}
          </div>
          <div className={styles.empty_state_description}>
            {hasCompletedKeyword
              ? "請確認證券代號或名稱是否正確，或換個關鍵字再試一次。"
              : "輸入證券代號或名稱，快速前往個股頁查看價格、持股與相關紀錄。"}
          </div>
        </div>
      </div>
    );
  }

  private getRowClassName(fluct_price: number): string {
    return (
      styles.row +
      " " +
      (fluct_price > 0 ? styles.red : fluct_price < 0 ? styles.green : styles.gray)
    );
  }

  private loadCachedItems = async (requestedKeyword = ""): Promise<void> => {
    const cachedSids = this.stockSearchCache.getAll();
    if (cachedSids.length === 0) {
      if (this.state.searchKeyword !== requestedKeyword) return;
      this.setState({ searchResults: [], completedSearchKeyword: requestedKeyword });
      return;
    }
    const stockInfoMap = await Api.sendRequest(
      `market/current-stock-info?sids=${cachedSids.join(",")}`,
      "get",
    );
    if (this.state.searchKeyword !== requestedKeyword) return;

    const stockInfoList: StockInfo[] = [];
    for (const sid of cachedSids) {
      const stockInfo = stockInfoMap[sid];
      if (stockInfo) stockInfoList.push(stockInfo);
    }
    this.setState({
      searchResults: stockInfoList,
      completedSearchKeyword: requestedKeyword,
    });
  };

  private search = async (value: string): Promise<void> => {
    if (this.state.searchKeyword !== value) return;

    if (value.trim() === "") this.loadCachedItems(value);
    else {
      const response = await Api.sendRequest(`market/search?keyword=${value}`, "get");
      if (this.state.searchKeyword !== value) return;
      this.setState({ searchResults: response.data, completedSearchKeyword: value });
    }
  };

  private debouncedSearch = Util.debounce(this.search, 300);

  private handleClickResult = async (e: MouseEvent, sid: string): Promise<void> => {
    this.stockSearchCache.add(sid);
    this.props.hideModal(e);
    setTimeout(() => {
      this.props.router.navigate(`${Env.frontendRootPath}market/${sid}`);
    }, 50);
  };
}

export default connect(mapStateToProps)(withRouter(StockSearchModal));
