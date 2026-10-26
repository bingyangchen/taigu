注意：這份檔案的指令會刪除或修改開發環境資料庫裡登入帳號的使用紀錄與 refresh token，所以要用只拿來測試的 Google 帳號登入，不要用存有真實資料的帳號。

執行 `make start`，用 Chrome 開啟 `https://local.taigu.tw`，再用 Google 帳號登入。下面的指令要把 `<Email>` 換成登入用的 Google 帳號的 Email。

要查看後端記下的使用紀錄時，在 repo 的根目錄執行下面的指令。指令會在 `usage:` 那一行依日期列出這個帳號的每一筆使用紀錄，每一筆是日期與平台，`web` 是網頁，`pwa` 是 PWA：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.usage.models import DailyActivity; print('usage:', [(str(d), p) for d, p in DailyActivity.objects.filter(user__email='<Email>').order_by('date', 'platform').values_list('date', 'platform')])"
```

要讓後端把今天當成這個帳號還沒使用過的一天時，執行下面的指令刪除這個帳號今天的使用紀錄。USAGE-R1.7、USAGE-R1.12 與 USAGE-R1.13 用這個指令模擬換日，因為換日要等到半夜；換日之後記下的是哪一天由 unit test 驗證，所以這幾個情境與 USAGE-R1.8 只檢查前端有沒有通知後端記下使用紀錄：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from django.utils import timezone; from main.usage.models import DailyActivity; print('deleted:', DailyActivity.objects.filter(user__email='<Email>', date=timezone.localdate()).delete()[0])"
```

步驟裡的下面這些說法代表固定的操作：

- 「只留一個空白分頁」：關閉 Taigu 的分頁與 PWA 的視窗，在 Chrome 只留一個開啟 `about:blank` 的分頁。這樣切到終端機執行指令、再切回 Chrome 時，畫面上沒有 Taigu 的頁面，所以前端不會因為使用者切回來而通知後端記下使用紀錄。
- 「登出」：開啟 `https://local.taigu.tw/settings`，點「登出」，再點確認視窗裡的「登出」。
- 「用 Google 帳號登入」：開啟 `https://local.taigu.tw/login`，點 Google 登入按鈕，在 Google 的畫面選擇帳號並同意授權。
- 「用 PWA 開啟 Taigu」：如果 Taigu 還沒安裝成 PWA，先在 Chrome 開啟 `https://local.taigu.tw`，再從 Chrome 選單的「投放、儲存及分享」選擇安裝的選項，把 Taigu 安裝成 PWA；接著從 macOS 的 Dock 或「應用程式」資料夾開啟安裝成 PWA 的 Taigu。
- 「清空 Network 的紀錄」：點 DevTools 的 Network 面板左上角的「Clear network log」按鈕。
- 「查看 open-session request」：在 DevTools 的 Network 面板的篩選欄輸入 `open-session`，點最新的一筆，在 Payload 看 `platform` 的值，在 Headers 看 status code。
- 「刪除 access token 的 cookie」：在 DevTools 的 Application > Cookies > `https://local.taigu.tw` 刪除 `__Host-access_token`。

## USAGE-R1.1 在網頁上開啟 Taigu

前端沒有自動化 test。記下的日期與平台由 unit test 驗證，這裡檢查前端開啟儀表板時會記下使用紀錄。

1. 只留一個空白分頁。
2. 執行刪除今天的使用紀錄的指令。
3. 執行查看使用紀錄的指令，確認 `usage:` 那一行沒有今天的日期。
4. 在 Chrome 的空白分頁開啟 `https://local.taigu.tw/`。
5. 確認畫面顯示儀表板。
6. 執行查看使用紀錄的指令。

預期：步驟 6 的 `usage:` 那一行有今天的日期與 `web` 一筆。

## USAGE-R1.2 以 PWA 開啟 Taigu

前端沒有自動化 test。本機的開發環境沒辦法從手機開啟，所以用桌面 Chrome 安裝的 PWA 檢查。

1. 只留一個空白分頁。
2. 執行刪除今天的使用紀錄的指令。
3. 用 PWA 開啟 Taigu。
4. 確認 PWA 的視窗顯示儀表板。
5. 執行查看使用紀錄的指令。

預期：步驟 5 的 `usage:` 那一行有今天的日期與 `pwa` 一筆，沒有今天的日期與 `web`。

## USAGE-R1.3 直接開啟設定頁

前端沒有自動化 test。

