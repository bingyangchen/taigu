本文件的檢查都在開發環境執行，要用只拿來測試的 Google 帳號登入，因為第 8、9 步的指令會改掉這個帳號的方案。寫入行情資料的檢查只改動測試股（代號 T01 到 T12）的資料，以及先備份、檢查完再還原的大盤指數與收盤價資料。開始之前先完成下面的準備：

1. 執行 `make start`。
2. 如果要檢查 MKT-R1.1，先做完那一段再繼續，因為那一段需要 scheduler 寫入真實的行情。
3. 執行 `docker compose -f compose.dev.yaml stop scheduler`，讓 scheduler 在檢查期間不會改動行情資料。
4. 執行下面的指令，把大盤指數的盤中走勢、收盤指數與股票收盤價備份到本機的 `/tmp/taigu-market-backup.json`。後面有些段落會改動或刪除這些資料，全部檢查完照第 12 步還原。

   ```bash
   docker compose -f compose.dev.yaml exec -T api-server python manage.py dumpdata market.MarketIndexPerMinute market.MarketIndexHistory market.History > /tmp/taigu-market-backup.json
   ```

5. 用 Google 帳號登入 `https://local.taigu.tw`。
6. 執行下面的指令準備股票。2330（台積電）、2317（鴻海）、2454（聯發科）只在股票清單上沒有時才建立，已經有的不會被改動；T01 到 T11 是測試股（名稱是「測試股01」到「測試股11」，scheduler 不會更新它們），每次執行都會把它們的價格重設成 10 元。T12 保留給 MKT-R10.1，這裡不建立。後面的段落寫「重設測試資料」時，就是再執行一次這個指令。

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date
   from main.market.models import Company, StockInfo
   for sid, name in [('2330', '台積電'), ('2317', '鴻海'), ('2454', '聯發科')]:
       company, _ = Company.objects.get_or_create(pk=sid, defaults={'name': name, 'trade_type': 'tse', 'business': ''})
       StockInfo.objects.get_or_create(company=company, defaults={'date': date.today(), 'quantity': 0, 'close_price': 100.0, 'fluct_price': 0.0})
   for i in range(1, 12):
       company, _ = Company.objects.get_or_create(pk=f'T{i:02d}', defaults={'name': f'測試股{i:02d}', 'trade_type': None, 'business': ''})
       StockInfo.objects.update_or_create(company=company, defaults={'date': date.today(), 'quantity': 0, 'close_price': 10.0, 'fluct_price': 0.0})
   "
   ```

7. 把下面指令裡的 `<email>` 換成登入用的 Google 帳號 email。
8. 要切換到 Standard 方案時，執行下面的指令再重新整理頁面：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.billing.models import BillingProfile
   BillingProfile.objects.filter(user__email='<email>').update(plan='standard', subscription_status='trialing', trial_started_at=timezone.now(), trial_ends_at=timezone.now() + timedelta(days=31), cancel_at_period_end=False)
   "
   ```

9. 要切換到 Free 方案時，執行下面的指令再重新整理頁面：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.billing.models import BillingProfile
   BillingProfile.objects.filter(user__email='<email>').update(plan='free', subscription_status='canceled', cancel_at_period_end=False)
   "
   ```

10. 段落裡寫「以窄版」「行動裝置」或「行動裝置模擬」時，在 Chrome DevTools 開啟 device toolbar（Toggle device toolbar），在 Dimensions 選「Responsive」並輸入 390 × 844，或選 iPhone 14 Pro 這類手機；寫出 1280 × 800 以外的可用畫面大小時，在 Responsive 輸入那個大小。寫「以寬版」或「桌面瀏覽器」時，用不開 device toolbar 的 Chrome 視窗，可用畫面是 1280 × 800，可以在 Console 執行 `[innerWidth, innerHeight]` 確認大小。前端依可用畫面的大小切換版面，不看 user agent，所以切換之後版面立刻跟著換，不用重新整理頁面。
11. 沒有特別寫方案的段落，都在 Standard 方案下檢查。
12. 全部檢查完之後，執行下面兩個指令，刪除檢查期間的大盤指數與收盤價資料，再從第 4 步的備份還原：

    ```bash
    docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
    from main.market.cache import TimeSeriesStockInfoCacheManager
    from main.market.models import History, MarketIndexHistory, MarketIndexPerMinute
    MarketIndexPerMinute.objects.all().delete()
    MarketIndexHistory.objects.all().delete()
    History.objects.all().delete()
    TimeSeriesStockInfoCacheManager.delete('tse')
    TimeSeriesStockInfoCacheManager.delete('otc')
    "
    ```

    ```bash
    docker compose -f compose.dev.yaml exec -T api-server python manage.py loaddata --format=json - < /tmp/taigu-market-backup.json
    ```

    還原之後，在瀏覽器的 DevTools Console 執行 `indexedDB.deleteDatabase('taigu')` 再重新整理頁面，因為瀏覽器存下了 MKT-R15.1 建立的假收盤指數，而且只會向後端要比存下的資料更新的日期。

13. 如果用測試股新增過紀錄、計畫、關注或筆記，先刪除那些資料，再執行下面的指令刪除測試股；為了 MKT-R12.1 加入關注的 2317 與 2454，如果原本不在關注清單上，也在個股詳情頁取消關注。

    ```bash
    docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
    from main.market.models import Company
    Company.objects.filter(pk__in=[f'T{i:02d}' for i in range(1, 13)]).delete()
    "
    ```

14. 執行 `docker compose -f compose.dev.yaml start scheduler`。

## MKT-R1.1 收盤前後的抓取

這個情境依賴 scheduler 的執行時間，沒有自動化 test。

1. 在週一到週五 13:55 到 13:56 之間，執行 `docker compose -f compose.dev.yaml start scheduler`。
2. 執行 `docker compose -f compose.dev.yaml logs -f scheduler`。
3. 觀察 log 到 14:02。

預期：`Running job "fetch_realtime_stock_info` 開頭的 log 出現在 13:57、13:58、13:59（看 `scheduled at` 的時間），14:00 與 14:01 沒有這類 log。

