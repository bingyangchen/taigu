注意：這份檔案的指令會刪除或修改開發環境資料庫裡的資料，包括登入帳號的紀錄，所以要用只拿來測試的 Google 帳號登入，不要用存有真實資料的帳號。

每一節開始前，先執行 `make start`，再用 Google 帳號登入 `https://local.taigu.tw`。開發環境的股票清單裡要有 2330 台積電與 2317 鴻海。除了 REC-R7 的各節之外，登入的帳號要是 Standard 方案或在試用期內，可以在 `https://local.taigu.tw/settings/current-plan` 確認。

前端依可用畫面的大小切換版面，不看 user agent，可用畫面改變時版面立刻跟著換，不用重新整理。各種寫法的操作方式如下：

- 「以寬版」或「在桌面瀏覽器上」：用電腦上的 Chrome，不開 device toolbar，把視窗調整到可用畫面是 1280 × 800，可以在 Console 執行 `[innerWidth, innerHeight]` 確認。
- 「以窄版」或「在行動裝置上」：在 Chrome DevTools 開啟 device toolbar（Toggle device toolbar），在 Dimensions 選「Responsive」並輸入 390 × 844，或選 iPhone 14 Pro 這類手機。
- 寫出 1280 × 800 以外的可用畫面大小時，例如 768 × 1024：在 device toolbar 的 Dimensions 選「Responsive」並輸入那個大小。
- 「在觸控裝置上」：在 device toolbar 選一款手機或平板，因為選了手機或平板，Chrome 才會模擬觸控。窄版的觸控裝置選 iPhone 14 Pro，寬版的觸控裝置選 iPad Mini（768 × 1024）。

以寬版操作側邊欄的「新增」之前，先確認側邊欄是展開的，收合時點側邊欄頂端的展開按鈕，因為在收合的側邊欄點「新增」會開啟選單，而不是新增交易紀錄的編輯器。

在窄版的編輯頁上，步驟要填的欄位所在的段落收合著時，先點那一段把它展開。

步驟寫「沒有連上網路」時，在 Chrome DevTools 的 Network 分頁把 throttling 設成「Offline」，做完那一節再改回「No throttling」。

下面的指令都在 repo 的根目錄執行，執行前把指令裡的 `<你的 email>` 換成登入用的 Google 帳號 email，執行完再重新整理瀏覽器裡的 Taigu。這些指令會一併刪除這個帳號的修改紀錄（`DataChangeLog`），所以另一個登入同一個帳號的瀏覽器可能留著舊的 cache，看到已經刪掉的紀錄；遇到時在那個瀏覽器的 Chrome DevTools 的 Application 分頁按「Clear site data」，再重新登入。

「清空紀錄」的指令會刪除這個帳號所有的交易紀錄與現金股利紀錄：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; from main.trade_record.models import TradeRecord; from main.cash_dividend.models import CashDividendRecord; from main.core.models import DataChangeLog; u = User.objects.get(email='<你的 email>'); TradeRecord.objects.filter(owner=u).delete(); CashDividendRecord.objects.filter(owner=u).delete(); DataChangeLog.objects.filter(user=u).delete()"
```

「建立範例紀錄」的指令會先清空紀錄，再建立四筆紀錄：2024-03-01 買進 2330 台積電 1,000 股、成交單價 600、手續費 855 的交易紀錄，2024-04-01 買進 2317 鴻海 200 股、成交單價 140、手續費 39 的交易紀錄，2024-05-02 賣出 2317 鴻海 200 股、成交單價 150、手續費 132 的交易紀錄，以及 2024-07-15、2330 台積電、入帳金額 1,500 的現金股利紀錄：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; from main.trade_record.models import TradeRecord; from main.cash_dividend.models import CashDividendRecord; from main.core.models import DataChangeLog; u = User.objects.get(email='<你的 email>'); TradeRecord.objects.filter(owner=u).delete(); CashDividendRecord.objects.filter(owner=u).delete(); DataChangeLog.objects.filter(user=u).delete(); TradeRecord.objects.create(owner=u, company_id='2330', deal_time='2024-03-01', deal_price=600, deal_quantity=1000, handling_fee=855); TradeRecord.objects.create(owner=u, company_id='2317', deal_time='2024-04-01', deal_price=140, deal_quantity=200, handling_fee=39); TradeRecord.objects.create(owner=u, company_id='2317', deal_time='2024-05-02', deal_price=150, deal_quantity=-200, handling_fee=132); CashDividendRecord.objects.create(owner=u, company_id='2330', deal_time='2024-07-15', cash_dividend=1500)"
```

