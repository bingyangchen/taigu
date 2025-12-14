import ReactECharts from "echarts-for-react";
import React from "react";
import { connect } from "react-redux";

import {
  Button,
  DollarSign,
  HandlingFeeDiscountModal,
  ListRow,
  RoundButton,
  SpeedDial,
} from "../../../components";
import { IconChevronLeft } from "../../../icons";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import type { HandlingFeeDiscount } from "../../../types";
import Util from "../../../utils/util";
import styles from "./HandlingFee.module.scss";

function mapStateToProps(rootState: RootState) {
  const { scrollTop } = rootState.mainPage;
  const { totalHandlingFee, tradeRecords } = rootState.tradeRecord;
  const { discounts } = rootState.handlingFeeDiscount;
  return { mainScrollTop: scrollTop, totalHandlingFee, tradeRecords, discounts };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  animatedTotalHandlingFee: number;
  daysToShow: number;
  showDiscountModal: boolean;
  numberToShow: number;
}

class HandlingFee extends React.Component<Props, State> {
  public state: State;
  private readonly SHOW_FLOATING_INFO_THRESHOLD: number = 120;
  private readonly TIME_SPAN_OPTIONS_IN_DAYS: number[] = [182, 365, 1825, Infinity];

  public constructor(props: Props) {
    super(props);
    this.state = {
      animatedTotalHandlingFee: 0,
      daysToShow: this.TIME_SPAN_OPTIONS_IN_DAYS[0],
      showDiscountModal: false,
      numberToShow: 15,
    };
  }

  public async componentDidMount(): Promise<void> {
    this.animateTotalHandlingFee();
  }

