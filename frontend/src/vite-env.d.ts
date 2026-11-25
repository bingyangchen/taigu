/// <reference types="vite/client" />

declare module "echarts-stat" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ecStat: { transform: { histogram: any } };
  export default ecStat;
}
