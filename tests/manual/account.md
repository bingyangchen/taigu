注意：這份檔案的指令會刪除或修改開發環境資料庫裡的資料，包括登入帳號的紀錄，所以要用只拿來測試的 Google 帳號登入，不要用存有真實資料的帳號。

執行 `make start`，準備一個能登入的 Google 帳號，再用 Chrome 開啟 `https://local.taigu.tw`。下面的指令要把 `<Email>` 換成登入用的 Google 帳號的 Email。

ACCT-R11.1、ACCT-R12.2、ACCT-R12.5、ACCT-R12.6、ACCT-R13.2 與 ACCT-R14.2 另外需要第二個 Google 帳號，而且第二個 Google 帳號不能綁定任何 Taigu 帳號。如果第二個 Google 帳號在本機登入過，先照 ACCT-R11.1 的步驟 1 刪除綁定它的 Taigu 帳號。這些情境開始之前，也要先照 ACCT-R11.1 的步驟 2 在 Chrome 登入第二個 Google 帳號，用到訪客視窗的情境也要在訪客視窗登入第二個 Google 帳號，否則 Google 可能直接用第一個帳號授權。

步驟裡的下面這些說法代表固定的操作：

- 「在桌面瀏覽器上」：直接用 Chrome。
- 「在行動裝置上」：開啟 DevTools 的裝置模擬（Toggle device toolbar）並選一款手機，再重新整理頁面，因為前端依 user agent 判斷是不是行動裝置。
- 「登出」：開啟 `https://local.taigu.tw/settings`，點「登出」，再點確認視窗裡的「登出」。
- 「用 Google 帳號登入」：開啟 `https://local.taigu.tw/login`，點 Google 登入按鈕，在 Google 的畫面選擇帳號並同意授權。
- 「刪除 access token 的 cookie」：在 DevTools 的 Application > Cookies > `https://local.taigu.tw` 刪除 `__Host-access_token`。這個 cookie 原本在 15 分鐘後過期，所以刪除它等於閒置超過 15 分鐘。
- 「開始更換綁定的帳號」：開啟 `https://local.taigu.tw/settings/account-binding`，點「更換綁定的帳號」，再點「綁定 Google 帳號」。
- 「訪客視窗」：指 Chrome 選單的「開啟訪客視窗」開出來的視窗。訪客視窗的 cookie 跟原本的 Chrome 分開，所以可以當成另一個人的瀏覽器。
- 「擋下 `<路徑>` 的 request」：在 DevTools 按 Cmd+Shift+P，執行「Show Network request blocking」，勾選「Enable network request blocking」，再新增 pattern `*<路徑>*`。
- 「取消擋下 request」：取消勾選「Enable network request blocking」。
- 「複製 Google 帶回的網址」：在 DevTools 的 Network 面板找到 Type 是 document、名稱以 `login?` 或 `account-binding?` 開頭的那一筆 request，按右鍵選 Copy > Copy URL。因為前端在送出授權結果之後就會移除網址上的參數，所以有這一步的情境，都要在開始授權之前先開啟 DevTools 的 Network 面板，並勾選「Preserve log」。

下面需要模擬 CSRF 回應的情境，在 DevTools 的 Console 執行這段程式。每次重新整理後需重新執行；檢查結束後呼叫 `restoreTaiguFetch()`：

```javascript
window.originalTaiguFetch = window.fetch.bind(window);
window.restoreTaiguFetch = () => { window.fetch = window.originalTaiguFetch; };
window.mockTaiguCsrf = (code, limit = Infinity) => {
  let count = 0;
  window.fetch = async (input, options) => {
    if (new URL(input, location.origin).pathname === "/api/account/update" && count++ < limit) {
      return new Response(code === null ? "Forbidden" : JSON.stringify({ code }), {
        status: 403,
        headers: { "Content-Type": code === null ? "text/html" : "application/json" },
      });
    }
    return window.originalTaiguFetch(input, options);
  };
};
```

## ACCT-R1.1 從登入頁登入

前端沒有自動化 test。

1. 如果已登入，登出。
2. 如果 DevTools 的 Application > Session Storage > `https://local.taigu.tw` 有 `pathAndQueryString`，刪除這一筆。
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

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 登出。
2. 在同一分頁開啟 `https://local.taigu.tw/records?sid=2330`。
3. 確認畫面換到歡迎頁。
4. 開啟登入頁。
5. 從記住網址起算未滿 30 分鐘時，在原分頁完成 Google 登入。
6. 在 DevTools 的 Application > Session Storage 確認 `pathAndQueryString` 已移除。

