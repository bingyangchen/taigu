注意：這份檔案的指令會刪除或修改開發環境資料庫裡的資料，包括登入帳號的紀錄，所以要用只拿來測試的 Google 帳號登入，不要用存有真實資料的帳號。

第一節開始之前做一次步驟 1 到 3，每一節開始之前做步驟 4 與 5，全部檢查完後做步驟 6 與 7。「設定價格」指令會改掉所有使用者共用的行情資料，scheduler 要到下一個交易日的盤中才會更新回來，所以檢查前先備份會改到的股票，全部檢查完後再還原。步驟 3 的備份只能做一次，再做一次會用改過的價格蓋掉備份：

1. 如果服務還沒啟動，執行 `make start`。下一步停掉 scheduler 之後，全部檢查完之前不要再執行 `make start`，因為它會把 scheduler 重新啟動。
2. 執行 `docker compose -f compose.dev.yaml stop scheduler`，避免 scheduler 在檢查途中蓋掉手動設定的價格。
3. 執行下面的指令，把 2330、2317、1301、0050、2412、3008 的行情備份到 api-server container 的 `/tmp/favorites_backup.json`（全部檢查完之前不要重建 api-server container）：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "import json; from main.market.models import StockInfo; json.dump(list(StockInfo.objects.filter(company_id__in=['2330', '2317', '1301', '0050', '2412', '3008']).values('company_id', 'close_price', 'fluct_price', 'quantity')), open('/tmp/favorites_backup.json', 'w'))"
   ```

4. 在桌面瀏覽器（Chrome）上用 Google 帳號登入 `https://local.taigu.tw`，視窗的寬度維持 780px 以上。
5. 執行下面的「改回 Standard 試用期」指令，讓帳號處在 Standard 試用期。
6. 全部檢查完後，執行下面的指令還原備份的行情：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "import json; from main.market.models import StockInfo; [StockInfo.objects.filter(company_id=row['company_id']).update(close_price=row['close_price'], fluct_price=row['fluct_price'], quantity=row['quantity']) for row in json.load(open('/tmp/favorites_backup.json'))]"
   ```

7. 還原後執行 `docker compose -f compose.dev.yaml start scheduler`。

各節用到下面這些說法與指令：

- 指令裡的 `<email>` 換成登入用的 Google 帳號 email。用指令改過自選股或價格之後，要重新整理頁面，Taigu 才會載入新的資料。
- 「關注」分頁上方顯示自選股檔數的數字，目前的標籤是「最愛檔數」。
- 各節用到的股票代號只是範例。如果你的帳號已經有某一檔股票的交易紀錄，而那一節要求股票不是持股，就換成其他沒有交易紀錄的股票，後面步驟裡的股票代號也跟著換；換上的股票要一起加進步驟 3 的備份與步驟 6 的還原指令，而且要在做步驟 3 之前決定。

「設定自選股」指令會清掉原本的自選股，再依序加入清單裡的股票。把 `['2330', '2317', '1301']` 換成各節指定的股票代號，順序照各節寫的：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; from main.favorite.models import Favorite; u = User.objects.get(email='<email>'); Favorite.objects.filter(owner=u).delete(); [Favorite.objects.create(owner=u, company_id=sid) for sid in ['2330', '2317', '1301']]"
```

「設定價格」指令設定一檔股票目前的價格。把 `company_id` 換成股票代號；`close_price` 是目前的價格，`fluct_price` 是漲跌（目前的價格減去昨收價），`quantity` 是成交股數：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.market.models import StockInfo; StockInfo.objects.filter(company_id='2330').update(close_price=1010, fluct_price=10, quantity=3500000)"
```

「改成 Free 方案」指令：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; from main.billing.models import BillingProfile; u = User.objects.get(email='<email>'); BillingProfile.objects.update_or_create(user=u, defaults={'plan': 'free', 'subscription_status': 'canceled'})"
```