「建立 40 筆紀錄」的指令會先清空紀錄，再建立 40 筆 2330 台積電的現金股利紀錄，入帳日期從 2024-01-01 到 2024-02-09 每天一筆：

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

編輯器送出的內容與完成畫面由 unit test 驗證；歷史紀錄頁上的那一列要人工確認，因為 unit test 沒有涵蓋歷史紀錄頁讀到新紀錄之後的畫面。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 點側邊欄的「新增」。
4. 確認「買賣別」是「買進」，在「股票」輸入 2330 並點選搜尋結果裡的台積電，在「交易日期」欄位選 2024-03-01，確認成交股數的單位是「張」（不是的話點「張」），「成交股數」輸入 1，「成交單價」輸入 600。
5. 確認「手續費用」是 855。
6. 點「新增買進紀錄」。
7. 在完成畫面點「完成」。

預期：第 6 步之後編輯器顯示「已新增買進紀錄」的完成畫面；第 7 步之後編輯器關閉，歷史紀錄頁出現一列，顯示 2330、台積電、2024-03-01、「買進」、「1,000 股」與「成交價」600。

## REC-R2.1 新增一筆現金股利紀錄

編輯器送出的內容與完成畫面由 unit test 驗證；歷史紀錄頁上的那一列要人工確認，因為 unit test 沒有涵蓋歷史紀錄頁讀到新紀錄之後的畫面。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 打開側邊欄「新增」旁的選單，點「新增現金股利」。
4. 在「股票」輸入 2330，點選搜尋結果裡的台積電。
5. 在「入帳日期」欄位選 2024-07-15。
6. 在「入帳金額」輸入 1500。
7. 點「新增現金股利」。
8. 在完成畫面點「完成」。

預期：第 7 步之後編輯器顯示「已新增現金股利」的完成畫面；第 8 步之後編輯器關閉，歷史紀錄頁出現一列，顯示 2330、台積電、2024-07-15、「股利」與「入帳金額」1,500。

## REC-R4.1 沒有連上網路時送出

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上點側邊欄的「新增」，確認「買賣別」是「買進」，在「股票」輸入 2330 並點選搜尋結果裡的台積電，在「交易日期」欄位選 2024-03-01，確認成交股數的單位是「張」（不是的話點「張」），「成交股數」輸入 1，「成交單價」輸入 600。
3. 把 Network throttling 設成「Offline」。
4. 點「新增買進紀錄」。
5. 把 Network throttling 改回「No throttling」。
6. 按 Esc，在「捨棄變更？」確認視窗點「捨棄變更」，重新整理頁面，再開啟 `https://local.taigu.tw/records`。

預期：第 4 步之後畫面出現錯誤提示，編輯器沒有關閉，填好的內容都還在；第 6 步的歷史紀錄頁顯示「目前沒有紀錄」。

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

## REC-R7.1 在寬版新增超過額度的紀錄

後端回應額度不足時，畫面才會出現被額度擋下的提示，unit test 沒有涵蓋這種情況，所以要人工確認。

1. 執行「改成 Free 並用完額度」的指令。
2. 以寬版開啟 `https://local.taigu.tw/records`。
3. 點側邊欄的「新增」，確認「買賣別」是「買進」，在「股票」輸入 2330 並點選搜尋結果裡的台積電，在「交易日期」欄位選 2024-03-01，確認成交股數的單位是「張」（不是的話點「張」），「成交股數」輸入 1，「成交單價」輸入 600。
4. 點「新增買進紀錄」。
5. 點 `PlanUpsellModal` 的「稍後再說」。
6. 按 Esc，在「捨棄變更？」確認視窗點「捨棄變更」。
7. 在搜尋框輸入「買進」。
8. 執行「恢復試用期」的指令。

