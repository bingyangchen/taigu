/// <reference types="react-scripts" />

declare module "*.mp4" {
  const src: string;
  export default src;
}

declare module "echarts-stat" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ecStat: { transform: { histogram: any } };
  export default ecStat;
}
