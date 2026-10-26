注意：這份檔案的指令會刪除或修改開發環境資料庫裡的資料，包括登入帳號的紀錄，所以要用只拿來測試的 Google 帳號登入，不要用存有真實資料的帳號。

這份檔案的檢查都在桌面瀏覽器上用 Chrome 執行。開始之前先完成下面的準備：

1. 執行 `make start`。
2. 執行 `docker compose -f compose.dev.yaml stop scheduler`，讓 scheduler 在檢查期間不會改掉用指令設定的價格。
3. 用試用期內或 Standard 方案的 Google 帳號登入 `https://local.taigu.tw`，這樣行情每 30 秒重新抓取一次，交易紀錄也不受額度限制。
4. 把下面每個指令裡的 `EMAIL` 換成這個帳號的 email。
5. 執行下面的指令，把這份檔案會改到的 2330、2002、2317、0050 的行情備份到 `api-server` container 的 `/tmp/holdings_backup.json`。全部檢查完之前不要重建 `api-server` container。

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   import json
   from main.market.models import StockInfo
   rows = list(StockInfo.objects.filter(company_id__in=['2330', '2002', '2317', '0050']).values('company_id', 'close_price', 'fluct_price', 'quantity'))
   json.dump(rows, open('/tmp/holdings_backup.json', 'w'))
   "
   ```

6. 全部檢查完之後，執行下面的指令，從備份還原行情，再執行 `docker compose -f compose.dev.yaml start scheduler`。如果沒有還原，用指令設定的價格會一直留著，直到 scheduler 在下一個交易時段抓到新的行情。

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   import json
   from main.market.models import StockInfo
   for row in json.load(open('/tmp/holdings_backup.json')):
       StockInfo.objects.filter(company_id=row['company_id']).update(close_price=row['close_price'], fluct_price=row['fluct_price'], quantity=row['quantity'])
   "
   ```

段落裡寫「執行『設定交易紀錄』」時，執行下面的指令。注意：這個指令會先刪除這個帳號所有的交易紀錄，再依序新增 `RECORDS` 列出的交易紀錄。每筆交易紀錄寫成 `('交易日期', '股票代號', 成交單價, 成交股數, 手續費)`，賣出的股數寫成負數。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
from django.db import transaction
from main.account.models import User
from main.core.data_change import append_data_change_log
from main.core.models import DataChangeLog
from main.trade_record.models import TradeRecord
EMAIL = 'EMAIL'
RECORDS = []
subject = DataChangeLog.Subject.TRADE_RECORD
user = User.objects.get(email=EMAIL)
with transaction.atomic():
    for record in list(TradeRecord.objects.filter(owner=user)):
        record_id = record.pk
        record.delete()
        append_data_change_log(user=user, subject=subject, subject_id=record_id, operation=DataChangeLog.Operation.DELETE)
    for deal_time, sid, price, quantity, fee in RECORDS:
        record = TradeRecord.objects.create(owner=user, company_id=sid, deal_time=deal_time, deal_price=price, deal_quantity=quantity, handling_fee=fee)
        append_data_change_log(user=user, subject=subject, subject_id=record.pk, operation=DataChangeLog.Operation.UPSERT)
        print(record.pk, deal_time, sid, price, quantity, fee)
"
```

段落裡寫「執行『設定價格』」時，執行下面的指令，把 `PRICES` 列出的股票設成指定的價格、漲跌與成交股數，每檔股票寫成 `'股票代號': (價格, 漲跌, 成交股數)`。價格寫 0 代表這檔股票還沒有價格。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
from main.market.models import StockInfo
PRICES = {}
for sid, (close, fluct, quantity) in PRICES.items():
    StockInfo.objects.filter(company_id=sid).update(close_price=close, fluct_price=fluct, quantity=quantity)
"
```

## HOLD-R1.1 賣出部分股數

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 1000, 0), ('2024-02-01', '2330', 110, 500, 0), ('2024-03-01', '2330', 120, -400, 0)]`。
2. 開啟 `https://local.taigu.tw/market`。

預期：「持股」分頁列出 2330，庫存是「1,100 股」。