預期：第 4 步之後畫面出現標題是「這個月的新增額度已用完」的 `PlanUpsellModal`；第 5 步之後編輯器的視窗仍然開著，2330 台積電、2024-03-01、1 張與 600 都還在；第 7 步的歷史紀錄頁顯示「目前沒有紀錄」。

## REC-R7.2 在窄版新增超過額度的紀錄

後端回應額度不足時，畫面才會出現被額度擋下的提示，unit test 沒有涵蓋這種情況，所以要人工確認。

1. 執行「改成 Free 並用完額度」的指令。
2. 以窄版開啟 `https://local.taigu.tw/records`。
3. 點加號按鈕，再點「新增交易紀錄」。
4. 確認「買賣別」是「買進」，在「股票」輸入 2330 並點選搜尋結果裡的台積電，在「交易日期」欄位選 2024-03-01，確認成交股數的單位是「張」（不是的話點「張」），「成交股數」輸入 1，「成交單價」輸入 600。
5. 點「新增買進紀錄」。
6. 點 `PlanUpsellModal` 的「稍後再說」。
7. 執行「恢復試用期」的指令。

預期：第 5 步之後畫面出現標題是「這個月的新增額度已用完」的 `PlanUpsellModal`；第 6 步之後畫面仍是新增交易紀錄的編輯頁，買進、2330 台積電、2024-03-01、1 張與 600 都還在。

## REC-R7.3 被額度擋下後查看方案

後端回應額度不足時，畫面才會出現被額度擋下的提示，unit test 沒有涵蓋這種情況，所以要人工確認。

1. 執行「改成 Free 並用完額度」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 點側邊欄的「新增」，確認「買賣別」是「買進」，在「股票」輸入 2330 並點選搜尋結果裡的台積電，在「交易日期」欄位選 2024-03-01，確認成交股數的單位是「張」（不是的話點「張」），「成交股數」輸入 1，「成交單價」輸入 600。
4. 點「新增買進紀錄」。
5. 點 `PlanUpsellModal` 的「查看 Standard 方案」。
6. 執行「恢復試用期」的指令。

預期：第 5 步之後畫面換到 `https://local.taigu.tw/settings/current-plan`，沒有出現「捨棄變更？」確認視窗，編輯器的視窗已經關閉。

## REC-R7.4 在編輯頁被擋下後查看方案

後端回應額度不足時，畫面才會出現被額度擋下的提示，unit test 沒有涵蓋這種情況，所以要人工確認。

1. 執行「改成 Free 並用完額度」的指令。
2. 在行動裝置上開啟 `https://local.taigu.tw/records`。
3. 點加號按鈕，再點「新增交易紀錄」。
4. 確認「買賣別」是「買進」，在「股票」輸入 2330 並點選搜尋結果裡的台積電，在「交易日期」欄位選 2024-03-01，確認成交股數的單位是「張」（不是的話點「張」），「成交股數」輸入 1，「成交單價」輸入 600。
5. 點「新增買進紀錄」。
6. 點 `PlanUpsellModal` 的「查看 Standard 方案」。
7. 執行「恢復試用期」的指令。

預期：第 6 步之後畫面換到 `https://local.taigu.tw/settings/current-plan`，沒有出現「捨棄變更？」確認視窗。

## REC-R8.1 修改交易紀錄

編輯器帶入的內容與送出的內容由 unit test 驗證；歷史紀錄頁上修改後的那一列要人工確認。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 點 2024-05-02 那筆交易紀錄。
4. 確認編輯器的標題是「編輯交易紀錄」，「買賣別」是「賣出」，「成交股數」是 200，單位是「股」。
5. 把「成交股數」改成 100。
6. 點「儲存變更」。

預期：編輯器關閉，2024-05-02 那筆紀錄顯示「賣出」與「100 股」。

## REC-R8.2 修改現金股利紀錄

