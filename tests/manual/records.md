注意：這份檔案的指令會刪除或修改開發環境資料庫裡的資料，包括登入帳號的紀錄，所以要用只拿來測試的 Google 帳號登入，不要用存有真實資料的帳號。

每一節開始前，先執行 `make start`，再用 Google 帳號登入 `https://local.taigu.tw`。開發環境的股票清單裡要有 2330 台積電與 2317 鴻海。除了 REC-R7 的兩節之外，登入的帳號要是 Standard 方案或在試用期內，可以在 `https://local.taigu.tw/settings/current-plan` 確認。

步驟寫「在桌面瀏覽器上」時，用電腦的瀏覽器操作；寫「在行動裝置上」時，用手機開啟，或在 Chrome DevTools 開啟 device toolbar、選一款手機之後重新整理頁面，因為 Taigu 依 user agent 判斷版面。步驟寫「沒有連上網路」時，在 Chrome DevTools 的 Network 分頁把 throttling 設成「Offline」，做完那一節再改回「No throttling」。

下面的指令都在 repo 的根目錄執行，執行前把指令裡的 `<你的 email>` 換成登入用的 Google 帳號 email，執行完再重新整理瀏覽器裡的 Taigu。這些指令會一併刪除這個帳號的修改紀錄（`DataChangeLog`），所以另一個登入同一個帳號的瀏覽器可能留著舊的 cache，看到已經刪掉的紀錄；遇到時在那個瀏覽器的 Chrome DevTools 的 Application 分頁按「Clear site data」，再重新登入。

「清空紀錄」的指令會刪除這個帳號所有的交易紀錄與現金股利紀錄：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; from main.trade_record.models import TradeRecord; from main.cash_dividend.models import CashDividendRecord; from main.core.models import DataChangeLog; u = User.objects.get(email='<你的 email>'); TradeRecord.objects.filter(owner=u).delete(); CashDividendRecord.objects.filter(owner=u).delete(); DataChangeLog.objects.filter(user=u).delete()"
```

「建立範例紀錄」的指令會先清空紀錄，再建立四筆紀錄：2024-03-01 買進 2330 台積電 1,000 股、成交單價 600、手續費 855 的交易紀錄，2024-04-01 買進 2317 鴻海 200 股、成交單價 140、手續費 39 的交易紀錄，2024-05-02 賣出 2317 鴻海 200 股、成交單價 150、手續費 132 的交易紀錄，以及 2024-07-15、2330 台積電、現金股利 1,500 的現金股利紀錄：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; from main.trade_record.models import TradeRecord; from main.cash_dividend.models import CashDividendRecord; from main.core.models import DataChangeLog; u = User.objects.get(email='<你的 email>'); TradeRecord.objects.filter(owner=u).delete(); CashDividendRecord.objects.filter(owner=u).delete(); DataChangeLog.objects.filter(user=u).delete(); TradeRecord.objects.create(owner=u, company_id='2330', deal_time='2024-03-01', deal_price=600, deal_quantity=1000, handling_fee=855); TradeRecord.objects.create(owner=u, company_id='2317', deal_time='2024-04-01', deal_price=140, deal_quantity=200, handling_fee=39); TradeRecord.objects.create(owner=u, company_id='2317', deal_time='2024-05-02', deal_price=150, deal_quantity=-200, handling_fee=132); CashDividendRecord.objects.create(owner=u, company_id='2330', deal_time='2024-07-15', cash_dividend=1500)"
```

「建立 40 筆紀錄」的指令會先清空紀錄，再建立 40 筆 2330 台積電的現金股利紀錄，交易日期從 2024-01-01 到 2024-02-09 每天一筆：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "import datetime; from main.account.models import User; from main.trade_record.models import TradeRecord; from main.cash_dividend.models import CashDividendRecord; from main.core.models import DataChangeLog; u = User.objects.get(email='<你的 email>'); TradeRecord.objects.filter(owner=u).delete(); CashDividendRecord.objects.filter(owner=u).delete(); DataChangeLog.objects.filter(user=u).delete(); [CashDividendRecord.objects.create(owner=u, company_id='2330', deal_time=datetime.date(2024, 1, 1) + datetime.timedelta(days=i), cash_dividend=100 + i) for i in range(40)]"
```

「改成 Free 並用完額度」的指令會先清空紀錄，再把帳號改成 Free 方案，並在這個月新增 20 筆現金股利紀錄：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "import datetime; from main.account.models import User; from main.billing.models import BillingProfile; from main.trade_record.models import TradeRecord; from main.cash_dividend.models import CashDividendRecord; from main.core.models import DataChangeLog; u = User.objects.get(email='<你的 email>'); TradeRecord.objects.filter(owner=u).delete(); CashDividendRecord.objects.filter(owner=u).delete(); DataChangeLog.objects.filter(user=u).delete(); BillingProfile.objects.update_or_create(user=u, defaults={'plan': 'free', 'subscription_status': 'canceled'}); [CashDividendRecord.objects.create(owner=u, company_id='2330', deal_time=datetime.date.today(), cash_dividend=1) for _ in range(20)]"
```

