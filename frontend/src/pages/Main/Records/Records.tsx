import React, { MouseEventHandler } from "react";
import { connect } from "react-redux";

import {
  Button,
  CashDividendRecordModal,
  CheckDeleteModal,
  DollarSign,
  ListRow,
  SearchKeywordInput,
  SegmentedControl,
  SpeedDial,
  TradeRecordModal,
} from "../../../components";
import { deleteRecord as deleteCashDividendRecord } from "../../../redux/slices/CashDividendRecordSlice";
import { updateHeaderTitle } from "../../../redux/slices/MainPageSlice";
import { deleteRecord as deleteTradeRecord } from "../../../redux/slices/TradeRecordSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import type { CashDividendRecord, TradeRecord } from "../../../types";
import Util from "../../../utils/util";
import styles from "./Records.module.scss";

function mapStateToProps(rootState: RootState) {
  const { tradeRecords, isWaiting: isWaitingTradeRecord } = rootState.tradeRecord;
  const { cashDividendRecords, isWaiting: isWaitingCashDividend } =
    rootState.cashDividend;
  return {
    tradeRecords,
    cashDividendRecords,
    isWaitingTradeRecord,
    isWaitingCashDividend,
  };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  activeSubpageName: "trade" | "cashDividend";
  searchKeyword: string | null;
  numberToShow: number;
}

