注意：這份檔案的指令會修改開發環境資料庫裡登入帳號的 superuser 設定，並新增與刪除 email 結尾是 `@taigu-check.test` 的測試帳號，所以要用只拿來測試的 Google 帳號登入。

執行 `make start`，用 Chrome 開啟 `https://local.taigu.tw`，再用 Google 帳號登入，並開啟 Chrome DevTools。下面的指令要把 `<Email>` 換成登入用的 Google 帳號的 Email。

把登入的帳號設成 superuser，或取消 superuser：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py superuser add <Email>
docker compose -f compose.dev.yaml exec api-server python manage.py superuser remove <Email>
```

建立測試用的問題回報。指令先刪除之前建立的測試帳號，再建立 6 則內容不同的未處理問題回報（`u1` 到 `u6`，`u6` 最新）、1 則已處理的問題回報（`handled`），以及 60 則內容是「批次回報」的未處理問題回報；`u1` 與 `u4` 沒有記下平台與 User-Agent：

```sh
docker compose -f compose.dev.yaml exec -T api-server python manage.py shell <<'EOF'
from datetime import timedelta
from django.utils import timezone
from main.account.models import User
from main.issue_report.models import IssueReport
User.objects.filter(email__endswith="@taigu-check.test").delete()
def make_user(name):
    return User.objects.create_user(oauth_org="google", oauth_id=f"check-{name}", email=f"{name}@taigu-check.test", username=name)
batch = make_user("batch")
for i in range(60):
    IssueReport.objects.create(user=batch, body=f"批次回報 {i}", platform="web", user_agent="Mozilla/5.0")
IssueReport.objects.create(user=make_user("handled"), body="已經處理的回報", platform="web", user_agent="Mozilla/5.0", handled_at=timezone.now())
bodies = ["現金股利可以支援股票股利嗎？", "\n".join(f"第 {i} 行：匯出的 CSV 用 Excel 開會變成亂碼" for i in range(1, 11)), "很長" * 300, "<b>粗體</b>", "一\n二\n三\n四", "一\n二\n三\n四\n五"]
for i, body in enumerate(bodies, start=1):
    legacy = i in (1, 4)
    IssueReport.objects.create(user=make_user(f"u{i}"), body=body, platform=None if legacy else "pwa", user_agent=None if legacy else "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)")
print("unhandled:", IssueReport.objects.filter(handled_at__isnull=True).count())
EOF
```

刪除測試帳號與它們的問題回報：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; print('deleted:', User.objects.filter(email__endswith='@taigu-check.test').delete()[0])"
```

步驟裡的下面這些說法代表固定的操作：

- 「改寫 `<網址>` 的回應」：在 DevTools 的 Network 面板開啟頁面，對網址是 `<網址>` 的 request 按右鍵，選「Override content」（第一次使用時，依畫面選一個本機的資料夾存放改寫的內容，並允許 DevTools 存取），把 Sources 面板開啟的回應內容整個換成步驟給的 JSON，按 Cmd+S 儲存，再重新整理頁面。檢查完之後，在 Sources 面板的 Overrides 分頁取消勾選「Enable Local Overrides」。
- 「刪除 access token 的 cookie」：在 DevTools 的 Application > Cookies > `https://local.taigu.tw` 刪除 `__Host-access_token`。
- 「刪除側邊欄的收合狀態」：在 DevTools 的 Application > Local storage > `https://local.taigu.tw` 刪除 `admin-nav-collapsed`。
- 「在桌面瀏覽器上」：關閉 DevTools 的裝置模擬（Toggle device toolbar），Chrome 的視窗寬度至少 1024px。
- 「在手機上」：開啟 DevTools 的裝置模擬，選一款手機機型（例如 iPhone 14 Pro），再重新整理頁面。

## ADMIN-R1.1 Superuser 開啟後台

