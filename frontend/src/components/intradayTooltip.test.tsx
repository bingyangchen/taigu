/** @jest-environment node */

import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import React from "react";

import { makeMarketIndexIntradayChartOption } from "./MarketIndexIntradayLineChart/MarketIndexIntradayLineChart";
import StockIntradayLineChart from "./StockIntradayLineChart/StockIntradayLineChart";

// ECharts aligns one-pixel strokes to half-pixel coordinates.
const POINTER_PIXEL_TOLERANCE = 1;

function buildData(prices: Record<number, number>): [number, number | null][] {
  return Array.from({ length: 271 }, (_, minute) => [minute, prices[minute] ?? null]);
}

test.each([
  { prevClosePrice: null, expected: "較昨收 -- (--)" },
  { prevClosePrice: 0, expected: "較昨收 ▲103 (--)" },
])(
  "reports unavailable market index changes from a $prevClosePrice close",
  ({ prevClosePrice, expected }) => {
    const option = makeMarketIndexIntradayChartOption(
      buildData({ 155: 103 }),
      prevClosePrice,
    );
    if (!option) throw new Error("Expected an intraday chart");
    const { series, tooltip } = option;
    if (!Array.isArray(series) || !tooltip || Array.isArray(tooltip)) {
      throw new Error("Expected chart series and a tooltip");
    }
    const formatter = tooltip.formatter;
    if (typeof formatter !== "function")
      throw new Error("Expected a tooltip formatter");

    // Offer the quote on every series; the formatter reads the tooltip series.
    const params = series.map((item, seriesIndex) => ({
      seriesIndex,
      seriesId: item.id,
      value: [155, 103],
    }));
    const content = formatter(params as never, "", () => {});
    expect(content).toContain(expected);
  },
);

