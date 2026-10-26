import { Dexie, type Table } from "dexie";

import type { TradeRecord, TradeRecordSyncResponse } from "../types";
import { dateStringToDate } from "../utils/date";
import {
  assertCurrentSession,
  getDocumentSessionVersion,
  SessionChangedError,
} from "../utils/session";

type Metadata = { key: string; value: number | string };
export type MarketId = "tse" | "otc";
export type MarketIndexHistoricalPriceRow = {
  market: MarketId;
  date: string;
  price: number;
};

class TaiguDatabase extends Dexie {
  tradeRecords!: Table<TradeRecord, number>;
  metadata!: Table<Metadata, string>;
  marketIndexHistoricalPrices!: Table<
    MarketIndexHistoricalPriceRow,
    [MarketId, string]
  >;

  public constructor() {
    super("taigu");
    this.version(1).stores({
      tradeRecords: "id, [deal_time+id], sid",
      metadata: "key",
    });
    this.version(2).stores({
      tradeRecords: "id, [deal_time+id], sid",
      metadata: "key",
      marketIndexHistoricalPrices: "[market+date]",
    });
  }
}

const database = new TaiguDatabase();
const accountIdKey = "accountId";
const tradeRecordsCacheVersion = 1;
const tradeRecordsCacheVersionKey = "tradeRecordsCacheVersion";
const tradeRecordsLastRevisionKey = "tradeRecordsLastRevision";

export default class LocalDatabase {
  private static accountVersion: string | null = null;

  public static async hasAccountData(): Promise<boolean> {
    return (await database.metadata.get(accountIdKey)) !== undefined;
  }

  public static invalidateAccount(): void {
    LocalDatabase.accountVersion = null;
  }

  private static assertAccount(): void {
    if (LocalDatabase.accountVersion === null)
      throw new SessionChangedError("Account session changed");
    assertCurrentSession(LocalDatabase.accountVersion);
  }

  public static async prepareForAccount(accountId: string): Promise<void> {
    const version = getDocumentSessionVersion();
    const cachedAccountId = (await database.metadata.get(accountIdKey))?.value;
    const cachedTradeRecordsCacheVersion = (
      await database.metadata.get(tradeRecordsCacheVersionKey)
    )?.value;
    if (
      cachedAccountId === accountId &&
      cachedTradeRecordsCacheVersion === tradeRecordsCacheVersion
    ) {
      assertCurrentSession(version);
      LocalDatabase.accountVersion = version;
      return;
    }

    await database.transaction(
      "rw",
      database.tradeRecords,
      database.metadata,
      async () => {
        assertCurrentSession(version);
        await database.tradeRecords.clear();
        await database.metadata.clear();
        await database.metadata.put({ key: accountIdKey, value: accountId });
        await database.metadata.put({
          key: tradeRecordsCacheVersionKey,
          value: tradeRecordsCacheVersion,
        });
      },
    );
    assertCurrentSession(version);
    LocalDatabase.accountVersion = version;
  }

  public static async clearAll(): Promise<void> {
    await database.transaction(
      "rw",
      database.tradeRecords,
      database.metadata,
      async () => {
        await database.tradeRecords.clear();
        await database.metadata.clear();
      },
    );
  }

  public static async getTradeRecords(): Promise<TradeRecord[]> {
    return await database.tradeRecords.orderBy("[deal_time+id]").reverse().toArray();
  }

  public static async getTradeRecordsLastRevision(): Promise<number> {
    const value = (await database.metadata.get(tradeRecordsLastRevisionKey))?.value;
    return typeof value === "number" ? value : 0;
  }

  public static async applyTradeRecordSyncResponse(
    response: TradeRecordSyncResponse,
  ): Promise<TradeRecord[]> {
    await database.transaction(
      "rw",
      database.tradeRecords,
      database.metadata,
      async () => {
        LocalDatabase.assertAccount();
        if (response.is_full_snapshot) {
          await database.tradeRecords.clear();
        }
        if (response.deletes.length > 0) {
          await database.tradeRecords.bulkDelete(response.deletes);
        }
        if (response.updates.length > 0) {
          await database.tradeRecords.bulkPut(response.updates);
        }
        await database.metadata.put({
          key: tradeRecordsLastRevisionKey,
          value: response.last_revision,
        });
      },
    );
    return await LocalDatabase.getTradeRecords();
  }

  public static async upsertTradeRecord(record: TradeRecord): Promise<void> {
    await database.transaction("rw", database.tradeRecords, async () => {
      LocalDatabase.assertAccount();
      await database.tradeRecords.put(record);
    });
  }

  public static async deleteTradeRecord(id: number | string): Promise<void> {
    await database.transaction("rw", database.tradeRecords, async () => {
      LocalDatabase.assertAccount();
      await database.tradeRecords.delete(Number(id));
    });
  }

  public static async getMarketIndexHistoricalPrices(
    market: MarketId,
  ): Promise<{ [date: string]: number }> {
    const rows = await database.marketIndexHistoricalPrices
      .where("[market+date]")
      .between([market, Dexie.minKey], [market, Dexie.maxKey])
      .toArray();
    return Object.fromEntries(rows.map((row) => [row.date, row.price]));
  }

  public static getNextMarketIndexHistoricalSinceDate(prices: {
    [date: string]: number;
  }): string | null {
    const dates = Object.keys(prices);
    if (dates.length === 0) return null;

    let latestDate = dates[0];
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] > latestDate) latestDate = dates[i];
    }

    const nextDate = dateStringToDate(latestDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate.toLocaleDateString("af");
  }

  public static async putMarketIndexHistoricalPrices(
    market: MarketId,
    prices: { date: string; price: number }[],
  ): Promise<void> {
    if (prices.length === 0) return;
    await database.marketIndexHistoricalPrices.bulkPut(
      prices.map((row) => ({ market, date: row.date, price: row.price })),
    );
  }
}
