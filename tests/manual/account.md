注意：這份檔案的指令會刪除或修改開發環境資料庫裡的資料，包括登入帳號的紀錄，所以要用只拿來測試的 Google 帳號登入，不要用存有真實資料的帳號。

執行 `make start`，準備一個能登入的 Google 帳號，再用 Chrome 開啟 `https://local.taigu.tw`。下面的指令要把 `<Email>` 換成登入用的 Google 帳號的 Email。

ACCT-R11.1、ACCT-R12.2、ACCT-R12.5、ACCT-R12.6、ACCT-R13.2 與 ACCT-R14.2 另外需要第二個 Google 帳號，而且第二個 Google 帳號不能綁定任何 Taigu 帳號。如果第二個 Google 帳號在本機登入過，先照 ACCT-R11.1 的步驟 1 刪除綁定它的 Taigu 帳號。這些情境開始之前，也要先照 ACCT-R11.1 的步驟 2 在 Chrome 登入第二個 Google 帳號，用到訪客視窗的情境也要在訪客視窗登入第二個 Google 帳號，否則 Google 可能直接用第一個帳號授權。

步驟裡的下面這些說法代表固定的操作：

- 「在桌面瀏覽器上」：直接用 Chrome。
- 「在行動裝置上」：開啟 DevTools 的裝置模擬（Toggle device toolbar）並選一款手機，再重新整理頁面，因為 Taigu 依 user agent 判斷是不是行動裝置。
- 「登出」：開啟 `https://local.taigu.tw/settings`，點「登出」，再點確認視窗裡的「登出」。
- 「用 Google 帳號登入」：開啟 `https://local.taigu.tw/login`，點 Google 登入按鈕，在 Google 的畫面選擇帳號並同意授權。
- 「刪除短效的登入 cookie」：在 DevTools 的 Application > Cookies > `https://local.taigu.tw` 刪除 `__Host-access_token`。這個 cookie 原本在 15 分鐘後過期，所以刪除它等於閒置超過 15 分鐘。
- 「開始更換綁定的帳號」：開啟 `https://local.taigu.tw/settings/account-binding`，點「更換綁定的帳號」，再點「綁定 Google 帳號」。
- 「訪客視窗」：指 Chrome 選單的「開啟訪客視窗」開出來的視窗。訪客視窗的 cookie 跟原本的 Chrome 分開，所以可以當成另一個人的瀏覽器。
- 「擋下 `<路徑>` 的 request」：在 DevTools 按 Cmd+Shift+P，執行「Show Network request blocking」，勾選「Enable network request blocking」，再新增 pattern `*<路徑>*`。
- 「取消擋下 request」：取消勾選「Enable network request blocking」。
- 「複製 Google 帶回的網址」：在 DevTools 的 Network 面板找到 Type 是 document、名稱以 `login?` 或 `account-binding?` 開頭的那一筆 request，按右鍵選 Copy > Copy URL。因為前端在送出授權結果之後就會移除網址上的參數，所以有這一步的情境，都要在開始授權之前先開啟 DevTools 的 Network 面板，並勾選「Preserve log」。

## ACCT-R1.1 從登入頁登入

前端沒有自動化 test。

1. 如果已登入，登出。
2. 如果 DevTools 的 Application > Local Storage > `https://local.taigu.tw` 有 `pathAndQueryString`，刪除這一筆。
3. 開啟 `https://local.taigu.tw/login`。
4. 點 Google 登入按鈕。
5. 在 Google 的畫面選擇帳號並同意授權。

預期：畫面回到 Taigu 並換到儀表板 `/`。

## ACCT-R1.2 已登入時開啟登入頁

前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/login`。

預期：畫面換到儀表板 `/`。

## ACCT-R2.1 第一次登入

後端的 test 沒有驗證新帳號的名字、頭像與 Email，前端也沒有自動化 test。

1. 如果已登入，登出。
2. 如果這個 Google 帳號在本機登入過，先注意下一個指令會刪除本機資料庫裡這個帳號與它的所有資料，再執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='<Email>').delete()"
   ```

3. 用 Google 帳號登入。
4. 開啟 `https://local.taigu.tw/settings`。

