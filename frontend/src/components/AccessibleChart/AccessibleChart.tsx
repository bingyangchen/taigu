import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";

import styles from "./AccessibleChart.module.scss";

interface Props {
  label: string;
  option: EChartsOption;
}

export default function AccessibleChart({ label, option }: Props) {
  return (
    <div aria-label={label} className={styles.chart} role="img">
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
      />
    </div>
  );
}