1. 只留一個空白分頁。
2. 執行刪除今天的使用紀錄的指令。
3. 在 Chrome 的空白分頁開啟 `https://local.taigu.tw/settings`。
4. 確認畫面顯示設定頁。
5. 執行查看使用紀錄的指令。

預期：步驟 5 的 `usage:` 那一行有今天的日期與 `web` 一筆。

## USAGE-R1.4 登入後換到儀表板

前端沒有自動化 test。

1. 登出。
2. 只留一個空白分頁。
3. 執行刪除今天的使用紀錄的指令。
4. 在 Chrome 的空白分頁開啟 `https://local.taigu.tw/`。
5. 確認畫面換到歡迎頁 `/welcome`。
6. 用 Google 帳號登入。
7. 確認畫面換到儀表板 `/`。
8. 執行查看使用紀錄的指令。

預期：步驟 5 與步驟 7 的確認成立；步驟 8 的 `usage:` 那一行有今天的日期與 `web` 一筆。

## USAGE-R1.7 隔天切回一直開著的分頁

前端沒有自動化 test。這裡檢查使用者切回分頁時前端會記下使用紀錄。

1. 只留一個空白分頁。
2. 在 Chrome 的新分頁開啟 `https://local.taigu.tw/`。
3. 確認畫面顯示儀表板。
4. 點空白分頁。
5. 執行刪除今天的使用紀錄的指令。
6. 執行查看使用紀錄的指令，確認 `usage:` 那一行沒有今天的日期。
7. 切回 Chrome。
8. 點顯示儀表板的分頁。
9. 執行查看使用紀錄的指令。

預期：步驟 9 的 `usage:` 那一行有今天的日期與 `web` 一筆。

## USAGE-R1.8 隔天在 Taigu 裡換頁

前端沒有自動化 test。切到終端機再切回 Chrome 時，前端就會因為使用者切回來而通知後端記下使用紀錄，所以這裡不刪除使用紀錄，改成檢查前端在換頁時送出的 open-session request。

1. 在 Chrome 開啟 `https://local.taigu.tw/`。
2. 確認畫面顯示儀表板。
3. 開啟 DevTools 的 Network 面板。
4. 清空 Network 的紀錄。
5. 點側邊欄的「市場」。
6. 查看 open-session request。

預期：畫面換到市場頁 `/market`；步驟 6 的 Network 面板有一筆 open-session request，`platform` 是 `web`，status code 是 200。

## USAGE-R1.10 開啟不用登入就能看的頁面

前端沒有自動化 test。

1. 只留一個空白分頁。
2. 執行刪除今天的使用紀錄的指令。
3. 在 Chrome 的空白分頁開啟 `https://local.taigu.tw/privacy-policy`。
4. 確認畫面顯示隱私權政策。
5. 執行查看使用紀錄的指令。

預期：步驟 5 的 `usage:` 那一行沒有今天的日期。

## USAGE-R1.11 離線時切回分頁

前端沒有自動化 test。錯誤提示出現 5 秒後就會自動消失，所以步驟 7 與步驟 8 要連續、盡快做完。

1. 在 Chrome 開啟 `https://local.taigu.tw/`。
2. 確認畫面顯示儀表板。
3. 開啟 DevTools 的 Network 面板。
4. 在 Network 面板把 throttling 設成「Offline」。
5. 在 Chrome 開一個新分頁。
6. 等 2 秒。
7. 點顯示儀表板的分頁。
8. 確認畫面。
9. 把 throttling 改回「No throttling」。

預期：步驟 8 的畫面沒有出現錯誤提示，儀表板照常顯示。

## USAGE-R1.12 隔天從其他 app 切回 PWA

前端沒有自動化 test。本機的開發環境沒辦法從手機開啟，所以用桌面 Chrome 安裝的 PWA 檢查，把 PWA 的視窗縮到最小再切回來。

1. 只留一個空白分頁。
2. 用 PWA 開啟 Taigu。
3. 確認 PWA 的視窗顯示儀表板。
4. 在 PWA 的視窗按 Cmd+M，把視窗縮到最小。
5. 執行刪除今天的使用紀錄的指令。
6. 執行查看使用紀錄的指令，確認 `usage:` 那一行沒有今天的日期。
7. 點 Dock 上 Taigu 的圖示，讓 PWA 的視窗回到畫面上。
8. 執行查看使用紀錄的指令。

預期：步驟 8 的 `usage:` 那一行有今天的日期與 `pwa` 一筆。

