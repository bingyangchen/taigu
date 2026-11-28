import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { memo, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  RoundButton,
  ScrollThresholdContainer,
  SegmentedControl,
  SpeedDial,
} from "../../../components";
import * as Icons from "../../../icons";
import { useAppSelector } from "../../../redux/hooks";
import { COLORS, FONT_SIZES } from "../../../styles/tokens";
import Api from "../../../utils/api";
import Env from "../../../utils/env";
import { useIsNarrowLayout } from "../../../utils/mediaQuery";
import { navigateBack } from "../../../utils/router";
import styles from "./EarningAnalysis.module.scss";

type ChartType = "gain" | "cashDividend";

interface ChartItem {
  sid: string;
  name: string;
  value: number;
}

function EarningAnalysis() {
  const sidGainMap = useAppSelector((state) => state.tradeRecord.sidGainMap);
  const sidTotalCashDividendMap = useAppSelector(
    (state) => state.cashDividend.sidTotalCashDividendMap,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const isNarrowLayout = useIsNarrowLayout();
  const [activeChartType, setActiveChartType] = useState<ChartType>("gain");
  const [companyNamesMap, setCompanyNamesMap] = useState<{
    [sid: string]: string | null;
  }>({});

  useEffect(() => {
    const gainSids = Object.keys(sidGainMap).filter((sid) => sidGainMap[sid] !== 0);
    const dividendSids = Object.keys(sidTotalCashDividendMap).filter(
      (sid) => sidTotalCashDividendMap[sid] !== 0,
    );
    const sids = [...new Set([...gainSids, ...dividendSids])];
    if (sids.length === 0) return;

    const fetchCompanyNames = async (): Promise<void> => {
      try {
        const response = await Api.sendRequest(
          `market/company-names?sids=${sids.join(",")}`,
          "get",
        );
        setCompanyNamesMap(response);
      } catch {
        // Silently fail - fallback to sid
      }
    };
    void fetchCompanyNames();
  }, [sidGainMap, sidTotalCashDividendMap]);

  const chartData =
    activeChartType === "gain"
      ? makeChartData(sidGainMap, companyNamesMap, Math.round)
      : makeChartData(sidTotalCashDividendMap, companyNamesMap, (value) => value);
  const chartOption =
    activeChartType === "gain"
      ? makeGainChartOption(chartData)
      : makeCashDividendChartOption(chartData);
  const chartHeight =
    chartData.length > 0 ? calculateChartHeight(chartData.length) : 400;

  return (
    <div className={styles.main}>
      <SpeedDial />
      <ScrollThresholdContainer>
        {(isScrolled) => (
          <div
            className={`${styles.back_button_container} ${
              isScrolled ? styles.scrolled : ""
            }`}
          >
            <RoundButton
              onClick={() => navigateBack({ location, navigate }, Env.frontendRootPath)}
              size="l"
              frosted={isScrolled}
              hint_text="回儀表板"
            >
              <Icons.IconChevronLeft sideLength="16" />
            </RoundButton>
          </div>
        )}
      </ScrollThresholdContainer>
      <div className={styles.floating_pill_wrapper}>
        <SegmentedControl
          label="收益分析分類"
          optionWidth="88px"
          options={[
            { label: "資本利得", value: "gain" },
            { label: "現金股利", value: "cashDividend" },
          ]}
          value={activeChartType}
          variant="floating"
          onChange={(value) => setActiveChartType(value as ChartType)}
        />
      </div>
      <div className={styles.chart_container} data-page-scroll>
        {chartData.length === 0 ? (
          <div className={styles.empty_section}>
            {activeChartType === "gain"
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
      {isNarrowLayout && <div className={styles.mobile_padding} />}
    </div>
  );
}

export default memo(EarningAnalysis);

function makeChartData(
  sidValueMap: { [sid: string]: number },
  companyNamesMap: { [sid: string]: string | null },
  toChartValue: (value: number) => number,
): ChartItem[] {
  return Object.entries(sidValueMap)
    .map(([sid, value]) => ({
      sid,
      name: companyNamesMap[sid] ?? sid,
      value: toChartValue(value),
    }))
    .filter((item) => item.value !== 0)
    .sort((a, b) => a.value - b.value);
}

function makeGainChartOption(chartData: ChartItem[]): EChartsOption {
  if (chartData.length === 0) return {};

  const categories = chartData.map((item) => item.name);
  const values = chartData.map((item) => ({
    value: item.value,
    itemStyle: { color: item.value >= 0 ? COLORS.chartUp : COLORS.chartDown },
  }));
  const totalGain = chartData.reduce((sum, item) => sum + Math.abs(item.value), 0);

  return {
    backgroundColor: "transparent",
    grid: { left: "15%", right: "5%", top: 20, bottom: 20 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const param = params[0] as { name: string; value: number };
        const dataItem = chartData.find((item) => item.name === param.name);
        const percentage =
          totalGain > 0 ? ((param.value / totalGain) * 100).toFixed(1) : "0.0";
        return `${dataItem?.sid ?? param.name}<br/>${param.name}<br/>$${param.value.toLocaleString()} (${percentage}%)`;
      },
    },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: categories,
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        hideOverlap: true,
      },
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
          color: COLORS.textSecondary,
          fontSize: FONT_SIZES.chartTick,
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

function makeCashDividendChartOption(chartData: ChartItem[]): EChartsOption {
  if (chartData.length === 0) return {};

  const categories = chartData.map((item) => item.name);
  const values = chartData.map((item) => item.value);
  const totalCashDividend = chartData.reduce(
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
        const dataItem = chartData.find((item) => item.name === param.name);
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
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        hideOverlap: true,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    series: [
      {
        name: "現金股利",
        type: "bar",
        data: values,
        itemStyle: { color: COLORS.chartAccent, borderRadius: 10 },
        barWidth: 40,
        label: {
          show: true,
          position: "right",
          color: COLORS.textSecondary,
          fontSize: FONT_SIZES.chartTick,
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

function calculateChartHeight(dataLength: number): number {
  const barHeight = 40;
  const spacing = 4;
  const topPadding = 20;
  const bottomPadding = 20;
  return dataLength * (barHeight + spacing) + topPadding + bottomPadding;
}
