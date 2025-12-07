import React from "react";
import { connect } from "react-redux";

import {
  Button,
  ListRow,
  SearchKeywordInput,
  StretchableButton,
} from "../../../components";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import type { TradePlan } from "../../../types";
import styles from "./Plans.module.scss";

function mapStateToProps(rootState: RootState) {
  const { tradePlans } = rootState.tradePlan;
  const { sidStockInfoMap } = rootState.stockInfo;
  return { tradePlans, sidStockInfoMap };
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
        <div className={styles.search_input_container}>
          <SearchKeywordInput
            placeholder="輸入證券代號或名稱"
            keyword={this.state.searchKeyword ?? ""}
            onChange={(searchKeyword) =>
              this.setState({ searchKeyword: searchKeyword })
            }
          />
        </div>
        <StretchableButton />
        <div className={styles.record_list}>
          {this.filteredAndSortedPlans
            .slice(0, this.state.numberToShow)
            .map((plan: TradePlan, idx) => {
              return <ListRow key={idx} target={plan} />;
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
}

export default connect(mapStateToProps)(withRouter(Plans));