## MKT-R2.3 只有委買價時取漲停價

沒有 unit test 驗證這個情境。這一段以測試股 T01 代替 2330，指令把時間固定在 13:45，讓這次處理不寫入盤中走勢。

1. 執行下面的指令，讓後端處理一筆只有委買價 109.5 元、漲停價 110 元、昨收價 100 元的 T01 行情：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date
   from unittest.mock import Mock, patch
   from django.utils import timezone
   from main.market.models import StockInfo
   from main.market.services import fetch_and_store_realtime_stock_info
   row = {'c': 'T01', 'd': date.today().strftime('%Y%m%d'), 'v': '1000', 'y': '100', 'z': '-', 'a': '-', 'b': '109.5', 'u': '110', 'w': '90'}
   with patch('main.market.services.timezone.localtime', return_value=timezone.localtime().replace(hour=13, minute=45)), patch('main.market.services.Company.objects.filter') as company_filter, patch('main.market.services.requests.get') as get:
       company_filter.return_value.values.return_value = [{'pk': 'T01', 'trade_type': 'tse'}]
       get.return_value = Mock(json=Mock(return_value={'msgArray': [row]}))
       fetch_and_store_realtime_stock_info()
   info = StockInfo.objects.get(company_id='T01')
   print(info.close_price, info.fluct_price)
   "
   ```

2. 重設測試資料。

預期：第 1 步印出 `110.0 10.0`，也就是 T01 的價格記為 110 元，漲跌記為 10 元。

## MKT-R2.4 沒有成交也沒有委買委賣時取昨收價

沒有 unit test 驗證這個情境。這一段以測試股 T01 代替 2330。

1. 把 MKT-R2.3 第 1 步指令裡的 `row` 改成下面這一行再執行，讓後端處理一筆沒有成交價、委買價與委賣價，昨收價 100 元的 T01 行情：

   ```python
   row = {'c': 'T01', 'd': date.today().strftime('%Y%m%d'), 'v': '-', 'y': '100', 'z': '-', 'a': '-', 'b': '-', 'u': '110', 'w': '90'}
   ```

2. 重設測試資料。

預期：第 1 步印出 `100.0 0.0`，也就是 T01 的價格記為 100 元，漲跌記為 0 元。

## MKT-R3.1 證交所回報成交量

沒有 unit test 驗證成交量的換算。這一段以測試股 T01 代替 2330。

1. 把 MKT-R2.3 第 1 步指令裡的 `row` 改成下面這一行，並把最後一行改成 `print(info.quantity)` 再執行，讓後端處理一筆累計成交 25,000 張的 T01 行情：

   ```python
   row = {'c': 'T01', 'd': date.today().strftime('%Y%m%d'), 'v': '25000', 'y': '100', 'z': '102.5', 'a': '103.5', 'b': '102.5', 'u': '110', 'w': '90'}
   ```

2. 重設測試資料。

預期：第 1 步印出 `25000000`，也就是 T01 的成交量記為 25,000,000 股。

## MKT-R4.1 平日休市

既有的 unit test 驗證休市時不更新價格，但沒有驗證 15:00 不寫入收盤價。這一段以測試股 T01 代替 2330；這一段執行的 15:00 工作會替所有今天有行情的股票寫入收盤價、寫入今天的收盤指數，並刪除早於 365 天前的收盤價，全部檢查完照共用準備第 12 步還原。

1. 執行下面的指令，讓 T01 最後記下的是昨天的 102.5 元，再讓後端處理一筆資料日期是昨天的 T01 行情，最後執行 15:00 寫入收盤價的工作：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date, timedelta
   from unittest.mock import Mock, patch
   from main.market.models import History, StockInfo, StockPricePerMinute
   from main.market.services import fetch_and_store_realtime_stock_info, update_all_stocks_history
   today = date.today()
   yesterday = today - timedelta(days=1)
   StockInfo.objects.filter(company_id='T01').update(date=yesterday, close_price=102.5, fluct_price=2.5)
   History.objects.filter(company_id='T01', date=today).delete()
   points_before = StockPricePerMinute.objects.filter(company_id='T01').count()
   row = {'c': 'T01', 'd': yesterday.strftime('%Y%m%d'), 'v': '1000', 'y': '100', 'z': '105', 'a': '-', 'b': '-', 'u': '110', 'w': '90'}
   with patch('main.market.services.Company.objects.filter') as company_filter, patch('main.market.services.requests.get') as get:
       company_filter.return_value.values.return_value = [{'pk': 'T01', 'trade_type': 'tse'}]
       get.return_value = Mock(json=Mock(return_value={'msgArray': [row]}))
       fetch_and_store_realtime_stock_info()
   update_all_stocks_history()
   info = StockInfo.objects.get(company_id='T01')
   print(info.close_price, StockPricePerMinute.objects.filter(company_id='T01').count() - points_before, History.objects.filter(company_id='T01', date=today).count())
   "
   ```

2. 重設測試資料。

預期：第 1 步印出 `102.5 0 0`，也就是價格維持 102.5 元，盤中走勢沒有新增點，也沒有今天的收盤價。

## MKT-R6.2 收盤後抓到的價格

既有的 unit test 只驗證 13:45 不記錄與 14:00 算進 13:30 那一點，沒有驗證 13:59。這一段以測試股 T01 代替 2330。