## HOLD-R1.2 賣出全部股數

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 1000, 0), ('2024-02-01', '2330', 110, -1000, 0)]`。
2. 開啟 `https://local.taigu.tw/market`。

預期：「持股」分頁沒有列出 2330，「持股檔數」是 0。

## HOLD-R1.3 只有現金股利紀錄的股票

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[]`。
2. 執行下面的指令，新增一筆 2330 的現金股利紀錄，並記下指令印出的 id。

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.account.models import User
   from main.cash_dividend.models import CashDividendRecord
   user = User.objects.get(email='EMAIL')
   print(CashDividendRecord.objects.create(owner=user, company_id='2330', deal_time='2024-07-01', cash_dividend=5000).pk)
   "
   ```

3. 開啟 `https://local.taigu.tw/market`。

預期：「持股」分頁沒有列出 2330。

檢查完執行下面的指令，把 `ID` 換成第 2 步記下的 id，刪除這一段新增的現金股利紀錄：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
from main.cash_dividend.models import CashDividendRecord
CashDividendRecord.objects.filter(pk=ID).delete()
"
```

## HOLD-R2.1 賣出的股數超過第一筆買進

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 1000, 0), ('2024-02-01', '2330', 120, 1000, 0), ('2024-03-01', '2330', 130, -1500, 0)]`。
2. 開啟 `https://local.taigu.tw/market/holding/2330`。

預期：投資摘要的「庫存」是「500 股」，「現金投入」是「$60,000」，「平均成本」是「$120.00」。

## HOLD-R2.2 新增的順序與交易日期的順序不同

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-02-01', '2330', 120, 1000, 0), ('2024-01-02', '2330', 100, 1000, 0), ('2024-03-01', '2330', 130, -1000, 0)]`。
2. 開啟 `https://local.taigu.tw/market/holding/2330`。

預期：投資摘要的「平均成本」是「$120.00」。

## HOLD-R2.3 同一天有多筆買進

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 1000, 0), ('2024-01-02', '2330', 110, 1000, 0), ('2024-01-03', '2330', 120, -1000, 0)]`。
2. 開啟 `https://local.taigu.tw/market/holding/2330`。

預期：投資摘要的「平均成本」是「$110.00」。

## HOLD-R3.1 買進時付了手續費

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 1000, 142)]`。
2. 開啟 `https://local.taigu.tw/market/holding/2330`。

預期：投資摘要的「現金投入」是「$100,000」，「平均成本」是「$100.00」。

## HOLD-R4.1 有價格的持股

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 500, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (600, 6, 25000000)}`。
3. 開啟 `https://local.taigu.tw/market/holding/2330`。

預期：投資摘要的「證券市值」是「$300,000」。

## HOLD-R4.2 還沒有價格的持股

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 500, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (0, 0, 0)}`。
3. 開啟 `https://local.taigu.tw/market/holding/2330`。

預期：投資摘要的「證券市值」是「$0」。

## HOLD-R5.1 價格改變

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 500, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (600, 6, 25000000)}`。
3. 開啟 `https://local.taigu.tw/market`。
4. 確認 2330 的價格是「600」。
5. 執行「設定價格」，`PRICES` 設成 `{'2330': (610, 16, 25000000)}`。
6. 停在這一頁，不要重新整理網頁，等待 40 秒。

預期：2330 的價格變成「610」。

## HOLD-R5.2 抓取失敗

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 500, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (600, 6, 25000000)}`。
3. 開啟 `https://local.taigu.tw/market`。
4. 確認 2330 的價格是「600」。
5. 開啟 Chrome DevTools 的 Network 面板。
6. 在 Network 面板把網路設成「Offline」。
7. 執行「設定價格」，`PRICES` 設成 `{'2330': (610, 16, 25000000)}`。
8. 停在這一頁，不要重新整理網頁，等待 40 秒。

預期：2330 的價格仍然是「600」。檢查完把 Network 面板的網路設回「No throttling」。

## HOLD-R5.3 儲存交易紀錄之後

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2002': (19.08, -0.07, 6735000)}`。
3. 開啟 `https://local.taigu.tw/market`。
4. 開啟 Chrome DevTools 的 Network 面板。
5. 點選側邊欄的「新增」。
6. 在「股票」欄位輸入 `2002`。
7. 點選搜尋結果裡的「中鋼」。
8. 在「成交單價」輸入 `20`。
9. 在「成交股數」輸入 `1000`。
10. 點選「送出」。