前端的權限判斷與換頁沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin`。

預期：網址換成 `/admin/usage`，畫面顯示使用情況頁。

## ADMIN-R1.2 不是 superuser 的使用者開啟後台

前端的權限判斷沒有自動化 test。

1. 取消登入的帳號的 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`。

預期：網址維持 `/admin/usage`，畫面顯示 404 頁面，標題是「找不到頁面」。

## ADMIN-R1.4 未登入時開啟後台

登入要經過 Google 的畫面，沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/settings`，點「登出」，再點確認視窗裡的「登出」。
3. 開啟 `https://local.taigu.tw/admin/usage`，確認畫面換到歡迎頁 `/welcome`。
4. 開啟 `https://local.taigu.tw/login`，點 Google 登入按鈕，在 Google 的畫面選擇帳號並同意授權。

預期：步驟 4 之後畫面換到 `/admin/usage`，顯示使用情況頁。

## ADMIN-R1.5 取消 superuser 之後重新整理

前端的權限判斷沒有自動化 test。

1. 把登入的帳號設成 superuser，開啟 `https://local.taigu.tw/admin/usage`，確認畫面顯示使用情況頁。
2. 取消登入的帳號的 superuser。
3. 重新整理頁面。

預期：網址維持 `/admin/usage`，畫面顯示 404 頁面。

## ADMIN-R1.6 Access token 過期之後操作後台

前端換發 access token 再重送的流程沒有自動化 test，這裡用刪除 access token 的 cookie 模擬 access token 過期。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`。
3. 刪除 access token 的 cookie。
4. 點 `u6@taigu-check.test` 那則問題回報右側的勾選按鈕。

預期：畫面出現提示「已標記為已處理。」，這則問題回報從列表消失，網址維持 `/admin/issue-reports`，沒有換到歡迎頁。

## ADMIN-R3.1 Superuser 從設定頁進入後台

前端沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/settings`，點「管理」區塊的「後台」。

預期：網址換成 `/admin/usage`，畫面顯示使用情況頁。

## ADMIN-R3.2 不是 superuser 的使用者開啟設定頁

前端沒有自動化 test。

1. 取消登入的帳號的 superuser。
2. 開啟 `https://local.taigu.tw/settings`。

預期：設定頁有「帳號」「付款與方案」「關於」區塊，沒有「管理」區塊，也沒有「後台」。

## ADMIN-R3.3 從後台按上一頁回到設定頁

瀏覽紀錄的行為沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/settings`，點「管理」區塊的「後台」，確認畫面顯示使用情況頁。
3. 按瀏覽器的上一頁。

預期：網址換回 `/settings`，畫面顯示設定頁。

## ADMIN-R4.1 有未處理的問題回報

導覽的畫面沒有自動化 test，未處理的則數由 unit test 驗證。

1. 把登入的帳號設成 superuser，建立測試用的問題回報，記下指令印出的 `unhandled:` 的數字。
2. 開啟 `https://local.taigu.tw/admin/usage`。

預期：導覽的「使用情況」顯示成選取狀態，「問題回報」旁邊顯示步驟 1 記下的數字。

## ADMIN-R4.2 沒有未處理的問題回報

導覽的畫面沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`，改寫 `https://local.taigu.tw/api/admin/issue-reports/unhandled-count` 的回應：

   ```json
   { "count": 0 }
   ```

預期：導覽的「問題回報」旁邊沒有顯示則數。

## ADMIN-R4.3 回到 Taigu

前端沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/subscriptions`，點導覽的「回到 Taigu」。

預期：網址換成 `/`，畫面顯示儀表板。

## ADMIN-R4.4 收合側邊欄

版面與滑鼠指到時的提示沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/admin/issue-reports`，如果側邊欄是收合的，先點側邊欄頂端的按鈕展開。
3. 點側邊欄頂端的收合按鈕，再把滑鼠移到「訂閱」的圖示上。