編輯器送出的內容由 unit test 驗證；歷史紀錄頁上修改後的那一列要人工確認。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 點 2024-07-15 那筆現金股利紀錄。
4. 把「入帳金額」改成 1800。
5. 點「儲存變更」。

預期：編輯器關閉，2024-07-15 那筆紀錄顯示「入帳金額」1,800。

## REC-R9.1 在桌面瀏覽器上刪除交易紀錄

後端刪除紀錄的部分由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 把滑鼠移到 2024-03-01 那筆交易紀錄上，點垃圾桶圖示的刪除按鈕。
4. 檢查確認視窗的標題是「刪除交易紀錄？」，說明是「刪除後，這筆紀錄會從投資績效、持股與手續費統計中移除。」，內容寫出「買進」與「1,000 股」。
5. 點選「刪除交易紀錄」。

預期：確認視窗關閉，2024-03-01 那筆交易紀錄從列表消失。

## REC-R9.2 在窄版用長按刪除現金股利紀錄

只有窄版的觸控裝置能長按由 unit test 驗證；長按在真實瀏覽器裡的觸控事件與刪除後的畫面要人工確認，因為 jsdom 沒有實際的觸控與版面。

1. 執行「建立範例紀錄」的指令。
2. 以窄版在觸控裝置上開啟 `https://local.taigu.tw/records`。
3. 按住 2024-07-15 那筆現金股利紀錄 1 秒後放開。
4. 點選畫面下方出現的「刪除」。
5. 檢查確認視窗的標題是「刪除現金股利？」，內容寫出「入帳金額」1,500。
6. 點選「刪除現金股利」。

預期：第 3 步之後畫面下方出現「編輯」與「刪除」，沒有開啟編輯頁；第 5 步的確認視窗標題是「刪除現金股利？」，內容寫出「入帳金額」1,500；第 6 步之後確認視窗關閉，2024-07-15 那筆現金股利紀錄從列表消失。

## REC-R9.3 在編輯器裡刪除

後端刪除紀錄的部分由 unit test 驗證，畫面上的結果要人工確認，因為前端沒有自動化 test。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/records`。
3. 點 2024-03-01 那筆交易紀錄。
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

## REC-R10.1 以寬版從側邊欄新增現金股利紀錄

選單開啟的編輯器要在真實瀏覽器的版面裡確認，前端沒有自動化 test。

1. 以 1280 × 800 的可用畫面開啟 `https://local.taigu.tw/`。
2. 側邊欄是收合的時，點側邊欄頂端的展開按鈕。
3. 點側邊欄「新增」右側的三角形，打開選單。
4. 點選「新增現金股利」。

預期：儀表板上方出現標題是「新增現金股利」的編輯器視窗。

## REC-R10.2 以窄版從個股詳情頁新增現金股利紀錄

前端沒有自動化 test。

1. 以窄版開啟 `https://local.taigu.tw/market/2330`。
2. 點加號按鈕。
3. 點選「新增現金股利」。

預期：網址變成 `https://local.taigu.tw/records/cash-dividend/new?sid=2330`，編輯頁的「股票」已經顯示「台積電」與「2330」。

## REC-R10.3 從圖示列新增現金股利紀錄

點「新增」開啟選單由 unit test 驗證；選單在 64px 寬的圖示列旁的位置與開啟的編輯器視窗要在真實瀏覽器的版面裡確認，因為 jsdom 沒有版面。

1. 用 device toolbar 把可用畫面設成 768 × 1024，開啟 `https://local.taigu.tw/`。
2. 確認側邊欄是只有圖示的一列。
3. 點側邊欄的「新增」圖示。
4. 點選「新增現金股利」。

預期：第 3 步之後「新增」下方出現「新增交易紀錄」「新增現金股利」「新增買賣計畫」三個選項的選單，選單沒有被側邊欄切掉，畫面沒有出現編輯器；第 4 步之後儀表板上方出現標題是「新增現金股利」的編輯器視窗。

## REC-R10.4 從使用者收合的側邊欄新增買賣計畫

