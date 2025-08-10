/* eslint-disable no-restricted-globals */

import type { TradeRecord } from "../types";

self.onmessage = (e: MessageEvent<TradeRecord[]>): void => {
  const result: (string | number)[][] = [];
  for (const record of e.data) {
    const { deal_price: p, deal_quantity: q, deal_time: t } = record;
    if (q >= 0) for (let i = 0; i < q; i++) result.push([t, p]);
    else result.splice(0, -q);
  }
  result.splice(0, 0, ["日期", "價格"]);
  self.postMessage(result);
};

export {};