預期：畫面換到 `/records?sid=2330`，記住的網址已清除。

## ACCT-R3.3 返回網址在滿 30 分鐘時失效

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 登出。
2. 開啟 `https://local.taigu.tw/records?sid=2330`。
3. 確認畫面換到歡迎頁。
4. 在 DevTools 的 Sources 開啟 `returnUrl.ts`。
5. 在 `consumeReturnUrl` 的第一行設定 breakpoint。
6. 在同一分頁完成 Google 授權，等程式停在 breakpoint。
7. 在 Console 執行 `const saved = JSON.parse(sessionStorage.getItem("pathAndQueryString")); Date.now = () => saved.savedAt + 1800000;`。
8. 繼續執行程式。
9. 確認 Session Storage 的 `pathAndQueryString` 已移除。

預期：畫面換到儀表板，記住的網址已清除。

## ACCT-R3.4 返回網址只使用一次

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 完成 ACCT-R3.2。
2. 確認畫面回到歷史紀錄頁。
3. 主動登出。
4. 直接在登入頁再次完成 Google 登入。

預期：畫面換到儀表板。

## ACCT-R3.5 其他分頁不使用返回網址

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 登出。
2. 在分頁 A 開啟 `https://local.taigu.tw/records?sid=2330`。
3. 以瀏覽器的新分頁按鈕另開分頁 B。
4. 在分頁 B 開啟 `https://local.taigu.tw/login`。
5. 在分頁 B 完成 Google 登入。

預期：分頁 B 換到儀表板，不使用分頁 A 的返回網址。

## ACCT-R3.6 關閉原分頁後不使用返回網址

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 登出。
2. 開啟 `https://local.taigu.tw/records?sid=2330`。
3. 確認畫面換到歡迎頁。
4. 關閉原分頁。
5. 用新分頁按鈕另開分頁。
6. 開啟 `https://local.taigu.tw/login`。
7. 完成 Google 登入。

預期：畫面換到儀表板。

## ACCT-R3.7 取消登入不延長返回期限

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 登出。
2. 開啟 `https://local.taigu.tw/records?sid=2330`。
3. 記下 Session Storage 裡 `pathAndQueryString` 的 `savedAt`。
4. 開始 Google 登入。
5. 在 Google 的畫面取消授權。
6. 確認 `savedAt` 沒有改變。
7. 等最初記住網址滿 30 分鐘後，在原分頁重新完成登入。

預期：畫面換到儀表板。

## ACCT-R3.8 已登入時清除留下的返回網址

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 登出。
2. 在分頁 A 開啟 `https://local.taigu.tw/records?sid=2330`。
3. 確認 Session Storage 已記住網址。
4. 另開分頁 B。
5. 在分頁 B 直接完成 Google 登入。
6. 回到分頁 A 開啟 `https://local.taigu.tw/login`。
7. 確認分頁 A 的 Session Storage 已移除 `pathAndQueryString`。

預期：畫面換到儀表板，分頁 A 記住的網址已清除。

## ACCT-R3.9 還原分頁沿用原返回期限

瀏覽器還原分頁的儲存行為需要手動確認。

1. 登出。
2. 開啟 `https://local.taigu.tw/records?sid=2330`。
3. 確認畫面換到歡迎頁。
4. 記下 Session Storage 裡 `pathAndQueryString` 的 `savedAt`。
5. 關閉分頁。
6. 用 Chrome 的「重新開啟已關閉的分頁」還原分頁。
7. 如果瀏覽器保留紀錄，確認 `savedAt` 不變。
8. 在原期限內完成 Google 登入。
9. 重做步驟 1 到 7。
10. 等最初記住網址滿 30 分鐘後，完成 Google 登入。
11. 記下實測的瀏覽器與版本。

預期結果依瀏覽器是否保留紀錄及紀錄的時間判定：

- 瀏覽器保留紀錄且未滿 30 分鐘時，畫面返回 `/records?sid=2330`。
- 瀏覽器保留紀錄且已滿 30 分鐘時，畫面換到儀表板。
- 瀏覽器沒有保留紀錄時，畫面換到儀表板。

前端會清除使用過的紀錄。

## ACCT-R3.10 複製分頁沿用原返回期限

瀏覽器複製分頁的儲存行為需要手動確認。