「恢復試用期」的指令會把帳號改回還有 31 天的試用期：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import timedelta; from django.utils import timezone; from main.account.models import User; from main.billing.models import BillingProfile; u = User.objects.get(email='<你的 email>'); BillingProfile.objects.filter(user=u).update(plan='standard', subscription_status='trialing', trial_started_at=timezone.now(), trial_ends_at=timezone.now() + timedelta(days=31))"
```

## REC-R1.1 新增一筆買進的交易紀錄

後端的儲存由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 點側邊欄的「新增」。
4. 在「交易日期」選 2024-03-01。
5. 在「股票」輸入 2330，點選搜尋結果裡的台積電。
6. 在「成交單價」輸入 600。
7. 確認買賣開關在「買」。
8. 在「成交股數」輸入 1000。
9. 確認「手續費用」是 855。
10. 點選編輯器的送出按鈕。

預期：編輯器關閉，歷史紀錄頁出現一列，顯示 2330、台積電、2024-03-01、「買入」、「1,000 股」與「成交價」600。

## REC-R1.2 交易紀錄的欄位沒有填完

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上點側邊欄的「新增」。
3. 在「股票」選 2330 台積電。
4. 在「成交單價」輸入 600。
5. 確認「成交股數」是空的。
6. 點選編輯器的送出按鈕。
7. 按 Esc 關閉編輯器，再開啟 `https://local.taigu.tw/records`。

預期：第 6 步時送出按鈕是灰色的停用樣子，點了沒有反應；第 7 步的歷史紀錄頁顯示「目前沒有紀錄」。

## REC-R2.1 新增一筆現金股利紀錄

後端的儲存由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 打開側邊欄「新增」旁的選單，點選「新增現金股利」。
4. 在「交易日期」選 2024-07-15。
5. 在「股票」選 2330 台積電。
6. 在「現金股利」輸入 1500。
7. 點選編輯器的送出按鈕。

預期：編輯器關閉，歷史紀錄頁出現一列，顯示 2330、台積電、2024-07-15、「股利」與「現金股利」1,500。

## REC-R3.1 買進的預設手續費

前端沒有自動化 test。

1. 在桌面瀏覽器上點側邊欄的「新增」。
2. 確認買賣開關在「買」。
3. 在「成交單價」輸入 50.5。
4. 在「成交股數」輸入 1000。

預期：「手續費用」顯示 71。

## REC-R3.2 賣出的預設手續費

前端沒有自動化 test。

1. 在桌面瀏覽器上點側邊欄的「新增」。
2. 點買賣開關，切到「賣」。
3. 在「成交單價」輸入 600。
4. 在「成交股數」輸入 1000。

預期：「手續費用」顯示 2655。

## REC-R3.3 算出來的手續費不到 1 元

前端沒有自動化 test。

1. 在桌面瀏覽器上點側邊欄的「新增」。
2. 確認買賣開關在「買」。
3. 在「成交單價」輸入 10。
4. 在「成交股數」輸入 1。

預期：「手續費用」顯示 1。

## REC-R3.4 編輯紀錄時修改成交單價

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上點側邊欄的「新增」，填好 2024-03-01、2330 台積電、成交單價 600、買、成交股數 1000。
3. 把「手續費用」改成 20。
4. 點選編輯器的送出按鈕。
5. 開啟 `https://local.taigu.tw/records`。
6. 把滑鼠移到這筆紀錄上，點鉛筆圖示的編輯按鈕。
7. 確認「手續費用」是 20。
8. 把「成交單價」改成 610。

預期：「手續費用」變成 869。

## REC-R4.1 沒有連上網路時送出

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上點側邊欄的「新增」，填好 2024-03-01、2330 台積電、成交單價 600、買、成交股數 1000。
3. 把 Network throttling 設成「Offline」。
4. 點選編輯器的送出按鈕。
5. 把 Network throttling 改回「No throttling」。
6. 按 Esc 關閉編輯器，重新整理頁面，再開啟 `https://local.taigu.tw/records`。

預期：第 4 步之後畫面出現錯誤提示，編輯器沒有關閉，五個欄位的值都還在；第 6 步的歷史紀錄頁顯示「目前沒有紀錄」。