「改回 Standard 試用期」指令：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import timedelta; from django.utils import timezone; from main.account.models import User; from main.billing.models import BillingProfile; u = User.objects.get(email='<email>'); now = timezone.now(); BillingProfile.objects.update_or_create(user=u, defaults={'plan': 'standard', 'subscription_status': 'trialing', 'trial_started_at': now, 'trial_ends_at': now + timedelta(days=31)})"
```

「填滿自選股的額度」指令會清掉原本的自選股，再加入 10 檔不是 2330 也不是 2317 的股票，10 檔是 Free 方案的自選股額度（見 `docs/specs/billing.md`）。把 `[:10]` 換成 `[:9]` 時只加入 9 檔：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; from main.favorite.models import Favorite; from main.market.models import Company; u = User.objects.get(email='<email>'); Favorite.objects.filter(owner=u).delete(); [Favorite.objects.create(owner=u, company=c) for c in Company.objects.exclude(pk__in=['2330', '2317']).order_by('pk')[:10]]"
```

## FAV-R1.1 加入一檔股票

後端的 test 只驗證自選股有存下來，愛心與列表的變化要在前端確認，而前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2317。
2. 開啟 `https://local.taigu.tw/market/2330`。
3. 點選空心愛心。
4. 點選側邊欄的「市場」。
5. 點選「關注」。

預期：第 3 步點選後愛心立刻變成實心；第 5 步的列表列出 2330。

## FAV-R1.2 移除一檔自選股

後端的 test 只驗證自選股有刪掉，愛心與列表的變化要在前端確認，而前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330、2317。
2. 開啟 `https://local.taigu.tw/market/2330`。
3. 點選實心愛心。
4. 點選側邊欄的「市場」。
5. 點選「關注」。

預期：第 3 步點選後愛心立刻變成空心，沒有出現確認視窗；第 5 步的列表沒有 2330。

## FAV-R2.1 自選股的額度用完時加入

後端沒有 test 驗證自選股的額度擋下新增，而且視窗與愛心的變化要在前端確認，前端沒有自動化 test。

1. 執行「改成 Free 方案」指令。
2. 執行「填滿自選股的額度」指令。
3. 開啟 `https://local.taigu.tw/market/2317`。
4. 點選空心愛心。
5. 點選視窗的「稍後再說」。
6. 點選側邊欄的「市場」。
7. 點選「關注」。
8. 執行「改回 Standard 試用期」指令。

預期：第 4 步之後畫面顯示 `PlanUpsellModal` 視窗（標題是「關注清單已達 Free 上限」），愛心變回空心；第 7 步的列表沒有 2317，上方的「最愛檔數」是 10。

## FAV-R2.2 離線時加入

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2317。
2. 開啟 `https://local.taigu.tw/market/2330`。
3. 開啟 Chrome DevTools 的 Network 分頁。
4. 選 throttling 選單的 Offline。
5. 點選空心愛心。
6. 選 throttling 選單的 No throttling。
7. 重新整理頁面。

預期：第 5 步之後愛心最後顯示空心；第 7 步重新整理後，愛心仍是空心。

## FAV-R2.3 離線時移除

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330。
2. 開啟 `https://local.taigu.tw/market/2330`。
3. 開啟 Chrome DevTools 的 Network 分頁。
4. 選 throttling 選單的 Offline。
5. 點選實心愛心。
6. 選 throttling 選單的 No throttling。
7. 重新整理頁面。

預期：第 5 步之後愛心最後顯示實心；第 7 步重新整理後，愛心仍是實心。

## FAV-R3.1 額度用完時在還沒更新的畫面再加入一次

後端的 test 只驗證重複加入不會多一筆，沒有在額度用完時驗證，而且另一個瀏覽器分頁的愛心變化要在前端確認，前端沒有自動化 test。

1. 執行「改成 Free 方案」指令。
2. 執行「填滿自選股的額度」指令，把 `[:10]` 換成 `[:9]`。
3. 在第一個瀏覽器分頁開啟 `https://local.taigu.tw/market/2330`。
4. 在第二個瀏覽器分頁開啟 `https://local.taigu.tw/market/2330`。
5. 在第一個瀏覽器分頁點選空心愛心，讓自選股達到 10 檔。
6. 切換到第二個瀏覽器分頁。
7. 點選仍是空心的愛心。
8. 重新整理第二個瀏覽器分頁。
9. 點選側邊欄的「市場」。
10. 點選「關注」。
11. 執行「改回 Standard 試用期」指令。

預期：第 7 步之後愛心變成實心，畫面沒有出現 `PlanUpsellModal` 視窗；第 10 步的列表只有一列 2330。

