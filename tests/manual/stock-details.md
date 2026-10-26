每段檢查開始前，先完成以下準備。這些檢查不會刪除或改掉使用者原本就有的交易紀錄、現金股利紀錄、買賣計畫與個股筆記：需要這些資料的段落都用使用者沒有任何資料的測試股票，並在段落最後刪除段落自己新增的資料；改到的行情與公司資料，在全部檢查完後從備份還原。

1. 如果服務還沒啟動，執行 `make start`。下一步停掉 scheduler 之後，全部檢查完之前不要再執行 `make start`，因為它會把 scheduler 重新啟動。
2. 執行 `docker compose -f compose.dev.yaml stop scheduler`，讓 scheduler 不會在檢查途中改掉用 Django shell 準備的行情與重大消息。
3. 用試用期或 Standard 方案的 Google 帳號登入 `https://local.taigu.tw`。這種帳號從其他頁面進入個股詳情頁時，個股詳情頁每 30 秒重新抓一次行情；直接用網址開啟個股詳情頁時，間隔是 600 秒（這是 roadmap.md 記錄的已知問題）。下文指令裡的 `<email>` 都換成這個 Google 帳號的 email。
4. 執行以下指令，確認登入的帳號沒有測試股票 1101（台泥）、1102（亞泥）、1216（統一）的任何資料：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.account.models import User
   from main.cash_dividend.models import CashDividendRecord
   from main.stock_memo.models import StockMemo
   from main.trade_plan.models import TradePlan
   from main.trade_record.models import TradeRecord
   user = User.objects.get(email='<email>')
   for sid in ['1101', '1102', '1216']:
       print(sid, [model.objects.filter(owner=user, company_id=sid).count() for model in (TradeRecord, CashDividendRecord, TradePlan, StockMemo)])
   "
   ```

5. 如果某檔測試股票印出的數字不全是 0，換一檔印出全是 0 的股票，並把下文所有段落裡的那個股票代號一起換掉。
6. 執行以下指令，把 2330 與三檔測試股票的行情，以及 2330 的主要經營業務備份到 `api-server` container 的 `/tmp/stock_details_backup.json`（全部檢查完之前不要重建 `api-server` container）：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   import json
   from main.market.models import Company, StockInfo
   backup = {'stock_info': list(StockInfo.objects.filter(company_id__in=['2330', '1101', '1102', '1216']).values('company_id', 'close_price', 'fluct_price', 'quantity')), 'business_2330': Company.objects.get(pk='2330').business}
   json.dump(backup, open('/tmp/stock_details_backup.json', 'w'), ensure_ascii=False)
   "
   ```

7. 執行以下指令，確認股票清單上有環球晶（6488）而且有行情；STOCK-R9、R10、R12、R13 都用這檔股票。指令印出 `True True` 才繼續，否則先在交易日的盤中啟動 scheduler，讓後端的 cron job 抓到 6488 的行情，或換一檔股票清單上有行情的上櫃股票，並把下文段落裡的 6488 一起換掉：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.market.models import Company, StockInfo
   print(Company.objects.filter(pk='6488', trade_type='otc').exists(), StockInfo.objects.filter(company_id='6488').exists())
   "
   ```

8. 段落寫「在行動裝置上」的步驟，用 Chrome DevTools 的裝置模擬（例如 iPhone 14 Pro）開啟頁面後重新整理；其他步驟用桌面瀏覽器（Chrome）。
9. 全部檢查完後，執行以下指令還原行情與 2330 的主要經營業務：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   import json
   from main.market.models import Company, StockInfo
   backup = json.load(open('/tmp/stock_details_backup.json'))
   for row in backup['stock_info']:
       StockInfo.objects.filter(company_id=row['company_id']).update(close_price=row['close_price'], fluct_price=row['fluct_price'], quantity=row['quantity'])
   Company.objects.filter(pk='2330').update(business=backup['business_2330'])
   "
   ```

10. 還原後執行 `docker compose -f compose.dev.yaml start scheduler`。

## STOCK-R1.1 三種網址

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/market/2330`。
2. 開啟 `https://local.taigu.tw/market/holding/2330`。
3. 開啟 `https://local.taigu.tw/market/favorites/2330`。

預期：三個網址都顯示台積電（2330）的個股詳情頁，內容相同。

