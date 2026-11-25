import React, { MouseEventHandler } from "react";
import { connect } from "react-redux";

import {
  CashDividendRecordEditor,
  CheckDeleteModal,
  DeletePreview,
  DollarSign,
  InfiniteScrollSentinel,
  ListRow,
  ScrollAwareFloatingControls,
  SearchKeywordInput,
  SpeedDial,
  TradeRecordEditor,
} from "../../../components";
import { deleteRecord as deleteCashDividendRecord } from "../../../redux/slices/CashDividendRecordSlice";
import { updateHeaderTitle } from "../../../redux/slices/MainPageSlice";
import { deleteRecord as deleteTradeRecord } from "../../../redux/slices/TradeRecordSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import type { CashDividendRecord, TradeRecord } from "../../../types";
import Env from "../../../utils/env";
import { getTradeSide, tradeSideToLabel } from "../../../utils/recordEditor";
import Util from "../../../utils/util";
import { getViewHistory } from "../viewHistory";
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
  searchKeyword: string | null;
  numberToShow: number;
}

class Records extends React.Component<Props, State> {
  public state: State;
  private readonly viewHistory = getViewHistory();
  public constructor(props: Props) {
    super(props);
    const list = this.viewHistory.get(
      props.router.location,
      props.router.navigationType,
    )?.list;
    this.state = {
      searchKeyword:
        list?.searchKeyword === undefined
          ? props.router.search_params.get("sid")
          : list.searchKeyword,
      numberToShow: list?.numberToShow ?? 15,
    };
  }

  public componentDidMount(): void {
    this.props.dispatch(updateHeaderTitle(null));
  }

  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
  ): void {
    if (prevProps.router.location.key !== this.props.router.location.key) {
      this.viewHistory.save(prevProps.router.location, { list: prevState });
    }
  }

  public componentWillUnmount(): void {
    this.viewHistory.save(this.props.router.location, { list: this.state });
    this.props.dispatch(updateHeaderTitle(null));
  }

  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <ScrollAwareFloatingControls
          activeClassName={styles.active}
          className={styles.floating_pill}
          hiddenClassName={styles.hidden}
          noTransitionClassName={styles.no_transition}
        >
          <SearchKeywordInput
            placeholder="輸入證券代號或名稱"
            keyword={this.state.searchKeyword ?? ""}
            onChange={(searchKeyword) =>
              this.setState({ searchKeyword: searchKeyword })
            }
          />
        </ScrollAwareFloatingControls>
        {this.filteredRecords.length === 0 ? (
          <div className={styles.empty_section}>目前沒有紀錄</div>
        ) : (
          <div className={styles.record_list} data-page-scroll>
            {this.filteredRecords
              .slice(0, this.state.numberToShow)
              .map((record: TradeRecord | CashDividendRecord) => {
                return (
                  <ListRow
                    key={`${
                      Util.isTradeRecord(record) ? "trade" : "cash-dividend"
                    }-${record.id}`}
                    target={record}
                    editModal={this.renderEditModal(record)}
                    deleteModal={this.renderDeleteModal(record)}
                    editPath={this.getEditPath(record)}
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
                              ? styles[getTradeSide(record)]
                              : styles.dividend
                          }`}
                        >
                          {this.getRecordTypeLabel(record)}
                        </span>
                        {Util.isTradeRecord(record) && (
                          <span className={styles.quantity}>
                            {Math.abs(record.deal_quantity).toLocaleString()} 股
                          </span>
                        )}
                        <span className={styles.price_group}>
                          <span className={styles.price_label}>
                            {Util.isTradeRecord(record) ? "成交價" : "入帳金額"}
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
            <InfiniteScrollSentinel
              hasMore={this.hasMoreToShow}
              onLoadMore={this.handleLoadMore}
            />
          </div>
        )}
        {Util.isMobile && <SpeedDial />}
      </div>
    );
  }

  private get filteredRecords(): (TradeRecord | CashDividendRecord)[] {
    return [...this.props.tradeRecords, ...this.props.cashDividendRecords]
      .sort((a, b) => Date.parse(b.deal_time) - Date.parse(a.deal_time))
      .filter((record) => this.matchesSearchKeyword(record));
  }

  private matchesSearchKeyword(record: TradeRecord | CashDividendRecord): boolean {
    return (
      !this.state.searchKeyword ||
      record.sid.includes(this.state.searchKeyword) ||
      record.company_name.includes(this.state.searchKeyword) ||
      record.deal_time.includes(this.state.searchKeyword) ||
      this.getRecordTypeLabel(record).includes(this.state.searchKeyword)
    );
  }

  private getRecordTypeLabel(record: TradeRecord | CashDividendRecord): string {
    if (!Util.isTradeRecord(record)) return "股利";
    return tradeSideToLabel[getTradeSide(record)];
  }

  private get hasMoreToShow(): boolean {
    return this.filteredRecords.length > this.state.numberToShow;
  }

  private handleLoadMore = (): void => {
    this.setState((state) => {
      return { numberToShow: state.numberToShow * 2 };
    });
  };

  private renderEditModal = (
    record: TradeRecord | CashDividendRecord,
  ): ((_hideModal: MouseEventHandler) => React.ReactNode) => {
    const EditModalComponent = (hideModal: MouseEventHandler) => {
      return Util.isTradeRecord(record) ? (
        <TradeRecordEditor record={record} hideModal={hideModal} />
      ) : (
        <CashDividendRecordEditor record={record} hideModal={hideModal} />
      );
    };
    EditModalComponent.displayName = "EditModalComponent";
    return EditModalComponent;
  };

  private getEditPath(record: TradeRecord | CashDividendRecord): string {
    return Util.isTradeRecord(record)
      ? `${Env.frontendRootPath}records/trade/${record.id}/edit`
      : `${Env.frontendRootPath}records/cash-dividend/${record.id}/edit`;
  }

  private renderDeleteModal = (
    record: TradeRecord | CashDividendRecord,
  ): ((_hideModal: MouseEventHandler) => React.ReactNode) => {
    const DeleteModalComponent = (hideModal: MouseEventHandler) => {
      return (
        <CheckDeleteModal
          hideModal={hideModal}
          title={Util.isTradeRecord(record) ? "刪除交易紀錄？" : "刪除現金股利？"}
          description={
            Util.isTradeRecord(record)
              ? "刪除後，這筆紀錄會從投資績效、持股與手續費統計中移除。"
              : "刪除後，這筆現金股利不會再計入收益分析。"
          }
          submitLabel={Util.isTradeRecord(record) ? "刪除交易紀錄" : "刪除現金股利"}
          isWaiting={
            Util.isTradeRecord(record)
              ? this.props.isWaitingTradeRecord
              : this.props.isWaitingCashDividend
          }
          onDelete={this.getDeleteHandler(record)}
        >
          <DeletePreview
            title={`${record.sid} ${record.company_name}`}
            meta={record.deal_time}
            details={
              Util.isTradeRecord(record)
                ? [
                    {
                      label: "成交價",
                      value: (
                        <>
                          <DollarSign />
                          {record.deal_price.toLocaleString()}
                        </>
                      ),
                    },
                    {
                      label: "類型",
                      value: this.getRecordTypeLabel(record),
                      tone: getTradeSide(record),
                    },
                    {
                      label: "股數",
                      value: `${Math.abs(record.deal_quantity).toLocaleString()} 股`,
                    },
                  ]
                : [
                    {
                      label: "入帳金額",
                      value: (
                        <>
                          <DollarSign />
                          {record.cash_dividend.toLocaleString()}
                        </>
                      ),
                    },
                  ]
            }
          />
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
