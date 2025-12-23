import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";
import { connect } from "react-redux";

import { RoundButton } from "../../../components";
import { IconChevronLeft } from "../../../icons";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import Api from "../../../utils/api";
import Util from "../../../utils/util";
import styles from "./EarningAnalysis.module.scss";

function mapStateToProps(rootState: RootState) {
  const { sidGainMap } = rootState.tradeRecord;
  const { sidTotalCashDividendMap } = rootState.cashDividend;
  const { scrollTop } = rootState.mainPage;
  return { sidGainMap, sidTotalCashDividendMap, mainScrollTop: scrollTop };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  activeChartType: "gain" | "cashDividend";
  sliderPosition: number;
  companyNamesMap: { [sid: string]: string | null };
}

class EarningAnalysis extends React.Component<Props, State> {
  private gainButtonRef = React.createRef<HTMLButtonElement>();
  private cashDividendButtonRef = React.createRef<HTMLButtonElement>();
  private containerRef = React.createRef<HTMLDivElement>();
  private readonly SHOW_FLOATING_INFO_THRESHOLD: number = 120;

  public state: State;

  public constructor(props: Props) {
    super(props);
    this.state = { activeChartType: "gain", sliderPosition: 0, companyNamesMap: {} };
  }

  public componentDidMount(): void {
    requestAnimationFrame(() => this.updateSliderPosition());
    this.fetchCompanyNames();
  }

  public componentDidUpdate(prevProps: Props, prevState: State): void {
    if (prevState.activeChartType !== this.state.activeChartType) {
      this.updateSliderPosition();
    }
    if (
      prevProps.sidGainMap !== this.props.sidGainMap ||
      prevProps.sidTotalCashDividendMap !== this.props.sidTotalCashDividendMap
    ) {
      this.fetchCompanyNames();
    }
  }

  public render(): React.ReactNode {
    const chartData =
      this.state.activeChartType === "gain"
        ? this.gainChartData
        : this.cashDividendChartData;
    const chartOption =
      this.state.activeChartType === "gain"
        ? this.gainChartOption
        : this.cashDividendChartOption;
    const chartHeight =
      chartData.length > 0 ? this.calculateChartHeight(chartData.length) : 400;

    return (
      <div className={styles.main}>
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
        <div className={styles.floating_pill_wrapper}>
          <div ref={this.containerRef} className={styles.floating_pill}>
            <div
              className={styles.active_indicator}
              style={{ transform: `translateX(${this.state.sliderPosition}px)` }}
            />
            <button
              ref={this.gainButtonRef}
              className={`${styles.tab_button} ${this.state.activeChartType === "gain" ? styles.active : ""}`}
              onClick={() => this.setState({ activeChartType: "gain" })}
            >
              資本利得
            </button>
            <button
              ref={this.cashDividendButtonRef}
              className={`${styles.tab_button} ${this.state.activeChartType === "cashDividend" ? styles.active : ""}`}
              onClick={() => this.setState({ activeChartType: "cashDividend" })}
            >
              現金股利
            </button>
          </div>
        </div>
        <div className={styles.chart_container}>
          {chartData.length === 0 ? (
            <div className={styles.empty_section}>
              {this.state.activeChartType === "gain"
                ? "目前沒有任何損益資料"
                : "目前沒有任何現金股利資料"}
            </div>
          ) : (
            <ReactECharts
              option={chartOption}
              style={{ height: `${chartHeight}px`, width: "100%" }}
              notMerge={true}
            />
          )}
        </div>
        {Util.isMobile && <div className={styles.mobile_padding} />}
      </div>
    );
  }

  private updateSliderPosition = (): void => {
    const activeButton =
      this.state.activeChartType === "gain"
        ? this.gainButtonRef.current
        : this.cashDividendButtonRef.current;
    const container = this.containerRef.current;
    if (activeButton && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const position = buttonRect.left - containerRect.left;
      this.setState({ sliderPosition: position });
    }
  };

  private fetchCompanyNames = async (): Promise<void> => {
    const { sidGainMap, sidTotalCashDividendMap } = this.props;
    const gainSids = Object.keys(sidGainMap).filter((sid) => sidGainMap[sid] !== 0);
    const dividendSids = Object.keys(sidTotalCashDividendMap).filter(
      (sid) => sidTotalCashDividendMap[sid] !== 0,
    );
    const sids = [...new Set([...gainSids, ...dividendSids])];
    if (sids.length === 0) return;

    try {
      const response = await Api.sendRequest(
        `stock/company-names?sids=${sids.join(",")}`,
        "get",
      );
      this.setState({ companyNamesMap: response });
    } catch (error) {
      // Silently fail - fallback to sid
    }
  };

