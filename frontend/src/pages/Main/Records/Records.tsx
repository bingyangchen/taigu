import React, { MouseEventHandler } from "react";
import { connect } from "react-redux";

import {
  Button,
  CashDividendRecordModal,
  CheckDeleteModal,
  DollarSign,
  ListRow,
  SearchKeywordInput,
  SpeedDial,
  TradeRecordModal,
} from "../../../components";
import { deleteRecord as deleteCashDividendRecord } from "../../../redux/slices/CashDividendRecordSlice";
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
  sliderPosition: number;
}

class Records extends React.Component<Props, State> {
  private tradeButtonRef = React.createRef<HTMLButtonElement>();
  private cashDividendButtonRef = React.createRef<HTMLButtonElement>();
  private containerRef = React.createRef<HTMLDivElement>();

  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      activeSubpageName: "trade",
      searchKeyword: this.props.router.search_params.get("sid"),
      numberToShow: 15,
      sliderPosition: 0,
    };
  }
  public componentDidMount(): void {
    requestAnimationFrame(() => this.updateSliderPosition());
    window.addEventListener("resize", this.updateSliderPosition);
  }
  public componentWillUnmount(): void {
    window.removeEventListener("resize", this.updateSliderPosition);
  }
  public componentDidUpdate(prevProps: Props, prevState: State): void {
    if (prevState.activeSubpageName !== this.state.activeSubpageName) {
      this.updateSliderPosition();
    }
  }
  private updateSliderPosition = (): void => {
    const activeButton =
      this.state.activeSubpageName === "trade"
        ? this.tradeButtonRef.current
        : this.cashDividendButtonRef.current;
    const container = this.containerRef.current;

    if (activeButton && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const position = buttonRect.left - containerRect.left;
      this.setState({ sliderPosition: position });
    }
  };
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.floating_pill_wrapper}>
          <div className={styles.floating_pill}>
            <div ref={this.containerRef} className={styles.switch_button_container}>
              <div
                className={styles.active_indicator}
                style={{ transform: `translateX(${this.state.sliderPosition}px)` }}
              />
              <button
                ref={this.tradeButtonRef}
                className={`${styles.tab_button} ${this.state.activeSubpageName === "trade" ? styles.active : ""}`}
                onClick={() => this.handleClickSwitchButton("trade")}
              >
                交易紀錄
              </button>
              <button
                ref={this.cashDividendButtonRef}
                className={`${styles.tab_button} ${this.state.activeSubpageName === "cashDividend" ? styles.active : ""}`}
                onClick={() => this.handleClickSwitchButton("cashDividend")}
              >
                現金股利
              </button>
            </div>
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
                    <span className={styles.company}>
                      {`${record.sid} ${record.company_name}`}
                    </span>
                    <span className={styles.price}>
                      <DollarSign />
                      {Util.isTradeRecord(record)
                        ? record.deal_price.toLocaleString()
                        : record.cash_dividend.toLocaleString()}
                    </span>
                    {Util.isTradeRecord(record) && (
                      <span className={styles.quantity_outer}>
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
                      </span>
                    )}
                    <span className={styles.date}>{record.deal_time}</span>
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