1. 登出。
2. 開啟 `https://local.taigu.tw/records?sid=2330`。
3. 確認畫面換到歡迎頁。
4. 記下 Session Storage 裡 `pathAndQueryString` 的 `savedAt`。
5. 用瀏覽器分頁選單的「複製」建立新分頁。
6. 如果瀏覽器複製了紀錄，確認新分頁的 `savedAt` 不變。
7. 在新分頁於原期限內完成 Google 登入。
8. 重做步驟 1 到 6。
9. 等最初記住網址滿 30 分鐘後，在新分頁完成 Google 登入。
10. 記下實測的瀏覽器與版本。

預期結果依瀏覽器是否複製紀錄及紀錄的時間判定：

- 瀏覽器複製紀錄且未滿 30 分鐘時，畫面返回 `/records?sid=2330`。
- 瀏覽器複製紀錄且已滿 30 分鐘時，畫面換到儀表板。
- 瀏覽器沒有複製紀錄時，畫面換到儀表板。

前端會清除使用過的紀錄，複製分頁不重新起算期限。

## ACCT-R5.1 閒置並關閉瀏覽器後再開啟

後端的 test 只驗證更新登入 cookie，瀏覽器自動維持登入狀態的部分在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 在 DevTools 的 Application > Cookies > `https://local.taigu.tw` 確認 `__Secure-refresh_token` 的 Expires 是一個日期，不是「Session」。
3. 刪除 access token 的 cookie。
4. 按 Cmd+Q 結束 Chrome，因為在 macOS 上只關閉視窗時，Chrome 會保留只在這次瀏覽期間有效的 cookie。
5. 開啟 Chrome。
6. 開啟 `https://local.taigu.tw/records`。

預期：畫面顯示歷史紀錄頁，不必重新登入。

## ACCT-R5.2 登入滿 30 天

後端的 test 驗證了原到期時間與拒絕更新 access token，前端的換頁與資料清除需要手動確認。

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

5. 刪除 access token 的 cookie。
6. 重新整理頁面。
7. 再執行一次步驟 4 的指令。
8. 確認印出的到期時間只有一個，而且跟步驟 4 記下的時間相同。
9. 執行下面的指令，把到期時間改到 1 秒前：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from datetime import timedelta; from django.utils import timezone; from main.account.models import RefreshToken; RefreshToken.objects.filter(user__email='<Email>', revoked_at__isnull=True).update(expires_at=timezone.now() - timedelta(seconds=1))"
   ```

10. 刪除 access token 的 cookie。
11. 開啟 `https://local.taigu.tw/records`。
12. 確認畫面換到歡迎頁 `/welcome`。
13. 用 Google 帳號登入。

預期：舊帳號資料依 ACCT-R17 清除，畫面換到歡迎頁 `/welcome`；在原分頁於 30 分鐘內重新登入後，畫面換回 `/records`。

## ACCT-R5.3 瀏覽器的登入 cookie 被清除

前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 在 DevTools 的 Application > Cookies > `https://local.taigu.tw` 刪除 `__Host-access_token` 與 `__Secure-refresh_token`。
3. 開啟 `https://local.taigu.tw/records`。
4. 確認畫面換到歡迎頁 `/welcome`。
5. 用 Google 帳號登入。

預期：舊帳號資料依 ACCT-R17 清除，畫面換到歡迎頁 `/welcome`；在原分頁於 30 分鐘內重新登入後，畫面換回 `/records`。

## ACCT-R6.2 多個分頁同時更新 Access Token

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 登入。
2. 在同一個瀏覽器開啟兩個 Taigu 分頁。
3. 在兩個分頁開啟 DevTools 的 Network 面板並保留紀錄。
4. 刪除 access token 的 cookie。
5. 讓兩個分頁同時重新讀取資料。
6. 檢查 `account/me?check_session=1`、`account/refresh-token` 的順序與回應，確認等待中的分頁先重新確認登入，沒有使用舊 token 觸發 replay。
7. 用同一個瀏覽器的四個分頁開啟設定頁。
8. 刪除 access token 的 cookie。
9. 讓四個分頁同時重新載入設定頁。
10. 確認四個分頁都能讀取帳號，內部檢查沒有占用一般 `me` 的讀取額度。
11. 在一個分頁更換綁定的 Google 帳號，同時讓另一個分頁更新 access token。
12. 確認兩種操作使用同一把鎖，兩個分頁之後仍可讀取資料。

預期：各分頁都取得資料並維持登入，不因同時更新 access token 而結束登入。

## ACCT-R7.1 登出

後端的 test 驗證了登出作廢 refresh token，畫面與瀏覽器資料清除需要手動確認。

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

預期：登出後畫面換到登入頁 `/login`；步驟 12 印出 `0`，這次登入發出過的 refresh token 都失效；`tradeRecords` 沒有任何資料；步驟 14 開啟儀表板時畫面換到歡迎頁 `/welcome`。

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
5. 在瀏覽器 B 刪除 access token 的 cookie。
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