點「新增」開啟選單由 unit test 驗證；選單的位置與開啟的編輯器視窗要在真實瀏覽器的版面裡確認，因為 jsdom 沒有版面。

1. 以 1280 × 800 的可用畫面開啟 `https://local.taigu.tw/`。
2. 側邊欄是展開的時，點側邊欄頂端的收合按鈕。
3. 點側邊欄的「新增」圖示。
4. 點選「新增買賣計畫」。

預期：第 3 步之後「新增」下方出現「新增交易紀錄」「新增現金股利」「新增買賣計畫」三個選項的選單，畫面沒有出現編輯器；第 4 步之後儀表板上方出現新增買賣計畫的編輯器視窗。

## REC-R11.1 在窄版點歷史紀錄頁的一列

點一列換到編輯頁由 unit test 驗證；編輯頁在真實瀏覽器裡帶入的內容與段落要人工確認。

1. 執行「建立範例紀錄」的指令。
2. 以窄版開啟 `https://local.taigu.tw/records`。
3. 點 2024-03-01 那筆交易紀錄。

預期：網址變成 `https://local.taigu.tw/records/trade/<這筆紀錄的 id>/edit`，畫面是標題為「編輯交易紀錄」的編輯頁，四段都收合，摘要分別是「買進・2330 台積電」「2024/3/1（五）」「1 張 × 600 元」與「855 元」。

## REC-R11.2 在寬版點歷史紀錄頁的一列

點一列開啟編輯器視窗由 unit test 驗證；寬版的觸控裝置上點一列與長按一列的結果要在模擬觸控的瀏覽器裡確認，因為 jsdom 沒有實際的觸控。

1. 執行「建立範例紀錄」的指令。
2. 以寬版開啟 `https://local.taigu.tw/records`。
3. 點 2024-03-01 那筆交易紀錄。
4. 按 Esc 關閉編輯器視窗。
5. 把滑鼠移到 2024-03-01 那筆交易紀錄上。
6. 以寬版在觸控裝置上開啟 `https://local.taigu.tw/records`。
7. 點 2024-03-01 那筆交易紀錄。
8. 按 Esc 關閉編輯器視窗。
9. 按住 2024-03-01 那筆交易紀錄 1 秒後放開。

預期：

- 第 3 步與第 7 步之後，歷史紀錄頁上方出現標題是「編輯交易紀錄」的編輯器視窗，「買賣別」是「買進」，「股票」是 2330 台積電，「成交單價」是 600，網址的路徑仍是 `/records`。
- 第 5 步時那一列的右側只出現垃圾桶圖示的刪除按鈕，沒有鉛筆圖示的編輯按鈕。
- 第 9 步之後畫面出現同一個編輯器視窗，畫面下方沒有出現「編輯」與「刪除」。

## REC-R12.1 送出後回到前一頁

離開編輯頁之後換到哪一頁，要在瀏覽器裡實際操作才能確認，unit test 沒有涵蓋這種情況。

1. 執行「清空紀錄」的指令。
2. 以窄版開啟 `https://local.taigu.tw/`。
3. 點加號按鈕，再點「新增交易紀錄」。
4. 確認「買賣別」是「買進」，在「股票」輸入 2330 並點選搜尋結果裡的台積電，在「交易日期」欄位選 2024-03-01，確認成交股數的單位是「張」（不是的話點「張」），「成交股數」輸入 1，「成交單價」輸入 600。
5. 點「新增買進紀錄」。
6. 在完成畫面點「完成」。

預期：第 5 步之後畫面顯示「已新增買進紀錄」的完成畫面；第 6 步之後畫面回到儀表板。

## REC-R12.2 直接開啟編輯頁的網址後送出

離開編輯頁之後換到哪一頁，要在瀏覽器裡實際操作才能確認，unit test 沒有涵蓋這種情況。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器開一個新分頁。
3. 在網址列輸入 `https://local.taigu.tw/records/cash-dividend/new` 並開啟。
4. 在「股票」選 2330 台積電，在「入帳日期」欄位選 2024-07-15，在「入帳金額」輸入 1500。
5. 點「新增現金股利」。
6. 在完成畫面點「完成」。