1. 執行下面的指令，先讓 T01 今天的盤中走勢只有 13:30 一點 1,000 元，再讓後端在 13:45 處理成交價 1,003 元、在 13:59 處理成交價 1,005 元的 T01 行情，每次處理完印出點數與 13:30 那一點的價格：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date
   from unittest.mock import Mock, patch
   from django.utils import timezone
   from main.market.models import StockPricePerMinute
   from main.market.services import fetch_and_store_realtime_stock_info
   today = date.today()
   StockPricePerMinute.objects.filter(company_id='T01').delete()
   StockPricePerMinute.objects.create(company_id='T01', date=today, number=270, price=1000.0, fluct_price=0.0)
   def fetch_at(hour, minute, price):
       row = {'c': 'T01', 'd': today.strftime('%Y%m%d'), 'v': '25000', 'y': '1000', 'z': price, 'a': '-', 'b': '-', 'u': '1100', 'w': '900'}
       with patch('main.market.services.timezone.localtime', return_value=timezone.localtime().replace(hour=hour, minute=minute)), patch('main.market.services.Company.objects.filter') as company_filter, patch('main.market.services.requests.get') as get:
           company_filter.return_value.values.return_value = [{'pk': 'T01', 'trade_type': 'tse'}]
           get.return_value = Mock(json=Mock(return_value={'msgArray': [row]}))
           fetch_and_store_realtime_stock_info()
       points = StockPricePerMinute.objects.filter(company_id='T01', date=today)
       print(points.count(), points.get(number=270).price)
   fetch_at(13, 45, '1003')
   fetch_at(13, 59, '1005')
   "
   ```

2. 重設測試資料。

預期：第 1 步先印出 `1 1000.0`，再印出 `1 1005.0`，也就是 13:45 之後沒有新增點、13:30 那一點仍是 1,000 元，13:59 之後 13:30 那一點變成 1,005 元。

## MKT-R8.1 交易日寫入收盤價與收盤指數

既有的 unit test 只用一點驗證收盤指數，沒有驗證收盤指數取的是最後一點，也沒有驗證股票的收盤價與成交量。這一段以測試股 T01 代替 2330，並會改動大盤指數的資料，全部檢查完照共用準備第 12 步還原。

1. 執行下面的指令，讓 T01 今天的價格是 1,000 元、成交量是 25,000,000 股，讓加權指數今天有 09:00 的 14,900 點與 13:30 的 15,000 點兩點，再執行 15:00 寫入收盤價的工作：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date
   from main.market.models import History, MarketIndexHistory, MarketIndexPerMinute, StockInfo
   from main.market.services import update_all_stocks_history
   today = date.today()
   StockInfo.objects.filter(company_id='T01').update(date=today, close_price=1000.0, quantity=25000000)
   History.objects.filter(company_id='T01', date=today).delete()
   MarketIndexPerMinute.objects.filter(market='tse').delete()
   MarketIndexPerMinute.objects.create(market='tse', date=today, number=0, price=14900.0, fluct_price=-50.0)
   MarketIndexPerMinute.objects.create(market='tse', date=today, number=270, price=15000.0, fluct_price=50.0)
   MarketIndexHistory.objects.filter(market='tse', date=today).delete()
   update_all_stocks_history()
   row = History.objects.get(company_id='T01', frequency='DAILY', date=today)
   print(row.close_price, row.quantity, MarketIndexHistory.objects.get(market='tse', date=today).close_price)
   "
   ```

2. 重設測試資料。

預期：第 1 步印出 `1000.0 25000000 15000.0`，也就是收盤價是 1,000 元、成交量是 25,000,000 股，收盤指數是最後一點 13:30 的 15,000 點，不是 09:00 的 14,900 點。

## MKT-R10.1 收盤行情裡有清單上沒有的股票

既有的 unit test 用 mock 取代了加入股票的動作，沒有驗證股票真的加進清單，也沒有驗證新股票的價格。這一段以測試用的代號 T12（「測試股12」）代替 1101，並以 mock 取代向證交所查公司名稱的動作，避免刪除或改動真實股票的資料。

1. 執行下面的指令，讓後端更新股票清單，這時證交所的收盤行情只有 T12，櫃買中心的收盤行情是空的：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from unittest.mock import Mock, patch
   from main.market.models import Company, CompanyManager, StockInfo
   from main.market.services import update_company_list
   Company.objects.filter(pk='T12').delete()
   with patch.object(CompanyManager, 'fetch_company_info', return_value={'name': '測試股12', 'trade_type': 'tse', 'business': ''}), patch('main.market.services.requests.get', side_effect=[Mock(json=Mock(return_value=[{'Code': 'T12'}])), Mock(json=Mock(return_value=[]))]):
       update_company_list()
   company = Company.objects.get(pk='T12')
   info = StockInfo.objects.get(company=company)
   print(company.name, info.close_price, info.fluct_price)
   "
   ```

2. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
3. 點選左側選單的「搜尋」。
4. 輸入「T12」。
5. 執行下面的指令，讓後端處理一筆成交價 40 元的 T12 行情：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date
   from unittest.mock import Mock, patch
   from django.utils import timezone
   from main.market.models import StockInfo
   from main.market.services import fetch_and_store_realtime_stock_info
   row = {'c': 'T12', 'd': date.today().strftime('%Y%m%d'), 'v': '1000', 'y': '39.5', 'z': '40', 'a': '-', 'b': '-', 'u': '43.45', 'w': '35.55'}
   with patch('main.market.services.timezone.localtime', return_value=timezone.localtime().replace(hour=13, minute=45)), patch('main.market.services.Company.objects.filter') as company_filter, patch('main.market.services.requests.get') as get:
       company_filter.return_value.values.return_value = [{'pk': 'T12', 'trade_type': 'tse'}]
       get.return_value = Mock(json=Mock(return_value={'msgArray': [row]}))
       fetch_and_store_realtime_stock_info()
   print(StockInfo.objects.get(company_id='T12').close_price)
   "
   ```