預期：側邊欄只剩圖示，「問題回報」圖示的右上角顯示未處理的則數；滑鼠指到的圖示旁顯示「訂閱」。

## ADMIN-R4.5 再次開啟後台時維持收合

收合狀態存在瀏覽器裡，沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/admin/usage`，把側邊欄收合。
3. 關閉這個分頁，再開一個新分頁開啟 `https://local.taigu.tw/admin/usage`。

預期：側邊欄是收合的。

## ADMIN-R4.6 收合之後把視窗拉窄

依視窗寬度改變的版面沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/admin/usage`，把側邊欄收合。
3. 把 Chrome 的視窗拉窄到導覽移到畫面上方（寬度小於 780px），再拉寬到 1024px 以上。

預期：視窗窄的時候，上方的導覽列出「使用情況」「訂閱」「問題回報」三頁的名稱；拉寬之後，側邊欄仍是收合的。

## ADMIN-R4.7 第一次開啟後台

收合狀態存在瀏覽器裡，沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/admin/usage`，刪除側邊欄的收合狀態。
3. 重新整理頁面。

預期：側邊欄是展開的，顯示「使用情況」「訂閱」「問題回報」的名稱。

## ADMIN-R6.3 跟 7 天前相比減少

人數由 unit test 驗證，這裡檢查畫面上增減的顏色與寫法。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`，改寫 `https://local.taigu.tw/api/admin/usage` 的回應：

   ```json
   {"recording_started_on": "2026-11-01", "days": [], "retention": [], "summary": {"yesterday": "2026-12-09", "compared_with": "2026-12-02", "dau": {"value": 2, "change": -3}, "wau": {"value": 9, "change": 3}, "mau": {"value": 20, "change": 0}, "registered": {"value": 412, "change": 15}}}
   ```

預期：每日活躍人數是 2 人，底下用綠色寫「▼ −3 人」。

## ADMIN-R6.4 跟 7 天前相比沒有變化

人數由 unit test 驗證，這裡檢查畫面上沒有變化時的寫法。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`，改寫 `https://local.taigu.tw/api/admin/usage` 的回應：

   ```json
   {"recording_started_on": "2026-11-01", "days": [], "retention": [], "summary": {"yesterday": "2026-12-09", "compared_with": "2026-12-02", "dau": {"value": 2, "change": 0}, "wau": {"value": 9, "change": 1}, "mau": {"value": 20, "change": -1}, "registered": {"value": 412, "change": 15}}}
   ```

預期：每日活躍人數是 2 人，底下用灰色寫「±0 人」。

## ADMIN-R6.5 昨天早於使用紀錄開始的那天

人數由 unit test 驗證，這裡檢查沒有活躍人數時的畫面。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`，改寫 `https://local.taigu.tw/api/admin/usage` 的回應：

   ```json
   {"recording_started_on": "2026-12-10", "days": [], "retention": [], "summary": {"yesterday": "2026-12-09", "compared_with": "2026-12-02", "dau": null, "wau": null, "mau": null, "registered": {"value": 412, "change": 15}}}
   ```

預期：每日活躍、7 天活躍與 30 天活躍的位置都顯示「尚未開始記錄」；累計註冊顯示 412 人，底下用紅色寫「▲ +15 人」。

## ADMIN-R6.11 跟 7 天前相比增加

人數由 unit test 驗證，這裡檢查畫面上增減的顏色與寫法。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`，改寫 `https://local.taigu.tw/api/admin/usage` 的回應：

   ```json
   {"recording_started_on": "2026-11-01", "days": [], "retention": [], "summary": {"yesterday": "2026-12-09", "compared_with": "2026-12-02", "dau": {"value": 5, "change": 3}, "wau": {"value": 9, "change": 0}, "mau": {"value": 20, "change": 0}, "registered": {"value": 412, "change": 15}}}
   ```

預期：每日活躍人數是 5 人，底下用紅色寫「▲ +3 人」。

## ADMIN-R7.1 預設顯示 90 天