## STOCK-R2.1 價格高於昨收價

前端沒有自動化 test。

1. 執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import StockInfo; StockInfo.objects.filter(company_id='2330').update(close_price=23.45, fluct_price=0.45, quantity=1235000)"
   ```

2. 開啟 `https://local.taigu.tw/market/2330`。

預期：頁面開頭顯示「台積電」「2330」、價格「$23.45」、「▲0.45 (1.96%)」與「成交 1,235 張」。

## STOCK-R2.2 價格低於昨收價

前端沒有自動化 test。

1. 執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import StockInfo; StockInfo.objects.filter(company_id='2330').update(close_price=23.45, fluct_price=-0.45)"
   ```

2. 開啟 `https://local.taigu.tw/market/2330`。

預期：頁面開頭顯示價格「$23.45」與「▼0.45 (1.88%)」。

## STOCK-R3.1 自動更新失敗

前端沒有自動化 test。

1. 執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import StockInfo; StockInfo.objects.filter(company_id='2330').update(close_price=23.45, fluct_price=0.45)"
   ```

2. 開啟 `https://local.taigu.tw`。
3. 點選左側選單的「搜尋」。
4. 輸入「2330」。
5. 點選搜尋結果裡的台積電。
6. 確認價格是「$23.45」。
7. 在 Chrome DevTools 的「Network request blocking」面板加入 `*current-stock-info*`。
8. 勾選「Enable network request blocking」。
9. 等待 30 秒。

預期：頁面上方顯示「資料暫時無法更新，畫面顯示的是最近一次取得的資訊。」與重試按鈕，價格仍是「$23.45」。

## STOCK-R3.2 重試成功

前端沒有自動化 test。

1. 照 STOCK-R3.1 的步驟，讓頁面上方顯示更新失敗的提示。
2. 執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import StockInfo; StockInfo.objects.filter(company_id='2330').update(close_price=23.55, fluct_price=0.55)"
   ```

3. 在「Network request blocking」面板取消勾選「Enable network request blocking」。
4. 在下一次自動更新之前（30 秒內），點選重試按鈕。

預期：提示消失，價格換成「$23.55」。

## STOCK-R3.3 之後的自動更新成功

前端沒有自動化 test。

1. 照 STOCK-R3.1 的步驟，讓頁面上方顯示更新失敗的提示。
2. 執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import StockInfo; StockInfo.objects.filter(company_id='2330').update(close_price=23.55, fluct_price=0.55)"
   ```

3. 在「Network request blocking」面板取消勾選「Enable network request blocking」。
4. 不點選重試按鈕，等待 30 秒。

預期：提示消失，價格換成「$23.55」。

## STOCK-R3.4 重試仍然失敗

前端沒有自動化 test。

1. 照 STOCK-R3.1 的步驟，讓頁面上方顯示更新失敗的提示，「Network request blocking」維持啟用。
2. 點選重試按鈕。
3. 在「Network request blocking」面板取消勾選「Enable network request blocking」。

預期：第 2 步之後提示仍然顯示，價格仍是「$23.45」。

## STOCK-R4.1 非交易日

前端沒有自動化 test。

1. 執行以下指令，印出一檔有行情、但沒有任何盤中走勢的股票：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import Company; print(Company.objects.filter(stock_prices_per_minute__isnull=True, stock_info__isnull=False).values_list('pk', 'name').first())"
   ```

2. 把下面指令裡的 `<股票代號>` 換成步驟 1 印出的股票代號，執行指令，讓這檔股票的盤中走勢是昨天的點：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.market.cache import TimeSeriesStockInfoCacheManager
   from main.market.models import StockPricePerMinute
   for number, price in [(5, 23.2), (135, 23.1), (270, 23.3)]:
       StockPricePerMinute.objects.create(company_id='<股票代號>', date=timezone.localdate() - timedelta(days=1), number=number, price=price, fluct_price=round(price - 23.0, 2))
   TimeSeriesStockInfoCacheManager.delete('<股票代號>')
   "
   ```

