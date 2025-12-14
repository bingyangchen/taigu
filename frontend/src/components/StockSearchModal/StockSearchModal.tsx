import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { DollarSign, Modal, SearchKeywordInput } from "../../components";
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
  dispatch: AppDispatch;
}

interface State {
  searchKeyword: string;
  searchResults: StockInfo[];
}

class StockSearchModal extends React.Component<Props, State> {
  public state: State;
  private stockSearchCache: StockSearchLRUCache;

  public constructor(props: Props) {
    super(props);
    this.state = { searchKeyword: "", searchResults: [] };
    this.stockSearchCache = new StockSearchLRUCache();
  }

  public componentDidMount(): void {
    if (this.state.searchKeyword === "") this.loadCachedItems();
  }

  public render(): React.ReactNode {
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
          <div className={styles.search_input_outer}>
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
          </div>
          {this.state.searchResults.length > 0 && (
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
                        ${
                          stockInfo.fluct_price !== 0
                            ? Math.abs(stockInfo.fluct_price)
                            : ""
                        }
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
          )}
        </div>
      </Modal>
    );
  }

  private getRowClassName(fluct_price: number): string {
    return (
      styles.row +
      " " +
      (fluct_price > 0 ? styles.red : fluct_price < 0 ? styles.green : styles.gray)
    );
  }

  private loadCachedItems = async (): Promise<void> => {
    const cachedSids = this.stockSearchCache.getAll();
    if (cachedSids.length === 0) {
      this.setState({ searchResults: [] });
      return;
    }
    const stockInfoMap = await Api.sendRequest(
      `stock/current-stock-info?sids=${cachedSids.join(",")}`,
      "get",
    );
    const stockInfoList: StockInfo[] = [];
    for (const sid of cachedSids) {
      const stockInfo = stockInfoMap[sid];
      if (stockInfo) stockInfoList.push(stockInfo);
    }
    this.setState({ searchResults: stockInfoList });
  };

  private search = async (value: string): Promise<void> => {
    if (value === "") this.loadCachedItems();
    else {
      const response = await Api.sendRequest(`stock/search?keyword=${value}`, "get");
      this.setState({ searchResults: response.data });
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
