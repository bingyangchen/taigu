import type { ECharts } from "echarts";
import type { CallbackDataParams, EChartsOption } from "echarts/types/dist/shared";
import ReactECharts from "echarts-for-react";
import { memo, useLayoutEffect, useRef } from "react";

import { useAppSelector } from "../../redux/hooks";
import { COLORS, FONT_SIZES, TRANSPARENT_ALPHA } from "../../styles/tokens";
import { useIsNarrowLayout } from "../../utils/mediaQuery";

interface Props {
  dates: Date[];
  values: number[];
}

interface ResizeTracking {
  observer: ResizeObserver | null;
  animationFrameId: number | null;
}

function SimpleCashInvestedLineChart({ dates, values }: Props) {
  const tradeRecords = useAppSelector((state) => state.tradeRecord.tradeRecords);
  const isNarrowLayout = useIsNarrowLayout();
  const resizeTrackingRef = useRef<ResizeTracking>({
    observer: null,
    animationFrameId: null,
  });
  const hasChartData = tradeRecords.length > 0 && dates.length > 0 && values.length > 0;

  useLayoutEffect(() => {
    if (!hasChartData) clearResizeTracking(resizeTrackingRef.current);
  }, [hasChartData]);

  useLayoutEffect(() => {
    const resizeTracking = resizeTrackingRef.current;
    return () => clearResizeTracking(resizeTracking);
  }, []);

  const handleChartReady = (chart: ECharts): void => {
    const chartContainer = chart.getDom().parentElement;
    if (!chartContainer) {
      throw new Error("Cash invested chart has no parent container.");
    }

    const resizeTracking = resizeTrackingRef.current;
    clearResizeTracking(resizeTracking);
    resizeTracking.observer = new ResizeObserver(() => {
      if (resizeTracking.animationFrameId !== null) return;
      resizeTracking.animationFrameId = requestAnimationFrame(() => {
        resizeTracking.animationFrameId = null;
        const { clientWidth, clientHeight } = chartContainer;
        if (
          clientWidth > 0 &&
          clientHeight > 0 &&
          (chart.getWidth() !== clientWidth || chart.getHeight() !== clientHeight)
        ) {
          chart.resize({ width: clientWidth, height: clientHeight });
        }
      });
    });
    resizeTracking.observer.observe(chartContainer);
  };

  if (!hasChartData) return null;
  return (
    <ReactECharts
      option={makeCashInvestedChartOption(dates, values, isNarrowLayout)}
      style={{ height: "100%", width: "100%" }}
      onChartReady={handleChartReady}
    />
  );
}

export default memo(SimpleCashInvestedLineChart);

function clearResizeTracking(resizeTracking: ResizeTracking): void {
  resizeTracking.observer?.disconnect();
  resizeTracking.observer = null;
  if (resizeTracking.animationFrameId !== null) {
    cancelAnimationFrame(resizeTracking.animationFrameId);
    resizeTracking.animationFrameId = null;
  }
}

function makeCashInvestedChartOption(
  dates: Date[],
  values: number[],
  isNarrowLayout: boolean,
): EChartsOption {
  if (values.length === 0 || dates.length !== values.length) {
    return {};
  }

  return {
    backgroundColor: "transparent",
    grid: {
      left: 0,
      top: 5,
      right: 50,
      bottom: 25,
      containLabel: false,
      outerBoundsMode: "none",
    },
    xAxis: {
      type: "category",
      data: dates.map(formatDate),
      boundaryGap: false,
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        showMinLabel: false,
        showMaxLabel: true,
        hideOverlap: true,
        formatter: (value: string) => {
          const date = new Date(value);
          if (values.length > 30) return `${date.getMonth() + 1}月`;
          return `${date.getDate()}日`;
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      position: "right",
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        margin: 3,
        showMinLabel: false,
        formatter: (value: number) => {
          if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
          else if (value >= 1_000) return Math.round(value / 1_000) + "K";
          return value.toString();
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      splitNumber: 3,
    },
    series: [
      {
        type: "line",
        data: values,
        smooth: false,
        symbolSize: isNarrowLayout ? 5 : 8,
        showSymbol: false,
        sampling: "lttb",
        lineStyle: { color: COLORS.chartAccent, width: 3, join: "round" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: COLORS.chartAccent },
              { offset: 1, color: `${COLORS.chartAccent}${TRANSPARENT_ALPHA}` },
            ],
          },
        },
      },
    ],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        if (!Array.isArray(params) || params.length === 0) {
          return "";
        }
        const param = params[0];
        const dateStr = param.name;
        const value = param.value;
        return `${dateStr}<br/>$${Number(value).toLocaleString()}`;
      },
    },
    animationDurationUpdate: 0,
    animationDuration: 500,
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
