import React, { MouseEventHandler } from "react";
import { connect } from "react-redux";

import {
  CheckDeleteModal,
  DeletePreview,
  DollarSign,
  InfiniteScrollSentinel,
  ListRow,
  ScrollAwareFloatingControls,
  SearchKeywordInput,
  SpeedDial,
  TradePlanModal,
} from "../../../components";
import { updateHeaderTitle } from "../../../redux/slices/MainPageSlice";
import { deletePlan } from "../../../redux/slices/TradePlanSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import type { TradePlan } from "../../../types";
import Util from "../../../utils/util";
import styles from "./Plans.module.scss";

function mapStateToProps(rootState: RootState) {
  const { tradePlans, isWaiting: isWaitingTradePlan } = rootState.tradePlan;
  const { sidStockInfoMap } = rootState.stockInfo;
  return { tradePlans, sidStockInfoMap, isWaitingTradePlan };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  searchKeyword: string | null;
  numberToShow: number;
}

class Plans extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
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
        {this.filteredAndSortedPlans.length === 0 ? (
          <div className={styles.empty_section}>目前沒有買賣計畫</div>
        ) : (
          <div className={styles.record_list}>
            {this.filteredAndSortedPlans
              .slice(0, this.state.numberToShow)
              .map((plan: TradePlan, idx) => {
                return (
                  <ListRow
                    key={idx}
                    target={plan}
                    editModal={this.renderEditModal(plan)}
                    deleteModal={this.renderDeleteModal(plan)}
                  >
                    <div className={styles.plan_row}>
                      <span className={styles.identity}>
                        <span className={styles.company}>
                          <span className={styles.sid}>{plan.sid}</span>
                          <span className={styles.company_name}>
                            {plan.company_name}
                          </span>
                        </span>
                        <span className={styles.plan_hint}>買賣計畫</span>
                      </span>
                      <span className={styles.plan_metrics}>
                        <span
                          className={`${styles.plan_type} ${
                            plan.plan_type === "buy" ? styles.buy : styles.sell
                          }`}
                        >
                          {plan.plan_type === "buy" ? "買入" : "賣出"}
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
              hasMore={this.hasMoreToShow}
              onLoadMore={this.handleLoadMore}
            />
          </div>
        )}
        {Util.isMobile && <SpeedDial />}
      </div>
    );
  }

  private get filteredAndSortedPlans(): TradePlan[] {
    return this.props.tradePlans
      .filter((plan) => {
        if (
          this.state.searchKeyword &&
          ["買", "賣"].includes(this.state.searchKeyword)
        ) {
          return (
            plan.plan_type === (this.state.searchKeyword === "買" ? "buy" : "sell")
          );
        } else if (this.state.searchKeyword) {
          return (
            plan.sid.includes(this.state.searchKeyword) ||
            plan.company_name.includes(this.state.searchKeyword)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let pa = a.target_price;
        let pb = b.target_price;
        if (a.sid in this.props.sidStockInfoMap) {
          pa = this.props.sidStockInfoMap[a.sid].close;
        }
        if (b.sid in this.props.sidStockInfoMap) {
          pb = this.props.sidStockInfoMap[b.sid].close;
        }
        return Math.abs(a.target_price - pa) / pa - Math.abs(b.target_price - pb) / pb;
      });
  }

  private handleLoadMore = (): void => {
    this.setState((state) => {
      return { numberToShow: state.numberToShow * 2 };
    });
  };

  private get hasMoreToShow(): boolean {
    return this.filteredAndSortedPlans.length > this.state.numberToShow;
  }

  private renderEditModal = (
    plan: TradePlan,
  ): ((_hideModal: MouseEventHandler) => React.ReactNode) => {
    const EditModalComponent = (hideModal: MouseEventHandler) => {
      return <TradePlanModal plan={plan} hideModal={hideModal} />;
    };
    EditModalComponent.displayName = "EditModalComponent";
    return EditModalComponent;
  };

  private renderDeleteModal = (
    plan: TradePlan,
  ): ((_hideModal: MouseEventHandler) => React.ReactNode) => {
    const DeleteModalComponent = (hideModal: MouseEventHandler) => {
      return (
        <CheckDeleteModal
          hideModal={hideModal}
          title="刪除買賣計畫？"
          description="刪除後，這個目標價提醒不會再出現在買賣計畫中。"
          submitLabel="刪除買賣計畫"
          isWaiting={this.props.isWaitingTradePlan}
          onDelete={this.getDeleteHandler(plan)}
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
                value: plan.plan_type === "buy" ? "買入" : "賣出",
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

  private getDeleteHandler = (plan: TradePlan): (() => Promise<void>) => {
    return async (): Promise<void> => {
      await this.props.dispatch(deletePlan(plan.id)).unwrap();
    };
  };
}

export default connect(mapStateToProps)(withRouter(Plans));