## USAGE-R1.13 記錄失敗之後換頁

前端沒有自動化 test。

1. 只留一個空白分頁。
2. 在 Chrome 的新分頁開啟 `https://local.taigu.tw/`。
3. 確認畫面顯示儀表板。
4. 開啟 DevTools 的 Network 面板。
5. 在 Network 面板把 throttling 設成「Offline」。
6. 點空白分頁。
7. 執行刪除今天的使用紀錄的指令。
8. 切回 Chrome。
9. 點顯示儀表板的分頁。
10. 執行查看使用紀錄的指令。
11. 切回 Chrome。
12. 把 throttling 改回「No throttling」。
13. 點側邊欄的「市場」。
14. 執行查看使用紀錄的指令。

預期：步驟 10 的 `usage:` 那一行沒有今天的日期；步驟 14 的 `usage:` 那一行有今天的日期與 `web` 一筆。

## USAGE-R1.14 登入狀態到期之後切回分頁

前端沒有自動化 test。這裡照 ACCT-R5.2 的手動檢查，把 refresh token 的到期時間改到過去，模擬登入滿 30 天。

1. 在 Chrome 開啟 `https://local.taigu.tw/settings`。
2. 在 Chrome 開一個新分頁。
3. 執行下面的指令，把這個帳號 refresh token 的到期時間改到 1 秒前：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import timedelta; from django.utils import timezone; from main.account.models import RefreshToken; RefreshToken.objects.filter(user__email='<Email>', revoked_at__isnull=True).update(expires_at=timezone.now() - timedelta(seconds=1))"
   ```

4. 切回 Chrome。
5. 在新分頁開啟 `https://local.taigu.tw/privacy-policy`。
6. 在顯示隱私權政策的分頁刪除 access token 的 cookie。
7. 點顯示設定頁的分頁。
8. 確認畫面換到歡迎頁 `/welcome`，而且沒有出現錯誤提示。
9. 在原分頁從記住網址起算未滿 30 分鐘時，用 Google 帳號完成登入。

預期：步驟 8 的確認成立；步驟 9 之後畫面換回 `/settings`。

## USAGE-R1.15 開啟後台

前端沒有自動化 test，這裡檢查前端在後台的頁面不會記下使用紀錄，包括在後台裡換頁與切回後台的分頁。

1. 執行 `docker compose -f compose.dev.yaml exec 後端 python manage.py superuser add <Email>`，把這個帳號設成 superuser。
2. 只留一個空白分頁。
3. 執行刪除今天的使用紀錄的指令。
4. 在 Chrome 的空白分頁開啟 `https://local.taigu.tw/admin/usage`，確認畫面顯示使用情況頁。
5. 點導覽的「訂閱」，確認畫面顯示訂閱頁。
6. 在 Chrome 開一個新分頁，再切回後台的分頁。
7. 執行查看使用紀錄的指令。

預期：步驟 7 的 `usage:` 那一行沒有今天的日期。

## USAGE-R1.16 從設定頁進入後台

前端沒有自動化 test，這裡檢查從設定頁進入後台時，開啟設定頁記下了使用紀錄。

1. 確認這個帳號是 superuser（見 USAGE-R1.15 的步驟 1）。
2. 只留一個空白分頁。
3. 執行刪除今天的使用紀錄的指令。
4. 在 Chrome 的空白分頁開啟 `https://local.taigu.tw/settings`，點「管理」區塊的「後台」。
5. 確認網址換成 `/admin/usage`，畫面顯示使用情況頁。
6. 執行查看使用紀錄的指令。

預期：步驟 6 的 `usage:` 那一行有今天的日期與 `web` 一筆。

## USAGE-R1.17 從後台回到 Taigu

前端沒有自動化 test，這裡檢查從後台回到儀表板時，前端會記下使用紀錄。

1. 確認這個帳號是 superuser（見 USAGE-R1.15 的步驟 1）。
2. 只留一個空白分頁。
3. 執行刪除今天的使用紀錄的指令。
4. 在 Chrome 的空白分頁開啟 `https://local.taigu.tw/admin/usage`。
5. 執行查看使用紀錄的指令，確認 `usage:` 那一行沒有今天的日期。
6. 點後台導覽的「回到 Taigu」。
7. 確認畫面顯示儀表板，再執行查看使用紀錄的指令。

預期：步驟 7 的 `usage:` 那一行有今天的日期與 `web` 一筆。