預期：設定頁顯示這個 Google 帳號的頭像、名字與 Email。

## ACCT-R2.2 再次登入時保留改過的名字

後端的 test 沒有驗證再次登入時保留改過的名字，前端也沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/user-info`。
3. 把名字改成「小明」。
4. 點儲存按鈕。
5. 登出。
6. 用同一個 Google 帳號登入。
7. 開啟 `https://local.taigu.tw/settings`。

預期：設定頁顯示的名字是「小明」，不是 Google 帳號的名字。

## ACCT-R3.1 未登入時開啟要登入才能使用的頁面

前端沒有自動化 test。

1. 如果已登入，登出。
2. 開啟 `https://local.taigu.tw/settings`。

預期：畫面換到歡迎頁 `/welcome`。

## ACCT-R3.2 登入後換回原本開啟的網址

前端沒有自動化 test。

1. 如果已登入，登出。
2. 開啟 `https://local.taigu.tw/records?sid=2330`。
3. 確認畫面換到歡迎頁 `/welcome`。
4. 用 Google 帳號登入。

預期：畫面換到 `/records?sid=2330`。

## ACCT-R5.1 閒置並關閉瀏覽器後再開啟

後端的 test 只驗證伺服器換發新的登入 cookie，瀏覽器自動維持登入狀態的部分在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 在 DevTools 的 Application > Cookies > `https://local.taigu.tw` 確認 `__Secure-refresh_token` 的 Expires 是一個日期，不是「Session」。
3. 刪除短效的登入 cookie。
4. 按 Cmd+Q 結束 Chrome，因為在 macOS 上只關閉視窗時，Chrome 會保留只在這次瀏覽期間有效的 cookie。
5. 開啟 Chrome。
6. 開啟 `https://local.taigu.tw/records`。

預期：畫面顯示歷史紀錄頁，不必重新登入。

## ACCT-R5.2 登入滿 30 天

沒有自動化 test 驗證登入狀態到期，也沒有驗證到期時間不隨使用而延後，前端也沒有自動化 test。

1. 如果已登入，登出。
2. 執行下面的指令，讓這個帳號在本機其他瀏覽器的登入都失效：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from django.utils import timezone; from main.account.models import RefreshToken; RefreshToken.objects.filter(user__email='<Email>').update(revoked_at=timezone.now())"
   ```

3. 用 Google 帳號登入。
4. 執行下面的指令，記下印出的到期時間，這個時間大約是現在的 30 天後：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import RefreshToken; print(list(RefreshToken.objects.filter(user__email='<Email>', revoked_at__isnull=True).values_list('expires_at', flat=True)))"
   ```

5. 刪除短效的登入 cookie。
6. 重新整理頁面。
7. 再執行一次步驟 4 的指令。
8. 確認印出的到期時間只有一個，而且跟步驟 4 記下的時間相同。
9. 執行下面的指令，把到期時間改到 1 秒前：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import timedelta; from django.utils import timezone; from main.account.models import RefreshToken; RefreshToken.objects.filter(user__email='<Email>', revoked_at__isnull=True).update(expires_at=timezone.now() - timedelta(seconds=1))"
   ```

10. 刪除短效的登入 cookie。
11. 開啟 `https://local.taigu.tw/records`。
12. 確認畫面換到歡迎頁 `/welcome`。
13. 用 Google 帳號登入。

預期：步驟 11 之後畫面換到歡迎頁 `/welcome`；重新登入後，畫面換回 `/records`。

## ACCT-R5.3 瀏覽器的登入 cookie 被清除

前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 在 DevTools 的 Application > Cookies > `https://local.taigu.tw` 刪除 `__Host-access_token` 與 `__Secure-refresh_token`。
3. 開啟 `https://local.taigu.tw/records`。
4. 確認畫面換到歡迎頁 `/welcome`。
5. 用 Google 帳號登入。

預期：步驟 3 之後畫面換到歡迎頁 `/welcome`；重新登入後，畫面換回 `/records`。

## ACCT-R7.1 登出

沒有自動化 test 驗證登出時讓登入憑證失效，畫面與瀏覽器保存的資料在前端，前端也沒有自動化 test。