後端的 test 驗證了新的名字有存下來，畫面的部分在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/user-info`。
3. 把名字改成「小明」。
4. 點儲存按鈕。

預期：畫面換到設定頁，顯示的名字是「小明」。

## ACCT-R9.2 修改頭像

後端的 test 驗證了新的頭像網址有存下來，畫面的部分在前端，前端沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/user-info`。
3. 清空「頭像位置」。
4. 在「頭像位置」輸入 `https://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50?s=128`。
5. 點儲存按鈕。

預期：畫面換到設定頁，頭像顯示這張圖片。

## ACCT-R9.3 清空頭像位置

後端的 test 驗證了頭像網址已清除，畫面的部分在前端，前端沒有自動化 test。

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

## ACCT-R9.5 去掉名字頭尾空白

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 開啟 `https://local.taigu.tw/settings/user-info`。
2. 把名字改成「 小明 」。
3. 清空「頭像位置」或輸入合法的 https 網址。
4. 點儲存按鈕。

預期：畫面換到設定頁，名字是「小明」。

## ACCT-R9.6 名字只有空白

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 開啟 `https://local.taigu.tw/settings/user-info`。
2. 記下原本的名字與頭像。
3. 把頭像位置改成另一個合法的 https 網址。
4. 在名字欄位輸入三個空白。
5. 點儲存按鈕。
6. 確認輸入保留。
7. 在另一分頁開啟設定頁。
8. 核對名字與頭像是否仍與步驟 2 記下的資料相同。

預期：顯示「名字需為 1 到 64 個字。」，留在原頁面並保留輸入，名字與頭像都沒有儲存。

## ACCT-R9.7 名字超過 64 個字

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 開啟 `https://local.taigu.tw/settings/user-info`。
2. 記下原本的名字與頭像。
3. 在名字欄位輸入 65 個「字」或 65 個 😀。
4. 清空「頭像位置」或輸入符合限制的網址。
5. 點儲存按鈕。
6. 確認輸入保留。
7. 在另一分頁開啟設定頁。
8. 核對名字與頭像是否仍與步驟 2 記下的資料相同。

預期：顯示「名字需為 1 到 64 個字。」，留在原頁面並保留輸入，名字與頭像都沒有儲存。

## ACCT-R9.8 名字長度的上下限

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 開啟 `https://local.taigu.tw/settings/user-info`。
2. 在名字欄位輸入 1 個字。
3. 點儲存按鈕。
4. 再次開啟頭像與名字頁。
5. 在名字欄位輸入 64 個 😀。
6. 點儲存按鈕。
7. 確認前端與後端都以 Unicode code point 計算長度。

預期：兩次都成功儲存，設定頁分別顯示完整的名字。

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

## ACCT-R11.1 更換綁定的 Google 帳號成功

後端的 test 驗證了更換綁定的 Google 帳號後帳號的 Email、名字與頭像換成新 Google 帳號的資料，畫面的部分在前端，前端沒有自動化 test。

1. 如果第二個 Google 帳號在本機登入過，先注意下一個指令會刪除本機資料庫裡第二個 Google 帳號的 Taigu 帳號與它的所有資料，再把 `<第二個 Email>` 換成第二個 Google 帳號的 Email 後執行：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='<第二個 Email>').delete()"
   ```

2. 開啟 `https://accounts.google.com`，在這個 Chrome 也登入第二個 Google 帳號。後端產生的授權網址沒有要求 Google 每次都顯示選擇帳號的畫面，所以 Chrome 只登入一個 Google 帳號時，Google 可能直接用那一個帳號授權。
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
15. 把名字改成「綁定帳號測試」。
16. 點儲存按鈕。
17. 登出。
18. 用第二個 Google 帳號登入。
19. 開啟 `https://local.taigu.tw/settings`。

預期：更換綁定的 Google 帳號後畫面顯示「成功綁定」，綁定的帳號顯示第二個 Google 帳號的 Email；設定頁的名字與頭像換成第二個 Google 帳號的名字與頭像，不再是「小明」；用第二個 Google 帳號登入後進到同一個帳號，設定頁顯示的名字是「綁定帳號測試」。檢查完之後，可以照步驟 7 到 10 把綁定的 Google 帳號換回第一個 Google 帳號，在步驟 10 改選第一個 Google 帳號。

