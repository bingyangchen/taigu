執行 `make start`，用 Chrome 開啟 `https://local.taigu.tw`，再用 Google 帳號登入。

前端依可用畫面的大小切換版面，不看 user agent，可用畫面改變時版面立刻跟著換，不用重新整理頁面。步驟寫「以窄版」或「在行動裝置上」時，開啟 Chrome DevTools 的 device toolbar（Toggle device toolbar），在 Dimensions 選「Responsive」並輸入 390 × 844，或選 iPhone 14 Pro 這類手機；步驟寫「以寬版」或「在桌面瀏覽器上」時，關閉 device toolbar，把視窗調整到可用畫面是 1280 × 800，可以在 Console 執行 `[innerWidth, innerHeight]` 確認大小。

要查看後端儲存的問題回報時，在 repo 的根目錄執行下面的指令。指令會在 `count:` 那一行印出問題回報的總數，在 `latest:` 那一行印出最新一則問題回報的字數、內容的前 100 個字、送出的使用者的 email、送出的時間、平台與 User-Agent：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.issue_report.models import IssueReport; r = IssueReport.objects.order_by('-id').first(); print('count:', IssueReport.objects.count()); r and print('latest:', len(r.body), repr(r.body[:100]), r.user.email, r.created_at, r.platform, repr(r.user_agent))"
```

## ISSUE-R1.1 從設定頁開啟問題回報

以窄版與寬版開啟問題回報時出現的畫面，要在真實瀏覽器裡確認，前端沒有自動化 test。

1. 以窄版開啟 `https://local.taigu.tw/settings`。
2. 點選「關於」區塊的「問題回報」。
3. 確認網址變成 `/settings/issue-report`，問題回報頁有一個空白的文字框。
4. 以寬版開啟 `https://local.taigu.tw/settings`。
5. 點選「關於」區塊的「問題回報」。

預期：步驟 3 的確認成立；步驟 5 之後，網址列顯示 `/settings##`（路徑仍是 `/settings`，`##` 是視窗開啟時加上的 hash），畫面出現問題回報的視窗，裡面有一個空白的文字框。

## ISSUE-R2.1 內容只有空白

前端沒有自動化 test。後端拒絕直接送來的空白內容這部分由 unit test 驗證，這裡只檢查編輯器。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
3. 點選「問題回報」。
4. 在文字框輸入 2 個空白。
5. 點選送出按鈕。
6. 執行查看問題回報的指令。

預期：送出按鈕呈灰色，點了沒有反應，視窗維持開啟；步驟 6 的 `count:` 與步驟 1 的數字相同。

## ISSUE-R2.2 內容超過 5,000 個字

前端沒有自動化 test，後端也沒有驗證超過 5,000 個字的 test。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
3. 開啟 Chrome DevTools 的 Console。
4. 在 Console 執行 `copy("測".repeat(5001))`，把 5,001 個「測」複製到剪貼簿。
5. 點選「問題回報」。
6. 在文字框貼上剪貼簿的內容。
7. 點選送出按鈕。
8. 確認送出按鈕呈灰色，點了沒有反應，視窗維持開啟。
9. 在 Console 執行下面的程式碼。

   ```js
   fetch("/api/issue-reports", {
     method: "POST",
     credentials: "include",
     headers: {
       "Content-Type": "application/json",
       "X-CSRFToken": document.cookie.match(/csrftoken=([^;]+)/)[1],
     },
     body: JSON.stringify({ body: "測".repeat(5001) }),
   }).then((response) => console.log(response.status));
   ```

10. 執行查看問題回報的指令。

預期：步驟 8 的確認成立；步驟 9 的 Console 印出 `400`，代表後端拒絕了這則問題回報；步驟 10 的 `count:` 與步驟 1 的數字相同。

## ISSUE-R2.3 內容剛好 5,000 個字

前端沒有自動化 test，後端也沒有驗證剛好 5,000 個字的 test。

1. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
2. 開啟 Chrome DevTools 的 Console。
3. 在 Console 執行 `copy("   " + "測".repeat(5000) + "   ")`，把前後各有 3 個空白的 5,000 個「測」複製到剪貼簿。
4. 點選「問題回報」。
5. 在文字框貼上剪貼簿的內容。
6. 點選送出按鈕。
7. 執行查看問題回報的指令。