1. 如果已登入，登出。
2. 執行下面的指令，讓這個帳號在本機其他瀏覽器的登入都失效：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from django.utils import timezone; from main.account.models import RefreshToken; RefreshToken.objects.filter(user__email='<Email>').update(revoked_at=timezone.now())"
   ```

3. 用 Google 帳號登入。
4. 如果歷史紀錄頁 `/records` 沒有任何交易紀錄，新增一筆交易紀錄。
5. 開啟 `https://local.taigu.tw/`。
6. 在 DevTools 的 Application > IndexedDB > `taigu` > `tradeRecords` 確認有交易紀錄。
7. 執行下面的指令，確認印出 `1`：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import RefreshToken; print(RefreshToken.objects.filter(user__email='<Email>', revoked_at__isnull=True).count())"
   ```

8. 開啟 `https://local.taigu.tw/settings`。
9. 點「登出」。
10. 點確認視窗裡的「登出」。
11. 確認畫面換到登入頁 `/login`。
12. 再執行一次步驟 7 的指令。
13. 在 DevTools 重新整理 IndexedDB 的 `tradeRecords`。
14. 開啟 `https://local.taigu.tw/`。

預期：登出後畫面換到登入頁 `/login`；步驟 12 印出 `0`，這次登入換發過的登入憑證都失效；`tradeRecords` 沒有任何資料；步驟 14 開啟儀表板時畫面換到歡迎頁 `/welcome`。

## ACCT-R7.2 取消登出

前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings`。
3. 點「登出」。
4. 點確認視窗裡取消登出的按鈕。
5. 開啟 `https://local.taigu.tw/records`。

預期：取消登出之後確認視窗關閉，畫面留在設定頁；之後開啟歷史紀錄頁時照常顯示，使用者仍是登入狀態。

## ACCT-R7.3 其他瀏覽器的登入不受影響

沒有自動化 test 驗證登出只影響這個瀏覽器的登入。

1. 在 Chrome 的一般視窗（以下稱瀏覽器 A）用 Google 帳號登入。
2. 開啟 Chrome 的無痕視窗（以下稱瀏覽器 B）。
3. 在瀏覽器 B 用同一個 Google 帳號登入。
4. 在瀏覽器 A 登出。
5. 在瀏覽器 B 刪除短效的登入 cookie。
6. 在瀏覽器 B 開啟 `https://local.taigu.tw/records`。

預期：瀏覽器 B 顯示歷史紀錄頁，不必重新登入。

## ACCT-R8.1 開啟設定頁

前端沒有自動化 test。

1. 如果這個帳號已經過了試用期，執行下面的指令，刪除本機資料庫裡這個帳號與它的所有資料，再用 Google 帳號重新登入，讓帳號回到試用期：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='<Email>').delete()"
   ```

2. 用 Google 帳號登入。
3. 開啟 `https://local.taigu.tw/settings`。
4. 確認設定頁顯示頭像、名字、Email，目前方案顯示「Standard」，並有隱私權政策、服務條款、問題回報與登出的入口。
5. 點頭像與名字那一列。
6. 確認畫面換到 `/settings/user-info`。
7. 開啟 `https://local.taigu.tw/settings`。
8. 點 Email 那一列。
9. 確認畫面換到 `/settings/account-binding`。
10. 開啟 `https://local.taigu.tw/settings`。
11. 點「資料控制」。
12. 確認畫面換到 `/settings/data-controls`。
13. 開啟 `https://local.taigu.tw/settings`。
14. 點「目前方案」。

預期：設定頁顯示使用者的頭像、名字與 Email，目前方案顯示「Standard」；點頭像與名字、Email、資料控制、目前方案，畫面分別換到 `/settings/user-info`、`/settings/account-binding`、`/settings/data-controls`、`/settings/current-plan`；頁面上另有隱私權政策、服務條款、問題回報與登出的入口。

## ACCT-R9.1 修改名字