畫的期間由 unit test 驗證，這裡檢查切換期間的畫面。

1. 把登入的帳號設成 superuser。
2. 執行 ADMIN-R7.5 步驟 2 的指令，替登入的帳號記下 40 天前的一筆使用紀錄，讓圖上有資料。
3. 執行下面的指令，印出今天與使用紀錄開始的那天：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from django.utils import timezone; from main.admin_console.services.usage import get_recording_start; print('today:', timezone.localdate(), 'start:', get_recording_start())"
   ```

4. 開啟 `https://local.taigu.tw/admin/usage`，把滑鼠移到活躍人數的圖最左邊與最右邊的點上。
5. 點「全部」，再把滑鼠移到活躍人數的圖最左邊的點上。

預期：步驟 4 最左邊的點是今天往前 89 天與 `start:` 兩者較晚的那天，最右邊的點是 `today:`；步驟 5 最左邊的點是 `start:`。新註冊人數的圖畫的日期跟活躍人數的圖相同。

## ADMIN-R7.4 今天的點

圖的畫法沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 執行 ADMIN-R7.5 步驟 2 的指令，替登入的帳號記下 40 天前的一筆使用紀錄，讓圖上有資料。
3. 開啟 `https://local.taigu.tw/admin/usage`。
4. 把滑鼠移到活躍人數的圖最右邊的點上，再移到新註冊人數的圖最右邊的長條上。

預期：活躍人數的圖上昨天到今天的線是虛線，新註冊人數的圖上今天的長條顏色比其他日子淡；指到時兩張圖都顯示今天的日期與數字，日期後面有「（進行中）」。

## ADMIN-R7.5 資料不完整的日子

畫面上的標示沒有自動化 test，哪些日子資料不完整由 unit test 驗證。

1. 把登入的帳號設成 superuser。
2. 執行下面的指令，替登入的帳號記下 40 天前的一筆使用紀錄，讓使用紀錄開始的那天至少在 40 天前：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import timedelta; from django.utils import timezone; from main.account.models import User; from main.usage.models import DailyActivity; print('created:', DailyActivity.objects.get_or_create(user=User.objects.get(email='<Email>'), date=timezone.localdate() - timedelta(days=40), platform='web')[1])"
   ```

3. 開啟 `https://local.taigu.tw/admin/usage`，點「全部」。
4. 把滑鼠移到活躍人數的圖最左邊的點上，再往右移到第 30 個點上。

預期：活躍人數的圖從最左邊的點到第 29 個點的背景是灰色的，圖例有「資料不完整」；指到最左邊的點時顯示「30 天的區間早於使用紀錄開始」，指到第 30 個點時沒有這句話。

## ADMIN-R7.7 還沒有任何使用紀錄

沒有資料時的畫面沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`，改寫 `https://local.taigu.tw/api/admin/usage` 的回應：

   ```json
   {"recording_started_on": null, "days": [], "retention": [], "summary": {"yesterday": "2026-12-09", "compared_with": "2026-12-02", "dau": null, "wau": null, "mau": null, "registered": {"value": 412, "change": 15}}}
   ```

預期：活躍人數與新註冊人數兩張圖的位置都只顯示「還沒有使用紀錄。」。

## ADMIN-R8.9 進行中的格子