## ACCT-R11.2 選了已經綁定其他 Taigu 帳號的 Google 帳號

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用第二個 Google 帳號第一次登入 Taigu，建立帳號。
2. 登出。
3. 用第一個 Google 帳號登入。
4. 開啟 `https://local.taigu.tw/settings/account-binding`。
5. 開始更換綁定的帳號。
6. 在 Google 的畫面選擇第二個 Google 帳號並同意授權。
7. 檢查網址已移除 Google 帶回的參數。
8. 確認原本的 Email 與 refresh token 的 cookie 沒有改變。

預期：顯示「這個 Google 帳號已綁定其他 Taigu 帳號，請選擇其他帳號。」，帳號資料與原本的 refresh token 不變，網址不再帶有 Google 帶回的參數。

## ACCT-R11.3 選到目前綁定的 Google 帳號

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用 Google 帳號登入。
2. 在頭像與名字頁設定自訂名字與頭像。
3. 記下 refresh token 的 cookie。
4. 開啟帳號綁定頁。
5. 開始更換綁定的帳號。
6. 在 Google 的畫面選擇目前已綁定的 Google 帳號。
7. 確認顯示預期的提示。
8. 確認網址已移除 Google 帶回的參數。
9. 核對自訂資料與 refresh token 的 cookie 沒有改變。

預期：以黃色 toast 顯示「目前已綁定這個 Google 帳號，無需更換。」，文字與關閉圖示使用深色，名字與頭像不被 Google 資料覆蓋，原本的 refresh token 與登入期限不變，網址不再帶有 Google 帶回的參數。

## ACCT-R11.6 更換綁定的 Google 帳號不影響其他瀏覽器

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用同一個 Taigu 帳號分別登入 Chrome 與訪客視窗。
2. 在 Chrome 把綁定的 Google 帳號換成尚未綁定的第二個 Google 帳號。
3. 在訪客視窗刪除 access token 的 cookie。
4. 在訪客視窗重新開啟歷史紀錄頁。

預期：訪客視窗中的前端成功更新 access token 並讀取資料，使用者不必重新登入。

## ACCT-R12.1 開啟別人傳來的登入連結

後端的 test 驗證了沒有對應 cookie 的授權結果會被拒絕，錯誤提示與網址的變化在前端，前端沒有自動化 test。

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

## ACCT-R12.2 開啟別人更換綁定的 Google 帳號時取得的連結

後端的 test 驗證了沒有對應 cookie 的授權結果會被拒絕，錯誤提示與網址的變化在前端，前端沒有自動化 test。

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
16. 在原分頁於 30 分鐘內，用步驟 1 的 Google 帳號登入。
17. 開啟 `https://local.taigu.tw/settings/account-binding`。

預期：步驟 14 的帳號綁定頁仍顯示步驟 3 記下的 Email，網址不再帶有 `code` 與 `state`，並顯示錯誤提示「更換綁定的帳號失敗，請再試一次。」；步驟 17 的帳號綁定頁也顯示步驟 3 記下的 Email。

## ACCT-R12.3 開始登入超過 10 分鐘才回到 Taigu

後端的 test 驗證了開始超過 10 分鐘的授權會被拒絕，瀏覽器保存 cookie 的時間與畫面的變化要在瀏覽器上確認。

1. 如果已登入，登出。
2. 開啟 `https://local.taigu.tw/login`。
3. 點 Google 登入按鈕。
4. 在 Google 的畫面等 11 分鐘。
5. 選擇帳號並同意授權。
6. 確認畫面的狀態。
7. 開啟 `https://local.taigu.tw/`。

預期：步驟 6 的畫面回到登入頁，並顯示錯誤提示「登入失敗，請重新登入。」；步驟 7 的畫面換到歡迎頁 `/welcome`。

## ACCT-R12.4 同一個瀏覽器先後開始兩次登入

後端的 test 驗證了只有最近一次開始的授權會被接受，兩個分頁的畫面要在瀏覽器上確認。

1. 如果已登入，登出。
2. 如果 DevTools 的 Application > Session Storage > `https://local.taigu.tw` 有 `pathAndQueryString`，刪除這一筆。
3. 在分頁 A 開啟 `https://local.taigu.tw/login`。
4. 在分頁 A 點 Google 登入按鈕，停在 Google 的畫面。
5. 在分頁 B 開啟 `https://local.taigu.tw/login`。
6. 在分頁 B 點 Google 登入按鈕，停在 Google 的畫面。
7. 在分頁 A 選擇帳號並同意授權。
8. 確認分頁 A 的畫面。
9. 在分頁 B 選擇帳號並同意授權。
10. 確認分頁 B 的畫面。

