/* eslint-disable no-restricted-globals */

import { TradeRecordState } from "../redux/slices/TradeRecordSlice";
import { StockWarehouse, TradeRecord } from "../types";
import Util from "../utils/util";

self.onmessage = (e: MessageEvent<TradeRecord[]>): void => {
  const tradeRecords = [...e.data].sort(
    (a, b) => Date.parse(b.deal_time) - Date.parse(a.deal_time),
  );
  const sidTradeRecordsMap = getSidTradeRecordsMap(tradeRecords);
  const stockWarehouse = getStockWarehouse([...tradeRecords].reverse());
  const sidHandlingFeeMap = getSidHandlingFeeMap(sidTradeRecordsMap);
  const sidGainMap = getSidGainMap(sidTradeRecordsMap);
  const chartData = chartDataHelper([...tradeRecords].reverse());
  const cashInvestedChartData = chartData.map((row) => [row[0], row[1]]);
  const tradeVolumeChartData = chartData.map((row) => [row[0], row[2]]);
  const averageCashInvested = getAverageCashInvested(cashInvestedChartData);

  const result: Omit<TradeRecordState, "isWaiting"> = {
    tradeRecords,
    sidTradeRecordsMap,
    stockWarehouse,
    sidCashInvestedMap: getSidCashInvestedMap(stockWarehouse),
    sidHandlingFeeMap,
    sidGainMap,
    totalCashInvested: getTotalCashInvested(stockWarehouse),
    totalHandlingFee: Object.values(sidHandlingFeeMap).reduce(
      (sum, fee) => sum + fee,
      0,
    ),
    totalGain: Object.values(sidGainMap).reduce((sum, gain) => sum + gain, 0),
    cashInvestedChartData,
    tradeVolumeChartData,
    averageCashInvested,
  };

  self.postMessage(result);
};

const getSidTradeRecordsMap = (
  tradeRecords: TradeRecord[],
): { [sid: string]: TradeRecord[] } => {
  const reversedRecords = [...tradeRecords].reverse();
  const result: { [sid: string]: TradeRecord[] } = {};
  reversedRecords.forEach((r) => {
    const { sid } = r;
    if (!Object.prototype.hasOwnProperty.call(result, sid)) result[sid] = [r];
    else result[sid].push(r);
  });
  return result;
};

const getStockWarehouse = (timeSeriesTradeRecords: TradeRecord[]): StockWarehouse => {
  const result: StockWarehouse = {};
  for (const { sid, deal_price, deal_quantity } of timeSeriesTradeRecords) {
    if (!Object.prototype.hasOwnProperty.call(result, sid)) result[sid] = [];
    if (deal_quantity >= 0) {
      result[sid].push(...Array(deal_quantity).fill(deal_price));
    } else result[sid].splice(0, -deal_quantity);
  }
  for (const sid in result) if (result[sid].length === 0) delete result[sid];
  return result;
};

const getSidCashInvestedMap = (
  stockWarehouse: StockWarehouse,
): { [sid: string]: number } => {
  const result: { [sid: string]: number } = {};
  for (const [sid, warehouse] of Object.entries(stockWarehouse)) {
    result[sid] = warehouse.reduce((sum, cash) => sum + cash, 0);
  }
  return result;
};

const getTotalCashInvested = (stockWarehouse: StockWarehouse): number => {
  let result = 0;
  for (const warehouse of Object.values(stockWarehouse)) {
    result += warehouse.reduce((sum, cash) => sum + cash, 0);
  }
  return result;
};

const getSidHandlingFeeMap = (sidTradeRecordsMap: {
  [sid: string]: TradeRecord[];
}): { [sid: string]: number } => {
  const result: { [sid: string]: number } = {};
  for (const [sid, tradeRecords] of Object.entries(sidTradeRecordsMap)) {
    for (const record of tradeRecords) {
      if (result[sid] === undefined) result[sid] = record.handling_fee;
      else result[sid] += record.handling_fee;
    }
  }
  return result;
};