預期：步驟 6 之後畫面出現送出成功的提示；步驟 7 的 `latest:` 那一行顯示字數 `5000`，內容以「測」開頭，前面沒有空白。

## ISSUE-R3.1 送出一則問題回報

後端儲存的內容、使用者、時間、平台與 User-Agent 由 unit test 驗證，前端沒有自動化 test，所以這裡檢查畫面、前端送出的平台，以及 request 經過 Nginx 之後後端讀到的 User-Agent。

1. 在行動裝置上開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入「點擊 Google 登入後畫面一直轉圈。」。
4. 點選頁首的送出按鈕。
5. 確認畫面回到設定頁 `/settings`，並出現提示「問題回報已送出，感謝你的回饋。」。
6. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
7. 點選「問題回報」。
8. 在文字框輸入「點擊 Google 登入後畫面一直轉圈。」。
9. 點選視窗裡的送出按鈕。
10. 開啟 Chrome DevTools 的 Console，執行 `navigator.userAgent`。
11. 執行查看問題回報的指令。

預期：步驟 5 的確認成立；步驟 9 之後，視窗關閉，畫面留在設定頁 `/settings`，並出現提示「問題回報已送出，感謝你的回饋。」；步驟 11 的 `latest:` 那一行的平台是 `web`，User-Agent 跟步驟 10 印出的相同。

## ISSUE-R3.2 內容的頭尾有空白與換行

後端沒有驗證去掉頭尾空白的 test，前端也沒有自動化 test。

1. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入 2 個空白。
4. 輸入「第一行」。
5. 按 1 次 Enter。
6. 輸入「第二行」。
7. 按 2 次 Enter。
8. 點選送出按鈕。
9. 執行查看問題回報的指令。

預期：`latest:` 那一行印出的字數是 `7`，內容是 `'第一行\n第二行'`。

## ISSUE-R3.3 在 PWA 送出問題回報

後端記下的平台與 User-Agent 由 unit test 驗證，前端沒有自動化 test。本機的開發環境沒辦法從手機開啟，所以用桌面 Chrome 安裝的 PWA 檢查。

1. 如果還沒把 Taigu 安裝成 app，在 Chrome 開啟 `https://local.taigu.tw`，再從 Chrome 選單的「投放、儲存及分享」選擇安裝的選項。
2. 從 macOS 的 Dock 或「應用程式」資料夾開啟安裝成 app 的 Taigu。
3. 點側邊欄的頭像，進入設定頁。
4. 點選「問題回報」。
5. 在文字框輸入「匯出的檔案打不開。」。
6. 點選視窗裡的送出按鈕。
7. 在 PWA 的視窗按 Cmd+Option+I 開啟 DevTools，在 Console 執行 `navigator.userAgent`。
8. 執行查看問題回報的指令。

預期：步驟 6 之後出現提示「問題回報已送出，感謝你的回饋。」；步驟 8 的 `latest:` 那一行的內容是 `'匯出的檔案打不開。'`，平台是 `pwa`，User-Agent 跟步驟 7 印出的相同。

## ISSUE-R4.1 連不上後端時送出

前端沒有自動化 test。

錯誤提示出現 5 秒後就會自動消失，所以步驟 7 與步驟 8 要連續、盡快做完。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
3. 點選「問題回報」。
4. 在文字框輸入「測試網路中斷」。
5. 開啟 Chrome DevTools 的 Network 分頁。
6. 把 throttling 設成「Offline」。
7. 點選送出按鈕。
8. 在步驟 7 之後 5 秒內，確認畫面左下角的錯誤提示、視窗與文字框的狀態。
9. 把 throttling 改回「No throttling」。
10. 執行查看問題回報的指令。

預期：步驟 8 的畫面出現錯誤提示，視窗沒有關閉，文字框的內容仍是「測試網路中斷」，送出按鈕可以再點選；步驟 10 的 `count:` 與步驟 1 的數字相同。

## ISSUE-R5.1 文字框只有空白與換行時返回

前端沒有自動化 test。

