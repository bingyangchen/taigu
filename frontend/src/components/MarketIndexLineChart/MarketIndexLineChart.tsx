import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React from "react";

interface Props {
  data: [number, number | null][];
  prevClosePrice: number;
}

interface State {}

class MarketIndexLineChart extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      this.props.data.length > 0 && (
        <ReactECharts
          option={this.chartOption}
          style={{ height: "100%", width: "100%" }}
        />
      )
    );
  }

  private get minPrice(): number {
    return Math.min(
      ...this.props.data.map((point) => point[1] ?? this.props.prevClosePrice),
    );
  }

  private get maxPrice(): number {
    return Math.max(
      ...this.props.data.map((point) => point[1] ?? this.props.prevClosePrice),
    );
  }

  private get chartOption(): EChartsOption {
    const segments = this.splitDataIntoColoredSegments(this.props.data);
    return {
      backgroundColor: "transparent",
      grid: { left: 0, top: 0, right: 0, bottom: 0, containLabel: false },
      xAxis: {
        type: "value",
        min: 0,
        max: 270,
        show: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        show: false,
        min: this.minPrice * 0.999,
        max: this.maxPrice * 1.001,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        scale: true,
      },
      series: [
        ...segments.map((segment) => ({
          type: "line" as const,
          data: segment.data,
          connectNulls: true,
          symbol: "none",
          lineStyle: { color: segment.color, width: 2 },
        })),
        {
          type: "line",
          data: [],
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#ddd", width: 1, type: "solid" },
            data: [{ yAxis: this.props.prevClosePrice }],
            label: { show: false },
          },
        },
      ],
      tooltip: { show: false },
      animationDurationUpdate: 0,
    };
  }

  private splitDataIntoColoredSegments(
    data: [number, number | null][],
  ): Array<{ data: [number, number | null][]; color: string }> {
    if (data.length === 0) return [];

    const segments: Array<{ data: [number, number | null][]; color: string }> = [];
    let currentSegment: [number, number | null][] = [];
    let currentColor: string | null = null;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const value = point[1];

      let pointColor: string;
      if (value === null) pointColor = currentColor ?? "#1aa260";
      else if (value > this.props.prevClosePrice) pointColor = "#de5246";
      else pointColor = "#1aa260";

      if (
        currentColor !== null &&
        currentColor !== pointColor &&
        currentSegment.length > 0
      ) {
        const prevPoint = data[i - 1];
        const prevValue = prevPoint[1];

        if (prevValue !== null && value !== null) {
          const x1 = prevPoint[0];
          const y1 = prevValue;
          const x2 = point[0];
          const y2 = value;

          const t = (this.props.prevClosePrice - y1) / (y2 - y1);
          if (t > 0 && t < 1) {
            const intersectionX = x1 + t * (x2 - x1);
            const intersectionPoint: [number, number] = [
              intersectionX,
              this.props.prevClosePrice,
            ];

            currentSegment.push(intersectionPoint);
            segments.push({ data: [...currentSegment], color: currentColor });
            currentSegment = [intersectionPoint, point];
          } else {
            currentSegment.push(point);
            segments.push({ data: [...currentSegment], color: currentColor });
            currentSegment = [point];
          }
        } else {
          currentSegment.push(point);
          segments.push({ data: [...currentSegment], color: currentColor });
          currentSegment = [point];
        }
        currentColor = pointColor;
      } else {
        if (currentColor === null) {
          currentColor = pointColor;
        }
        currentSegment.push(point);
      }
    }

    if (currentSegment.length > 0 && currentColor !== null) {
      segments.push({ data: currentSegment, color: currentColor });
    }

    return segments;
  }
}

export default MarketIndexLineChart;