預期：第 1 步印出 `測試股12 0.0 0.0`；第 4 步列出「測試股12」，價格是 0 元，漲跌顯示「-」；第 5 步印出 `40.0`。

## MKT-R11.1 Standard 方案

後端回傳的間隔有 unit test，前端依間隔重新抓行情的部分沒有自動化 test。

1. 切換到 Standard 方案。
2. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
3. 開啟 DevTools 的 Network 面板，在篩選欄輸入 `market`。
4. 重新整理頁面。
5. 停留在儀表板 2 分鐘。

預期：開啟時出現一組 `current-stock-info` 與 `market-index` 的 request，之後每隔約 30 秒再出現一組。

## MKT-R11.2 Free 方案

後端回傳的間隔有 unit test，前端依間隔重新抓行情的部分沒有自動化 test。

1. 切換到 Free 方案。
2. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
3. 開啟 DevTools 的 Network 面板，在篩選欄輸入 `market`。
4. 重新整理頁面。
5. 停留在儀表板 11 分鐘。
6. 切換回 Standard 方案。

預期：開啟時出現一組 `current-stock-info` 與 `market-index` 的 request，約 10 分鐘後再出現一組，這段時間沒有其他 `current-stock-info` 或 `market-index` 的 request。

## MKT-R11.3 停留在設定頁

前端沒有自動化 test。

1. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
2. 開啟 DevTools 的 Network 面板，在篩選欄輸入 `market`。
3. 點選左側選單最上方的頭像（「查看帳號與設定」）。
4. 停留在設定頁 1 分鐘。
5. 點選設定頁左上角的返回按鈕（「回首頁」）。

預期：在設定頁的 1 分鐘裡沒有新的 `current-stock-info` 或 `market-index` 的 request；回到儀表板時立刻出現一筆 `current-stock-info` 與一筆 `market-index` 的 request。

## MKT-R12.1 「關注」分頁

前端沒有自動化 test。

1. 確認自己沒有 2317 與 2454 的交易紀錄。
2. 在桌面瀏覽器開啟 `https://local.taigu.tw/market/2317`。
3. 如果愛心按鈕是空心的，點選愛心按鈕（「加入關注」）。
4. 開啟 `https://local.taigu.tw/market/2454`。
5. 如果愛心按鈕是空心的，點選愛心按鈕（「加入關注」）。
6. 開啟 `https://local.taigu.tw/market`。
7. 點選「關注」分頁。
8. 點選左側選單的「儀表板」。
9. 開啟 DevTools 的 Network 面板，在篩選欄輸入 `2454`。
10. 點選左側選單的「市場」，並記下這時的時間。
11. 停留約 70 秒。
12. 點選「持股」分頁。
13. 再停留 1 分鐘。

預期：第 10 步進入市場頁的當下出現一筆網址同時含 `2317` 與 `2454` 的 `current-stock-info` request，進入後約第 30 秒與第 60 秒各再出現一筆；切到「持股」分頁之後就沒有新的這類 request。

## MKT-R12.2 個股詳情頁

前端沒有自動化 test。這一節要求帳號沒有 2330 的交易紀錄，否則儀表板每 30 秒抓持股價格的 request 也會出現在篩選結果裡；有的話把下文的 2330 換成一檔沒有交易紀錄的股票。

1. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
2. 開啟 DevTools 的 Network 面板，在篩選欄輸入 `2330`。
3. 點選左側選單的「搜尋」。
4. 輸入「2330」。
5. 點選台積電那一列。
6. 停留 1 分鐘。

預期：進入個股詳情頁時出現 `current-stock-info?sids=2330` 與 `intraday-prices?sid=2330` 的 request，之後每隔約 30 秒再出現一組。

### 大盤指數測試資料

先完成共用準備。下列指令會替換兩個指數的盤中走勢與歷史收盤指數，全部檢查完後照共用準備第 12 步還原。

```bash
docker compose -f compose.dev.yaml exec -T api-server python manage.py shell -c "
from datetime import date, timedelta
from main.market.cache import TimeSeriesStockInfoCacheManager
from main.market.models import MarketIndexHistory, MarketIndexPerMinute

today = date.today()
MarketIndexPerMinute.objects.all().delete()
MarketIndexHistory.objects.all().delete()
for market, number, price, change in [
    ('tse', 0, 23010.0, 10.0), ('tse', 90, 23100.5, 100.5),
    ('otc', 0, 249.0, -1.0), ('otc', 90, 252.5, 2.5),
]:
    MarketIndexPerMinute.objects.create(
        market=market, date=today, number=number, price=price, fluct_price=change
    )
MarketIndexHistory.objects.bulk_create([
    MarketIndexHistory(market='tse', date=today - timedelta(days=days), close_price=23000 - days * 5)
    for days in [*range(1, 36), 400]
] + [
    MarketIndexHistory(market='otc', date=today - timedelta(days=days), close_price=250 - days / 10)
    for days in range(50)
])
for market in ('tse', 'otc'):
    TimeSeriesStockInfoCacheManager.delete(market)
"
```

切換測試資料前關閉其他 Taigu 分頁，並在 DevTools 的 Application 面板清除 `taigu` IndexedDB 裡的 `marketIndexHistoricalPrices` 資料。執行 MKT-R14.8 時則保留這些資料。檢查讀取較慢、讀取失敗或舊版回應時，在 Application 的 Service Workers 面板勾選 Bypass for network，避免 service worker 的 cache 影響檢查。