class Records extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      activeSubpageName: "trade",
      searchKeyword: this.props.router.search_params.get("sid"),
      numberToShow: 15,
    };
  }

  public componentDidMount(): void {
    this.props.dispatch(updateHeaderTitle(null));
  }

  public componentWillUnmount(): void {
    this.props.dispatch(updateHeaderTitle(null));
  }

  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.floating_pill_wrapper}>
          <div className={styles.floating_controls_row}>
            <div className={styles.segmented_slot}>
              <SegmentedControl
                label="歷史紀錄分類"
                optionWidth="84px"
                options={[
                  { label: "交易紀錄", value: "trade" },
                  { label: "現金股利", value: "cashDividend" },
                ]}
                value={this.state.activeSubpageName}
                variant="floating"
                onChange={(value) =>
                  this.handleClickSwitchButton(value as "trade" | "cashDividend")
                }
              />
            </div>
            <div className={styles.search_pill}>
              <div className={styles.search_input_container}>
                <SearchKeywordInput
                  placeholder="輸入證券代號或名稱"
                  keyword={this.state.searchKeyword ?? ""}
                  onChange={(searchKeyword) =>
                    this.setState({ searchKeyword: searchKeyword })
                  }
                />
              </div>
            </div>
          </div>
        </div>
        {this.filteredRecords.length === 0 ? (
          <div className={styles.empty_section}>
            目前沒有
            {this.state.activeSubpageName === "trade" ? "交易" : "現金股利"}
            紀錄
          </div>
        ) : (
          <div className={styles.record_list}>
            {this.filteredRecords
              .slice(0, this.state.numberToShow)
              .map((record: TradeRecord | CashDividendRecord, idx) => {
                return (
                  <ListRow
                    key={idx}
                    target={record}
                    editModal={this.renderEditModal(record)}
                    deleteModal={this.renderDeleteModal(record)}
                  >
                    <div className={styles.record_row}>
                      <span className={styles.identity}>
                        <span className={styles.company}>
                          <span className={styles.sid}>{record.sid}</span>
                          <span className={styles.company_name}>
                            {record.company_name}
                          </span>
                        </span>
                        <span className={styles.date}>{record.deal_time}</span>
                      </span>
                      <span className={styles.record_metrics}>
                        <span
                          className={`${styles.record_type} ${
                            Util.isTradeRecord(record)
                              ? record.deal_quantity > 0
                                ? styles.buy
                                : styles.sell
                              : styles.dividend
                          }`}
                        >
                          {Util.isTradeRecord(record)
                            ? record.deal_quantity > 0
                              ? "買入"
                              : "賣出"
                            : "股利"}
                        </span>
                        {Util.isTradeRecord(record) && (
                          <span className={styles.quantity}>
                            {Math.abs(record.deal_quantity).toLocaleString()} 股
                          </span>
                        )}
                        <span className={styles.price_group}>
                          <span className={styles.price_label}>
                            {Util.isTradeRecord(record) ? "成交價" : "現金股利"}
                          </span>
                          <span className={styles.price}>
                            <DollarSign />
                            {Util.isTradeRecord(record)
                              ? record.deal_price.toLocaleString()
                              : record.cash_dividend.toLocaleString()}
                          </span>
                        </span>
                      </span>
                    </div>
                  </ListRow>
                );
              })}
            <div className={styles.show_more_button_outer}>
              <Button
                className="transparent"
                onClick={this.handleClickShowMore}
                disabled={!this.hasMoreToShow}
              >
                顯示更多
              </Button>
            </div>
          </div>
        )}
        {Util.isMobile && <SpeedDial />}
      </div>
    );
  }

  private get filteredRecords(): (TradeRecord | CashDividendRecord)[] {
    if (this.state.activeSubpageName === "trade") {
      return this.props.tradeRecords.filter((record) => {
        return (
          !this.state.searchKeyword ||
          record.sid.includes(this.state.searchKeyword) ||
          record.company_name.includes(this.state.searchKeyword) ||
          record.deal_time.includes(this.state.searchKeyword)
        );
      });
    } else {
      return this.props.cashDividendRecords.filter((record) => {
        return (
          !this.state.searchKeyword ||
          record.sid.includes(this.state.searchKeyword) ||
          record.company_name.includes(this.state.searchKeyword) ||
          record.deal_time.includes(this.state.searchKeyword)
        );
      });
    }
  }

  private handleClickSwitchButton = (name: "trade" | "cashDividend"): void => {
    this.setState({ activeSubpageName: name, numberToShow: 15 });
  };

  private get hasMoreToShow(): boolean {
    return this.filteredRecords.length > this.state.numberToShow;
  }

  private handleClickShowMore = (): void => {
    this.setState((state) => {
      return { numberToShow: state.numberToShow * 2 };
    });
  };

  private renderEditModal = (
    record: TradeRecord | CashDividendRecord,
  ): ((hideModal: MouseEventHandler) => React.ReactNode) => {
    const EditModalComponent = (hideModal: MouseEventHandler) => {
      return Util.isTradeRecord(record) ? (
        <TradeRecordModal record={record} hideModal={hideModal} />
      ) : (
        <CashDividendRecordModal record={record} hideModal={hideModal} />
      );
    };
    EditModalComponent.displayName = "EditModalComponent";
    return EditModalComponent;
  };

  private renderDeleteModal = (
    record: TradeRecord | CashDividendRecord,
  ): ((hideModal: MouseEventHandler) => React.ReactNode) => {
    const DeleteModalComponent = (hideModal: MouseEventHandler) => {
      return (
        <CheckDeleteModal
          hideModal={hideModal}
          isWaiting={
            Util.isTradeRecord(record)
              ? this.props.isWaitingTradeRecord
              : this.props.isWaitingCashDividend
          }
          onDelete={this.getDeleteHandler(record)}
        >
          <div className={styles.modal_inner}>
            <span
              className={styles.company}
            >{`${record.sid} ${record.company_name}`}</span>
            <span className={styles.price}>
              <DollarSign />
              {(Util.isTradeRecord(record)
                ? record.deal_price
                : record.cash_dividend
              ).toLocaleString()}
            </span>
            {Util.isTradeRecord(record) && (
              <>
                <span
                  className={`${styles.trade_type} ${
                    record.deal_quantity > 0 ? styles.buy : styles.sell
                  }`}
                >
                  {record.deal_quantity > 0 ? "買" : "賣"}
                </span>
                <span className={styles.quantity}>
                  {Math.abs(record.deal_quantity)} 股
                </span>
              </>
            )}
            <span className={styles.date}>{record.deal_time}</span>
          </div>
        </CheckDeleteModal>
      );
    };
    DeleteModalComponent.displayName = "DeleteModalComponent";
    return DeleteModalComponent;
  };

  private getDeleteHandler = (
    record: TradeRecord | CashDividendRecord,
  ): (() => Promise<void>) => {
    return async (): Promise<void> => {
      if (Util.isTradeRecord(record)) {
        await this.props.dispatch(deleteTradeRecord(record.id)).unwrap();
      } else {
        await this.props.dispatch(deleteCashDividendRecord(record.id)).unwrap();
      }
    };
  };
}

export default connect(mapStateToProps)(withRouter(Records));