  private get gainChartData(): { sid: string; name: string; value: number }[] {
    return Object.entries(this.props.sidGainMap)
      .map(([sid, gain]) => {
        return {
          sid,
          name: this.state.companyNamesMap[sid] ?? sid,
          value: Math.round(gain),
        };
      })
      .filter((item) => item.value !== 0)
      .sort((a, b) => a.value - b.value);
  }

  private get cashDividendChartData(): { sid: string; name: string; value: number }[] {
    return Object.entries(this.props.sidTotalCashDividendMap)
      .map(([sid, dividend]) => {
        return { sid, name: this.state.companyNamesMap[sid] ?? sid, value: dividend };
      })
      .filter((item) => item.value !== 0)
      .sort((a, b) => a.value - b.value);
  }

  private get gainChartOption(): EChartsOption {
    if (this.gainChartData.length === 0) return {};

    const categories = this.gainChartData.map((item) => item.name);
    const values = this.gainChartData.map((item) => ({
      value: item.value,
      itemStyle: { color: item.value >= 0 ? "#4c8bf5" : "#f44336" },
    }));
    const totalGain = this.gainChartData.reduce(
      (sum, item) => sum + Math.abs(item.value),
      0,
    );

    return {
      backgroundColor: "transparent",
      grid: { left: "15%", right: "5%", top: 20, bottom: 20 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const param = params[0] as { name: string; value: number };
          const dataItem = this.gainChartData.find((item) => item.name === param.name);
          const percentage =
            totalGain > 0 ? ((param.value / totalGain) * 100).toFixed(1) : "0.0";
          return `${dataItem?.sid ?? param.name}<br/>${param.name}<br/>$${param.value.toLocaleString()} (${percentage}%)`;
        },
      },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        data: categories,
        axisLabel: { color: "#aaa", fontSize: 11, hideOverlap: true },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      series: [
        {
          name: "資本利得",
          type: "bar",
          data: values,
          itemStyle: { borderRadius: 10 },
          barWidth: 40,
          label: {
            show: true,
            position: "right",
            color: "#aaa",
            fontSize: 11,
            formatter: (params: unknown) => {
              const param = params as { value: number };
              const value = Number(param.value);
              if (Math.abs(value) >= 1_000_000)
                return `$${(value / 1_000_000).toFixed(1)}M`;
              if (Math.abs(value) >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
              return `$${value.toLocaleString()}`;
            },
          },
        },
      ],
    };
  }

  private get cashDividendChartOption(): EChartsOption {
    if (this.cashDividendChartData.length === 0) return {};

    const categories = this.cashDividendChartData.map((item) => item.name);
    const values = this.cashDividendChartData.map((item) => item.value);
    const totalCashDividend = this.cashDividendChartData.reduce(
      (sum, item) => sum + Math.abs(item.value),
      0,
    );

    return {
      backgroundColor: "transparent",
      grid: { left: "15%", right: "5%", top: 20, bottom: 20 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const param = params[0] as { name: string; value: number };
          const dataItem = this.cashDividendChartData.find(
            (item) => item.name === param.name,
          );
          const percentage =
            totalCashDividend > 0
              ? ((param.value / totalCashDividend) * 100).toFixed(1)
              : "0.0";
          return `${dataItem?.sid ?? param.name}<br/>${param.name}<br/>$${param.value.toLocaleString()} (${percentage}%)`;
        },
      },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        data: categories,
        axisLabel: { color: "#aaa", fontSize: 11, hideOverlap: true },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      series: [
        {
          name: "現金股利",
          type: "bar",
          data: values,
          itemStyle: { color: "#4c8bf5", borderRadius: 10 },
          barWidth: 40,
          label: {
            show: true,
            position: "right",
            color: "#aaa",
            fontSize: 11,
            formatter: (params: unknown) => {
              const param = params as { value: number };
              const value = Number(param.value);
              if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
              if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
              return `$${value.toLocaleString()}`;
            },
          },
        },
      ],
    };
  }

  private calculateChartHeight(dataLength: number): number {
    const barHeight = 40;
    const spacing = 4;
    const topPadding = 20;
    const bottomPadding = 20;
    return dataLength * (barHeight + spacing) + topPadding + bottomPadding;
  }
}

export default connect(mapStateToProps)(withRouter(EarningAnalysis));