哪些格子進行中由 unit test 驗證，這裡檢查表格的畫面。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`，改寫 `https://local.taigu.tw/api/admin/usage` 的回應：

   ```json
   {"recording_started_on": "2026-11-23", "summary": {"yesterday": "2026-12-09", "compared_with": "2026-12-02", "dau": {"value": 2, "change": 0}, "wau": {"value": 9, "change": 0}, "mau": {"value": 20, "change": 0}, "registered": {"value": 412, "change": 12}}, "days": [], "retention": [
     {"week_start": "2026-12-07", "signups": 2, "day_1": {"status": "in_progress", "count": null, "percent": null}, "day_7": {"status": "in_progress", "count": null, "percent": null}, "day_30": {"status": "in_progress", "count": null, "percent": null}},
     {"week_start": "2026-11-30", "signups": 5, "day_1": {"status": "in_progress", "count": null, "percent": null}, "day_7": {"status": "in_progress", "count": null, "percent": null}, "day_30": {"status": "in_progress", "count": null, "percent": null}},
     {"week_start": "2026-11-23", "signups": 5, "day_1": {"status": "complete", "count": 3, "percent": 60}, "day_7": {"status": "in_progress", "count": null, "percent": null}, "day_30": {"status": "in_progress", "count": null, "percent": null}}
   ]}
   ```

預期：留存表最上面一列是「2026/12/07 週」，註冊人數是 2 人，三格都顯示「進行中」；「2026/11/30 週」的三格都顯示「進行中」；「2026/11/23 週」的第 1–6 天顯示「3 人」與「60%」，第 7–13 天與第 30–36 天顯示「進行中」；表格下面寫「使用紀錄從 2026/11/23 開始，所以從 2026/11/23 那一週列起。」。

## ADMIN-R8.14 一週沒有人註冊

哪一週沒有人註冊由 unit test 驗證，這裡檢查表格的畫面。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/usage`，改寫 `https://local.taigu.tw/api/admin/usage` 的回應：

   ```json
   {"recording_started_on": "2026-11-01", "summary": {"yesterday": "2026-12-09", "compared_with": "2026-12-02", "dau": {"value": 2, "change": 0}, "wau": {"value": 9, "change": 0}, "mau": {"value": 20, "change": 0}, "registered": {"value": 412, "change": 12}}, "days": [], "retention": [
     {"week_start": "2026-11-30", "signups": 0, "day_1": {"status": "no_signups", "count": null, "percent": null}, "day_7": {"status": "no_signups", "count": null, "percent": null}, "day_30": {"status": "no_signups", "count": null, "percent": null}},
     {"week_start": "2026-11-23", "signups": 5, "day_1": {"status": "complete", "count": 3, "percent": 60}, "day_7": {"status": "in_progress", "count": null, "percent": null}, "day_30": {"status": "in_progress", "count": null, "percent": null}}
   ]}
   ```

預期：「2026/11/30 週」的註冊人數是 0 人，三格都顯示「–」。

## ADMIN-R8.16 沒有可以列出的註冊週

沒有資料時的畫面沒有自動化 test。

1. 照 ADMIN-R6.5 的步驟改寫 `https://local.taigu.tw/api/admin/usage` 的回應。

預期：留存表的位置只顯示「還沒有可以統計的註冊週。」。

## ADMIN-R9.7 進行中與已結算

狀態與結算日由 unit test 驗證，這裡檢查表格的畫面。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/subscriptions`，改寫 `https://local.taigu.tw/api/admin/subscriptions` 的回應：

   ```json
   {"statuses": {"trialing": 3, "auto_renewing": 2, "auto_renewal_stopped": 1, "past_due": 1, "unsubscribed": 4}, "whitelisted": 1, "monthly_payments": [], "trial_conversions": [
     {"month": "2026-12", "trials": 4, "paid": 0, "conversion_rate": "0.0", "status": "in_progress", "settles_on": "2027-03-02"},
     {"month": "2026-11", "trials": 0, "paid": 0, "conversion_rate": null, "status": null, "settles_on": null},
     {"month": "2026-10", "trials": 76, "paid": 9, "conversion_rate": "11.8", "status": "in_progress", "settles_on": "2026-12-31"},
     {"month": "2026-09", "trials": 16, "paid": 1, "conversion_rate": "6.3", "status": "settled", "settles_on": null}
   ]}
   ```

預期：「2026/12」那一列的狀態顯示「進行中」與「3/2 結算」，「2026/10」那一列顯示「進行中」與「12/31 結算」，轉換率是「11.8%」；「2026/09」那一列顯示「已結算」。

