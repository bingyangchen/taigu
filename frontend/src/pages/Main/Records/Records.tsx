import React, { memo, MouseEventHandler, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

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
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { deleteRecord as deleteCashDividendRecord } from "../../../redux/slices/CashDividendRecordSlice";
import { updateHeaderTitle } from "../../../redux/slices/MainPageSlice";
import { deleteRecord as deleteTradeRecord } from "../../../redux/slices/TradeRecordSlice";
import type { CashDividendRecord, TradeRecord } from "../../../types";
import Env from "../../../utils/env";
import { getTradeSide, tradeSideToLabel } from "../../../utils/recordEditor";
import Util from "../../../utils/util";
import { useListViewSaving, useSavedListView } from "../useListViewHistory";
import styles from "./Records.module.scss";

function Records() {
  const tradeRecords = useAppSelector((state) => state.tradeRecord.tradeRecords);
  const isWaitingTradeRecord = useAppSelector((state) => state.tradeRecord.isWaiting);
  const cashDividendRecords = useAppSelector(
    (state) => state.cashDividend.cashDividendRecords,
  );
  const isWaitingCashDividend = useAppSelector((state) => state.cashDividend.isWaiting);
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const savedListView = useSavedListView();
  const [searchKeyword, setSearchKeyword] = useState<string | null>(
    savedListView?.searchKeyword === undefined
      ? searchParams.get("sid")
      : savedListView.searchKeyword,
  );
  const [numberToShow, setNumberToShow] = useState(savedListView?.numberToShow ?? 15);
  useListViewSaving({ searchKeyword, numberToShow });

  useLayoutEffect(() => {
    dispatch(updateHeaderTitle(null));
    return () => {
      dispatch(updateHeaderTitle(null));
    };
  }, [dispatch]);

  const getRecordTypeLabel = (record: TradeRecord | CashDividendRecord): string => {
    if (!Util.isTradeRecord(record)) return "股利";
    return tradeSideToLabel[getTradeSide(record)];
  };
  const matchesSearchKeyword = (record: TradeRecord | CashDividendRecord): boolean =>
    !searchKeyword ||
    record.sid.includes(searchKeyword) ||
    record.company_name.includes(searchKeyword) ||
    record.deal_time.includes(searchKeyword) ||
    getRecordTypeLabel(record).includes(searchKeyword);
  const filteredRecords = [...tradeRecords, ...cashDividendRecords]
    .sort((a, b) => Date.parse(b.deal_time) - Date.parse(a.deal_time))
    .filter(matchesSearchKeyword);

  const handleLoadMore = (): void => setNumberToShow((count) => count * 2);

  const makeDeleteHandler =
    (record: TradeRecord | CashDividendRecord): (() => Promise<void>) =>
    async (): Promise<void> => {
      if (Util.isTradeRecord(record)) {
        await dispatch(deleteTradeRecord(record.id)).unwrap();
      } else {
        await dispatch(deleteCashDividendRecord(record.id)).unwrap();
      }
    };

  const makeEditModal = (
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

  const makeDeleteModal = (
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
            Util.isTradeRecord(record) ? isWaitingTradeRecord : isWaitingCashDividend
          }
          onDelete={makeDeleteHandler(record)}
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
                      value: getRecordTypeLabel(record),
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

  return (
    <div className={styles.main}>
      <ScrollAwareFloatingControls className={styles.search_controls}>
        <SearchKeywordInput
          placeholder="輸入證券代號或名稱"
          keyword={searchKeyword ?? ""}
          onChange={setSearchKeyword}
        />
      </ScrollAwareFloatingControls>
      {filteredRecords.length === 0 ? (
        <div className={styles.empty_section}>目前沒有紀錄</div>
      ) : (
        <div className={styles.record_list} data-page-scroll>
          <div className={styles.list_card}>
            {filteredRecords
              .slice(0, numberToShow)
              .map((record: TradeRecord | CashDividendRecord) => {
                return (
                  <ListRow
                    key={`${
                      Util.isTradeRecord(record) ? "trade" : "cash-dividend"
                    }-${record.id}`}
                    target={record}
                    editModal={makeEditModal(record)}
                    deleteModal={makeDeleteModal(record)}
                    editPath={getEditPath(record)}
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
                          {getRecordTypeLabel(record)}
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
              hasMore={filteredRecords.length > numberToShow}
              onLoadMore={handleLoadMore}
            />
          </div>
        </div>
      )}
      {Util.isMobile && <SpeedDial />}
    </div>
  );
}

export default memo(Records);

function getEditPath(record: TradeRecord | CashDividendRecord): string {
  return Util.isTradeRecord(record)
    ? `${Env.frontendRootPath}records/trade/${record.id}/edit`
    : `${Env.frontendRootPath}records/cash-dividend/${record.id}/edit`;
}
