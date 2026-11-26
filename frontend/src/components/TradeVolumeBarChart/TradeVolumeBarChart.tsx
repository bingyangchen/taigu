import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { memo } from "react";

import { useAppSelector } from "../../redux/hooks";
import { COLORS, FONT_SIZES } from "../../styles/tokens";
import Util from "../../utils/util";

type ChartRow = (Date | string | number)[];

interface Props {
  data: ChartRow[];
  daysToShow: number;
}

function TradeVolumeBarChart({ data, daysToShow }: Props) {
  const tradeRecords = useAppSelector((state) => state.tradeRecord.tradeRecords);
  if (tradeRecords.length === 0 || data.length <= 1) {
    return null;
  }

  return (
    <ReactECharts
      option={makeTradeVolumeChartOption(
        Util.isMobile ? makeMobileChartData(data, daysToShow) : data,
        daysToShow,
      )}
      style={{ height: Util.isMobile ? "100%" : "95%", width: "100%" }}
      notMerge={true}
    />
  );
}

export default memo(TradeVolumeBarChart);

function makeTradeVolumeChartOption(
  data: ChartRow[],
  daysToShow: number,
): EChartsOption {
  if (data.length === 0) {
    return {};
  }

  // Extract dates and values from data
  // Data format: [date, dummy, cashInvested, volume]
  const dates: (Date | string | number)[] = [];
  const dummyValues: number[] = [];
  const cashInvestedValues: number[] = [];
  const volumeValues: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    dates.push(row[0]);
    dummyValues.push(0);
    const cashInvested = row[2] || row[1];
    const volume = row[3] || 0;
    cashInvestedValues.push(typeof cashInvested === "number" ? cashInvested : 0);
    volumeValues.push(typeof volume === "number" ? volume : 0);
  }

  const dateFormatter = (date: Date | string | number): string => {
    if (date instanceof Date) {
      return daysToShow > 30 ? `${date.getMonth() + 1}月` : `${date.getDate()}日`;
    }
    return String(date);
  };

  return {
    backgroundColor: "transparent",
    grid: {
      left: "1%",
      top: "5%",
      right: Util.isMobile ? "16%" : "2%",
      bottom: !Util.isMobile ? "15%" : "12%",
      containLabel: false,
    },
    xAxis: {
      type: "category",
      data: dates.map(dateFormatter),
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        interval: 1,
        showMaxLabel: true,
        showMinLabel: true,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: "value",
        show: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      {
        type: "value",
        show: Util.isMobile,
        position: "right",
        axisLabel: {
          show: Util.isMobile,
          color: COLORS.textSecondary,
          fontSize: FONT_SIZES.chartTick,
          formatter: (value: number) => {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
            if (value >= 1000) return (value / 1000).toFixed(1) + "K";
            return value.toString();
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        splitNumber: 3,
      },
      {
        type: "value",
        show: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        type: "line",
        data: dummyValues,
        lineStyle: { width: 0 },
        symbol: "none",
        silent: true,
        yAxisIndex: 0,
      },
      {
        type: "line",
        data: cashInvestedValues,
        lineStyle: { width: Util.isMobile ? 2.5 : 2, color: COLORS.chartAccent },
        symbol: "none",
        yAxisIndex: 1,
      },
      {
        type: "bar",
        data: volumeValues,
        itemStyle: { color: COLORS.chartMuted },
        barWidth: "60%",
        yAxisIndex: 1,
      },
    ],
    dataZoom: !Util.isMobile
      ? [
          {
            type: "slider",
            show: true,
            xAxisIndex: [0],
            start: 0,
            end: 100,
            bottom: "0%",
            height: "10%",
            handleIcon:
              "path://M30.9,53.2C16.8,53.2,5.3,41.7,5.3,27.6S16.8,2,30.9,2C45,2,56.4,13.5,56.4,27.6S45,53.2,30.9,53.2z M30.9,3.5C17.6,3.5,6.8,14.4,6.8,27.6c0,13.2,10.8,24.1,24.1,24.1C44.2,51.7,55,40.8,55,27.6C54.9,14.4,44.1,3.5,30.9,3.5z M36.9,35.8c0,0.5-0.4,0.9-0.9,0.9s-0.9-0.4-0.9-0.9V19.4c0-0.5,0.4-0.9,0.9-0.9s0.9,0.4,0.9,0.9V35.8z M25.8,35.8c0,0.5-0.4,0.9-0.9,0.9s-0.9-0.4-0.9-0.9V19.4c0-0.5,0.4-0.9,0.9-0.9s0.9,0.4,0.9,0.9V35.8z",
            handleSize: "80%",
            handleStyle: { color: COLORS.chartAccent, borderColor: COLORS.chartAccent },
            textStyle: { color: COLORS.textSecondary, fontSize: FONT_SIZES.chartTick },
            borderColor: "transparent",
            fillerColor: COLORS.chartAccentWash,
            dataBackground: {
              lineStyle: { color: COLORS.chartAccent, width: 0.5 },
              areaStyle: { color: "transparent" },
            },
            selectedDataBackground: {
              lineStyle: { color: COLORS.chartAccent, width: 0.5 },
              areaStyle: { color: COLORS.chartAccentWash },
            },
          },
        ]
      : undefined,
    tooltip: { show: true, trigger: "axis", axisPointer: { type: "line" } },
  };
}

function makeMobileChartData(data: ChartRow[], daysToShow: number): ChartRow[] {
  const candidates = [...data.slice(-Math.min(daysToShow, data.length - 1))];
  const n = 90;
  const l = candidates.length;
  if (l > n) {
    const m = l / n;
    let i = l - 1;
    let j = l - 1;
    const result = [data[0]];
    while (i >= 0) {
      result.push(candidates[i]);
      j -= m;
      i = Math.ceil(j);
    }
    return result;
  } else return [data[0], ...candidates];
}
