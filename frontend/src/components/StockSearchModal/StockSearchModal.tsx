import styles from "./StockSearchModal.module.scss";

import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { DollarSign, Modal, SearchKeywordInput } from "..";
import type { AppDispatch, RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import type { StockInfo, TradePlan } from "../../types";
import Api from "../../utils/api";
import Env from "../../utils/env";
import Util from "../../utils/util";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.tradePlan;
  return { isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  defaultSid?: string;
  plan?: TradePlan;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  dispatch: AppDispatch;
}

interface State {
  searchKeyword: string;
  searchResults: StockInfo[];
}

class StockSearchModal extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { searchKeyword: "", searchResults: [] };
  }
  public componentDidMount(): void {}
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
                                                        Math.abs(
                                                          stockInfo.fluct_price /
                                                            stockInfo.close,
                                                        ) * 100
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
  private search = async (value: string): Promise<void> => {
    const response = await Api.sendRequest(`stock/search?keyword=${value}`, "get");
    this.setState({ searchResults: response.data });
  };
  private debouncedSearch = Util.debounce(this.search, 300);
  private handleClickResult = async (e: MouseEvent, sid: string): Promise<void> => {
    this.props.hideModal(e);
    setTimeout(() => {
      this.props.router.navigate(`${Env.frontendRootPath}market/${sid}`);
    }, 50);
  };
}

export default connect(mapStateToProps)(withRouter(StockSearchModal));