## REC-R5.2 金額是負數

負的現金股利由 unit test 驗證；負的成交單價與手續費沒有 unit test，而且編輯器送不出這種紀錄，所以要在瀏覽器的 console 直接送出 request。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 開啟 Chrome DevTools 的 Console 分頁。
4. 在 Console 執行下面的程式碼，送出成交單價是 -1 的交易紀錄：

   ```js
   fetch("/api/trade-records", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "" }, body: JSON.stringify({ deal_time: "2024-03-01", sid: "2330", deal_price: -1, deal_quantity: 1000, handling_fee: 1 }) }).then((response) => response.json()).then(console.log);
   ```

5. 在 Console 執行下面的程式碼，送出手續費是 -1 的交易紀錄：

   ```js
   fetch("/api/trade-records", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "" }, body: JSON.stringify({ deal_time: "2024-03-01", sid: "2330", deal_price: 600, deal_quantity: 1000, handling_fee: -1 }) }).then((response) => response.json()).then(console.log);
   ```

6. 重新整理頁面。

預期：第 4 步印出 `{message: 'Deal price must be positive'}`，第 5 步印出 `{message: 'Handling fee must be positive'}`，重新整理後歷史紀錄頁仍顯示「目前沒有紀錄」。

## REC-R7.1 在桌面瀏覽器上新增超過額度的紀錄

前端沒有自動化 test，額度擋下時的畫面只能人工確認。

1. 執行「改成 Free 並用完額度」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 點側邊欄的「新增」，填好 2024-03-01、2330 台積電、成交單價 600、買、成交股數 1000。
4. 點選編輯器的送出按鈕。
5. 點 `PlanUpsellModal` 的「稍後再說」。
6. 在搜尋框輸入「買入」。
7. 執行「恢復試用期」的指令。

預期：第 4 步之後畫面出現標題是「這個月的新增額度已用完」的 `PlanUpsellModal`；第 6 步的歷史紀錄頁顯示「目前沒有紀錄」。

## REC-R7.2 在行動裝置上新增超過額度的紀錄

前端沒有自動化 test，額度擋下時的畫面只能人工確認。

1. 執行「改成 Free 並用完額度」的指令。
2. 在行動裝置上開啟 `https://local.taigu.tw/records`。
3. 點加號按鈕，再點「新增交易紀錄」。
4. 填好 2024-03-01、2330 台積電、成交單價 600、買、成交股數 1000。
5. 點選編輯頁的送出按鈕。
6. 點 `PlanUpsellModal` 的「稍後再說」。
7. 執行「恢復試用期」的指令。

預期：第 5 步之後畫面出現標題是「這個月的新增額度已用完」的 `PlanUpsellModal`；第 6 步之後畫面仍是新增交易紀錄的編輯頁，2024-03-01、台積電、600、買、1000 都還在。

## REC-R8.1 修改交易紀錄

後端的修改由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 把滑鼠移到 2024-05-02 那筆交易紀錄上，點鉛筆圖示的編輯按鈕。
4. 確認編輯器的標題是「編輯交易紀錄」，買賣開關在「賣」，「成交股數」是 200。
5. 把「成交股數」改成 100。
6. 點選編輯器的送出按鈕。

預期：編輯器關閉，2024-05-02 那筆紀錄顯示「賣出」與「100 股」。

## REC-R8.2 修改現金股利紀錄

後端的修改由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 把滑鼠移到 2024-07-15 那筆現金股利紀錄上，點鉛筆圖示的編輯按鈕。
4. 把「現金股利」改成 1800。
5. 點選編輯器的送出按鈕。

預期：編輯器關閉，2024-07-15 那筆紀錄顯示「現金股利」1,800。

## REC-R9.1 在桌面瀏覽器上刪除交易紀錄

後端的刪除由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 把滑鼠移到 2024-03-01 那筆交易紀錄上，點垃圾桶圖示的刪除按鈕。
4. 確認確認視窗的標題是「刪除交易紀錄？」，說明是「刪除後，這筆紀錄會從投資績效、持股與手續費統計中移除。」。
5. 點選「刪除交易紀錄」。

預期：確認視窗關閉，2024-03-01 那筆交易紀錄從列表消失。

## REC-R9.2 在行動裝置上刪除現金股利紀錄

後端的刪除由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在行動裝置上開啟 `https://local.taigu.tw/records`。
3. 按住 2024-07-15 那筆現金股利紀錄 1 秒後放開。
4. 點選畫面下方出現的「刪除」。
5. 確認確認視窗的標題是「刪除現金股利？」。
6. 點選「刪除現金股利」。