後端的 test 驗證了 Taigu 儲存新的名字，畫面的部分在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/user-info`。
3. 把名字改成「小明」。
4. 點儲存按鈕。

預期：畫面換到設定頁，顯示的名字是「小明」。

## ACCT-R9.2 修改頭像

後端的 test 驗證了 Taigu 儲存新的頭像網址，畫面的部分在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/user-info`。
3. 清空「頭像位置」。
4. 在「頭像位置」輸入 `https://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50?s=128`。
5. 點儲存按鈕。

預期：畫面換到設定頁，頭像顯示這張圖片。

## ACCT-R9.3 清空頭像位置

後端的 test 驗證了 Taigu 清除頭像網址，畫面的部分在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/user-info`。
3. 如果「頭像位置」是空白，在「頭像位置」輸入 `https://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50?s=128`，點儲存按鈕，再開啟 `https://local.taigu.tw/settings/user-info`。
4. 清空「頭像位置」。
5. 點儲存按鈕。
6. 確認畫面換到設定頁，頭像顯示預設的人像圖示。
7. 在桌面瀏覽器上開啟 `https://local.taigu.tw/`。
8. 確認側邊欄最上方的頭像是預設的人像圖示。
9. 在行動裝置上開啟 `https://local.taigu.tw/`。

預期：設定頁、桌面瀏覽器的側邊欄與行動裝置的底部導覽列都顯示預設的人像圖示。

## ACCT-R9.4 頭像位置不是 http 或 https 網址

前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/user-info`。
3. 記下目前的名字與頭像。
4. 把名字改成「測試」。
5. 清空「頭像位置」。
6. 在「頭像位置」輸入 `ftp://example.com/avatar.png`。
7. 點儲存按鈕。
8. 確認畫面留在頭像與名字頁。
9. 開啟 `https://local.taigu.tw/settings`。

預期：點儲存按鈕之後畫面顯示錯誤提示「無效的頭像 URL，請檢查格式是否正確」，留在頭像與名字頁；設定頁顯示的名字與頭像仍是步驟 3 記下的樣子。

## ACCT-R10.1 套用 Gravatar 頭像

前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 執行下面的指令，把帳號的 Email 改成一個在 Gravatar 有頭像的 Email：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='<Email>').update(email='beau@dentedreality.com.au')"
   ```

3. 開啟 `https://local.taigu.tw/settings/user-info`。
4. 點「使用 Gravatar 頭像」。
5. 點確認套用 Gravatar 頭像的按鈕。
6. 確認「頭像位置」換成 `https://www.gravatar.com/avatar/` 開頭的網址，頭像預覽換成 Gravatar 頭像。
7. 在新分頁開啟 `https://local.taigu.tw/settings`。
8. 確認新分頁上的頭像還是套用前的頭像。
9. 切回原本的分頁。
10. 點儲存按鈕。
11. 確認畫面換到設定頁，頭像換成 Gravatar 頭像。
12. 執行下面的指令，把 Email 改回原本的值：

    ```bash
    docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='beau@dentedreality.com.au').update(email='<Email>')"
    ```

預期：確認套用後「頭像位置」換成 Gravatar 頭像的網址，頭像預覽換成 Gravatar 頭像；儲存修改之前頭像沒有儲存，儲存修改之後設定頁的頭像才換成 Gravatar 頭像。

## ACCT-R10.2 Email 沒有 Gravatar 頭像

前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 執行下面的指令，把帳號的 Email 改成一個在 Gravatar 沒有頭像的 Email：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='<Email>').update(email='nobody-taigu-test@example.com')"
   ```

3. 開啟 `https://local.taigu.tw/settings/user-info`。
4. 確認頁面上沒有「使用 Gravatar 頭像」。
5. 執行下面的指令，把 Email 改回原本的值：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='nobody-taigu-test@example.com').update(email='<Email>')"
   ```

預期：步驟 4 的頁面上沒有「使用 Gravatar 頭像」。

## ACCT-R11.1 改綁成功

後端的 test 驗證了改綁後帳號的 Email、名字與頭像換成新 Google 帳號的資料，畫面的部分在前端，前端沒有自動化 test。

1. 如果第二個 Google 帳號在本機登入過，先注意下一個指令會刪除本機資料庫裡第二個 Google 帳號的 Taigu 帳號與它的所有資料，再把 `<第二個 Email>` 換成第二個 Google 帳號的 Email 後執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='<第二個 Email>').delete()"
   ```