3. 開啟 `https://local.taigu.tw/market/<股票代號>`。
4. 如果走勢圖沒有選「今日」，點選「今日」。
5. 檢查完把下面指令裡的 `<股票代號>` 換成同一個股票代號，執行指令，刪除步驟 2 新增的盤中走勢：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.market.cache import TimeSeriesStockInfoCacheManager
   from main.market.models import StockPricePerMinute
   StockPricePerMinute.objects.filter(company_id='<股票代號>').delete()
   TimeSeriesStockInfoCacheManager.delete('<股票代號>')
   "
   ```

預期：步驟 4 之後畫面顯示昨天的日期與星期，格式像「2026/10/23 (五)」，走勢圖畫出昨天 09:05 到 13:30 的盤中走勢。

## STOCK-R4.2 交易日開盤前

前端沒有自動化 test。

1. 在交易日 09:00 之前，照 STOCK-R4.1 的步驟 1 到步驟 4，替一檔沒有盤中走勢的股票準備上一個交易日（昨天）的盤中走勢，並開啟它的個股詳情頁。
2. 確認走勢圖的內容。
3. 照 STOCK-R4.1 的步驟 5 刪除準備的盤中走勢。

預期：步驟 2 的畫面顯示昨天的日期與星期，走勢圖畫出昨天 09:05 到 13:30 的盤中走勢。

## STOCK-R4.3 沒有盤中走勢

前端沒有自動化 test。

1. 照 STOCK-R4.1 的步驟 1，印出一檔沒有任何盤中走勢的股票。
2. 開啟 `https://local.taigu.tw/market/<步驟 1 印出的股票代號>`。
3. 如果走勢圖沒有選「今日」，點選「今日」。

預期：走勢圖的位置顯示「盤中尚未有成交資料」與「開盤後會顯示今日走勢。」。

## STOCK-R5.1 交易時段內

前端沒有自動化 test。

1. 在交易日 09:00 之後，執行以下指令，印出 2330 保留下來的最早一天的日期與收盤價，以及 2330 現在的價格：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.market import Frequency
   from main.market.models import History, StockInfo
   print(History.objects.filter(company_id='2330', frequency=Frequency.DAILY).order_by('date').values_list('date', 'close_price').first(), StockInfo.objects.filter(company_id='2330').values_list('close_price', flat=True).first())
   "
   ```

2. 開啟 `https://local.taigu.tw/market/2330`。
3. 點選「歷史」。
4. 把游標移到歷史走勢圖的最左邊。
5. 把游標移到歷史走勢圖的最右邊。

預期：最左邊那一點的日期與收盤價是步驟 1 印出的最早一天；最右邊那一點的日期是今天的「月/日」，收盤價是步驟 1 印出的現在價格。

## STOCK-R6.1 持股

前端沒有自動化 test。

1. 在 `https://local.taigu.tw/records` 新增一筆 1101 的交易紀錄：買進、成交價 500、1,000 股。
2. 執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import StockInfo; StockInfo.objects.filter(company_id='1101').update(close_price=600, fluct_price=0)"
   ```

3. 開啟 `https://local.taigu.tw/market/1101`。
4. 確認「投資摘要」的內容。
5. 在 `https://local.taigu.tw/records` 刪除步驟 1 新增的 1101 交易紀錄。

預期：步驟 4 的「現金投入」是「$500,000」，「證券市值」是「$600,000」，「庫存」是「1,000 股」，「平均成本」是「$500.00」，「實現損益」是「$0」。

## STOCK-R6.2 不是持股

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/market/1102`。

預期：「投資摘要」的「現金投入」「證券市值」「實現損益」都是「$0」，「庫存」是「0 股」，「平均成本」是「-」。

## STOCK-R7.1 持股

前端沒有自動化 test。

1. 在 `https://local.taigu.tw/records` 新增一筆 1216 的交易紀錄：買進、成交價 500、1,000 股。
2. 新增一筆 1216 的交易紀錄：買進、成交價 550、500 股。
3. 開啟 `https://local.taigu.tw/market/1216`。
4. 把游標移到「庫存分佈」最左邊有高度的長條上。
5. 把游標移到「庫存分佈」最右邊有高度的長條上。
6. 在 `https://local.taigu.tw/records` 刪除步驟 1 與步驟 2 新增的兩筆 1216 交易紀錄。

預期：最左邊有高度的長條是 500 元附近的區間、數量 1,000 股，最右邊有高度的長條是 550 元附近的區間、數量 500 股。

