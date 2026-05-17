import { Dexie, type Table } from "dexie";

import type { TradeRecord, TradeRecordSyncResponse } from "../types";

type Metadata = { key: string; value: number | string };

class TaiguDatabase extends Dexie {
  tradeRecords!: Table<TradeRecord, number>;
  metadata!: Table<Metadata, string>;

  public constructor() {
    super("taigu");
    this.version(1).stores({
      tradeRecords: "id, [deal_time+id], sid",
      metadata: "key",
    });
  }
}

const database = new TaiguDatabase();
const accountIdKey = "accountId";
const tradeRecordsCacheVersion = 1;
const tradeRecordsCacheVersionKey = "tradeRecordsCacheVersion";
const tradeRecordsLastRevisionKey = "tradeRecordsLastRevision";

export default class LocalDatabase {
  public static async prepareForAccount(accountId: string): Promise<void> {
    const cachedAccountId = (await database.metadata.get(accountIdKey))?.value;
    const cachedTradeRecordsCacheVersion = (
      await database.metadata.get(tradeRecordsCacheVersionKey)
    )?.value;
    if (
      cachedAccountId === accountId &&
      cachedTradeRecordsCacheVersion === tradeRecordsCacheVersion
    ) {
      return;
    }

    await database.transaction(
      "rw",
      database.tradeRecords,
      database.metadata,
      async () => {
        await database.tradeRecords.clear();
        await database.metadata.clear();
        await database.metadata.put({ key: accountIdKey, value: accountId });
        await database.metadata.put({
          key: tradeRecordsCacheVersionKey,
          value: tradeRecordsCacheVersion,
        });
      },
    );
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
    await database.tradeRecords.put(record);
  }

  public static async deleteTradeRecord(id: number | string): Promise<void> {
    await database.tradeRecords.delete(Number(id));
  }
}