2. 開啟 `https://accounts.google.com`，在這個 Chrome 也登入第二個 Google 帳號。Taigu 送出的授權網址沒有要求 Google 每次都顯示選擇帳號的畫面，所以 Chrome 只登入一個 Google 帳號時，Google 可能直接用那一個帳號授權。
3. 用第一個 Google 帳號登入。
4. 開啟 `https://local.taigu.tw/settings/user-info`。
5. 把名字改成「小明」。
6. 點儲存按鈕。
7. 開啟 `https://local.taigu.tw/settings/account-binding`。
8. 點「更換綁定的帳號」。
9. 點「綁定 Google 帳號」。
10. 在 Google 的畫面選擇第二個 Google 帳號並同意授權。
11. 確認畫面回到 `/settings/account-binding`，顯示「成功綁定」，綁定的帳號顯示第二個 Google 帳號的 Email。
12. 開啟 `https://local.taigu.tw/settings`。
13. 確認名字與頭像是第二個 Google 帳號的名字與頭像，不再是「小明」。
14. 開啟 `https://local.taigu.tw/settings/user-info`。
15. 把名字改成「改綁測試」。
16. 點儲存按鈕。
17. 登出。
18. 用第二個 Google 帳號登入。
19. 開啟 `https://local.taigu.tw/settings`。

預期：改綁後畫面顯示「成功綁定」，綁定的帳號顯示第二個 Google 帳號的 Email；設定頁的名字與頭像換成第二個 Google 帳號的名字與頭像，不再是「小明」；用第二個 Google 帳號登入後進到同一個帳號，設定頁顯示的名字是「改綁測試」。檢查完之後，可以照步驟 7 到 10 改綁回第一個 Google 帳號，在步驟 10 改選第一個 Google 帳號。

## ACCT-R11.2 選了已經綁定 Taigu 帳號的 Google 帳號

後端的 test 驗證了 Taigu 拒絕改綁，帳號綁定頁的顯示在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/account-binding`。
3. 記下綁定的帳號顯示的 Email。
4. 點「更換綁定的帳號」。
5. 點「綁定 Google 帳號」。
6. 在 Google 的畫面選擇目前綁定的這個 Google 帳號並同意授權。
7. 等畫面回到 `/settings/account-binding`。

預期：Taigu 不改綁，帳號綁定頁仍顯示步驟 3 記下的 Email。

## ACCT-R12.1 開啟別人傳來的登入連結

後端的 test 驗證了 api-server 拒絕沒有對應 cookie 的授權結果，錯誤提示與網址的變化在前端，前端沒有自動化 test。

1. 開啟訪客視窗。
2. 在訪客視窗開啟 DevTools 的 Network 面板。
3. 在 Network 面板勾選「Preserve log」。
4. 在訪客視窗擋下 `/api/account/google-login` 的 request。
5. 在訪客視窗開啟 `https://local.taigu.tw/login`。
6. 點 Google 登入按鈕。
7. 在 Google 的畫面選擇帳號並同意授權。
8. 在訪客視窗複製 Google 帶回的網址。
9. 關閉訪客視窗。
10. 如果原本的 Chrome 已登入，登出。
11. 在原本的 Chrome 開啟步驟 8 複製的網址。
12. 確認畫面的狀態。
13. 開啟 `https://local.taigu.tw/`。

預期：步驟 12 的畫面留在登入頁，網址不再帶有 `code` 與 `state`，並顯示錯誤提示「登入失敗，請重新登入。」；步驟 13 的畫面換到歡迎頁 `/welcome`。

## ACCT-R12.2 開啟別人傳來的改綁連結

後端的 test 驗證了 api-server 拒絕沒有對應 cookie 的授權結果，錯誤提示與網址的變化在前端，前端沒有自動化 test。