需要模擬個別 request 較慢或讀取失敗時，在 [Chrome DevTools 的 Request conditions 面板](https://developer.chrome.com/docs/devtools/request-conditions) 依各節指定的網址啟用限速或封鎖，檢查完關閉該規則。封鎖盤中行情用 `*/api/market/market-index?*`，限制櫃買歷史查詢用 `*/api/market/market-index-historical-prices?market=otc*`。

## MKT-R13.1 休市的日子

自動化 test 用模擬的回應檢查，所以要用後端的實際資料再確認卡片的日期與走勢。

1. 複製「大盤指數測試資料」的指令，把 `today = date.today()` 改成上週五的日期（例如 `today = date(2026, 11, 20)`），再把 `('tse', 90, 23100.5, 100.5)` 改成 `('tse', 90, 22880.0, -120.0)`。
2. 執行改好的指令。
3. 開啟 [儀表板](https://local.taigu.tw/)。

預期：「大盤指數」卡片只顯示一個行情日期，日期是週五。兩個摘要都有週五的走勢，加權指數顯示「22,880」與「▼120 (0.52%)」。

## MKT-R13.2 兩筆行情共用同一個入口

自動化 test 無法確認點選卡片內各個位置時實際點到的元素。

1. 在 [儀表板](https://local.taigu.tw/) 點選加權指數那一筆摘要。
2. 在大盤指數頁按「回儀表板」。
3. 對櫃買指數那一筆摘要、卡片標題、兩筆摘要之間的留白，各重複第 1 步與第 2 步。
4. 按 Tab 將焦點移到「大盤指數」卡片。
5. 按 Enter。

預期：每次都開啟 `/market-index`。整張卡片在鍵盤導覽順序中只出現一次。

## MKT-R13.3 首次查詢期間

自動化 test 只檢查卡片本身，無法確認儀表板的其他內容不用等盤中行情回應就會出現。

1. 在 Request conditions 面板啟用盤中行情的限速規則，設成 Slow 3G。
2. 重新整理 [儀表板](https://local.taigu.tw/)。

預期：盤中行情回應之前，「大盤指數」卡片的圖表與數值位置顯示載入狀態，投入金額等其他內容已經出現。

## MKT-R13.4 查詢成功但沒有行情

自動化 test 用模擬的回應檢查，所以要在實際畫面上再確認一次。

1. 執行以下指令，清除兩個指數的盤中行情。

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.market.cache import TimeSeriesStockInfoCacheManager
   from main.market.models import MarketIndexPerMinute
   MarketIndexPerMinute.objects.all().delete()
   for market in ('tse', 'otc'):
       TimeSeriesStockInfoCacheManager.delete(market)
   "
   ```

2. 重新整理 [儀表板](https://local.taigu.tw/)。
3. 點選「大盤指數」卡片。

預期：卡片顯示「目前沒有行情」，點選後開啟 `/market-index`。

## MKT-R13.5 更新失敗時仍有行情

自動化 test 用模擬的回應檢查，所以要在實際畫面上再確認一次。

1. 執行「大盤指數測試資料」的指令。
2. 開啟 [儀表板](https://local.taigu.tw/)，等兩個摘要出現。
3. 在 Request conditions 面板啟用盤中行情的封鎖規則。
4. 等 Network 面板出現前端下一次送出、被封鎖的盤中行情 request。

預期：卡片保留兩個摘要與走勢，並標示「更新失敗，顯示上次行情」。

## MKT-R13.6 首次讀取失敗

自動化 test 用模擬的回應檢查，所以要在實際畫面上再確認一次。

1. 在 Request conditions 面板啟用盤中行情的封鎖規則。
2. 重新整理 [儀表板](https://local.taigu.tw/)。
3. 點選「大盤指數」卡片。

預期：卡片顯示「行情讀取失敗」，點選後開啟 `/market-index`。

## MKT-R13.7 離線開啟時使用 Cache

自動化 test 用模擬的 service worker 回應檢查，所以要用實際的 service worker cache 再確認一次。

1. 確認 Service Workers 面板沒有勾選 Bypass for network。
2. 執行「大盤指數測試資料」的指令。
3. 開啟 [儀表板](https://local.taigu.tw/)，等兩個摘要出現。
4. 在 DevTools 的 Network 面板切換為 Offline。
5. 重新整理儀表板。

預期：卡片顯示兩個指數的摘要與走勢，並標示「更新失敗，顯示上次行情」。

## MKT-R14.1 從儀表板進入

自動化 test 無法確認回到儀表板後的捲動位置。

1. 執行「大盤指數測試資料」的指令。
2. 在 [儀表板](https://local.taigu.tw/) 把「大盤指數」卡片捲到視窗中間。
3. 點選「大盤指數」卡片。
4. 查看摘要和今日走勢。
5. 按「回儀表板」。
6. 重複第 3 步，再按瀏覽器的上一頁。

預期：`/market-index` 選取「今日」，同時顯示行情日期與兩個指數。加權指數顯示「23,100.5」與「▲100.5 (0.44%)」，兩張今日走勢圖上都有 09:00 與 10:30 的點。兩種方式回到儀表板後，頁面捲動位置都與進入前相同。

## MKT-R14.2 直接開啟大盤指數頁

自動化 test 已驗證圖表與返回按鈕，但沒有涵蓋從網址列直接載入頁面的情況。

1. 登入後，在新分頁開啟 [大盤指數](https://local.taigu.tw/market-index)。
2. 確認頁面顯示兩張今日走勢圖。
3. 按「回儀表板」。

預期：按「回儀表板」後開啟儀表板。

## MKT-R14.3 不用捲動就看到兩張圖

兩個指數的數值、圖表與控制項能不能不用捲動就完整看到，取決於實際的版面與字型，所以自動化 test 無法量測。

1. 執行「大盤指數測試資料」的指令。
2. 以預設文字大小，把可用畫面設成 1280 × 800 CSS px，開啟 [大盤指數](https://local.taigu.tw/market-index)。
3. 捲到頁面最上方，查看「今日」。
4. 捲到頁面最上方，依序點選「1M」、「1Q」、「1Y」與「ALL」。
5. 在 device toolbar 的 Dimensions 選「Responsive」，把可用畫面設成 390 × 700 CSS px，重複第 3 步與第 4 步。

預期：1280 × 800 CSS px 時兩個指數左右並排，390 × 700 CSS px 時上下排列。不論選取哪一個項目，都不用捲動就看得到兩組數值、右側點數刻度、時間或日期刻度，以及「今日」、「1M」、「1Q」、「1Y」、「ALL」五個選項。

## MKT-R14.4 縮短視窗或放大文字

捲動與文字放大後的版面取決於實際的瀏覽器，所以自動化 test 無法量測。

1. 在行動裝置模擬中，把可用畫面設成 320 × 568 CSS px，重新整理 [大盤指數](https://local.taigu.tw/market-index)。
2. 垂直捲動並查看兩張圖。
3. 點選「ALL」。
4. 將文字放大至 200%，重複第 2 步與第 3 步。

預期：可以垂直捲動到兩組數值與圖表，控制項仍可操作，頁面沒有橫向捲動。

## MKT-R14.5 一張圖表先取得資料

自動化 test 用模擬的回應檢查，所以要用實際的慢速 request 再確認畫面。

1. 在 Application 面板清除 `taigu` IndexedDB 裡的 `marketIndexHistoricalPrices` 資料。
2. 啟用櫃買歷史查詢的限速規則，把延遲設成 5 秒。
3. 重新整理 [大盤指數](https://local.taigu.tw/market-index)。
4. 點選「1M」。
5. 等櫃買歷史查詢結束。

預期：加權指數的走勢圖先出現，櫃買走勢圖的位置顯示載入狀態，等櫃買歷史查詢成功後才出現走勢圖。

## MKT-R14.6 一個指數沒有可繪製的資料

自動化 test 用模擬的回應檢查，所以要用後端的實際資料再確認畫面。

1. 複製「大盤指數測試資料」的指令，刪掉 `bulk_create` 參數裡 `market='otc'` 的那一個 list（從 `] + [` 到 `for days in range(50)`），只留加權的收盤指數。
2. 執行改好的指令。
3. 在 Application 面板清除 `taigu` IndexedDB 裡的 `marketIndexHistoricalPrices` 資料。
4. 用 DevTools 的 Local Overrides 把盤中行情回應的 `dates.otc` 設為 `null`，保留櫃買點數。
5. 重新整理 [大盤指數](https://local.taigu.tw/market-index)。
6. 點選「1M」。

預期：加權指數照常顯示走勢圖。櫃買摘要顯示最新指數及「行情日期不明」，走勢圖的位置顯示「目前沒有歷史走勢」。

## MKT-R14.7 一個指數讀取失敗

自動化 test 用模擬的回應檢查，所以要用實際失敗的 request 再確認重試。

1. 執行「大盤指數測試資料」的指令。
2. 在 Application 面板清除 `taigu` IndexedDB 裡的 `marketIndexHistoricalPrices` 資料。
3. 啟用櫃買歷史查詢的封鎖規則。
4. 重新整理 [大盤指數](https://local.taigu.tw/market-index)。
5. 點選「1M」，等櫃買走勢圖的位置顯示「歷史走勢讀取失敗」。
6. 關閉櫃買歷史查詢的封鎖規則。
7. 按櫃買走勢圖位置的「重試」。
8. 在 Network 面板查看這次送出的 request。

預期：Network 面板只多出一筆櫃買歷史查詢的 request，前端沒有重新送出加權的查詢。加權走勢圖持續顯示，重試成功後櫃買走勢圖也出現。

## MKT-R14.8 更新失敗時仍有可用資料

自動化 test 用模擬的回應檢查，所以要用實際的 IndexedDB 資料再確認畫面。

1. 執行「大盤指數測試資料」的指令。
2. 開啟 [大盤指數](https://local.taigu.tw/market-index)，點選「1M」，等兩張走勢圖出現。
3. 不要清除 IndexedDB 資料，啟用櫃買歷史查詢的封鎖規則。
4. 按「回儀表板」。
5. 點選「大盤指數」卡片。
6. 點選「1M」。

預期：櫃買仍顯示原本的走勢，並標示「更新失敗，顯示上次取得的走勢」。

## MKT-R14.9 兩個指數的行情日期不同

自動化 test 用模擬的回應檢查，所以要用後端的實際資料再確認兩個頁面的日期與圖上的點。

1. 複製「大盤指數測試資料」的指令，把 `MarketIndexPerMinute.objects.create(` 裡的 `date=today` 改成 `date=today if market == 'tse' else today - timedelta(days=1)`，再把櫃買收盤指數的 `range(50)` 改成 `range(1, 50)`。
2. 執行改好的指令。
3. 查看 [儀表板](https://local.taigu.tw/)。
4. 點選「大盤指數」卡片。
5. 點選「1M」。
6. 將游標移到櫃買走勢圖的最後一點。

預期：兩個頁面分別標示各指數的行情日期，櫃買歷史走勢圖的最後一點是前一天的 252.5 點。

## MKT-R14.10 首次讀取兩個指數的盤中行情失敗

自動化 test 用模擬的回應檢查，所以要用實際失敗的 request 再確認重試。

1. 在 Request conditions 面板啟用盤中行情的封鎖規則。
2. 重新整理 [大盤指數](https://local.taigu.tw/market-index)，等畫面出現「重試」。
3. 關閉盤中行情的封鎖規則。
4. 按「重試」。

預期：兩張圖共用一個重試入口。Network 面板記錄一筆重試的盤中行情查詢，成功後兩張圖都出現。

## MKT-R14.11 窄版保留加號選單

加號選單的展開與收合取決於實際的觸控與版面，自動化 test 沒有涵蓋。

1. 開啟行動裝置模擬，重新整理 [大盤指數](https://local.taigu.tw/market-index)。
2. 展開加號選單，再點選選單外側收合。
3. 按 Tab 將焦點移到加號。
4. 按 Enter 展開選單。
5. 按 Tab 依序將焦點移到各選項。
6. 按 Esc 收合選單。
7. 關閉行動裝置模擬。
8. 把可用畫面縮至 844 × 360 CSS px。
9. 用加號選單開啟「搜尋」。
10. 按 Esc 關閉搜尋。
11. 在新分頁開啟[含加號選單 hash 的大盤指數網址](https://local.taigu.tw/market-index#@)。

預期：兩種視窗大小下都能操作「新增交易紀錄」、「新增現金股利」、「新增買賣計畫」與「搜尋」。關閉選單或搜尋視窗後，焦點回到加號。從新分頁直接開啟大盤指數頁時，加號選單維持收合。

## MKT-R14.12 行情回應缺少個別日期

自動化 test 用模擬的回應檢查，所以要用 DevTools 把實際的盤中行情回應改寫成舊版格式（沒有 `dates` 欄位），再確認畫面。

1. 複製「大盤指數測試資料」的指令，把櫃買收盤指數的 `range(50)` 改成 `range(1, 50)`，讓兩個指數最新的收盤指數都是前一天的。
2. 執行改好的指令。
3. 用 DevTools 的 Local Overrides 移除盤中行情回應的 `dates`，保留 `date` 和點數。
4. 重新整理 [儀表板](https://local.taigu.tw/)。
5. 點選「大盤指數」卡片。
6. 點選「1M」。
7. 將游標分別移到兩張走勢圖的最後一點。

預期：兩個頁面都顯示兩個指數的最新指數及「行情日期不明」。兩張歷史走勢圖的最後一點仍是前一天的收盤指數。

## MKT-R14.13 開啟舊的大盤指數網址

自動化 test 已確認這兩個網址由 404 頁面處理，但沒有確認瀏覽器實際顯示的內容與網址列。

1. 開啟 `https://local.taigu.tw/market-index/tse`。
2. 開啟 `https://local.taigu.tw/market-index/otc`。

預期：兩個網址都顯示 PUB-R5 的「找不到頁面」，網址列維持各自開啟的網址。

## MKT-R15.1 選「1M」與「ALL」

自動化 test 用模擬的回應檢查，所以要用後端的實際資料再確認點數與區間。

1. 執行「大盤指數測試資料」的指令。
2. 開啟 [大盤指數](https://local.taigu.tw/market-index)。
3. 點選「1M」。
4. 將游標移到兩張走勢圖的第一點與最後一點，記下 tooltip 的日期與點數。
5. 點選「ALL」，重複第 4 步。

預期：

- 點選「1M」後，兩張圖都顯示最近 30 個點。兩張圖的最後一點是當天的盤中指數，加權是 23,100.5 點，櫃買是 252.5 點。
- 點選「ALL」後，加權第一點的日期是 400 天前，櫃買第一點的日期是 49 天前。

## MKT-R15.2 歷史走勢只有最新盤中指數

自動化 test 用模擬的回應檢查，所以要在實際走勢圖上再確認單一點與 tooltip。

1. 複製「大盤指數測試資料」的指令，刪掉 `bulk_create` 參數裡 `market='tse'` 的那一個 list（從開頭的 `[` 到 `] + `），只留櫃買的收盤指數。
2. 執行改好的指令。
3. 在 Application 面板清除 `taigu` IndexedDB 裡的 `marketIndexHistoricalPrices` 資料。
4. 開啟 [大盤指數](https://local.taigu.tw/market-index)。
5. 點選「1M」。
6. 將游標移到加權走勢圖的資料點上。

預期：加權指數走勢圖只顯示當天的 23,100.5 點，tooltip 顯示這一點的日期、點數與「漲跌 -- (--)」。

## MKT-R17.1 點選搜尋結果

前端沒有自動化 test。

1. 以窄版開啟 `https://local.taigu.tw/`。
2. 點選右下角的「+」。
3. 點選「搜尋」。
4. 輸入「2330」。
5. 確認台積電那一列顯示公司名稱、股票代號、價格與漲跌。
6. 點選台積電那一列。
7. 確認畫面的網址。
8. 按瀏覽器的上一頁。

預期：第 5 步台積電那一列顯示「台積電」、2330、價格與漲跌；第 7 步的網址是 `/market/2330`；第 8 步後回到儀表板，不會回到搜尋頁。

## MKT-R18.1 點選第 11 檔股票

前端沒有自動化 test。這一段會改掉這個瀏覽器裡最近點選過的股票清單。

1. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
2. 開啟 DevTools 的 Console，執行 `localStorage.setItem('stock_search_lru_cache', JSON.stringify(['T10', 'T09', 'T08', 'T07', 'T06', 'T05', 'T04', 'T03', 'T02', 'T01']))`。
3. 點選左側選單的「搜尋」。
4. 確認列出「測試股10」到「測試股01」共 10 檔。
5. 輸入「T11」。
6. 點選「測試股11」那一列。
7. 點選左側選單的「搜尋」。

預期：第 7 步列出 10 檔，第一檔是「測試股11」，後面依序是「測試股10」到「測試股02」，「測試股01」不在清單上。

## MKT-R19.1 沒有輸入文字也沒有點選過的股票

前端沒有自動化 test。這一段會改掉這個瀏覽器裡最近點選過的股票清單。

1. 在行動裝置開啟 `https://local.taigu.tw/`。
2. 開啟 DevTools 的 Console，執行 `localStorage.removeItem('stock_search_lru_cache')`。
3. 點選右下角的「+」。
4. 點選「搜尋」。

預期：畫面顯示「搜尋台股」與「輸入證券代號或名稱，快速前往個股頁查看價格、持股與相關紀錄。」。

## MKT-R19.2 找不到符合的股票

前端沒有自動化 test。

1. 在行動裝置開啟 `https://local.taigu.tw/`。
2. 點選右下角的「+」。
3. 點選「搜尋」。
4. 輸入「zzzz」。

預期：畫面顯示「找不到符合的股票」與「請確認證券代號或名稱是否正確，或換個關鍵字再試一次。」。

## MKT-R20.1 搜尋並點選股票

前端沒有自動化 test。

1. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
2. 點選左側選單的「新增」，開啟新增交易紀錄的編輯器。
3. 在「股票」欄位輸入「2330」。
4. 點選搜尋結果裡的台積電。

預期：「股票」欄位顯示台積電與 2330，以及「更換」按鈕。

## MKT-R20.2 沒有選擇股票就離開搜尋

前端沒有自動化 test。

1. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
2. 點選左側選單的「新增」，開啟新增交易紀錄的編輯器。
3. 在「股票」欄位輸入「2330」。
4. 點選「成交單價」欄位。

預期：「股票」欄位仍然沒有股票，欄位下方顯示「請從搜尋結果選擇一檔股票」。

## MKT-R21.1 沒有連上網路

前端沒有自動化 test。

1. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
2. 點選左側選單的「新增」，開啟新增交易紀錄的編輯器。
3. 在 DevTools 的 Network 面板把 throttling 設成 Offline。
4. 在「股票」欄位輸入「2330」。
5. 把 throttling 設回 No throttling。

預期：第 4 步後欄位下方顯示「目前無法搜尋股票，請稍後再試一次。」。

### Tooltip 測試資料

MKT-R22.1 檢查 [大盤指數](https://local.taigu.tw/market-index) 上的兩張今日走勢，以及 [T01 個股詳情頁](https://local.taigu.tw/market/T01) 的今日走勢。其餘手動檢查從大盤指數頁選一張圖，並在 T01 個股詳情頁重複操作。

每次更換資料後，重新整理頁面再檢查。

這些檢查會改動大盤指數，開始前先完成共用準備的備份，結束後照共用準備第 12 步還原。

選點的回歸測試使用實際 ECharts，可執行 `docker compose -f compose.dev.yaml exec frontend npm test -- --run intradayTooltip.test.tsx`。

下面指令準備昨收價 100、11:30 的 99 與 11:35 的 103 兩筆行情。各節需要不同資料時，照該節說明替換指令裡的 `points` 再執行。`points` 的每一組值是從 09:00 起算的分鐘數與價格。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
from datetime import date
from main.market.cache import TimeSeriesStockInfoCacheManager
from main.market.models import MarketIndexPerMinute, StockInfo, StockPricePerMinute
points = [(150, 99.0), (155, 103.0)]
today = date.today()
for market in ('tse', 'otc'):
    MarketIndexPerMinute.objects.filter(market=market).delete()
    for minute, price in points:
        MarketIndexPerMinute.objects.create(market=market, date=today, number=minute, price=price, fluct_price=price - 100.0)
    TimeSeriesStockInfoCacheManager.delete(market)
StockPricePerMinute.objects.filter(company_id='T01').delete()
for minute, price in points:
    StockPricePerMinute.objects.create(company_id='T01', date=today, number=minute, price=price, fluct_price=price - 100.0)
last_price = points[-1][1]
StockInfo.objects.filter(company_id='T01').update(date=today, close_price=last_price, fluct_price=last_price - 100.0)
TimeSeriesStockInfoCacheManager.delete('T01')
"
```

## MKT-R22.1 在缺少行情的分鐘之間移動

回歸測試驗證 ECharts 的選點結果，這裡另外確認實際顯示的 tooltip 與指示線，也檢查觸控操作。

1. 執行「Tooltip 測試資料」的指令。
2. 開啟大盤指數頁的「今日」，找到加權指數圖表。
3. 在繪圖區把游標從 11:30 水平移到 11:35，過程中讓游標與折線保持一段垂直距離。
4. 在櫃買指數走勢圖與 T01 個股詳情頁的今日走勢圖重複第 3 步。
5. 開啟 DevTools 的行動裝置模擬。
6. 重新整理大盤指數頁與 T01 個股詳情頁。
7. 在三張今日走勢圖上依序觸控 11:31 與 11:34 的時間位置。

預期：移動期間 tooltip 持續顯示，滑鼠與觸控在 11:31 位置都顯示 11:30 的行情，在 11:34 位置都顯示 11:35 的行情，垂直指示線與 tooltip 的時間一致。

## MKT-R22.5 只有一筆資料

回歸測試驗證只有一筆時的選點結果，這裡另外確認整個繪圖區都能查閱。

1. 把「Tooltip 測試資料」指令裡的 `points` 改成 `[(150, 100.0)]`。
2. 執行修改後的指令。
3. 把游標從大盤指數與 T01 今日走勢圖繪圖區的 09:00 水平移到 13:30。

預期：Tooltip 持續顯示 11:30 的行情，垂直指示線維持在 11:30。

## MKT-R22.7 離開繪圖區

這個情境需要實際操作滑鼠確認顯示與隱藏。

1. 執行「Tooltip 測試資料」的指令。
2. 把游標移進大盤指數與 T01 今日走勢圖的繪圖區。
3. 確認這兩個頁面的 tooltip 都出現。
4. 把游標移到圖表外的頁面標題。

預期：Tooltip 與垂直指示線都消失。