## STOCK-R8.1 查看交易紀錄

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/market/2330`。
2. 點選「紀錄與計畫」區塊的「查看交易紀錄」。

預期：畫面換到網址為 `/records?sid=2330` 的歷史紀錄頁。

## STOCK-R8.2 查看買賣計畫

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/market/2330`。
2. 點選「紀錄與計畫」區塊的「查看買賣計畫」。

預期：畫面換到網址為 `/plans?sid=2330` 的買賣計畫頁。

## STOCK-R9.1 有 5 則重大消息

前端沒有自動化 test。

1. 執行以下指令，印出一檔有主要經營業務、但沒有任何重大消息的股票：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import Company; print(Company.objects.filter(material_facts__isnull=True, stock_info__isnull=False).exclude(business='').values_list('pk', 'name').first())"
   ```

2. 把下面指令裡的 `<股票代號>` 換成步驟 1 印出的股票代號，執行指令，替這檔股票準備 1 到 5 天前 14:30 各 1 則重大消息，標題的數字是幾天前：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import datetime, time, timedelta, timezone
   from main.market.models import MaterialFact
   taipei = timezone(timedelta(hours=8))
   today = datetime.now(taipei).date()
   for days_ago in range(1, 6):
       MaterialFact.objects.create(company_id='<股票代號>', date_time=datetime.combine(today - timedelta(days=days_ago), time(14, 30), tzinfo=taipei), title=f'測試重大消息 {days_ago}', description='第一行說明\n第二行說明')
   "
   ```

3. 開啟 `https://local.taigu.tw/market/<股票代號>`。
4. 確認「公司與重大消息」區塊的內容。
5. 把下面指令裡的 `<股票代號>` 換成同一個股票代號，執行指令，刪除步驟 2 新增的重大消息：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import MaterialFact; MaterialFact.objects.filter(company_id='<股票代號>', title__startswith='測試重大消息').delete()"
   ```

預期：步驟 4 的「公司與重大消息」區塊顯示這家公司的主要經營業務，下面由上到下列出「測試重大消息 1」「測試重大消息 2」「測試重大消息 3」。

## STOCK-R9.2 沒有重大消息

前端沒有自動化 test。

1. 照 STOCK-R9.1 的步驟 1，印出一檔沒有任何重大消息的股票。
2. 開啟 `https://local.taigu.tw/market/<步驟 1 印出的股票代號>`。

預期：「公司與重大消息」區塊顯示「目前沒有重大消息」。

## STOCK-R10.1 開啟公司資訊

前端沒有自動化 test。

1. 照 STOCK-R9.1 的步驟 1 到步驟 3，替一檔沒有重大消息的股票準備 5 則重大消息，並開啟它的個股詳情頁。
2. 點選「公司與重大消息」區塊的「完整資料」。
3. 確認公司資訊的內容。
4. 照 STOCK-R9.1 的步驟 5 刪除準備的重大消息。

預期：步驟 3 的公司資訊，「證券代號」是這檔股票的股票代號，「公司簡稱」是它的公司名稱，「主要經營業務」是它的主要經營業務，下面由上到下列出「測試重大消息 1」到「測試重大消息 5」的標題與日期。

## STOCK-R10.2 查看一則重大消息

前端沒有自動化 test。

1. 照 STOCK-R9.1 的步驟 1 到步驟 3，替一檔沒有重大消息的股票準備 5 則重大消息，並開啟它的個股詳情頁。
2. 點選「公司與重大消息」區塊裡的「測試重大消息 1」。
3. 確認公司資訊的內容。
4. 照 STOCK-R9.1 的步驟 5 刪除準備的重大消息。

預期：步驟 2 之後畫面開啟公司資訊，步驟 3 確認的內容是「測試重大消息 1」、昨天的「年-月-日 14:30:00」，以及分成兩行的「第一行說明」與「第二行說明」。

## STOCK-R11.1 取不到主要經營業務

後端存下空白主要經營業務的部分由 test 驗證，畫面的部分前端沒有自動化 test。