1. 以窄版開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入 2 個空白。
4. 按 1 次 Enter。
5. 點選頁首的返回按鈕。

預期：畫面直接回到設定頁 `/settings`，沒有出現確認視窗。

## ISSUE-R5.2 文字框有內容時返回

前端沒有自動化 test。

1. 以窄版開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入「畫面一直轉圈」。
4. 點選頁首的返回按鈕。

預期：畫面仍在問題回報頁，並出現確認視窗，標題是「捨棄變更？」，說明是「離開後，尚未送出的內容不會被儲存。」，下方有「繼續編輯」與「捨棄變更」兩個按鈕。

## ISSUE-R5.3 在確認視窗選擇繼續編輯

前端沒有自動化 test。

1. 以窄版開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入「畫面一直轉圈」。
4. 點選頁首的返回按鈕。
5. 點選確認視窗的「繼續編輯」。

預期：確認視窗關閉，畫面留在問題回報頁 `/settings/issue-report`，文字框的內容仍是「畫面一直轉圈」。

## ISSUE-R5.4 在確認視窗選擇捨棄變更

前端沒有自動化 test。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 以窄版開啟 `https://local.taigu.tw/settings`。
3. 點選「問題回報」。
4. 在文字框輸入「畫面一直轉圈」。
5. 點選頁首的返回按鈕。
6. 點選確認視窗的「捨棄變更」。
7. 執行查看問題回報的指令。

預期：步驟 6 之後畫面回到設定頁 `/settings`；步驟 7 的 `count:` 與步驟 1 的數字相同。

## ISSUE-R6.1 文字框沒有內容時關閉視窗

前端沒有自動化 test。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 以寬版開啟 `https://local.taigu.tw/settings`。
3. 點選「問題回報」。
4. 在文字框輸入 2 個空白。
5. 按 1 次 Enter。
6. 點選視窗裡的取消按鈕。
7. 確認視窗關閉，畫面留在設定頁 `/settings`。
8. 點選「問題回報」。
9. 在文字框輸入 2 個空白。
10. 按 1 次 Enter。
11. 按 Esc。
12. 執行查看問題回報的指令。

預期：步驟 7 的確認成立；步驟 11 之後視窗關閉，畫面留在設定頁 `/settings`；步驟 12 的 `count:` 與步驟 1 的數字相同。

## ISSUE-R6.2 文字框有內容時按 Esc

按 Esc 先顯示確認視窗由 unit test 驗證；真實瀏覽器裡的 Esc 與取消按鈕要人工確認。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 以寬版開啟 `https://local.taigu.tw/settings`。
3. 點選「問題回報」。
4. 在文字框輸入「畫面一直轉圈」。
5. 按 Esc。
6. 點選確認視窗的「繼續編輯」。
7. 點選視窗裡的取消按鈕。
8. 點選確認視窗的「捨棄變更」。
9. 執行查看問題回報的指令。

預期：

- 步驟 5 與步驟 7 之後都出現標題是「捨棄變更？」的確認視窗。
- 步驟 6 之後，確認視窗關閉，問題回報的視窗仍然開著，文字框的內容仍是「畫面一直轉圈」。
- 步驟 8 之後問題回報的視窗關閉，畫面留在設定頁 `/settings`；步驟 9 的 `count:` 與步驟 1 的數字相同。

## ISSUE-R6.3 文字框有內容時按瀏覽器的上一頁

按上一頁先顯示確認視窗由 unit test 驗證；瀏覽器的上一頁會改變實際的瀏覽紀錄，而 jsdom 沒有實際的瀏覽紀錄，所以要在真實瀏覽器裡確認。

1. 以寬版開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入「畫面一直轉圈」。
4. 按瀏覽器的上一頁。
5. 點選確認視窗的「繼續編輯」。
6. 按瀏覽器的上一頁。
7. 點選確認視窗的「繼續編輯」。

預期：步驟 4 與步驟 6 之後都出現標題是「捨棄變更？」的確認視窗；步驟 5 與步驟 7 之後，確認視窗關閉，問題回報的視窗仍然開著，文字框的內容仍是「畫面一直轉圈」，網址的路徑仍是 `/settings`。