預期：畫面換到 `https://local.taigu.tw/records`，列表上有 2024-07-15、2330 台積電、「入帳金額」1,500 的那一列。

## REC-R12.4 編輯紀錄後直接回到前一頁

離開編輯頁之後換到哪一頁，要在瀏覽器裡實際操作才能確認，unit test 沒有涵蓋這種情況。

1. 執行「建立範例紀錄」的指令。
2. 以窄版開啟 `https://local.taigu.tw/records`。
3. 點 2024-03-01 那筆交易紀錄。
4. 點「股數與單價」，把「成交單價」改成 610。
5. 點「儲存變更」。

預期：畫面直接回到歷史紀錄頁，沒有顯示完成畫面。

## REC-R12.6 用完成畫面的返回箭頭離開

離開編輯頁之後換到哪一頁，要在瀏覽器裡實際操作才能確認，unit test 沒有涵蓋這種情況。

1. 執行「清空紀錄」的指令。
2. 以窄版開啟 `https://local.taigu.tw/`。
3. 點加號按鈕，再點「新增交易紀錄」。
4. 確認「買賣別」是「買進」，在「股票」輸入 2330 並點選搜尋結果裡的台積電，在「交易日期」欄位選 2024-03-01，確認成交股數的單位是「張」（不是的話點「張」），「成交股數」輸入 1，「成交單價」輸入 600。
5. 點「新增買進紀錄」。
6. 在完成畫面點左上角的返回箭頭。

預期：畫面回到儀表板，沒有出現確認視窗。

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
6. 檢查確認視窗的標題是「捨棄變更？」，說明是「離開後，尚未送出的內容不會被儲存。」。
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

## REC-R13.8 預先選好股票的編輯頁直接返回

從個股詳情頁開啟編輯頁、再回到個股詳情頁，要在實際的 routing 裡確認，unit test 沒有涵蓋。

1. 以窄版開啟 `https://local.taigu.tw/market/2330`。
2. 點加號按鈕，再點「新增交易紀錄」。
3. 確認「買賣與股票」的摘要是「買進・2330 台積電」。
4. 不修改任何欄位，點左上角的返回箭頭。

預期：畫面直接回到 2330 台積電的個股詳情頁，沒有出現確認視窗。

## REC-R13.9 用瀏覽器的上一頁關閉有修改的視窗

按瀏覽器的上一頁會改變瀏覽器實際的瀏覽紀錄，unit test 沒有涵蓋，所以要人工確認。

1. 以寬版開啟 `https://local.taigu.tw/records`。
2. 點側邊欄的「新增」，在「成交單價」輸入 600。
3. 按瀏覽器的上一頁。
4. 在「捨棄變更？」確認視窗點「繼續編輯」。
5. 再按一次瀏覽器的上一頁。
6. 在「捨棄變更？」確認視窗點「捨棄變更」。

預期：第 3 步與第 5 步之後都出現「捨棄變更？」確認視窗；第 4 步之後編輯器的視窗仍然開著，「成交單價」仍是 600；第 6 步之後視窗關閉，畫面是歷史紀錄頁。

## REC-R14.1 找不到要編輯的交易紀錄

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/records/trade/999999/edit`。

預期：編輯頁顯示「找不到這筆資料，可能已經被刪除或尚未載入完成。」，頁面上只有返回箭頭，沒有送出按鈕。

## REC-R15.1 列表的順序與內容

列表的順序與內容由 unit test 驗證；實際的歷史紀錄頁要人工確認。

1. 執行「建立範例紀錄」的指令。
2. 開啟 `https://local.taigu.tw/records`。

預期：列表由上到下有四列。第一列顯示 2330、台積電、2024-07-15、「股利」與「入帳金額」1,500；第二列顯示 2317、鴻海、2024-05-02、「賣出」、「200 股」與「成交價」150；第三列顯示 2317、鴻海、2024-04-01、「買進」、「200 股」與「成交價」140；第四列顯示 2330、台積電、2024-03-01、「買進」、「1,000 股」與「成交價」600。