1. 執行以下指令，讓台積電的主要經營業務變成空的，模擬取不到主要經營業務的結果（原本的內容已在準備步驟 6 備份）：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import Company; Company.objects.filter(pk='2330').update(business='')"
   ```

2. 開啟 `https://local.taigu.tw/market/2330`。
3. 確認「公司與重大消息」區塊的內容。
4. 執行以下指令，從備份還原台積電的主要經營業務：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "import json; from main.market.models import Company; Company.objects.filter(pk='2330').update(business=json.load(open('/tmp/stock_details_backup.json'))['business_2330'])"
   ```

預期：步驟 3 的「公司與重大消息」區塊顯示「目前沒有公司業務摘要。」。

## STOCK-R12.1 公司發布新的重大消息

現有的 test 沒有驗證後端會存下抓到的重大消息。這個檢查用一份只有測試資料的假公開資料，不會新增或修改原本存的重大消息；不過每次抓取完，後端都會刪除發布時間超過約 29 天 16 小時的重大消息，這些重大消息本來就會在 scheduler 下一次抓取時被刪除。

1. 執行以下指令。指令讓後端抓到的證交所資料是空的、櫃買中心資料只有一則環球晶（6488）今天 00:01:23 發布的「測試重大消息」，抓取一次後印出存下的測試重大消息：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from unittest.mock import Mock, patch
   from django.utils import timezone
   from main.market import ThirdPartyApi, TradeType, services
   from main.market.models import MaterialFact
   today = timezone.localdate()
   rows = [{'SecuritiesCompanyCode': '6488', '發言日期': f'{today.year - 1911:03d}{today.month:02d}{today.day:02d}', '發言時間': '000123', '主旨': '測試重大消息', '說明': '測試說明'}]
   def fake_get(url, *args, **kwargs):
       return Mock(json=Mock(return_value=rows if url == ThirdPartyApi.material_fact[TradeType.OTC] else []))
   with patch.object(services.requests, 'get', fake_get):
       services.update_material_facts()
   print(list(MaterialFact.objects.filter(company_id='6488', title__startswith='測試重大消息').values_list('title', flat=True)))
   "
   ```

2. 開啟 `https://local.taigu.tw/market/6488`。
3. 點選「完整資料」。
4. 確認公司資訊的內容。
5. 執行以下指令，刪除這個段落存下的測試重大消息：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import MaterialFact; MaterialFact.objects.filter(company_id='6488', title__startswith='測試重大消息').delete()"
   ```

預期：步驟 1 印出 `['測試重大消息']`，步驟 4 的公司資訊列出「測試重大消息」。

## STOCK-R12.2 再次抓到同一則重大消息

現有的 test 沒有驗證重複抓到的重大消息只存一則。這個檢查用一份只有測試資料的假公開資料，不會新增或修改原本存的重大消息；不過每次抓取完，後端都會刪除發布時間超過約 29 天 16 小時的重大消息，這些重大消息本來就會在 scheduler 下一次抓取時被刪除。

1. 執行以下指令。指令讓後端連續抓取兩次，兩次的櫃買中心資料都只有環球晶（6488）今天 00:01:23 發布的同一則重大消息，第二次的標題改成「測試重大消息（修改後）」，抓完後印出存下的測試重大消息：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from unittest.mock import Mock, patch
   from django.utils import timezone
   from main.market import ThirdPartyApi, TradeType, services
   from main.market.models import MaterialFact
   today = timezone.localdate()
   for title in ['測試重大消息（修改前）', '測試重大消息（修改後）']:
       rows = [{'SecuritiesCompanyCode': '6488', '發言日期': f'{today.year - 1911:03d}{today.month:02d}{today.day:02d}', '發言時間': '000123', '主旨': title, '說明': '測試說明'}]
       def fake_get(url, *args, **kwargs):
           return Mock(json=Mock(return_value=rows if url == ThirdPartyApi.material_fact[TradeType.OTC] else []))
       with patch.object(services.requests, 'get', fake_get):
           services.update_material_facts()
   print(list(MaterialFact.objects.filter(company_id='6488', title__startswith='測試重大消息').values_list('title', flat=True)))
   "
   ```

2. 開啟 `https://local.taigu.tw/market/6488`。
3. 點選「完整資料」。
4. 確認公司資訊的內容。
5. 照 STOCK-R12.1 的步驟 5 刪除測試重大消息。

預期：步驟 1 只印出 `['測試重大消息（修改後）']`，步驟 4 的公司資訊只列出一次這則重大消息，標題是「測試重大消息（修改後）」。

## STOCK-R12.3 證交所的資料抓取失敗

