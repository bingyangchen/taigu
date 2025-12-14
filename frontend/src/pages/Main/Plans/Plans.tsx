import React, { MouseEventHandler } from "react";
import { connect } from "react-redux";

import {
  Button,
  CheckDeleteModal,
  DollarSign,
  ListRow,
  SearchKeywordInput,
  SpeedDial,
  TradePlanModal,
} from "../../../components";
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
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.floating_pill}>
          <SearchKeywordInput
            placeholder="輸入證券代號或名稱"
            keyword={this.state.searchKeyword ?? ""}
            onChange={(searchKeyword) =>
              this.setState({ searchKeyword: searchKeyword })
            }
          />
        </div>
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
                  <span className={styles.company}>
                    {`${plan.sid} ${plan.company_name}`}
                  </span>
                  <span className={styles.price}>
                    <DollarSign />
                    {plan.target_price.toLocaleString()}
                  </span>
                  <span className={styles.quantity_outer}>
                    <span
                      className={`${styles.trade_type} ${
                        plan.plan_type === "buy" ? styles.buy : styles.sell
                      }`}
                    >
                      {plan.plan_type === "buy" ? "買" : "賣"}
                    </span>
                    <span className={styles.quantity}>{plan.target_quantity} 股</span>
                  </span>
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
  private handleClickShowMore = (): void => {
    this.setState((state) => {
      return { numberToShow: state.numberToShow * 2 };
    });
  };
  private get hasMoreToShow(): boolean {
    return this.filteredAndSortedPlans.length > this.state.numberToShow;
  }

  private renderEditModal = (
    plan: TradePlan,
  ): ((hideModal: MouseEventHandler) => React.ReactNode) => {
    const EditModalComponent = (hideModal: MouseEventHandler) => {
      return <TradePlanModal plan={plan} hideModal={hideModal} />;
    };
    EditModalComponent.displayName = "EditModalComponent";
    return EditModalComponent;
  };

  private renderDeleteModal = (
    plan: TradePlan,
  ): ((hideModal: MouseEventHandler) => React.ReactNode) => {
    const DeleteModalComponent = (hideModal: MouseEventHandler) => {
      return (
        <CheckDeleteModal
          hideModal={hideModal}
          isWaiting={this.props.isWaitingTradePlan}
          onDelete={this.getDeleteHandler(plan)}
        >
          <div className={styles.modal_inner}>
            <span className={styles.company}>{`${plan.sid} ${plan.company_name}`}</span>
            <span className={styles.price}>
              <DollarSign />
              {plan.target_price.toLocaleString()}
            </span>
            <span
              className={`${styles.trade_type} ${
                plan.plan_type === "buy" ? styles.buy : styles.sell
              }`}
            >
              {plan.plan_type === "buy" ? "買" : "賣"}
            </span>
            <span className={styles.quantity}>{plan.target_quantity} 股</span>
          </div>
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
