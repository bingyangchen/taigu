/// <reference types="react-scripts" />

declare module "*.mp4" {
  const src: string;
  export default src;
}

declare module "echarts-stat" {
  const ecStat: any;
  export default ecStat;
}
