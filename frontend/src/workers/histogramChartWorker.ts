/* eslint-disable no-restricted-globals */

import type { TradeRecord } from "../types";

self.onmessage = (e: MessageEvent<TradeRecord[]>): void => {
  const prices: number[] = [];
  for (const { deal_price: p, deal_quantity: q } of e.data) {
    if (q > 0 && p > 0) prices.push(...Array(q).fill(p));
    else if (q < 0) prices.splice(0, -q);
  }
  self.postMessage(prices);
};

export {};