預期：步驟 8 的分頁 A 回到登入頁，並顯示錯誤提示「登入失敗，請重新登入。」；步驟 10 的分頁 B 完成登入，畫面換到儀表板 `/`。

## ACCT-R12.5 未登入時開啟別人更換綁定的 Google 帳號時取得的連結

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

後端的 test 驗證了有一個未登入的 request 先送到更換綁定帳號的 API 之後，access token 過期的 request 仍得到 401、cookie 沒有被刪除，更新 access token 之後重送的 request 能完成更換綁定的 Google 帳號；前端更新 access token 之後重送 request 的部分沒有自動化 test。

1. 用 Google 帳號登入。
2. 開啟 `https://local.taigu.tw/settings/account-binding`。
3. 刪除 access token 的 cookie。
4. 點「更換綁定的帳號」。
5. 點「綁定 Google 帳號」，停在 Google 的畫面。
6. 在 repo 的根目錄執行下面的指令。這個指令會在接下來的 60 秒內，每秒送一個未登入、但通過 CSRF 檢查的 request 到更換綁定帳號的 API：

   ```bash
   curl -sk -c /tmp/taigu-anonymous -o /dev/null "https://local.taigu.tw/api/account/authorization-url?redirect_uri=https://local.taigu.tw/login" && for i in $(seq 60); do curl -sk -b /tmp/taigu-anonymous -H "X-CSRFToken: $(awk '$6=="csrftoken"{print $7}' /tmp/taigu-anonymous)" -H "Origin: https://local.taigu.tw" -o /dev/null -w "%{http_code}\n" -X POST https://local.taigu.tw/api/account/change-binding; sleep 1; done
   ```

7. 在指令執行的期間，在 Google 的畫面選擇第二個 Google 帳號並同意授權。
8. 確認畫面的狀態。
9. 確認指令印出的每一行 status code 都是 `401`。

預期：步驟 8 的畫面回到帳號綁定頁並顯示「成功綁定」，綁定的帳號顯示第二個 Google 帳號的 Email；步驟 9 的每一行都是 `401`。檢查完之後，可以照 ACCT-R11.1 的步驟 7 到 10 把綁定的 Google 帳號換回第一個 Google 帳號，在步驟 10 改選第一個 Google 帳號。

## ACCT-R13.1 登入時 Google 不接受授權結果

後端的 test 驗證了 Google 不接受授權結果時的回應，錯誤提示與網址的變化在前端，前端沒有自動化 test。

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

## ACCT-R13.2 更換綁定的 Google 帳號時 Google 不接受授權結果

後端的 test 驗證了 Google 不接受授權結果時的回應，錯誤提示與網址的變化在前端，前端沒有自動化 test。

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

## ACCT-R13.3 登入時後端連不上 Google

後端的 test 驗證了連不上 Google 時的回應，錯誤提示與網址的變化在前端，前端沒有自動化 test。

1. 如果已登入，登出。
2. 開啟 `https://local.taigu.tw/login`。
3. 點 Google 登入按鈕，停在 Google 的畫面。
4. 執行下面的指令，讓 `api-server` 的 container 連不上 Google 的 token endpoint：

   ```bash
   docker compose -f compose.dev.yaml exec api-server sh -c 'cp /etc/hosts /etc/hosts.bak && echo "127.0.0.1 oauth2.googleapis.com" >> /etc/hosts'
   ```

5. 在 Google 的畫面選擇帳號並同意授權。
6. 確認畫面的狀態。
7. 執行下面的指令，讓 `api-server` 的 container 恢復連線：

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

後端的 test 驗證了先檢查 `state`，再檢查 Google 帳號有沒有綁定，兩個分頁的畫面要在瀏覽器上確認。

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

## ACCT-R14.2 更換綁定的 Google 帳號時取消授權

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

## ACCT-R15.4 Google 沒有提供頭像

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 執行帳號的 unit test。
2. 確認新帳號登入與更換綁定的 Google 帳號在 `picture` 缺少或是空字串時都成功。
3. 用本機測試帳號登入。
4. 執行 `docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.account.models import User; User.objects.filter(email='<Email>').update(avatar_url=None)"`。
5. 重新整理設定頁。
6. 查看桌面導覽列與行動版導覽列。

預期：操作成功，顯示預設人像圖示。

## ACCT-R16.1 缺少 CSRF Token 後恢復

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用 Google 帳號登入。
2. 開啟頭像與名字頁。
3. 修改名字。
4. 只刪除 `csrftoken` cookie。
5. 點儲存按鈕。
6. 檢查 Network 面板，確認第一次修改回 403，接著 `account/csrf-token` 回 200，最後重送一次修改成功。
7. 確認只有最後一次 request 修改資料。

