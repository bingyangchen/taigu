import { render } from "@testing-library/react";
import type { EChartsOption } from "echarts";
import { beforeEach, expect, test, vi } from "vitest";

import StockIntradayLineChart, {
  makeStockIntradayChartOption,
} from "./StockIntradayLineChart";

let renderedOption: EChartsOption | null = null;

vi.mock("echarts-for-react", () => ({
  default: ({ option }: { option: EChartsOption }) => {
    renderedOption = option;
    return <div data-testid="chart" />;
  },
}));

beforeEach(() => {
  renderedOption = null;
});

function buildData(prices: Record<number, number>): [number, number | null][] {
  return Array.from({ length: 271 }, (_, minute) => [minute, prices[minute] ?? null]);
}

test("draws the option that makeStockIntradayChartOption builds", () => {
  // The tooltip tests call the option builder directly, so this checks that the
  // chart on the page uses the same option.
  const data = buildData({ 0: 100, 150: 102 });
  const { getByTestId } = render(
    <StockIntradayLineChart data={data} prevClosePrice={101} />,
  );

  expect(getByTestId("chart")).toBeInTheDocument();
  expect(JSON.stringify(renderedOption)).toBe(
    JSON.stringify(makeStockIntradayChartOption(data, 101)),
  );
});

test("draws nothing without quotes", () => {
  const { container } = render(
    <StockIntradayLineChart data={buildData({})} prevClosePrice={101} />,
  );

  expect(container).toBeEmptyDOMElement();
  expect(renderedOption).toBeNull();
});