## ADMIN-R9.12 沒有人開始試用的月份

沒有人試用的月份由 unit test 驗證，這裡檢查表格的畫面。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/subscriptions`，改寫 `https://local.taigu.tw/api/admin/subscriptions` 的回應：

   ```json
   {"statuses": {"trialing": 0, "auto_renewing": 0, "auto_renewal_stopped": 0, "past_due": 0, "unsubscribed": 5}, "whitelisted": 0, "monthly_payments": [], "trial_conversions": [
     {"month": "2026-09", "trials": 2, "paid": 0, "conversion_rate": "0.0", "status": "settled", "settles_on": null},
     {"month": "2026-08", "trials": 0, "paid": 0, "conversion_rate": null, "status": null, "settles_on": null},
     {"month": "2026-07", "trials": 3, "paid": 1, "conversion_rate": "33.3", "status": "settled", "settles_on": null}
   ]}
   ```

預期：「2026/08」那一列的試用人數與付款人數都是 0 人，轉換率與狀態都顯示「–」。

## ADMIN-R9.13 沒有試用的使用者

沒有資料時的畫面沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/subscriptions`，改寫 `https://local.taigu.tw/api/admin/subscriptions` 的回應：

   ```json
   {"statuses": {"trialing": 0, "auto_renewing": 0, "auto_renewal_stopped": 0, "past_due": 0, "unsubscribed": 3}, "whitelisted": 0, "trial_conversions": [], "monthly_payments": []}
   ```

預期：試用轉付費表的位置只顯示「還沒有試用的使用者。」；目前的訂閱狀態的未訂閱是 3 人，其他狀態都是 0 人。

## ADMIN-R11.2 沒有付款成功的月份

每個月的筆數與金額由 unit test 驗證，這裡檢查長條圖的畫面。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/subscriptions`，改寫 `https://local.taigu.tw/api/admin/subscriptions` 的回應：

   ```json
   {"statuses": {"trialing": 0, "auto_renewing": 1, "auto_renewal_stopped": 0, "past_due": 0, "unsubscribed": 3}, "whitelisted": 0, "trial_conversions": [], "monthly_payments": [
     {"month": "2026-09", "count": 1, "amount": 65},
     {"month": "2026-10", "count": 0, "amount": 0},
     {"month": "2026-11", "count": 4, "amount": 895},
     {"month": "2026-12", "count": 2, "amount": 130}
   ]}
   ```

3. 把滑鼠移到每月付款的長條圖上 26/10 與 26/12 的位置。

預期：長條圖畫出 26/09 到 26/12，26/10 沒有長條，指到時顯示「2026/10」與「0 筆，0 元」；26/12 的長條顏色比其他月份淡，指到時顯示「2026/12（進行中）」與「2 筆，130 元」。

## ADMIN-R11.5 還沒有任何付款成功

沒有資料時的畫面沒有自動化 test。

1. 照 ADMIN-R9.13 的步驟改寫 `https://local.taigu.tw/api/admin/subscriptions` 的回應。

預期：每月付款的長條圖的位置只顯示「還沒有付款成功的紀錄。」。

## ADMIN-R12.1 開啟時只列未處理的回報

列出哪些問題回報由 unit test 驗證，這裡檢查列表的畫面。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 執行下面的指令，把 `u1` 到 `u6`（`@taigu-check.test`）以外的未處理問題回報都標記成已處理，處理時間記成 2000/01/01，讓步驟 4 能改回來：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import datetime, UTC; from main.issue_report.models import IssueReport; print('marked:', IssueReport.objects.filter(handled_at__isnull=True).exclude(user__email__regex=r'^u[1-6]@taigu-check[.]test$').update(handled_at=datetime(2000, 1, 1, tzinfo=UTC)))"
   ```

3. 開啟 `https://local.taigu.tw/admin/issue-reports`。
4. 執行 ADMIN-R13.7 步驟 5 的指令，把步驟 2 標記的問題回報改回未處理。