現有的 test 沒有驗證一個市場抓取失敗時，另一個市場照常存入。這個檢查用一份只有測試資料的假公開資料，不會新增或修改原本存的重大消息；不過每次抓取完，後端都會刪除發布時間超過約 29 天 16 小時的重大消息，這些重大消息本來就會在 scheduler 下一次抓取時被刪除。

1. 執行以下指令。指令讓後端抓證交所資料時連線失敗、櫃買中心資料只有一則環球晶（6488）的「測試重大消息」，抓取一次後印出存下的測試重大消息：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from unittest.mock import Mock, patch
   import requests
   from django.utils import timezone
   from main.market import ThirdPartyApi, TradeType, services
   from main.market.models import MaterialFact
   today = timezone.localdate()
   rows = [{'SecuritiesCompanyCode': '6488', '發言日期': f'{today.year - 1911:03d}{today.month:02d}{today.day:02d}', '發言時間': '000123', '主旨': '測試重大消息', '說明': '測試說明'}]
   def fake_get(url, *args, **kwargs):
       if url == ThirdPartyApi.material_fact[TradeType.TSE]:
           raise requests.ConnectionError('TSE is down')
       return Mock(json=Mock(return_value=rows))
   with patch.object(services.requests, 'get', fake_get):
       services.update_material_facts()
   print(list(MaterialFact.objects.filter(company_id='6488', title__startswith='測試重大消息').values_list('title', flat=True)))
   "
   ```

2. 照 STOCK-R12.1 的步驟 5 刪除測試重大消息。

預期：步驟 1 印出 `['測試重大消息']`。

## STOCK-R13.1 超過 30 天

現有的 test 沒有驗證重大消息的保留期間。這一節第 2 步讓後端真的向證交所與櫃買中心抓一次重大消息，所以需要連上網路，而且會像 scheduler 每小時的抓取一樣，存下當天的重大消息，也可能把新公司加進股票清單。

1. 執行以下指令，替環球晶（6488）新增 31 天前與 29 天前各 1 則測試用的重大消息：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.market.models import MaterialFact
   now = timezone.now()
   MaterialFact.objects.create(company_id='6488', date_time=now - timedelta(days=31), title='31 天前的重大消息', description='')
   MaterialFact.objects.create(company_id='6488', date_time=now - timedelta(days=29), title='29 天前的重大消息', description='')
   "
   ```

2. 執行 `docker compose -f compose.dev.yaml exec 後端 python manage.py update_material_facts`。
3. 開啟 `https://local.taigu.tw/market/6488`。
4. 點選「完整資料」。
5. 確認公司資訊的內容。
6. 執行以下指令，刪除步驟 1 新增、還留著的測試重大消息：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import MaterialFact; MaterialFact.objects.filter(company_id='6488', title__in=['31 天前的重大消息', '29 天前的重大消息']).delete()"
   ```

預期：步驟 5 的公司資訊沒有列出「31 天前的重大消息」。

## STOCK-R13.2 29 天以內

現有的 test 沒有驗證重大消息的保留期間。

1. 照 STOCK-R13.1 的步驟 1 到步驟 4，新增測試重大消息、抓取一次並開啟環球晶的公司資訊。
2. 確認公司資訊的內容。
3. 照 STOCK-R13.1 的步驟 6 刪除還留著的測試重大消息。

預期：步驟 2 的公司資訊仍列出「29 天前的重大消息」。

## STOCK-R14.1 新增個股筆記

後端存下個股筆記的部分由 test 驗證，畫面與去掉空白的部分在前端，前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/market/1102`。
2. 點選頁面上方的「編輯備註」圖示。
3. 輸入兩個空白、「等法說會」與兩個空白。
4. 點選儲存按鈕。
5. 執行以下指令，印出後端存下的 1102 個股筆記：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.stock_memo.models import StockMemo; print(repr(StockMemo.objects.get(owner__email='<email>', company_id='1102').note))"
   ```

6. 執行以下指令，刪除這個段落新增的 1102 個股筆記：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.stock_memo.models import StockMemo; StockMemo.objects.filter(owner__email='<email>', company_id='1102').delete()"
   ```

預期：步驟 4 之後畫面跳出「備註已更新」的提示，編輯器關閉；步驟 5 印出 `'等法說會'`，前後沒有空白。

## STOCK-R14.2 修改個股筆記

前端沒有自動化 test，也沒有 test 驗證後端修改既有的個股筆記。

