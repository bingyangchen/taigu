import styles from "./Records.module.scss";

import React from "react";
import { connect } from "react-redux";

import {
  Button,
  ListRow,
  SearchKeywordInput,
  StretchableButton,
} from "../../../components";
import type { RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import type { CashDividendRecord, TradeRecord } from "../../../types";

function mapStateToProps(rootState: RootState) {
  const { tradeRecords } = rootState.tradeRecord;
  const { cashDividendRecords } = rootState.cashDividend;
  return { tradeRecords, cashDividendRecords };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {}

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
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.switch_button_container}>
          <Button
            className={this.getSwitchButtonClass("trade")}
            onClick={() => this.handleClickSwitchButton("trade")}
          >
            交易紀錄
          </Button>
          <Button
            className={this.getSwitchButtonClass("cashDividend")}
            onClick={() => this.handleClickSwitchButton("cashDividend")}
          >
            現金股利
          </Button>
        </div>
        <div className={styles.search_input_container}>
          <SearchKeywordInput
            placeholder="輸入證券代號或名稱"
            keyword={this.state.searchKeyword || ""}
            onChange={(searchKeyword) =>
              this.setState({ searchKeyword: searchKeyword })
            }
          />
        </div>
        <div className={styles.record_list}>
          {this.filteredRecords
            .slice(0, this.state.numberToShow)
            .map((record: TradeRecord | CashDividendRecord, idx) => {
              return <ListRow key={idx} target={record} />;
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
        <StretchableButton />
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
  private getSwitchButtonClass(name: "trade" | "cashDividend"): string {
    return this.state.activeSubpageName === name ? "white xs" : "transparent xs";
  }
  private handleClickSwitchButton = (name: "trade" | "cashDividend"): void => {
    this.setState({ activeSubpageName: name, numberToShow: 15 });
  };
  private get hasMoreToShow(): boolean {
    return this.filteredRecords.length > this.state.numberToShow;
  }
  private handleClickShowMore = (): void => {
    this.setState((state, props) => {
      return { numberToShow: state.numberToShow * 2 };
    });
  };
}

export default connect(mapStateToProps)(withRouter(Records));