預期：步驟 3 的列表依序列出 `u6` 到 `u1` 的 6 則問題回報，勾選按鈕都是空心的圓圈，沒有 `handled@taigu-check.test` 的問題回報，最下面沒有「載入更多」。

## ADMIN-R12.3 載入更多

分頁由 unit test 驗證，這裡檢查畫面上的「載入更多」。

1. 把登入的帳號設成 superuser，建立測試用的問題回報，記下指令印出的 `unhandled:` 的數字。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，捲到列表最下面。
3. 點「載入更多」，捲到列表最下面；如果還有「載入更多」，再點一次，直到「載入更多」消失。

預期：步驟 2 列表有 10 則問題回報，最下面有「載入更多」；步驟 3 之後列表的則數等於步驟 1 記下的數字，「載入更多」消失。

## ADMIN-R12.6 內容當成純文字顯示

畫面的顯示沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，找到 `u4@taigu-check.test` 那則問題回報。

預期：內容顯示成「<b>粗體</b>」，沒有變成粗體字。

## ADMIN-R12.7 沒有記下平台與 User-Agent

畫面的顯示沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，點 `u1@taigu-check.test` 那則問題回報的「顯示 User-Agent」。

預期：平台的位置顯示「平台未記錄」，User-Agent 的位置顯示「User-Agent 未記錄」。

## ADMIN-R12.8 展開與收合

是否超過 4 行依瀏覽器的排版判斷，沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/admin/issue-reports`，找到 `u2@taigu-check.test` 那則問題回報。
3. 點「展開全文與 User-Agent」，再點「收合」。

預期：步驟 2 只顯示「第 1 行」到「第 4 行」；步驟 3 展開之後顯示「第 1 行」到「第 10 行」與 User-Agent，收合之後恢復成前 4 行。

## ADMIN-R12.9 沒有換行的長內容

是否超過 4 行依瀏覽器的排版判斷，沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 在手機上開啟 `https://local.taigu.tw/admin/issue-reports`，找到 `u3@taigu-check.test` 那則問題回報。

預期：內容只顯示 4 行，下面有「展開全文與 User-Agent」。

## ADMIN-R12.10 剛好 4 行的內容

是否超過 4 行依瀏覽器的排版判斷，沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，找到 `u5@taigu-check.test` 那則問題回報。

預期：顯示完整的「一」到「四」4 行，下面是「顯示 User-Agent」。

## ADMIN-R12.11 沒有未處理的回報

沒有資料時的畫面沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，改寫 `https://local.taigu.tw/api/admin/issue-reports?filter=unhandled` 的回應：

   ```json
   {"reports": [], "next_cursor": null}
   ```

預期：畫面顯示「沒有未處理的問題回報。」。

## ADMIN-R12.12 剛好 5 行的內容

是否超過 4 行依瀏覽器的排版判斷，沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，找到 `u6@taigu-check.test` 那則問題回報。

預期：只顯示「一」到「四」4 行，下面是「展開全文與 User-Agent」。

## ADMIN-R13.1 標記為已處理

標記的結果由 unit test 驗證，這裡檢查畫面的變化。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，記下導覽的「問題回報」旁邊的數字。
3. 點 `u6@taigu-check.test` 那則問題回報的勾選按鈕。

預期：畫面出現提示「已標記為已處理。」，`u6` 那則問題回報從列表消失，導覽的「問題回報」旁邊的數字比步驟 2 少 1。

## ADMIN-R13.2 改回未處理

標記的結果由 unit test 驗證，這裡檢查畫面的變化。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，點「全部」，記下導覽的「問題回報」旁邊的數字。
3. 點 `handled@taigu-check.test` 那則問題回報的勾選按鈕。