const getSidGainMap = (sidTradeRecordsMap: {
  [sid: string]: TradeRecord[];
}): { [sid: string]: number } => {
  const result: { [sid: string]: number } = {};
  for (const [sid, tradeRecords] of Object.entries(sidTradeRecordsMap)) {
    // `queue` can only contains elements with all positive `q` or all negative `q`
    const queue: { q: number; p: number }[] = [];
    result[sid] = 0;

    for (let { deal_quantity: q, deal_price: p } of tradeRecords) {
      // Check if the last q in `queue` is of the same sign as the incoming q
      if (queue.length === 0 || queue[queue.length - 1].q * q > 0) {
        queue.push({ q, p });
      } else {
        while (queue.length > 0 && q !== 0) {
          // Check if there's remaining q after eliminating the first
          // element in `queue` with the incoming q
          if ((queue[0].q + q) * queue[0].q > 0) {
            queue[0].q += q;
            result[sid] += (p - queue[0].p) * -q;
            q = 0;
          } else {
            q += queue[0].q;
            result[sid] += (p - queue[0].p) * queue[0].q;
            queue.shift();
          }
        }
      }
    }
  }
  return result;
};

// const getCashInvestedChartDataWithAverageCashInvested = (
//     timeSeriesTradeRecords: TradeRecord[]
// ): (string | number)[][] => {
//     const chartData = chartDataHelper(timeSeriesTradeRecords);
//     chartData.forEach((row, i) => {
//         if (i === 0) row.push("平均投入");
//         else {
//             const denominator = ((i + 1) * i) / 2;
//             let total = 0;
//             chartData
//                 .slice(1, i + 1)
//                 .map((row) => row[2] as number)
//                 .forEach((val, j) => {
//                     total += val * ((j + 1) / denominator);
//                 });
//             row.push(Math.round(total));
//         }
//     });
//     return chartData;
// };

const chartDataHelper = (
  timeSeriesTradeRecords: TradeRecord[],
  dates: string[] = [],
  stockWarehouse: StockWarehouse = {},
  result: (string | number)[][] = [["日期", "現金投入", "交易金額"]],
): (string | number)[][] => {
  if (dates.length === 0) {
    if (timeSeriesTradeRecords.length === 0) return result;
    if (new Date(timeSeriesTradeRecords[0].deal_time) <= new Date()) {
      dates = Util.getDateStringList(
        new Date(timeSeriesTradeRecords[0].deal_time),
        new Date(),
      );
    } else return result;
  }

  let remainingRecords = [...timeSeriesTradeRecords];
  let currentStockWarehouse = { ...stockWarehouse };
  const datesToProcess = [...dates];
  while (datesToProcess.length > 0) {
    const solvingDateString = datesToProcess.shift();
    if (!solvingDateString) break;

    const solvingRecords = remainingRecords.filter(
      (record) => record.deal_time === solvingDateString,
    );
    remainingRecords = remainingRecords.filter(
      (record) => record.deal_time !== solvingDateString,
    );

    currentStockWarehouse = updateStockWarehouse(solvingRecords, currentStockWarehouse);

    result.push([
      solvingDateString,
      Math.round(getTotalCashInvested(currentStockWarehouse)),
      solvingRecords.reduce(
        (sum, record) => sum + record.deal_price * Math.abs(record.deal_quantity),
        0,
      ),
    ]);
  }

  return result;
};

const updateStockWarehouse = (
  timeSeriesTradeRecords: TradeRecord[],
  prev: StockWarehouse = {},
): StockWarehouse => {
  for (const record of timeSeriesTradeRecords) {
    const { sid, deal_price: p, deal_quantity: q } = record;
    if (!(sid in prev)) prev[sid] = [];
    if (q >= 0) for (let i = 0; i < q; i++) prev[sid].push(p);
    else prev[sid].splice(0, -q);
  }
  for (const sid in prev) if (prev[sid].length === 0) delete prev[sid];
  return prev;
};

const getAverageCashInvested = (
  cashInvestedChartData: (Date | string | number)[][],
): number => {
  let averageCashInvested = 0;
  if (cashInvestedChartData.length > 1) {
    const denominator =
      (cashInvestedChartData.length * (cashInvestedChartData.length - 1)) / 2;
    let total = 0;
    cashInvestedChartData
      .slice(1)
      .map((row) => row[1] as number)
      .forEach((val, idx) => {
        total += val * ((idx + 1) / denominator);
      });
    averageCashInvested = Math.round(total);
  }
  return averageCashInvested;
};

export {};