預期：名字成功儲存，使用者維持登入；原本失敗的 request 沒有修改資料。

## ACCT-R16.2 CSRF Token 不一致後恢復

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用 Google 帳號登入。
2. 開啟頭像與名字頁。
3. 填好名字。
4. 在 Console 執行檔案開頭用來模擬 CSRF 回應的程式。
5. 在 Console 執行下面的程式，只修改第一次 request 的 header：

```javascript
let first = true;
window.fetch = (input, options) => {
  if (first && new URL(input, location.origin).pathname === "/api/account/update") {
    first = false;
    const headers = new Headers(options.headers);
    headers.set("X-CSRFToken", "A".repeat(32));
    options = { ...options, headers };
  }
  return window.originalTaiguFetch(input, options);
};
```

6. 點儲存按鈕。
7. 檢查 Network 面板，確認前端取得新 CSRF token 後只重送一次。
8. 確認資料只修改一次。

預期：名字只修改一次，使用者維持登入。

## ACCT-R16.3 來源檢查失敗

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

後端的 Origin 與 Referer 檢查由 unit test 驗證，這裡模擬來源檢查失敗的回應。

1. 用 Google 帳號登入。
2. 開啟頭像與名字頁。
3. 填好名字。
4. 在 Console 執行檔案開頭用來模擬 CSRF 回應的程式。
5. 執行 `mockTaiguCsrf("CSRF_FAILED", 1)`，讓前端收到來源檢查失敗的回應。
6. 點儲存按鈕。
7. 確認前端沒有取得新 CSRF token，也沒有重送 request。
8. 確認輸入與登入仍保留。
9. 執行 `restoreTaiguFetch()` 恢復原本的 fetch。

預期：不自動重送，顯示失敗提示、保留輸入，資料未修改，登入未被結束。

## ACCT-R16.4 重送仍未通過 CSRF 檢查

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用 Google 帳號登入。
2. 開啟頭像與名字頁。
3. 填好名字。
4. 在 Console 執行檔案開頭用來模擬 CSRF 回應的程式。
5. 執行 `mockTaiguCsrf("CSRF_TOKEN_RECOVERABLE")`，讓修改資料的 request 每次都收到可恢復的 403 回應；前端取得 CSRF token 的 request 仍會送到後端。
6. 點儲存按鈕。
7. 確認前端總共只向修改資料的 endpoint 送出兩次 request，取得 CSRF token 的 request 只送出一次。
8. 執行 `restoreTaiguFetch()` 恢復原本的 fetch。

預期：不再重試，顯示失敗提示、保留輸入，資料未修改，登入未被結束。

## ACCT-R16.5 無法重新取得 CSRF Token

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用 Google 帳號登入。
2. 開啟頭像與名字頁。
3. 填好名字。
4. 刪除 `csrftoken` cookie。
5. 擋下 `/api/account/csrf-token` 的 request。
6. 點儲存按鈕。
7. 確認修改資料的 request 只有首次被拒絕的那一次，沒有重送。
8. 取消擋下 request。

預期：不重送原操作，顯示失敗提示並保留輸入，不把連線失敗當成登入失效。

## ACCT-R16.6 更新 Access Token 時恢復 CSRF

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用 Google 帳號登入。
2. 刪除 access token 的 cookie 與 `csrftoken` cookie，保留尚未到期的 refresh token 的 cookie。
3. 開啟歷史紀錄頁。
4. 檢查 Network 面板，確認更新 access token 的 request 先收到 403，前端取得 CSRF token 後重送成功。

預期：資料讀取成功，使用者維持登入。

## ACCT-R16.7 登出時恢復 CSRF

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用 Google 帳號登入。
2. 只刪除 `csrftoken` cookie。
3. 在設定頁登出。
4. 檢查 Network 面板，確認第一次登出回 403，前端取得 CSRF token 後重送成功。
5. 確認 refresh token 在後端已作廢。
6. 確認畫面換到登入頁。

預期：依 ACCT-R7 完成登出，refresh token 已失效。

## ACCT-R16.8 CSRF 恢復後確認登入已失效

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 依 ACCT-R5.2 的指令讓 refresh token 到期。
2. 刪除 access token 的 cookie 與 `csrftoken` cookie。
3. 開啟歷史紀錄頁。
4. 檢查 Network 面板，確認前端先取得 CSRF token，之後更新 access token 的 request 因登入失效收到 401。
5. 確認帳號資料已清除。
6. 確認畫面換到歡迎頁。

