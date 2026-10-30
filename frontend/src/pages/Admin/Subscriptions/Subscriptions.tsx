import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React, { useEffect, useRef, useState } from "react";

import { Skeleton } from "../../../components";
import type {
  MonthlyPayment,
  SubscriptionsResponse,
  SubscriptionStatusKey,
  TrialConversion,
} from "../../../types";
import {
  categoryAxisStyle,
  CHART_COLORS,
  type DataIndexParam,
  makeAria,
  makeValueAxis,
} from "../chart";
import {
  LoadFailure,
  Metric,
  Muted,
  PageHead,
  Section,
  SkeletonRows,
  StateMessage,
} from "../components";
import shared from "../components.module.scss";
import { formatCount, formatMonth, formatShortDate, formatShortMonth } from "../format";
import tokens from "../tokens.module.scss";
import useAdminData from "../useAdminData";

// Listed in this order on the page.
const STATUS_KEY_TO_LABEL: Record<SubscriptionStatusKey, string> = {
  trialing: "試用中",
  auto_renewing: "自動續訂中",
  auto_renewal_stopped: "已停止自動續訂",
  unsubscribed: "未訂閱",
};
const STATUS_ENTRIES = Object.entries(STATUS_KEY_TO_LABEL) as [
  SubscriptionStatusKey,
  string,
][];
const PAYMENT_CHART_HEIGHT = tokens.adminSmallChartHeight;

// Below this width the count labels on the bars overlap each other.
const PAYMENT_LABEL_MIN_WIDTH = parseFloat(tokens.adminChartLabelMinWidth);

export default function Subscriptions(): React.ReactElement {
  const subscriptions = useAdminData<SubscriptionsResponse>("admin/subscriptions");

  if (subscriptions.status === "failed") {
    return (
      <>
        <PageHead title="訂閱" />
        <LoadFailure onRetry={subscriptions.reload} />
      </>
    );
  }
  if (subscriptions.status === "loading") {
    return (
      <>
        <PageHead title="訂閱" />
        <Section title="目前的訂閱狀態">
          <Skeleton width="100%" height={48} borderRadius={4} />
        </Section>
        <Section title="試用轉付費">
          <SkeletonRows count={6} />
        </Section>
        <Section title="每月付款">
          <Skeleton width="100%" height={PAYMENT_CHART_HEIGHT} borderRadius={4} />
        </Section>
      </>
    );
  }

  const data = subscriptions.data;
  return (
    <>
      <PageHead title="訂閱" />
      <Section
        title="目前的訂閱狀態"
        caption={`白名單上的使用者 ${formatCount(data.whitelisted)} 人，已含在下面的人數裡`}
      >
        <div
          className={`${shared.metrics} ${shared.compact_metrics}`}
          style={{ "--columns": STATUS_ENTRIES.length } as React.CSSProperties}
        >
          {STATUS_ENTRIES.map(([key, label]) => (
            <Metric key={key} label={label} value={data.statuses[key]} />
          ))}
        </div>
      </Section>
      <Section
        title="試用轉付費"
        caption="到試用結束後 30 天為止，第一次付款成功的比例，不含白名單上的使用者"
      >
        <TrialConversionTable rows={data.trial_conversions} />
      </Section>
      <Section title="每月付款" caption="付款成功的金額與筆數，包含定期扣款">
        <PaymentChart payments={data.monthly_payments} />
      </Section>
    </>
  );
}

function TrialConversionTable({
  rows,
}: {
  rows: TrialConversion[];
}): React.ReactElement {
  if (rows.length === 0) return <StateMessage>還沒有試用的使用者。</StateMessage>;
  return (
    <div className={shared.table_wrap}>
      <table className={shared.table}>
        <thead>
          <tr>
            <th scope="col">試用開始的月份</th>
            <th scope="col">試用人數</th>
            <th scope="col">付款人數</th>
            <th scope="col">轉換率</th>
            <th scope="col">狀態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <td>{formatMonth(row.month)}</td>
              <td>{formatCount(row.trials)} 人</td>
              <td>{formatCount(row.paid)} 人</td>
              <td>
                {row.conversion_rate === null ? (
                  <Muted>–</Muted>
                ) : (
                  `${row.conversion_rate}%`
                )}
              </td>
              <td>
                <TrialConversionStatus row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrialConversionStatus({ row }: { row: TrialConversion }): React.ReactElement {
  switch (row.status) {
    case null:
      return <Muted>–</Muted>;
    case "settled":
      return <Muted>已結算</Muted>;
    case "in_progress":
      return (
        <>
          進行中
          <span className={shared.secondary_value}>
            {formatShortDate(row.settles_on)} 結算
          </span>
        </>
      );
  }
}

function PaymentChart({
  payments,
}: {
  payments: MonthlyPayment[];
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (payments.length === 0) {
    return <StateMessage>還沒有付款成功的紀錄。</StateMessage>;
  }
  return (
    <div ref={containerRef}>
      <ReactECharts
        style={{ width: "100%", height: PAYMENT_CHART_HEIGHT }}
        option={makePaymentChartOption(payments, width >= PAYMENT_LABEL_MIN_WIDTH)}
        notMerge
      />
    </div>
  );
}

function makePaymentChartOption(
  payments: MonthlyPayment[],
  showsCountLabels: boolean,
): EChartsOption {
  const last = payments.length - 1;
  return {
    animation: false,
    aria: makeAria(
      `每月付款，${formatMonth(payments[0].month)} 到 ${formatMonth(payments[last].month)}，` +
        `共 ${formatCount(payments.reduce((sum, payment) => sum + payment.count, 0))} 筆、` +
        `${formatCount(payments.reduce((sum, payment) => sum + payment.amount, 0))} 元。`,
    ),
    grid: { left: 48, right: 8, top: 28, bottom: 24 },
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const index = (params as DataIndexParam[])[0].dataIndex;
        const payment = payments[index];
        const inProgress = index === last ? "（進行中）" : "";
        return (
          `${formatMonth(payment.month)}${inProgress}<br/>` +
          `${formatCount(payment.count)} 筆，${formatCount(payment.amount)} 元`
        );
      },
    },
    xAxis: {
      type: "category",
      data: payments.map((payment) => formatShortMonth(payment.month)),
      ...categoryAxisStyle,
    },
    yAxis: makeValueAxis("元", { formatLabel: formatCount }),
    series: [
      {
        type: "bar",
        barMaxWidth: 24,
        data: payments.map((payment, i) => ({
          value: payment.amount,
          itemStyle: {
            color: i === last ? CHART_COLORS.blueLight : CHART_COLORS.blue,
            borderRadius: [2, 2, 0, 0],
          },
        })),
        label: {
          show: showsCountLabels,
          position: "top",
          color: CHART_COLORS.gray,
          fontSize: 10,
          formatter: (params: DataIndexParam) =>
            `${formatCount(payments[params.dataIndex].count)} 筆`,
        },
      },
    ],
  };
}