預期：確認視窗關閉，2024-07-15 那筆現金股利紀錄從列表消失。

## REC-R9.3 在編輯器裡刪除

後端的刪除由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 把滑鼠移到 2024-03-01 那筆交易紀錄上，點鉛筆圖示的編輯按鈕。
4. 點選編輯器下方的「刪除交易紀錄」。
5. 在確認視窗點選「刪除交易紀錄」。

預期：確認視窗與編輯器都關閉，2024-03-01 那筆交易紀錄從列表消失。

## REC-R9.4 刪除失敗

前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 把 Network throttling 設成「Offline」。
4. 把滑鼠移到 2024-03-01 那筆交易紀錄上，點垃圾桶圖示的刪除按鈕。
5. 在確認視窗點選「刪除交易紀錄」。
6. 把 Network throttling 改回「No throttling」。

預期：第 5 步之後畫面出現錯誤提示，確認視窗沒有關閉，2024-03-01 那筆交易紀錄仍然在列表上。

## REC-R10.1 在桌面瀏覽器上從側邊欄新增現金股利紀錄

前端沒有自動化 test。

1. 在桌面瀏覽器上開啟 `https://local.taigu.tw/`。
2. 點側邊欄「新增」右側的三角形，打開選單。
3. 點選「新增現金股利」。

預期：儀表板上方出現標題是「新增現金股利」的編輯器視窗。

## REC-R10.2 在行動裝置上從個股詳情頁新增現金股利紀錄

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/market/2330`。
2. 點加號按鈕。
3. 點選「新增現金股利」。

預期：網址變成 `https://local.taigu.tw/records/cash-dividend/new?sid=2330`，編輯頁的「股票」已經顯示「台積電」與「2330」。

## REC-R11.1 在行動裝置上點歷史紀錄頁的一列

前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在行動裝置上開啟 `https://local.taigu.tw/records`。
3. 點 2024-03-01 那筆交易紀錄。

預期：網址變成 `https://local.taigu.tw/records/trade/<這筆紀錄的 id>/edit`，畫面是標題為「編輯交易紀錄」的編輯頁，欄位是 2024-03-01、台積電 2330、600、買、1000、855。

## REC-R12.1 送出後回到前一頁

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/`。
2. 點加號按鈕，再點「新增交易紀錄」。
3. 填好 2024-03-01、2330 台積電、成交單價 600、買、成交股數 1000。
4. 點選編輯頁的送出按鈕。

預期：畫面回到儀表板，網址是 `https://local.taigu.tw/`。

## REC-R12.2 直接開啟編輯頁的網址後送出

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在瀏覽器開一個新分頁。
3. 在新分頁的網址列輸入 `https://local.taigu.tw/records/cash-dividend/new` 並開啟。
4. 在「交易日期」選 2024-07-15，在「股票」選 2330 台積電，在「現金股利」輸入 1500。
5. 點選編輯頁的送出按鈕。

預期：畫面換到 `https://local.taigu.tw/records`，列表上有 2024-07-15、2330 台積電、「現金股利」1,500 的那一列。

## REC-R13.1 沒有修改就按返回

前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在行動裝置上開啟 `https://local.taigu.tw/records`。
3. 點 2024-03-01 那筆交易紀錄。
4. 不修改任何欄位，點左上角的返回箭頭。

預期：畫面直接回到歷史紀錄頁，沒有出現確認視窗。

## REC-R13.2 有還沒送出的修改時按返回

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在行動裝置上開啟 `https://local.taigu.tw/records`。
3. 點加號按鈕，再點「新增交易紀錄」。
4. 在「成交單價」輸入 600。
5. 點左上角的返回箭頭。
6. 確認確認視窗的標題是「捨棄變更？」，說明是「離開後，尚未送出的內容不會被儲存。」。
7. 點選「捨棄變更」。

預期：畫面回到歷史紀錄頁，頁面顯示「目前沒有紀錄」。

## REC-R13.3 選擇繼續編輯

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/records`。
2. 點加號按鈕，再點「新增交易紀錄」。
3. 在「成交單價」輸入 600。
4. 點左上角的返回箭頭。
5. 在「捨棄變更？」確認視窗點選「繼續編輯」。

預期：確認視窗關閉，畫面仍是新增交易紀錄的編輯頁，「成交單價」仍是 600。

## REC-R14.1 找不到要編輯的交易紀錄

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/records/trade/999999/edit`。

預期：編輯頁顯示「找不到這筆資料，可能已經被刪除或尚未載入完成。」，頁面上只有返回箭頭，沒有送出按鈕。

## REC-R15.1 列表的順序與內容

