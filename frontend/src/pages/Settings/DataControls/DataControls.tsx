import { memo, useLayoutEffect } from "react";

import { BeautifulBlock, BeautifulRow } from "../../../components";
import { useAppDispatch } from "../../../redux/hooks";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { TradeRecordSyncResponse } from "../../../types";
import Api from "../../../utils/api";
import styles from "./DataControls.module.scss";

function DataControls() {
  const dispatch = useAppDispatch();

  useLayoutEffect(() => {
    dispatch(updateHeaderTitle("資料控制"));
  }, [dispatch]);

  return (
    <div className={styles.main}>
      <BeautifulBlock title="交易紀錄">
        <BeautifulRow onClick={handleExportAllTradeRecords}>
          <div className={styles.blue}>匯出所有交易紀錄</div>
        </BeautifulRow>
        {/* <BeautifulRow>
            <div className={styles.red}>刪除所有交易紀錄</div>
          </BeautifulRow> */}
      </BeautifulBlock>
      <BeautifulBlock title="現金股利紀錄">
        <BeautifulRow onClick={handleExportAllCashDividendRecords}>
          <div className={styles.blue}>匯出所有現金股利紀錄</div>
        </BeautifulRow>
        {/* <BeautifulRow>
            <div className={styles.red}>刪除所有現金股利紀錄</div>
          </BeautifulRow> */}
      </BeautifulBlock>
      {/* <BeautifulBlock title="帳號">
          <BeautifulRow onClick={handleClickDeleteAccount}>
            <div className={styles.red}>刪除帳號</div>
          </BeautifulRow>
        </BeautifulBlock> */}
    </div>
  );
}

export default memo(DataControls);

function downloadJsonFile(data: unknown, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function handleExportAllTradeRecords(): Promise<void> {
  const response = (await Api.sendRequest(
    "trade-records",
    "get",
  )) as TradeRecordSyncResponse;
  downloadJsonFile(response.updates, "trade-records.json");
}

async function handleExportAllCashDividendRecords(): Promise<void> {
  const response = await Api.sendRequest("cash-dividends", "get");
  downloadJsonFile(response, "cash-dividend-records.json");
}