預期：依 ACCT-R5 清除資料並換到歡迎頁。

## ACCT-R16.9 CSRF Token 格式不合法或原因不明

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用 Google 帳號登入。
2. 開啟頭像與名字頁。
3. 填好名字。
4. 在 Console 執行檔案開頭用來模擬 CSRF 回應的程式。
5. 執行 `mockTaiguCsrf("CSRF_FAILED")`。
6. 點儲存按鈕。
7. 確認前端不重新取得 token、不重送 request、不登出，而且保留輸入。
8. 執行 `mockTaiguCsrf(null)`，模擬只有 HTML 的舊版 403 回應。
9. 重做步驟 6、7。
10. 執行 `restoreTaiguFetch()` 恢復原本的 fetch。

預期：不自動重送，顯示失敗提示並保留輸入，不結束登入。

## ACCT-R16.10 Google 登入時恢復 CSRF

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 在 DevTools 的 Sources 開啟 `Login.tsx`。
2. 在送出 `loginWithGoogle` 之前設定 breakpoint。
3. 用測試帳號完成 Google 授權，等程式回到 Taigu 並停在 breakpoint。
4. 在 Application 刪除 `csrftoken` cookie。
5. 繼續執行 callback。
6. 檢查第一次 `google-login` 回 403，取得 token 後重送同一份 `code` 與 `state`。
7. 確認登入成功，且第一次 request 沒有消耗 OAuth cookie。

預期：完成登入，CSRF 失敗的 request 沒有消耗這次 Google 授權。

## ACCT-R17.1 主動登出後換另一個帳號登入

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 用帳號 A 登入。
2. 準備交易紀錄、現金股利、買賣計畫、關注、筆記與手續費折讓。
3. 逐一開啟頁面，讓資料寫入離線 cache。
4. 從搜尋結果點選一檔股票。
5. 在第二個分頁開啟同一帳號。
6. 在第二個分頁啟動資料讀取，保留延遲中的 request。
7. 在第一個分頁登出。
8. 確認 IndexedDB 的 `tradeRecords` 與 `metadata`、API cache、最近點選過的股票與舊返回網址都已清除，其他分頁也停止使用舊資料。
9. 確認 Local Storage 已移除 `accountSessionCleanupPending`。
10. 從登入頁登入帳號 B。
11. 切成離線。
12. 確認看不到 A 的資料，延遲中的 A 回應也沒有寫回帳號 B 讀取的 cache key。
13. 重新準備上述資料與兩個分頁，以檢查清除尚未完成時的協調。
14. 在 DevTools 的 Sources 開啟 `api.ts`。
15. 在 `clearLocalAccountData` 中設定 breakpoint。
16. 在第一個分頁登出。
17. 等程式停在清除流程的 breakpoint。
18. 讓第二個分頁完成重新載入並開始讀取 `me`。
19. 確認第二個分頁等待同一輪清除，不再次改變 `accountSessionVersion`，也不使第一個分頁重新載入。
20. 繼續執行第一個分頁的清除流程。
21. 確認兩個分頁都完成清除。
22. 在受舊 service worker 控制的分頁重做上述檢查。
23. 確認前端要求重新整理，在新 worker 確認資料隔離與清除完成之前不能繼續讀寫。
24. 確認新版 service worker 使用 `api-cache-v2`，沒有讀取舊 service worker 延遲寫入 `api-cache` 的資料。

預期：前端在登入帳號 B 前已清除帳號 A 的上述資料；使用者登入帳號 B 後看不到帳號 A 的離線資料與最近點選過的股票，前端也不使用帳號 A 的舊返回網址。

## ACCT-R17.2 登入失效後換另一個帳號登入

前端沒有自動化 test，需要確認瀏覽器、頁面與儲存資料的實際結果。

1. 依 ACCT-R17.1 準備帳號 A 的離線資料、最近點選過的股票與兩個開著的分頁。
2. 依 ACCT-R5.2 的指令讓登入到期。
3. 刪除 access token 的 cookie。
4. 開啟 `https://local.taigu.tw/records?sid=2330`。
5. 確認舊資料清除，原分頁只留下這次 `/records?sid=2330` 的返回紀錄。
6. 在原分頁於 30 分鐘內登入帳號 B。
7. 切成離線。
8. 確認看不到帳號 A 的資料，延遲回應也沒有把資料寫回。

預期：前端在登入帳號 B 前已清除帳號 A 的上述資料；使用者登入帳號 B 後看不到帳號 A 的離線資料與最近點選過的股票，畫面依 ACCT-R3 返回這次開啟的 `/records?sid=2330`。