預期：送出之後，Network 面板馬上出現網址包含 `current-stock-info?sids=2002` 的 request，「持股」分頁的 2002 顯示價格「19.08」，不是「--」。

## HOLD-R6.1 桌面瀏覽器上的持股

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 120, 300, 0), ('2024-02-01', '2330', 120, 200, 0)]`。用兩筆交易紀錄，是因為交易紀錄少於 2 筆時年化報酬率固定是 0%（roadmap.md 記錄的已知問題）。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (600, 6, 25000000)}`。
3. 開啟 `https://local.taigu.tw/market`。

預期：2330 的卡片顯示「台積電」「2330」、價格「600」、漲跌與漲跌幅「▲ 6.00 1.01%」、「庫存」「500 股」、「平均成本」「$120.00」、2330 的年化報酬率（卡片上目前標示為「報酬率」）與「成交量 2.5 萬張」。

## HOLD-R6.2 還沒有價格的持股

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 500, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (0, 0, 0)}`。
3. 開啟 `https://local.taigu.tw/market`。

預期：2330 的價格顯示「--」。

## HOLD-R6.3 點選持股

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 500, 0)]`。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選 2330 的卡片。

預期：畫面換到 2330 的個股詳情頁，網址是 `https://local.taigu.tw/market/holding/2330`。

## HOLD-R7.1 有漲有跌也有平盤

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 1000, 0), ('2024-01-02', '2002', 30, 1000, 0), ('2024-01-02', '2317', 100, 1000, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (600, 5, 25000000), '2002': (19.08, -0.1, 6735000), '2317': (252, 0, 16487000)}`。
3. 開啟 `https://local.taigu.tw/market`。

預期：「持股檔數」是 3，「今日上漲」是 1，「今日下跌」是 1。

## HOLD-R7.2 搜尋時與還沒有價格的持股

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 1000, 0), ('2024-01-02', '2002', 30, 1000, 0), ('2024-01-02', '2317', 100, 1000, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (600, 5, 25000000), '2002': (19.08, -0.1, 6735000), '2317': (0, 0, 0)}`。
3. 開啟 `https://local.taigu.tw/market`。
4. 在搜尋框輸入 `2330`。

預期：列表只列出 2330，「持股檔數」仍然是 3，「今日上漲」是 1，「今日下跌」是 1。

## HOLD-R8.1 所有股票都已賣出

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 1000, 0), ('2024-02-01', '2330', 110, -1000, 0)]`。
2. 開啟 `https://local.taigu.tw/market`。

預期：畫面顯示「還沒有持股」「新增第一筆交易紀錄後，這裡會自動整理你的庫存、成本與報酬率。」與「新增交易紀錄」「查看交易紀錄」兩個按鈕。

## HOLD-R8.2 點選「新增交易紀錄」

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[]`。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「新增交易紀錄」。

預期：畫面換到新增交易紀錄的編輯器，網址是 `https://local.taigu.tw/records/trade/new`。

## HOLD-R8.3 點選「查看交易紀錄」

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[]`。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「查看交易紀錄」。

預期：畫面換到歷史紀錄頁，網址是 `https://local.taigu.tw/records`。

## HOLD-R9.1 兩檔持股

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 500, 0), ('2024-01-02', '0050', 90, 1000, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (600, 6, 25000000), '0050': (100, 1, 34942000)}`。
3. 開啟 `https://local.taigu.tw/`。

預期：「目前市值」是「$400,000」，圓餅圖有兩個區塊，較大的區塊占整圈的四分之三，較小的區塊占四分之一。

## HOLD-R9.2 持股都還沒有價格

前端沒有自動化 test。

1. 執行「設定交易紀錄」，`RECORDS` 設成 `[('2024-01-02', '2330', 100, 500, 0)]`。
2. 執行「設定價格」，`PRICES` 設成 `{'2330': (0, 0, 0)}`。
3. 開啟 `https://local.taigu.tw/`。

預期：「目前市值」是「$0」，「投資組合」卡片裡沒有圓餅圖。