## REC-R15.2 同一天有交易紀錄與現金股利紀錄

前端沒有自動化 test。

1. 執行「清空紀錄」的指令。
2. 在桌面瀏覽器上新增一筆 2024-07-15、2330 台積電、入帳金額 1500 的現金股利紀錄。
3. 新增一筆 2024-07-15 買進 2330 台積電 1,000 股、成交單價 600 的交易紀錄。
4. 重新整理 `https://local.taigu.tw/records`。

預期：「買進」那一列排在「股利」那一列上面。

## REC-R16.1 紀錄超過 15 筆

分批載入要在真實瀏覽器裡捲動才會觸發，前端沒有自動化 test。下面三節的步驟要數列表的列數時，都在 Chrome DevTools 的 Console 執行 `document.querySelectorAll('[class*="record_row"]').length`。

1. 執行「建立 40 筆紀錄」的指令。
2. 以 1280 × 800 的可用畫面開啟 `https://local.taigu.tw/records`，不捲動。
3. 在 Console 數列表的列數。
4. 一直往下捲動列表，直到不再出現新的列。
5. 在 Console 再數一次列表的列數。

預期：第 3 步印出 15；第 5 步印出 40，列表的最後一列是 2024-01-01，沒有日期重複的列。

## REC-R16.2 在平板直立的寬度捲到底

可用畫面是 768 × 1024 時，捲動的容器跟 1280 × 800 時不同，分批載入要在真實瀏覽器裡捲動才會觸發，前端沒有自動化 test。

1. 執行「建立 40 筆紀錄」的指令。
2. 用 device toolbar 把可用畫面設成 768 × 1024，開啟 `https://local.taigu.tw/records`，不捲動。
3. 在 Console 數列表的列數。
4. 一直往下捲動，直到不再出現新的列。
5. 在 Console 再數一次列表的列數。

預期：第 3 步印出 15；第 5 步印出 40，列表的最後一列是 2024-01-01，沒有日期重複的列。

## REC-R16.3 手機橫放時捲到底

可用寬度至少 780px，但可用高度小於 480px 而算窄版時，捲動的容器跟其他情況不同，分批載入要在真實瀏覽器裡捲動才會觸發，前端沒有自動化 test。

1. 執行「建立 40 筆紀錄」的指令。
2. 用 device toolbar 把可用畫面設成 844 × 390，開啟 `https://local.taigu.tw/records`，不捲動。
3. 在 Console 數列表的列數。
4. 一直往下捲動，直到不再出現新的列。
5. 在 Console 再數一次列表的列數。

預期：第 3 步印出 15；第 5 步印出 40，列表的最後一列是 2024-01-01，沒有日期重複的列。

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

## REC-R21.4 視窗全部展開

段落是否全部展開取決於瀏覽器視窗實際的寬度，unit test 沒有涵蓋這種情況。

1. 在桌面瀏覽器上把視窗寬度調到 1280px，開啟 `https://local.taigu.tw/`。
2. 點側邊欄的「新增」。

預期：編輯器的視窗裡「買賣與股票」「交易日期」「股數與單價」「手續費用」四段都展開。

## REC-R23.12 紀錄還沒載入完成

要讓前端停在還沒載入完交易紀錄的狀態，只能在瀏覽器裡擋下 request，unit test 沒有涵蓋。

1. 執行「建立範例紀錄」的指令。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/`。
3. 在 Chrome DevTools 開啟「Network request blocking」分頁，勾選「Enable network request blocking」，新增 pattern `*/api/trade-records*`，再重新整理頁面。瀏覽器已經存有紀錄時，前端改送帶 `since_revision` 的 request，這個 pattern 也會擋下這種 request，所以紀錄仍然不會載入完成。
4. 點側邊欄的「新增」，在「股票」選 2330 台積電，「成交股數」用張填 3，「成交單價」填 1040。
5. 在「Network request blocking」分頁取消勾選剛才新增的 pattern，再重新整理頁面。

預期：第 4 步之後主要按鈕上方寫出應付金額 3,124,446，沒有「庫存」那一行。