## FAV-R4.1 切換到「關注」分頁

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330、2317、1301。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「關注」。

預期：標題變成「關注」，列表列出 2330、2317、1301。

## FAV-R5.1 切換分頁時保留搜尋文字與排序方式

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330、2317、1301。
2. 開啟 `https://local.taigu.tw/market`。
3. 在「持股」分頁的搜尋框輸入「台」。
4. 在排序選單選「名稱」。
5. 點選「關注」。

預期：搜尋框仍是「台」，排序仍是「名稱」，列表依序列出台塑、台積電。

## FAV-R5.2 重新整理頁面

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330、2317、1301。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「關注」。
4. 在搜尋框輸入「積」。
5. 在排序選單選「今日漲跌幅」。
6. 重新整理頁面。

預期：市場頁顯示「持股」分頁，搜尋框是空的，排序是「持倉高到低」。

## FAV-R6.1 用股票名稱搜尋自選股

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330、2317、1301。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「關注」。
4. 在搜尋框輸入「台」。

預期：列表列出台積電與台塑，沒有鴻海。

## FAV-R6.2 用股票代號搜尋自選股

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330、2317、1301。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「關注」。
4. 在搜尋框輸入「23」。

預期：列表列出 2330 與 2317，沒有 1301。

## FAV-R7.1 搜尋不到自選股

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330、2317、1301。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「關注」。
4. 在搜尋框輸入「9999」。

預期：列表的位置顯示「找不到符合的股票」與「清除搜尋」按鈕。

## FAV-R7.2 點選「清除搜尋」

前端沒有自動化 test。

1. 完成 FAV-R7.1 的所有步驟。
2. 點選「清除搜尋」。

預期：搜尋框變成空白，列表列出 2330、2317、1301。

## FAV-R8.1 依今日漲跌幅排序

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號依序用 2330、0050、2317。
2. 執行「設定價格」指令 3 次，依序把 2330 設成 `close_price=1010, fluct_price=10`，2317 設成 `close_price=97, fluct_price=-3`，0050 設成 `close_price=102, fluct_price=2`；`quantity` 維持指令裡的值。
3. 開啟 `https://local.taigu.tw/market`。
4. 點選「關注」。
5. 在排序選單選「今日漲跌幅」。

預期：列表依序列出 2317、0050、2330。

## FAV-R8.2 依持倉排序時有不是持股的自選股

前端沒有自動化 test。這一節要求帳號原本沒有 0050、2330、2317 的交易紀錄，否則市值會不同、順序也可能跟預期不一樣。

1. 執行「設定自選股」指令，股票代號依序用 0050、2330、2317。
2. 執行「設定價格」指令 2 次，把 2317 設成 `close_price=300, fluct_price=0`，2330 設成 `close_price=200, fluct_price=0`；`quantity` 維持指令裡的值。
3. 到 `https://local.taigu.tw/records/trade/new` 新增一筆 2317 的買進交易紀錄，成交單價 300 元，成交股數 1,000 股。
4. 到 `https://local.taigu.tw/records/trade/new` 新增一筆 2330 的買進交易紀錄，成交單價 200 元，成交股數 1,000 股。
5. 開啟 `https://local.taigu.tw/market`。
6. 點選「關注」。
7. 在排序選單選「持倉高到低」。
8. 到 `https://local.taigu.tw/records` 刪除第 3 步與第 4 步新增的交易紀錄。

預期：第 7 步時，列表依序列出 2317、2330、0050。

## FAV-R9.1 搜尋時的統計數字

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330、2317、1301、2412、3008。
2. 執行「設定價格」指令 5 次，依序把 2330 設成 `close_price=1010, fluct_price=10`，2317 設成 `close_price=105, fluct_price=5`，1301 設成 `close_price=48, fluct_price=-2`，2412 設成 `close_price=100, fluct_price=0`，3008 設成 `close_price=0, fluct_price=0, quantity=0`；其他欄位維持指令裡的值。
3. 開啟 `https://local.taigu.tw/market`。
4. 點選「關注」。
5. 在搜尋框輸入「2412」。

預期：列表只列出 2412；上方的「最愛檔數」是 5，「今日上漲」是 2，「今日下跌」是 1。

