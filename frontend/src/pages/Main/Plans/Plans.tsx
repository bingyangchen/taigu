import React, { memo, MouseEventHandler, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  CheckDeleteModal,
  DeletePreview,
  DollarSign,
  InfiniteScrollSentinel,
  ListRow,
  ScrollAwareFloatingControls,
  SearchKeywordInput,
  SpeedDial,
  TradePlanEditor,
} from "../../../components";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateHeaderTitle } from "../../../redux/slices/MainPageSlice";
import { deletePlan } from "../../../redux/slices/TradePlanSlice";
import type { TradePlan } from "../../../types";
import Env from "../../../utils/env";
import { tradeSideToLabel } from "../../../utils/recordEditor";
import Util from "../../../utils/util";
import { useListViewSaving, useSavedListView } from "../useListViewHistory";
import styles from "./Plans.module.scss";

function Plans() {
  const tradePlans = useAppSelector((state) => state.tradePlan.tradePlans);
  const isWaitingTradePlan = useAppSelector((state) => state.tradePlan.isWaiting);
  const sidStockInfoMap = useAppSelector((state) => state.stockInfo.sidStockInfoMap);
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

  const filteredAndSortedPlans = tradePlans
    .filter((plan) => {
      if (searchKeyword && ["買", "賣"].includes(searchKeyword)) {
        return plan.plan_type === (searchKeyword === "買" ? "buy" : "sell");
      } else if (searchKeyword) {
        return (
          plan.sid.includes(searchKeyword) || plan.company_name.includes(searchKeyword)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let pa = a.target_price;
      let pb = b.target_price;
      if (a.sid in sidStockInfoMap) {
        pa = sidStockInfoMap[a.sid].close;
      }
      if (b.sid in sidStockInfoMap) {
        pb = sidStockInfoMap[b.sid].close;
      }
      return Math.abs(a.target_price - pa) / pa - Math.abs(b.target_price - pb) / pb;
    });

  const makeEditModal = (
    plan: TradePlan,
  ): ((_hideModal: MouseEventHandler) => React.ReactNode) => {
    const EditModalComponent = (hideModal: MouseEventHandler) => {
      return <TradePlanEditor plan={plan} hideModal={hideModal} />;
    };
    EditModalComponent.displayName = "EditModalComponent";
    return EditModalComponent;
  };

  const makeDeleteModal = (
    plan: TradePlan,
  ): ((_hideModal: MouseEventHandler) => React.ReactNode) => {
    const DeleteModalComponent = (hideModal: MouseEventHandler) => {
      return (
        <CheckDeleteModal
          hideModal={hideModal}
          title="刪除買賣計畫？"
          description="刪除後，這個目標價提醒不會再出現在買賣計畫中。"
          submitLabel="刪除買賣計畫"
          isWaiting={isWaitingTradePlan}
          onDelete={async () => {
            await dispatch(deletePlan(plan.id)).unwrap();
          }}
        >
          <DeletePreview
            title={`${plan.sid} ${plan.company_name}`}
            details={[
              {
                label: "目標價",
                value: (
                  <>
                    <DollarSign />
                    {plan.target_price.toLocaleString()}
                  </>
                ),
              },
              {
                label: "類型",
                value: tradeSideToLabel[plan.plan_type],
                tone: plan.plan_type === "buy" ? "buy" : "sell",
              },
              { label: "股數", value: `${plan.target_quantity.toLocaleString()} 股` },
            ]}
          />
        </CheckDeleteModal>
      );
    };
    DeleteModalComponent.displayName = "DeleteModalComponent";
    return DeleteModalComponent;
  };

  return (
    <div className={styles.main}>
      <ScrollAwareFloatingControls>
        <SearchKeywordInput
          placeholder="輸入證券代號或名稱"
          keyword={searchKeyword ?? ""}
          onChange={setSearchKeyword}
        />
      </ScrollAwareFloatingControls>
      {filteredAndSortedPlans.length === 0 ? (
        <div className={styles.empty_section}>目前沒有買賣計畫</div>
      ) : (
        <div className={styles.record_list} data-page-scroll>
          {filteredAndSortedPlans.slice(0, numberToShow).map((plan: TradePlan) => {
            return (
              <ListRow
                key={plan.id}
                target={plan}
                editModal={makeEditModal(plan)}
                deleteModal={makeDeleteModal(plan)}
                editPath={`${Env.frontendRootPath}plans/${plan.id}/edit`}
              >
                <div className={styles.plan_row}>
                  <span className={styles.identity}>
                    <span className={styles.company}>
                      <span className={styles.sid}>{plan.sid}</span>
                      <span className={styles.company_name}>{plan.company_name}</span>
                    </span>
                    <span className={styles.plan_hint}>買賣計畫</span>
                  </span>
                  <span className={styles.plan_metrics}>
                    <span
                      className={`${styles.plan_type} ${
                        plan.plan_type === "buy" ? styles.buy : styles.sell
                      }`}
                    >
                      {tradeSideToLabel[plan.plan_type]}
                    </span>
                    <span className={styles.quantity}>
                      {plan.target_quantity.toLocaleString()} 股
                    </span>
                    <span className={styles.price_group}>
                      <span className={styles.price_label}>目標價</span>
                      <span className={styles.price}>
                        <DollarSign />
                        {plan.target_price.toLocaleString()}
                      </span>
                    </span>
                  </span>
                </div>
              </ListRow>
            );
          })}
          <InfiniteScrollSentinel
            hasMore={filteredAndSortedPlans.length > numberToShow}
            onLoadMore={() => setNumberToShow((count) => count * 2)}
          />
        </div>
      )}
      {Util.isMobile && <SpeedDial />}
    </div>
  );
}

export default memo(Plans);