1. 在原本的 Chrome 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/account-binding`。
3. 記下綁定的帳號顯示的 Email。
4. 開啟訪客視窗。
5. 在訪客視窗用同一個 Google 帳號登入。
6. 在訪客視窗開啟 DevTools 的 Network 面板。
7. 在 Network 面板勾選「Preserve log」。
8. 在訪客視窗擋下 `/api/account/change-binding` 的 request。
9. 在訪客視窗開始更換綁定的帳號。
10. 在 Google 的畫面選擇第二個 Google 帳號並同意授權。
11. 在訪客視窗複製 Google 帶回的網址。
12. 關閉訪客視窗。
13. 在原本的 Chrome 開啟步驟 11 複製的網址。
14. 確認畫面的狀態。
15. 登出。
16. 用步驟 1 的 Google 帳號登入。
17. 開啟 `https://local.taigu.tw/settings/account-binding`。

預期：步驟 14 的帳號綁定頁仍顯示步驟 3 記下的 Email，網址不再帶有 `code` 與 `state`，並顯示錯誤提示「更換綁定的帳號失敗，請再試一次。」；步驟 17 的帳號綁定頁也顯示步驟 3 記下的 Email。

## ACCT-R12.3 開始登入超過 10 分鐘才回到 Taigu

後端的 test 驗證了 api-server 拒絕開始超過 10 分鐘的授權，瀏覽器保存 cookie 的時間與畫面的變化要在瀏覽器上確認。

1. 如果已登入，登出。
2. 開啟 `https://local.taigu.tw/login`。
3. 點 Google 登入按鈕。
4. 在 Google 的畫面等 11 分鐘。
5. 選擇帳號並同意授權。
6. 確認畫面的狀態。
7. 開啟 `https://local.taigu.tw/`。

預期：步驟 6 的畫面回到登入頁，並顯示錯誤提示「登入失敗，請重新登入。」；步驟 7 的畫面換到歡迎頁 `/welcome`。

## ACCT-R12.4 同一個瀏覽器先後開始兩次登入

後端的 test 驗證了 api-server 只接受最近一次開始的授權，兩個分頁的畫面要在瀏覽器上確認。

1. 如果已登入，登出。
2. 如果 DevTools 的 Application > Local Storage > `https://local.taigu.tw` 有 `pathAndQueryString`，刪除這一筆。
3. 在分頁 A 開啟 `https://local.taigu.tw/login`。
4. 在分頁 A 點 Google 登入按鈕，停在 Google 的畫面。
5. 在分頁 B 開啟 `https://local.taigu.tw/login`。
6. 在分頁 B 點 Google 登入按鈕，停在 Google 的畫面。
7. 在分頁 A 選擇帳號並同意授權。
8. 確認分頁 A 的畫面。
9. 在分頁 B 選擇帳號並同意授權。
10. 確認分頁 B 的畫面。

預期：步驟 8 的分頁 A 回到登入頁，並顯示錯誤提示「登入失敗，請重新登入。」；步驟 10 的分頁 B 完成登入，畫面換到儀表板 `/`。

## ACCT-R12.5 未登入時開啟別人傳來的改綁連結

前端沒有自動化 test。

1. 在原本的 Chrome 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/account-binding`。
3. 記下綁定的帳號顯示的 Email。
4. 登出。
5. 開啟訪客視窗。
6. 在訪客視窗用同一個 Google 帳號登入。
7. 在訪客視窗開啟 DevTools 的 Network 面板。
8. 在 Network 面板勾選「Preserve log」。
9. 在訪客視窗擋下 `/api/account/change-binding` 的 request。
10. 在訪客視窗開始更換綁定的帳號。
11. 在 Google 的畫面選擇第二個 Google 帳號並同意授權。
12. 在訪客視窗複製 Google 帶回的網址。
13. 關閉訪客視窗。
14. 在原本的 Chrome 開啟步驟 12 複製的網址。
15. 確認畫面換到歡迎頁 `/welcome`。
16. 用步驟 1 的 Google 帳號登入。

預期：登入之後畫面換回帳號綁定頁，綁定的帳號顯示步驟 3 記下的 Email，網址不再帶有 `code` 與 `state`，並顯示錯誤提示「更換綁定的帳號失敗，請再試一次。」。

## ACCT-R12.6 Access Token 過期時更換綁定的帳號

後端的 test 驗證了有一個未登入的 request 先送到更換綁定帳號的 API 之後，access token 過期的 request 仍得到 401、cookie 沒有被刪除，換發 access token 之後重送的 request 能完成改綁；前端換發 access token 之後重送 request 的部分沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/account-binding`。
3. 刪除短效的登入 cookie。
4. 點「更換綁定的帳號」。
5. 點「綁定 Google 帳號」，停在 Google 的畫面。
6. 在 repo 的根目錄執行下面的指令。這個指令會在接下來的 60 秒內，每秒送一個未登入、但通過 CSRF 檢查的 request 到更換綁定帳號的 API：

   ```bash
   curl -sk -c /tmp/taigu-anonymous -o /dev/null "https://local.taigu.tw/api/account/authorization-url?redirect_uri=https://local.taigu.tw/login" && for i in $(seq 60); do curl -sk -b /tmp/taigu-anonymous -H "X-CSRFToken: $(awk '$6=="csrftoken"{print $7}' /tmp/taigu-anonymous)" -H "Origin: https://local.taigu.tw" -o /dev/null -w "%{http_code}\n" -X POST https://local.taigu.tw/api/account/change-binding; sleep 1; done
   ```