describe.each([
  {
    name: "market index",
    makeOption: (props: { data: [number, number | null][]; prevClosePrice: number }) =>
      makeMarketIndexIntradayChartOption(props.data, props.prevClosePrice),
    expectedPrice: (price: number) => `指數 ${price.toLocaleString()}`,
  },
  {
    name: "stock",
    makeOption: (props: {
      data: [number, number | null][];
      prevClosePrice: number;
    }) => {
      const element = new StockIntradayLineChart(props).render();
      return React.isValidElement<{ option: EChartsOption }>(element)
        ? element.props.option
        : null;
    },
    expectedPrice: (price: number) => `價格 $${price.toFixed(2)}`,
  },
])("$name intraday tooltip", ({ makeOption, expectedPrice }) => {
  function getSelectedQuote(
    prices: Record<number, number>,
    minute: number,
  ): { minute: number; tooltip: string } {
    const option = makeOption({ data: buildData(prices), prevClosePrice: 100 });
    if (!option) throw new Error("Expected an intraday chart");
    const { series, tooltip } = option;
    if (!Array.isArray(series) || !tooltip || Array.isArray(tooltip)) {
      throw new Error("Expected chart series and a tooltip");
    }
    const formatter = tooltip.formatter;
    if (typeof formatter !== "function")
      throw new Error("Expected a tooltip formatter");
    const chart = echarts.init(null, null, {
      renderer: "svg",
      ssr: true,
      width: 800,
      height: 400,
    });
    try {
      chart.setOption({ ...option, animation: false });
      let selectedMinute: number | undefined;
      let tooltipText: string | undefined;
      chart.on("updateAxisPointer", (event: { axesInfo: { value: number }[] }) => {
        selectedMinute = event.axesInfo[0]?.value;
      });
      chart.on("showTip", (event: { seriesIndex: number; dataIndex: number }) => {
        const selectedSeries = series[event.seriesIndex];
        if (selectedSeries.type !== "line") throw new Error("Expected a line series");
        const point = selectedSeries.data?.[event.dataIndex];
        if (!Array.isArray(point)) throw new Error("Expected a recorded quote");
        const content = formatter(
          [
            {
              componentType: "series",
              componentSubType: "line",
              componentIndex: event.seriesIndex,
              seriesIndex: event.seriesIndex,
              seriesId: selectedSeries.id as string | undefined,
              name: "",
              dataIndex: event.dataIndex,
              data: point,
              value: point,
              $vars: [],
            },
          ],
          "",
          () => {},
        );
        if (typeof content !== "string") throw new Error("Expected tooltip text");
        tooltipText = content.replace(/<[^>]*>/g, "");
      });
      const [x, y] = chart.convertToPixel({ gridIndex: 0 }, [minute, 100]);
      chart.dispatchAction({
        type: "updateAxisPointer",
        x,
        y,
        axesInfo: [{ axisDim: "x", axisIndex: 0, value: minute }],
      });
      if (selectedMinute === undefined || tooltipText === undefined) {
        throw new Error("Expected an axis selection and a tooltip request");
      }
      const yAxis = option.yAxis;
      if (
        !yAxis ||
        Array.isArray(yAxis) ||
        typeof yAxis.min !== "number" ||
        typeof yAxis.max !== "number"
      ) {
        throw new Error("Expected numeric chart bounds");
      }
      const pointerX = chart.convertToPixel({ xAxisIndex: 0 }, selectedMinute);
      const top = chart.convertToPixel({ yAxisIndex: 0 }, yAxis.max);
      const bottom = chart.convertToPixel({ yAxisIndex: 0 }, yAxis.min);
      const verticalPaths = [
        ...chart
          .renderToSVGString()
          .matchAll(
            /<path\b[^>]*\bd="M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)"[^>]*>/g,
          ),
      ];
      expect(
        verticalPaths.some((path) => {
          const [, startX, startY, endX, endY] = path.map(Number);
          return (
            !/(?:stroke-)?opacity="0"|stroke="none"/.test(path[0]) &&
            Math.abs(startX - pointerX) <= POINTER_PIXEL_TOLERANCE &&
            Math.abs(endX - pointerX) <= POINTER_PIXEL_TOLERANCE &&
            Math.abs(Math.min(startY, endY) - top) <= POINTER_PIXEL_TOLERANCE &&
            Math.abs(Math.max(startY, endY) - bottom) <= POINTER_PIXEL_TOLERANCE
          );
        }),
      ).toBe(true);
      return { minute: selectedMinute, tooltip: tooltipText };
    } finally {
      chart.dispose();
    }
  }

  function expectQuote(
    prices: Record<number, number>,
    minute: number,
    expectedMinute: number,
    expectedTime: string,
  ): void {
    const quote = getSelectedQuote(prices, minute);
    const price = prices[expectedMinute];
    expect(quote.minute).toBe(expectedMinute);
    expect(quote.tooltip).toContain(expectedTime);
    expect(quote.tooltip).toContain(expectedPrice(price));
    expect(quote.tooltip).toContain("較昨收");
  }

  test("[MKT-R22.1] selects actual quotes across missing minutes", () => {
    for (let minute = 150; minute <= 155; minute += 0.5) {
      const earlier = minute <= 152.5;
      expectQuote(
        { 150: 99, 155: 103 },
        minute,
        earlier ? 150 : 155,
        earlier ? "11:30" : "11:35",
      );
    }
  });

  test("[MKT-R22.2] selects the earlier quote at an exact midpoint", () => {
    expectQuote({ 150: 99, 155: 103 }, 152.5, 150, "11:30");
  });

  test("[MKT-R22.3] selects the first quote before recorded data", () => {
    expectQuote({ 150: 99, 155: 103 }, 0, 150, "11:30");
  });

  test("[MKT-R22.4] selects the last quote after recorded data", () => {
    expectQuote({ 150: 99, 155: 103 }, 270, 155, "11:35");
  });

  test("[MKT-R22.6] does not select the interpolated red/green intersection", () => {
    expectQuote({ 150: 99, 151: 103 }, 150.25, 150, "11:30");
  });

  test("[MKT-R22.5] selects the only quote throughout the chart", () => {
    for (const minute of [0, 150, 270]) {
      expectQuote({ 150: 100 }, minute, 150, "11:30");
    }
  });

  test("does not render a chart without quotes", () => {
    expect(makeOption({ data: buildData({}), prevClosePrice: 100 })).toBeNull();
  });
});
