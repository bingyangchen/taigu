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

10. 段落裡寫「行動裝置」時，在 Chrome DevTools 開啟裝置模擬（例如 iPhone 14 Pro）並重新整理頁面，因為前端依 user agent 判斷是不是行動裝置；寫「桌面瀏覽器」時用一般的 Chrome 視窗。
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

既有的 unit test 驗證休市時不更新價格，但沒有驗證 15:00 不寫入收盤價。這一段以測試股 T01 代替 2330；這一段執行的 15:00 工作會替所有今天有行情的股票寫入收盤價、寫入今天的收盤指數，並刪除 80 天前的收盤價，全部檢查完照共用準備第 12 步還原。

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

## MKT-R9.1 刪除過期的收盤價

沒有 unit test 驗證收盤價的保留期間。這一段以測試股 T01 代替 2330，並會改動收盤指數的資料，全部檢查完照共用準備第 12 步還原。

1. 執行下面的指令，替 T01 建立 80 天前與 81 天前的收盤價、替加權指數建立 400 天前的收盤指數，再執行 15:00 的工作：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date, timedelta
   from main.market.models import History, MarketIndexHistory
   from main.market.services import update_all_stocks_history
   today = date.today()
   for days_ago in (80, 81):
       History.objects.update_or_create(company_id='T01', frequency='DAILY', date=today - timedelta(days=days_ago), defaults={'quantity': 0, 'close_price': 900.0})
   MarketIndexHistory.objects.update_or_create(market='tse', date=today - timedelta(days=400), defaults={'close_price': 15000.0})
   update_all_stocks_history()
   print([(today - row.date).days for row in History.objects.filter(company_id='T01', date__lte=today - timedelta(days=80))])
   print(MarketIndexHistory.objects.filter(market='tse', date=today - timedelta(days=400)).exists())
   "
   ```

預期：第一行印出 `[80]`，81 天前的收盤價已經刪除；第二行印出 `True`，400 天前的收盤指數仍然保存。

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

## MKT-R13.1 休市的日子

前端沒有自動化 test。這一段會改動大盤指數的資料，全部檢查完照共用準備第 12 步還原。

1. 執行下面的指令，讓加權指數最後記錄的盤中走勢是 3 天前的資料，最後一點是 22,880 點、漲跌 -120 點，模擬休市的日子：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date, timedelta
   from main.market.cache import TimeSeriesStockInfoCacheManager
   from main.market.models import MarketIndexPerMinute
   day = date.today() - timedelta(days=3)
   MarketIndexPerMinute.objects.all().delete()
   for market, number, price, fluct in [('tse', 0, 22990.0, -10.0), ('tse', 270, 22880.0, -120.0), ('otc', 270, 251.25, 1.25)]:
       MarketIndexPerMinute.objects.create(market=market, date=day, number=number, price=price, fluct_price=fluct)
   TimeSeriesStockInfoCacheManager.delete('tse')
   TimeSeriesStockInfoCacheManager.delete('otc')
   "
   ```

2. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
3. 查看「加權指數」卡片。

預期：加權指數卡片的日期是 3 天前的日期，走勢圖畫的是那一天 09:00 到 13:30 的資料，最新的指數是 22880，漲跌是 ▼120。

## MKT-R14.1 從儀表板進入

前端沒有自動化 test。這一段會改動大盤指數的資料，全部檢查完照共用準備第 12 步還原。