7. 在指令執行的期間，在 Google 的畫面選擇第二個 Google 帳號並同意授權。
8. 確認畫面的狀態。
9. 確認指令印出的每一行 status code 都是 `401`。

預期：步驟 8 的畫面回到帳號綁定頁並顯示「成功綁定」，綁定的帳號顯示第二個 Google 帳號的 Email；步驟 9 的每一行都是 `401`。檢查完之後，可以照 ACCT-R11.1 的步驟 7 到 10 改綁回第一個 Google 帳號，在步驟 10 改選第一個 Google 帳號。

## ACCT-R13.1 登入時 Google 不接受授權結果

後端的 test 驗證了 Google 不接受授權結果時 api-server 的回應，錯誤提示與網址的變化在前端，前端沒有自動化 test。

1. 如果已登入，登出。
2. 開啟 DevTools 的 Network 面板。
3. 在 Network 面板勾選「Preserve log」。
4. 擋下 `/api/account/google-login` 的 request。
5. 開啟 `https://local.taigu.tw/login`。
6. 點 Google 登入按鈕。
7. 在 Google 的畫面選擇帳號並同意授權。
8. 複製 Google 帶回的網址。
9. 把網址裡 `code=` 後面的值的最後一個字元換成別的字元，`state` 不改。
10. 取消擋下 request。
11. 在同一個分頁開啟步驟 9 改過的網址。
12. 確認畫面的狀態。
13. 開啟 `https://local.taigu.tw/`。

預期：步驟 12 的畫面留在登入頁，網址不再帶有 `code` 與 `state`，並顯示錯誤提示「登入失敗，請重新登入。」；步驟 13 的畫面換到歡迎頁 `/welcome`。

## ACCT-R13.2 改綁時 Google 不接受授權結果

後端的 test 驗證了 Google 不接受授權結果時 api-server 的回應，錯誤提示與網址的變化在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/account-binding`。
3. 記下綁定的帳號顯示的 Email。
4. 開啟 DevTools 的 Network 面板。
5. 在 Network 面板勾選「Preserve log」。
6. 擋下 `/api/account/change-binding` 的 request。
7. 點「更換綁定的帳號」。
8. 點「綁定 Google 帳號」。
9. 在 Google 的畫面選擇第二個 Google 帳號並同意授權。
10. 複製 Google 帶回的網址。
11. 把網址裡 `code=` 後面的值的最後一個字元換成別的字元，`state` 不改。
12. 取消擋下 request。
13. 在同一個分頁開啟步驟 11 改過的網址。

預期：帳號綁定頁仍顯示步驟 3 記下的 Email，網址不再帶有 `code` 與 `state`，並顯示錯誤提示「更換綁定的帳號失敗，請再試一次。」。

## ACCT-R13.3 登入時 Taigu 連不上 Google

後端的 test 驗證了連不上 Google 時 api-server 的回應，錯誤提示與網址的變化在前端，前端沒有自動化 test。

1. 如果已登入，登出。
2. 開啟 `https://local.taigu.tw/login`。
3. 點 Google 登入按鈕，停在 Google 的畫面。
4. 執行下面的指令，讓 api-server 的 container 連不上 Google 的 token endpoint：

   ```bash
   docker compose -f compose.dev.yaml exec api-server sh -c 'cp /etc/hosts /etc/hosts.bak && echo "127.0.0.1 oauth2.googleapis.com" >> /etc/hosts'
   ```