1. 照 STOCK-R14.1 的步驟 1 到步驟 4，把 1102 的個股筆記存成「等法說會」。
2. 點選頁面上方的「編輯備註」圖示。
3. 確認文字框顯示「等法說會」。
4. 把文字框的內容改成「法說會後再加碼」。
5. 點選儲存按鈕。
6. 再次點選頁面上方的「編輯備註」圖示。
7. 照 STOCK-R14.1 的步驟 6 刪除這個段落新增的 1102 個股筆記。

預期：步驟 5 之後畫面跳出「備註已更新」的提示，編輯器關閉；步驟 6 的文字框顯示「法說會後再加碼」。

## STOCK-R14.3 清空個股筆記

前端沒有自動化 test。

1. 照 STOCK-R14.1 的步驟 1 到步驟 4，把 1102 的個股筆記存成「等法說會」。
2. 點選頁面上方的「編輯備註」圖示。
3. 刪除文字框裡的全部文字。
4. 點選儲存按鈕。
5. 再次點選頁面上方的「編輯備註」圖示。
6. 照 STOCK-R14.1 的步驟 6 刪除這個段落新增的 1102 個股筆記。

預期：步驟 4 之後畫面跳出「備註已更新」的提示；步驟 5 的文字框是空的，並顯示「還沒有備註，可以記下你的觀察或交易想法。」。

## STOCK-R15.1 儲存失敗

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/market/1102`。
2. 點選頁面上方的「編輯備註」圖示。
3. 在文字框輸入「等法說會」。
4. 在 Chrome DevTools 的「Network request blocking」面板加入 `*stock-memo/1102*`。
5. 勾選「Enable network request blocking」。
6. 點選儲存按鈕。
7. 如果開發環境的 dev server 在畫面上蓋了一層「Uncaught runtime errors」的錯誤說明，點選它右上角的 ✕ 關閉（這層錯誤說明只在開發環境出現，不是要檢查的畫面）。
8. 確認畫面的內容。
9. 取消勾選「Enable network request blocking」。

預期：步驟 8 的畫面跳出過錯誤提示，編輯器保持開啟，文字框仍是「等法說會」。

## STOCK-R16.1 換到下一檔

前端沒有自動化 test。

1. 在 `https://local.taigu.tw/records` 替 1101、1102、1216 各新增一筆交易紀錄：買進、成交價 100、1,000 股。
2. 執行以下指令，讓這三檔股票的市值依序是 9,000,000、8,000,000 與 7,000,000 元，排在「持股」分頁的前面：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.market.models import StockInfo
   for sid, price in [('1101', 9000), ('1102', 8000), ('1216', 7000)]:
       StockInfo.objects.filter(company_id=sid).update(close_price=price, fluct_price=0)
   "
   ```

3. 在行動裝置上開啟 `https://local.taigu.tw/market`。
4. 點選「持股」分頁。
5. 確認列表依市值排序，台泥（1101）的下一檔是亞泥（1102）。
6. 點選台泥。
7. 在頁面上向左滑動 100px 後放開。
8. 確認畫面的網址。
9. 在 `https://local.taigu.tw/records` 刪除步驟 1 新增的三筆交易紀錄。

預期：步驟 8 的畫面是網址為 `/market/holding/1102` 的亞泥個股詳情頁。

## STOCK-R16.2 已經是最後一檔

前端沒有自動化 test。

1. 照 STOCK-R16.1 的步驟 1 到步驟 4，準備持股並在行動裝置上開啟「持股」分頁。
2. 點選列表的最後一檔股票。
3. 在頁面上向左滑動 100px 後放開。
4. 確認畫面的內容與網址。
5. 在 `https://local.taigu.tw/records` 刪除步驟 1 新增的三筆交易紀錄。

預期：步驟 4 的畫面仍是步驟 2 點選的那檔股票的個股詳情頁，網址沒有改變。

## STOCK-R16.3 切換後返回

前端沒有自動化 test。

1. 照 STOCK-R16.1 的步驟 1 到步驟 7，從「持股」分頁開啟台泥並切換到亞泥。
2. 點選左上角的返回按鈕。
3. 確認畫面的內容。
4. 在 `https://local.taigu.tw/records` 刪除步驟 1 新增的三筆交易紀錄。

預期：步驟 3 的畫面是市場頁的「持股」分頁。
