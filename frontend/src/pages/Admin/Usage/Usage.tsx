import type { EChartsOption, LineSeriesOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React, { useState } from "react";

import { SegmentedControl, Skeleton } from "../../../components";
import type {
  DailyUsage,
  DailyUsageRange,
  DailyUsageResponse,
  RetentionCell,
  RetentionWeek,
  UsageResponse,
} from "../../../types";
import {
  categoryAxisStyle,
  CHART_COLORS,
  CHART_GRID,
  type DataIndexParam,
  makeAria,
  makeValueAxis,
} from "../chart";
import {
  LoadFailure,
  Metric,
  MetricsSkeleton,
  Muted,
  PageHead,
  Section,
  SkeletonRows,
  StateMessage,
} from "../components";
import shared from "../components.module.scss";
import { formatCount, formatDate, formatShortDate } from "../format";
import tokens from "../tokens.module.scss";
import useAdminData, { type AdminDataState } from "../useAdminData";

const RANGE_OPTIONS = [
  { label: "90 天", value: "90" },
  { label: "全部", value: "all" },
];

export default function Usage(): React.ReactElement {
  const usage = useAdminData<UsageResponse>("admin/usage");
  const [range, setRange] = useState<DailyUsageRange>("90");

  // The usage response already carries the 90 days, so only "all" is fetched here.
  // Kept once fetched, so switching back to it does not run the query again.
  const [hasRequestedAllDays, setHasRequestedAllDays] = useState(false);
  const allDays = useAdminData<DailyUsageResponse>(
    hasRequestedAllDays ? "admin/usage/daily" : null,
  );
  const daily: AdminDataState<{ days: DailyUsage[] }> =
    range === "90" ? usage : allDays;

  if (usage.status === "failed") {
    return (
      <>
        <PageHead title="使用情況" />
        <LoadFailure onRetry={usage.reload} />
      </>
    );
  }

  const summary = usage.data?.summary;

  // 累計註冊 always shows a change, so the comparison day is always named.
  const description = summary
    ? `摘要數字統計到昨天（${formatShortDate(summary.yesterday)}），` +
      `增減與 ${formatShortDate(summary.compared_with)} 相比`
    : undefined;

  return (
    <>
      <PageHead title="使用情況" description={description} />
      <div className={`${shared.metrics} ${shared.summary}`}>
        {summary ? (
          <>
            {(
              [
                ["每日活躍（DAU）", summary.dau],
                ["7 天活躍（WAU）", summary.wau],
                ["30 天活躍（MAU）", summary.mau],
              ] as const
            ).map(([label, count]) => (
              <Metric
                key={label}
                label={label}
                value={count?.value ?? null}
                change={count?.change ?? null}
                pendingText="尚未開始記錄"
              />
            ))}
            <Metric
              label="累計註冊"
              value={summary.registered.value}
              change={summary.registered.change}
            />
          </>
        ) : (
          <MetricsSkeleton count={4} />
        )}
      </div>
      <Section
        title="活躍人數"
        caption={<ActivityLegend />}
        tools={
          <SegmentedControl
            label="期間"
            options={RANGE_OPTIONS}
            value={range}
            onChange={(value) => {
              setRange(value as DailyUsageRange);
              if (value === "all") setHasRequestedAllDays(true);
            }}
          />
        }
      >
        <DailyChart daily={daily} makeOption={makeActivityChartOption} />
      </Section>
      <Section title="新註冊人數">
        <DailyChart daily={daily} makeOption={makeSignupChartOption} small />
      </Section>
      <Section title="留存" caption="依註冊週分批，註冊當天算第 0 天">
        {usage.data ? (
          <RetentionTable
            weeks={usage.data.retention}
            recordingStartedOn={usage.data.recording_started_on}
          />
        ) : (
          <SkeletonRows count={6} />
        )}
      </Section>
    </>
  );
}

function ActivityLegend(): React.ReactElement {
  return (
    <span className={shared.legend}>
      <span>
        <i style={{ background: CHART_COLORS.blue }} />
        DAU
      </span>
      <span>
        <i style={{ background: CHART_COLORS.deepGray }} />
        WAU
      </span>
      <span>
        <i style={{ background: CHART_COLORS.gray }} />
        MAU
      </span>
      <span>
        <i className={shared.area} />
        資料不完整
      </span>
    </span>
  );
}

function DailyChart({
  daily,
  makeOption,
  small = false,
}: {
  daily: AdminDataState<{ days: DailyUsage[] }>;
  makeOption: (days: DailyUsage[]) => EChartsOption;
  small?: boolean;
}): React.ReactElement {
  const height = small ? tokens.adminSmallChartHeight : tokens.adminChartHeight;
  if (daily.status === "failed") return <LoadFailure onRetry={daily.reload} />;
  if (daily.status === "loading") {
    return <Skeleton width="100%" height={height} borderRadius={4} />;
  }
  if (daily.data.days.length === 0) {
    return <StateMessage>還沒有使用紀錄。</StateMessage>;
  }
  return (
    <ReactECharts
      style={{ width: "100%", height }}
      option={makeOption(daily.data.days)}
      notMerge
    />
  );
}

function makeDayTitle(days: DailyUsage[], index: number): string {
  const inProgress = index === days.length - 1 ? "（進行中）" : "";
  return `${formatDate(days[index].date)}${inProgress}`;
}

// Describes the last complete day, unless today is the only day recorded.
function makeDayCountsDescription(day: DailyUsage, isInProgress: boolean): string {
  return (
    `${formatDate(day.date)}${isInProgress ? "（進行中）" : ""}，` +
    `DAU ${formatCount(day.dau)} 人、WAU ${formatCount(day.wau)} 人、` +
    `MAU ${formatCount(day.mau)} 人。`
  );
}

function makeActivityChartOption(days: DailyUsage[]): EChartsOption {
  const last = days.length - 1;
  const labels = days.map((day) => formatShortDate(day.date));
  const firstCompleteIndex = days.findIndex((day) => !day.is_incomplete);
  const lastIncompleteIndex = firstCompleteIndex === -1 ? last : firstCompleteIndex - 1;
  const isSingleDay = days.length === 1;
  const makeSeries = (
    name: string,
    key: "dau" | "wau" | "mau",
    color: string,
    extra: LineSeriesOption = {},
  ): LineSeriesOption[] => [
    {
      name,
      type: "line",
      // Today has not ended, so its point joins yesterday's with a dashed line.
      data: days.map((day, i) => (i === last ? null : day[key])),
      showSymbol: false,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      ...extra,
    },
    {
      name,
      type: "line",
      data: days.map((day, i) => (i >= last - 1 ? day[key] : null)),
      // With only today recorded there is no line to draw, so its point shows.
      showSymbol: isSingleDay,
      lineStyle: { width: 2, color, type: "dashed" },
      itemStyle: { color },
      tooltip: { show: isSingleDay },
    },
  ];
  const markArea: LineSeriesOption["markArea"] =
    lastIncompleteIndex >= 0
      ? {
          silent: true,
          itemStyle: { color: CHART_COLORS.incompleteArea },
          // By position, because a range over a year repeats the "M/D" labels.
          data: [[{ xAxis: 0 }, { xAxis: lastIncompleteIndex }]],
        }
      : undefined;

  return {
    animation: false,
    aria: makeAria(
      `活躍人數，${formatDate(days[0].date)} 到 ${formatDate(days[last].date)}。` +
        makeDayCountsDescription(days[Math.max(last - 1, 0)], last === 0),
    ),
    grid: CHART_GRID,
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const index = (params as DataIndexParam[])[0].dataIndex;
        const day = days[index];
        const incomplete = day.is_incomplete
          ? `<br/><span style="color:${CHART_COLORS.gray}">30 天的區間早於使用紀錄開始</span>`
          : "";
        return (
          `${makeDayTitle(days, index)}${incomplete}<br/>` +
          `DAU ${formatCount(day.dau)} 人<br/>` +
          `WAU ${formatCount(day.wau)} 人<br/>` +
          `MAU ${formatCount(day.mau)} 人`
        );
      },
    },
    xAxis: { type: "category", data: labels, boundaryGap: false, ...categoryAxisStyle },
    yAxis: makeValueAxis("人", { minInterval: 1 }),
    series: [
      ...makeSeries("MAU", "mau", CHART_COLORS.gray, { markArea }),
      ...makeSeries("WAU", "wau", CHART_COLORS.deepGray),
      ...makeSeries("DAU", "dau", CHART_COLORS.blue),
    ],
  };
}