5. 在 Google 的畫面選擇帳號並同意授權。
6. 確認畫面的狀態。
7. 執行下面的指令，讓 api-server 的 container 恢復連線：

   ```bash
   docker compose -f compose.dev.yaml exec api-server sh -c 'cp /etc/hosts.bak /etc/hosts'
   ```

預期：步驟 6 的畫面留在登入頁，網址不再帶有 `code` 與 `state`，並顯示錯誤提示「登入失敗，請重新登入。」，使用者沒有登入。

## ACCT-R13.4 Google 帶回取消授權以外的錯誤

Google 帶回的錯誤只由前端處理，前端沒有自動化 test。

1. 如果已登入，登出。
2. 開啟 `https://local.taigu.tw/login?error=server_error&state=test`。
3. 確認畫面的狀態。
4. 開啟 `https://local.taigu.tw/`。

預期：步驟 3 的畫面留在登入頁，網址不再帶有 `error` 與 `state`，並顯示錯誤提示「登入失敗，請重新登入。」；步驟 4 的畫面換到歡迎頁 `/welcome`。

## ACCT-R13.5 沒通過檢查又選到已經綁定的 Google 帳號

後端的 test 驗證了 api-server 先檢查 `state` 再檢查 Google 帳號有沒有綁定，兩個分頁的畫面要在瀏覽器上確認。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/account-binding`。
3. 記下綁定的帳號顯示的 Email。
4. 在分頁 A 開始更換綁定的帳號，停在 Google 的畫面。
5. 在分頁 B 開始更換綁定的帳號，停在 Google 的畫面。
6. 在分頁 A 選擇目前綁定的 Google 帳號並同意授權。

預期：分頁 A 回到帳號綁定頁，仍顯示步驟 3 記下的 Email，並顯示錯誤提示「更換綁定的帳號失敗，請再試一次。」。

## ACCT-R14.1 登入時取消授權

Google 帶回的錯誤只由前端處理，前端沒有自動化 test。

1. 開啟 `https://myaccount.google.com/connections`。
2. 如果登入用的 Google 帳號已經讓 Taigu 存取資料，移除這項存取權，因為已經同意過授權時，Google 會直接帶使用者回到 Taigu，畫面上沒有取消的按鈕。
3. 如果已登入，登出。
4. 開啟 DevTools 的 Network 面板。
5. 在 Network 面板勾選「Preserve log」。
6. 開啟 `https://local.taigu.tw/login`。
7. 點 Google 登入按鈕。
8. 在 Google 的畫面選擇帳號。
9. 點「取消」。
10. 確認畫面的狀態。
11. 複製 Google 帶回的網址。
12. 記下網址帶了哪些參數。

預期：步驟 10 的畫面回到登入頁，網址沒有 Google 帶回來的參數，畫面上沒有錯誤提示，使用者沒有登入；步驟 12 的網址帶有 `error=access_denied` 與 `state`，沒有 `code`。

## ACCT-R14.2 改綁時取消授權

Google 帶回的錯誤只由前端處理，前端沒有自動化 test。

1. 開啟 `https://myaccount.google.com/connections`。
2. 如果第二個 Google 帳號已經讓 Taigu 存取資料，移除這項存取權。
3. 用 Google 帳號登入。
4. 開啟 `https://local.taigu.tw/settings/account-binding`。
5. 記下綁定的帳號顯示的 Email。
6. 點「更換綁定的帳號」。
7. 點「綁定 Google 帳號」。
8. 在 Google 的畫面選擇第二個 Google 帳號。
9. 點「取消」。

預期：畫面回到帳號綁定頁，仍顯示步驟 5 記下的 Email，網址沒有 Google 帶回來的參數，畫面上沒有錯誤提示。
