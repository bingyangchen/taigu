import React from "react";
import { connect } from "react-redux";

import { Button, ListRow, SearchKeywordInput, SpeedDial } from "../../../components";
import type { RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import type { CashDividendRecord, TradeRecord } from "../../../types";
import styles from "./Records.module.scss";

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
        <SpeedDial />
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
}

export default connect(mapStateToProps)(withRouter(Records));