  public async componentDidUpdate(prevProps: Readonly<Props>): Promise<void> {
    if (prevProps.totalHandlingFee !== this.props.totalHandlingFee) {
      this.animateTotalHandlingFee();
    }
  }

  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        {Util.isMobile && <SpeedDial />}
        {Util.isMobile && (
          <div
            className={`${styles.mobile_back_button_container} ${
              this.props.mainScrollTop > this.SHOW_FLOATING_INFO_THRESHOLD
                ? styles.scrolled
                : ""
            }`}
          >
            <RoundButton
              onClick={() => this.props.router.navigate(-1)}
              className="p-12"
              hint_text="回儀表板"
            >
              <IconChevronLeft sideLength="16" />
            </RoundButton>
          </div>
        )}
        <div className={styles.container}>
          {!Util.isMobile && (
            <div className={styles.desktop_back_button_container}>
              <RoundButton
                onClick={() => this.props.router.navigate(-1)}
                className="p-12"
                hint_text="回儀表板"
              >
                <IconChevronLeft sideLength="16" />
              </RoundButton>
            </div>
          )}
          <div className={styles.left_block}>
            <div className={styles.handling_fee_section}>
              <div className={styles.title}>累積手續費</div>
              <div className={styles.total_handling_fee}>
                <DollarSign />
                {Math.round(this.state.animatedTotalHandlingFee).toLocaleString()}
              </div>
            </div>
            <div className={styles.chart_section}>
              <div className={styles.chart_container}>
                <ReactECharts
                  option={this.handlingFeeChartOption}
                  style={{ height: "100%", width: "100%" }}
                />
              </div>
              <div className={styles.controls}>
                <div className={styles.time_span_options}>
                  <div
                    className={styles.time_span_options_inner}
                    style={
                      {
                        "--active-index": this.getActiveOptionIndex(),
                      } as React.CSSProperties
                    }
                  >
                    <div className={styles.sliding_background} />
                    <span
                      className={this.getTimeSpanOptionClass(182)}
                      onClick={() => this.handleClickTimeSpanOption(182)}
                    >
                      6M
                    </span>
                    <span
                      className={this.getTimeSpanOptionClass(365)}
                      onClick={() => this.handleClickTimeSpanOption(365)}
                    >
                      1Y
                    </span>
                    <span
                      className={this.getTimeSpanOptionClass(1825)}
                      onClick={() => this.handleClickTimeSpanOption(1825)}
                    >
                      5Y
                    </span>
                    <span
                      className={this.getTimeSpanOptionClass(Infinity)}
                      onClick={() => this.handleClickTimeSpanOption(Infinity)}
                    >
                      ALL
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.right_block}>
            <div className={styles.section_header}>
              <div className={styles.title}>手續費折讓</div>
              <Button
                className="light"
                onClick={() => this.setState({ showDiscountModal: true })}
              >
                新增折讓紀錄
              </Button>
            </div>
            <div className={styles.record_list}>
              {this.props.discounts
                .slice(0, this.state.numberToShow)
                .map((discount: HandlingFeeDiscount) => (
                  <ListRow key={discount.id} target={discount} />
                ))}
              {this.props.discounts.length > 0 && (
                <div className={styles.show_more_button_outer}>
                  <Button
                    className="transparent"
                    onClick={this.handleClickShowMore}
                    disabled={!this.hasMoreToShow}
                  >
                    顯示更多
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        {this.state.showDiscountModal && (
          <HandlingFeeDiscountModal
            hideModal={(e) => this.setState({ showDiscountModal: false })}
          />
        )}
      </div>
    );
  }

  private animateTotalHandlingFee(): void {
    if (this.state.animatedTotalHandlingFee === this.props.totalHandlingFee) return;
    this.setState(
      (state, props) => {
        return {
          animatedTotalHandlingFee: Math.min(
            state.animatedTotalHandlingFee +
              Math.max(
                1,
                (props.totalHandlingFee - state.animatedTotalHandlingFee) / 2.5,
              ),
            props.totalHandlingFee,
          ),
        };
      },
      () => setTimeout(() => this.animateTotalHandlingFee(), 30),
    );
  }

  private get handlingFeeChartOption(): any {
    const monthlyData = this.getMonthlyHandlingFeeData();
    const months = monthlyData.map((item) => item.month);
    const values = monthlyData.map((item) => item.fee);
    const borderRadius = Math.max(
      3,
      Math.min(Math.floor(2500 / this.state.daysToShow), 10),
    );
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const param = params[0];
          return `${param.name}<br/>${param.seriesName}: $${param.value.toLocaleString()}`;
        },
      },
      grid: { left: "3%", right: "4%", bottom: "3%", top: "10%", containLabel: true },
      xAxis: {
        type: "category",
        data: months,
        axisLabel: { color: "#aaa", fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#aaa",
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toString();
          },
        },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "手續費",
          type: "bar",
          data: values,
          itemStyle: {
            color: "#4c8bf5",
            borderRadius: [borderRadius, borderRadius, 0, 0],
          },
          emphasis: { itemStyle: { color: "#3a6bc4" } },
        },
      ],
      backgroundColor: "transparent",
    };
  }

  private getMonthlyHandlingFeeData(): { month: string; fee: number }[] {
    const now = new Date();
    const cutoffDate = new Date();
    if (this.state.daysToShow !== Infinity) {
      cutoffDate.setDate(now.getDate() - this.state.daysToShow);
      cutoffDate.setDate(1); // Set to first day of the month
    } else {
      cutoffDate.setFullYear(2000, 0, 1);
    }

    const monthlyMap: { [month: string]: number } = {};

    this.props.tradeRecords.forEach((record) => {
      const recordDate = new Date(record.deal_time);
      if (recordDate >= cutoffDate) {
        const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + record.handling_fee;
      }
    });

    const result = Object.entries(monthlyMap)
      .map(([month, fee]) => ({
        month: `${month.split("-")[0]}/${month.split("-")[1]}`,
        fee,
      }))
      .sort((a, b) => {
        const [yearA, monthA] = a.month.split("/").map(Number);
        const [yearB, monthB] = b.month.split("/").map(Number);
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
      });

    return result;
  }

  private getTimeSpanOptionClass(number: number): string {
    return this.state.daysToShow === number ? styles.active : "";
  }

  private getActiveOptionIndex(): number {
    return this.TIME_SPAN_OPTIONS_IN_DAYS.indexOf(this.state.daysToShow);
  }

  private handleClickTimeSpanOption = (number: number): void => {
    this.setState({ daysToShow: number });
  };

  private handleClickShowMore = (): void => {
    this.setState((state) => {
      return { numberToShow: state.numberToShow * 2 };
    });
  };

  private get hasMoreToShow(): boolean {
    return this.props.discounts.length > this.state.numberToShow;
  }
}

export default connect(mapStateToProps)(withRouter(HandlingFee));
