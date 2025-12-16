/// <reference types="react-scripts" />

declare module "*.mp4" {
  const src: string;
  export default src;
}

declare module "echarts-stat" {
  interface EChartsStat {
    transform: { histogram: any };
  }
  const ecStat: EChartsStat;
  export default ecStat;
}