預期：步驟 2 `handled` 那則問題回報的勾選按鈕是打勾的實心圓圈；步驟 3 之後畫面出現提示「已改回未處理。」，勾選按鈕變回空心的圓圈，導覽的「問題回報」旁邊的數字比步驟 2 多 1。

## ADMIN-R13.4 網路中斷時標記

網路中斷時的處理沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，記下導覽的「問題回報」旁邊的數字。
3. 在 DevTools 的 Network 面板把 throttling 改成「Offline」。
4. 點 `u6@taigu-check.test` 那則問題回報的勾選按鈕。
5. 把 throttling 改回「No throttling」。

預期：步驟 4 之後畫面出現錯誤提示「無法更新這則問題回報，請稍後再試。」，`u6` 那則問題回報仍在列表裡，勾選按鈕仍是空心的圓圈，導覽的數字跟步驟 2 相同。

## ADMIN-R13.5 指到勾選按鈕

滑鼠指到時的提示沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/admin/issue-reports`，點「全部」。
3. 把滑鼠移到 `u6@taigu-check.test` 那則問題回報的勾選按鈕上，再移到 `handled@taigu-check.test` 那則的勾選按鈕上。

預期：`u6` 那則顯示「標記為已處理」，`handled` 那則顯示「改回未處理」。

## ADMIN-R13.6 回應之前再點一次

處理中的按鈕狀態沒有自動化 test。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 開啟 `https://local.taigu.tw/admin/issue-reports`，點「全部」。
3. 在 DevTools 的 Network 面板把 throttling 改成「3G」。
4. 點 `u6@taigu-check.test` 那則問題回報的勾選按鈕，在畫面出現提示之前再點一次。
5. 把 throttling 改回「No throttling」。

預期：步驟 4 第一次點之後按鈕變淡、不能點，第二次點沒有作用；之後畫面出現一次提示「已標記為已處理。」，`u6` 那則問題回報的勾選按鈕是打勾的實心圓圈。

## ADMIN-R13.7 標記最後一則未處理的回報

畫面的變化沒有自動化 test，標記的結果由 unit test 驗證。

1. 把登入的帳號設成 superuser，建立測試用的問題回報。
2. 執行下面的指令，把 `u6@taigu-check.test` 以外的未處理問題回報都標記成已處理，處理時間記成 2000/01/01，讓步驟 5 能改回來：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import datetime, UTC; from main.issue_report.models import IssueReport; print('marked:', IssueReport.objects.filter(handled_at__isnull=True).exclude(user__email='u6@taigu-check.test').update(handled_at=datetime(2000, 1, 1, tzinfo=UTC)))"
   ```

3. 開啟 `https://local.taigu.tw/admin/issue-reports`，確認列表只有 `u6` 那則問題回報，導覽的「問題回報」旁邊顯示 1。
4. 點 `u6` 那則問題回報的勾選按鈕。
5. 執行下面的指令，把步驟 2 標記的問題回報改回未處理：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import datetime, UTC; from main.issue_report.models import IssueReport; print('restored:', IssueReport.objects.filter(handled_at=datetime(2000, 1, 1, tzinfo=UTC)).update(handled_at=None))"
   ```

預期：步驟 4 之後畫面出現提示「已標記為已處理。」，列表的位置顯示「沒有未處理的問題回報。」，導覽的「問題回報」旁邊不再顯示則數。

## ADMIN-R14.1 網路中斷時開啟使用情況頁

網路中斷時的處理沒有自動化 test。

1. 把登入的帳號設成 superuser。
2. 開啟 `https://local.taigu.tw/admin/subscriptions`。
3. 在 DevTools 的 Network 面板把 throttling 改成「Offline」，點導覽的「使用情況」。
4. 把 throttling 改回「No throttling」，點「重新載入」。

預期：步驟 3 之後畫面顯示「無法載入資料。」與「重新載入」；步驟 4 之後畫面顯示使用情況頁的數字、兩張圖與留存表。