1. 執行下面的指令，準備今天的加權指數：昨收價 23,000 點，09:00 是 23,010 點，10:30 是 23,100.5 點。

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date
   from main.market.cache import TimeSeriesStockInfoCacheManager
   from main.market.models import MarketIndexPerMinute
   MarketIndexPerMinute.objects.all().delete()
   for market, number, price, fluct in [('tse', 0, 23010.0, 10.0), ('tse', 90, 23100.5, 100.5), ('otc', 0, 250.0, 0.0)]:
       MarketIndexPerMinute.objects.create(market=market, date=date.today(), number=number, price=price, fluct_price=fluct)
   TimeSeriesStockInfoCacheManager.delete('tse')
   TimeSeriesStockInfoCacheManager.delete('otc')
   "
   ```

2. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
3. 點選「加權指數」卡片。

預期：畫面換到 `/market-index/tse`，顯示「加權指數」、今天的日期、最新的指數 23100.5 與漲跌 ▲100.5；「今日」是選取狀態，走勢圖畫出 09:00 與 10:30 兩點。

## MKT-R15.1 切換到「歷史」與「ALL」

前端沒有自動化 test。這一段會改動大盤指數的資料，全部檢查完照共用準備第 12 步還原。

1. 執行下面的指令，讓加權指數保存 400 天前一筆，以及 1 到 35 天前每天各一筆收盤指數，並讓今天目前的指數是 23,100.5 點：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import date, timedelta
   from main.market.cache import TimeSeriesStockInfoCacheManager
   from main.market.models import MarketIndexHistory, MarketIndexPerMinute
   today = date.today()
   MarketIndexHistory.objects.filter(market='tse').delete()
   MarketIndexHistory.objects.create(market='tse', date=today - timedelta(days=400), close_price=15000.0)
   for days_ago in range(1, 36):
       MarketIndexHistory.objects.create(market='tse', date=today - timedelta(days=days_ago), close_price=23000.0 - days_ago * 10)
   MarketIndexPerMinute.objects.all().delete()
   for market, number, price, fluct in [('tse', 0, 23010.0, 10.0), ('tse', 90, 23100.5, 100.5), ('otc', 0, 250.0, 0.0)]:
       MarketIndexPerMinute.objects.create(market=market, date=today, number=number, price=price, fluct_price=fluct)
   TimeSeriesStockInfoCacheManager.delete('tse')
   TimeSeriesStockInfoCacheManager.delete('otc')
   "
   ```

2. 在桌面瀏覽器開啟 `https://local.taigu.tw/`。
3. 開啟 DevTools 的 Console，執行 `indexedDB.deleteDatabase('taigu')`。
4. 重新整理頁面。
5. 點選「加權指數」卡片。
6. 點選「歷史」。
7. 把滑鼠移到走勢圖的第一點與最後一點。
8. 點選「ALL」。
9. 把滑鼠移到走勢圖的第一點。

預期：第 6 步後「1M」是選取狀態；第 7 步第一點的日期是 29 天前（30 個點裡最早的一點），最後一點的日期是今天、值是 23,100.5；第 9 步第一點的日期是 400 天前。

## MKT-R17.1 點選搜尋結果

前端沒有自動化 test。

1. 在行動裝置開啟 `https://local.taigu.tw/`。
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
4. 點選「交易日期」欄位。

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

MKT-R22.1 檢查下列三個頁面的「今日」走勢：`https://local.taigu.tw/market-index/tse`、`https://local.taigu.tw/market-index/otc` 與 `https://local.taigu.tw/market/T01`。其餘手動檢查各選一個大盤指數頁與 T01，涵蓋兩種圖表元件。

每次更換資料後，重新整理頁面再檢查。

這些檢查會改動大盤指數，開始前先完成共用準備的備份，結束後照共用準備第 12 步還原。

選點的回歸測試使用實際 ECharts，可執行 `docker compose -f compose.dev.yaml exec frontend npm test -- --watchAll=false --runInBand intradayTooltip.test.tsx`。

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
2. 開啟加權指數頁的今日走勢。
3. 在繪圖區把游標從 11:30 水平移到 11:35，過程中讓游標與折線保持一段垂直距離。
4. 在櫃買指數頁與 T01 的個股詳情頁重複第 3 步。
5. 開啟 DevTools 的行動裝置模擬。
6. 重新整理這三個頁面。
7. 在三個頁面的今日走勢圖，依序觸控 11:31 與 11:34 的時間位置。

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