## FAV-R10.1 在桌面瀏覽器上的一列

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330。
2. 執行「設定價格」指令，把 2330 設成 `close_price=1010, fluct_price=10, quantity=3500000`。
3. 開啟 `https://local.taigu.tw/market`。
4. 點選「關注」。

預期：2330 那一列顯示台積電、2330、1,010、「▲ 10.00 1.00%」（漲跌 10.00、漲跌幅 1.00%）與「成交量 3,500 張」。

## FAV-R10.2 還沒有價格的自選股

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 3008。
2. 執行「設定價格」指令，把 3008 設成 `close_price=0, fluct_price=0, quantity=0`。
3. 開啟 `https://local.taigu.tw/market`。
4. 點選「關注」。

預期：3008 那一列的價格顯示「--」。

## FAV-R10.3 點選一檔自選股

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「關注」。
4. 點選 2330 那一列。

預期：畫面顯示 2330 的個股詳情頁，網址是 `https://local.taigu.tw/market/favorites/2330`。

## FAV-R11.1 切換到「關注」分頁時取得新價格

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330。
2. 執行「設定價格」指令，把 2330 設成 `close_price=1000, fluct_price=0`；`quantity` 維持指令裡的值。
3. 開啟 `https://local.taigu.tw/market`。
4. 點選「關注」。
5. 確認 2330 那一列顯示 1,000。
6. 點選「持股」。
7. 執行「設定價格」指令，把 2330 設成 `close_price=1010, fluct_price=10`。
8. 點選「關注」。

預期：第 8 步時，2330 那一列顯示 1,010。

## FAV-R12.1 更新價格失敗

前端沒有自動化 test。

1. 執行「設定自選股」指令，股票代號用 2330。
2. 執行「設定價格」指令，把 2330 設成 `close_price=1000, fluct_price=0`；`quantity` 維持指令裡的值。
3. 開啟 `https://local.taigu.tw/market`。
4. 點選「關注」。
5. 確認 2330 那一列顯示 1,000。
6. 開啟 Chrome DevTools 的 Network 分頁。
7. 選 throttling 選單的 Offline。
8. 點選「持股」。
9. 點選「關注」。

預期：第 9 步之後，控制列顯示 ↻，2330 那一列仍顯示 1,000。

## FAV-R12.2 點選重新整理按鈕

前端沒有自動化 test。

1. 完成 FAV-R12.1 的所有步驟。
2. 執行「設定價格」指令，把 2330 設成 `close_price=1010, fluct_price=10`。
3. 選 throttling 選單的 No throttling。
4. 點選 ↻。

預期：↻ 消失，2330 那一列顯示 1,010。

## FAV-R12.3 自動更新成功

前端沒有自動化 test。

直接用網址開啟市場頁時，「關注」分頁的自動更新間隔是 600 秒（roadmap.md 記錄的已知問題），所以這一節從儀表板進入市場頁，讓間隔是 30 秒。

1. 執行「設定自選股」指令，股票代號用 2330。
2. 執行「設定價格」指令，把 2330 設成 `close_price=1000, fluct_price=0`；`quantity` 維持指令裡的值。
3. 開啟 `https://local.taigu.tw/`，等儀表板載入完成。
4. 點選側邊欄的「市場」，再點選「關注」。
5. 開啟 Chrome DevTools 的 Network 分頁，選 throttling 選單的 Offline。
6. 點選「持股」，再點選「關注」，確認控制列出現 ↻。
7. 執行「設定價格」指令，把 2330 設成 `close_price=1010, fluct_price=10`。
8. 選 throttling 選單的 No throttling。
9. 不點選 ↻，停在「關注」分頁等 30 秒。

預期：第 9 步的 30 秒內 ↻ 消失，2330 那一列顯示 1,010。

## FAV-R13.1 沒有自選股

前端沒有自動化 test。

1. 執行「設定自選股」指令，把 `['2330', '2317', '1301']` 換成 `[]`。
2. 開啟 `https://local.taigu.tw/market`。
3. 點選「關注」。

預期：列表的位置顯示「到股票詳情頁點選愛心，就能把常看的股票集中在這裡追蹤。」、「搜尋股票」與「查看持股」；上方的「最愛檔數」、「今日上漲」與「今日下跌」都是 0。