function makeSignupChartOption(days: DailyUsage[]): EChartsOption {
  const last = days.length - 1;
  return {
    animation: false,
    aria: makeAria(
      `新註冊人數，${formatDate(days[0].date)} 到 ${formatDate(days[last].date)}，` +
        `共 ${formatCount(days.reduce((sum, day) => sum + day.signups, 0))} 人。`,
    ),
    grid: CHART_GRID,
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const index = (params as DataIndexParam[])[0].dataIndex;
        return `${makeDayTitle(days, index)}<br/>新註冊 ${formatCount(days[index].signups)} 人`;
      },
    },
    xAxis: {
      type: "category",
      data: days.map((day) => formatShortDate(day.date)),
      ...categoryAxisStyle,
    },
    yAxis: makeValueAxis("人", { minInterval: 1 }),
    series: [
      {
        type: "bar",
        barMaxWidth: 8,
        data: days.map((day, i) => ({
          value: day.signups,
          itemStyle: {
            color: i === last ? CHART_COLORS.blueLight : CHART_COLORS.blueMedium,
          },
        })),
      },
    ],
  };
}

function RetentionTable({
  weeks,
  recordingStartedOn,
}: {
  weeks: RetentionWeek[];
  recordingStartedOn: string | null;
}): React.ReactElement {
  if (weeks.length === 0 || recordingStartedOn === null) {
    return <StateMessage>還沒有可以統計的註冊週。</StateMessage>;
  }
  const firstWeek = weeks[weeks.length - 1].week_start;
  return (
    <>
      <div className={shared.table_wrap}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th scope="col">註冊週</th>
              <th scope="col">註冊人數</th>
              <th scope="col">第 1–6 天</th>
              <th scope="col">第 7–13 天</th>
              <th scope="col">第 30–36 天</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.week_start}>
                <td>{formatDate(week.week_start)} 週</td>
                <td>{formatCount(week.signups)} 人</td>
                <td>
                  <RetentionCellContent cell={week.day_1} />
                </td>
                <td>
                  <RetentionCellContent cell={week.day_7} />
                </td>
                <td>
                  <RetentionCellContent cell={week.day_30} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={shared.footnote}>
        使用紀錄從 {formatDate(recordingStartedOn)} 開始，所以從 {formatDate(firstWeek)}{" "}
        那一週列起。
      </p>
    </>
  );
}

function RetentionCellContent({ cell }: { cell: RetentionCell }): React.ReactElement {
  if (cell.status === "no_signups") return <Muted>–</Muted>;
  if (cell.status === "in_progress") return <Muted>進行中</Muted>;
  return (
    <>
      {formatCount(cell.count)} 人
      <span className={shared.secondary_value}>{cell.percent}%</span>
    </>
  );
}