前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 開啟 `https://local.taigu.tw/records`。

預期：列表由上到下有四列。第一列顯示 2330、台積電、2024-07-15、「股利」與「現金股利」1,500；第二列顯示 2317、鴻海、2024-05-02、「賣出」、「200 股」與「成交價」150；第三列顯示 2317、鴻海、2024-04-01、「買入」、「200 股」與「成交價」140；第四列顯示 2330、台積電、2024-03-01、「買入」、「1,000 股」與「成交價」600。

## REC-R15.2 同一天有交易紀錄與現金股利紀錄

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上新增一筆 2024-07-15、2330 台積電、現金股利 1500 的現金股利紀錄。
3. 新增一筆 2024-07-15 買進 2330 台積電 1,000 股、成交單價 600 的交易紀錄。
4. 重新整理 `https://local.taigu.tw/records`。

預期：「買入」那一列排在「股利」那一列上面。

## REC-R16.1 紀錄超過 15 筆

前端沒有自動化 test。

1. 執行「建立 40 筆紀錄」的指令。
2. 在桌面瀏覽器上把視窗的高度調到約 400px。
3. 開啟 `https://local.taigu.tw/records`，不捲動。
4. 在 Chrome DevTools 的 Console 執行 `document.querySelectorAll('[class*="record_row"]').length`。
5. 一直往下捲動列表，直到不再出現新的列。
6. 在 Console 再執行一次第 4 步的程式碼。

預期：第 4 步印出 15；第 6 步印出 40，列表的最後一列是 2024-01-01，沒有日期重複的列。

## REC-R17.1 用股票代號搜尋

前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 開啟 `https://local.taigu.tw/records`。
3. 在搜尋框輸入 2330。

預期：列表只剩 2024-07-15 的現金股利紀錄與 2024-03-01 的交易紀錄兩列。

## REC-R17.2 從網址帶入關鍵字

前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 開啟 `https://local.taigu.tw/records?sid=2317`。

預期：搜尋框裡是 2317，列表只剩 2317 鴻海的兩列。

## REC-R18.1 還沒有任何紀錄

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 開啟 `https://local.taigu.tw/records`。

預期：頁面顯示「目前沒有紀錄」。

## REC-R18.2 沒有紀錄符合關鍵字

前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 開啟 `https://local.taigu.tw/records`。
3. 在搜尋框輸入 9999。

預期：頁面顯示「目前沒有紀錄」。

## REC-R19.1 在另一台裝置修改過紀錄

後端回傳其他裝置的修改由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。這一節用 Chrome 的一般視窗當裝置 A，用無痕視窗當裝置 B。

1. 執行「建立範例紀錄」的指令。
2. 在裝置 A 開啟 Chrome DevTools 的 Application 分頁，按「Clear site data」。
3. 在裝置 A 重新登入，開啟 `https://local.taigu.tw/records`，確認列表有四列。
4. 在裝置 B 登入同一個 Google 帳號，開啟 `https://local.taigu.tw/records`。
5. 在裝置 B 新增一筆 2024-06-03 買進 2330 台積電 100 股、成交單價 610 的交易紀錄。
6. 在裝置 B 刪除 2024-05-02 那筆 2317 鴻海的交易紀錄。
7. 在裝置 A 重新整理頁面。

預期：裝置 A 的列表有 2024-06-03 那一列，沒有 2024-05-02 那一列，2024-07-15、2024-04-01 與 2024-03-01 三列都還在。

## REC-R20.1 匯出交易紀錄

API 回傳的欄位由 unit test 驗證，下載的檔案要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 開啟 `https://local.taigu.tw/settings/data-controls`。
3. 點選「匯出所有交易紀錄」。
4. 用文字編輯器開啟下載的 `trade-records.json`。

預期：檔案裡依序列出 2024-05-02、2024-04-01 與 2024-03-01 三筆交易紀錄，每一筆有 `id`、`deal_time`、`sid`、`company_name`、`deal_price`、`deal_quantity` 與 `handling_fee`，2024-05-02 那筆的 `deal_quantity` 是 -200。

## REC-R20.2 匯出現金股利紀錄

API 回傳的欄位由 unit test 驗證，下載的檔案要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 開啟 `https://local.taigu.tw/settings/data-controls`。
3. 點選「匯出所有現金股利紀錄」。
4. 用文字編輯器開啟下載的 `cash-dividend-records.json`。

預期：檔案裡列出一筆現金股利紀錄，有 `id`、`deal_time`、`sid`、`company_name` 與 `cash_dividend`，`deal_time` 是 2024-07-15，`cash_dividend` 是 1500。
