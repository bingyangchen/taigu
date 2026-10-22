執行 `make start`，用 Chrome 開啟 `https://local.taigu.tw`，再用 Google 帳號登入。步驟寫「在行動裝置上」時，先開啟 Chrome DevTools 的裝置模擬（Toggle device toolbar），選一款手機機型（例如 iPhone 14 Pro），再重新整理頁面；步驟寫「在桌面瀏覽器上」時，先關閉裝置模擬，再重新整理頁面。

要查看 Taigu 儲存的問題回報時，在 repo 的根目錄執行下面的指令。指令會在 `count:` 那一行印出問題回報的總數，在 `latest:` 那一行印出最新一則問題回報的字數、內容的前 100 個字、送出的使用者的 email 與送出的時間：

```sh
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "from main.issue_report.models import IssueReport; r = IssueReport.objects.order_by('-id').first(); print('count:', IssueReport.objects.count()); r and print('latest:', len(r.body), repr(r.body[:100]), r.user.email, r.created_at)"
```

## ISSUE-R1.1 從設定頁開啟問題回報

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/settings`。
2. 點選「關於」區塊的「問題回報」。
3. 確認網址變成 `/settings/issue-report`，問題回報頁有一個空白的文字框。
4. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
5. 點選「關於」區塊的「問題回報」。

預期：步驟 3 的確認成立；步驟 5 之後，網址列顯示 `/settings##`（路徑仍是 `/settings`，`##` 是視窗開啟時加上的 hash），畫面出現問題回報的視窗，裡面有一個空白的文字框。

## ISSUE-R2.1 內容只有空白

前端沒有自動化 test。Taigu 拒絕直接送來的空白內容這部分由 unit test 驗證，這裡只檢查編輯器。

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

預期：步驟 8 的確認成立；步驟 9 的 Console 印出 `400`，代表 Taigu 拒絕了這則問題回報；步驟 10 的 `count:` 與步驟 1 的數字相同。

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

Taigu 儲存的內容、使用者與時間由 unit test 驗證，這裡只檢查畫面，因為前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入「點擊 Google 登入後畫面一直轉圈。」。
4. 點選頁首的送出按鈕。
5. 確認畫面回到設定頁 `/settings`，並出現提示「問題回報已送出，感謝你的回饋。」。
6. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
7. 點選「問題回報」。
8. 在文字框輸入「點擊 Google 登入後畫面一直轉圈。」。
9. 點選視窗裡的送出按鈕。

預期：步驟 5 的確認成立；步驟 9 之後，視窗關閉，畫面留在設定頁 `/settings`，並出現提示「問題回報已送出，感謝你的回饋。」。

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

## ISSUE-R4.1 網路中斷時送出

前端沒有自動化 test。

錯誤提示出現 5 秒後就會自動消失，所以步驟 7 到步驟 9 要連續、盡快做完。本機的開發環境在送出失敗時，還會蓋上一層全螢幕的錯誤畫面「Uncaught runtime errors」，因為送出失敗的 exception 會往上拋；這個錯誤畫面只在開發環境出現，不是這個情境要檢查的結果。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
3. 點選「問題回報」。
4. 在文字框輸入「測試網路中斷」。
5. 開啟 Chrome DevTools 的 Network 分頁。
6. 把 throttling 設成「Offline」。
7. 點選送出按鈕。
8. 如果畫面出現全螢幕的錯誤畫面「Uncaught runtime errors」，點選這個錯誤畫面右上角的 × 關閉它。
9. 在步驟 7 之後 5 秒內，確認畫面左下角的錯誤提示、視窗與文字框的狀態。
10. 把 throttling 改回「No throttling」。
11. 執行查看問題回報的指令。

預期：步驟 9 的畫面出現錯誤提示，視窗沒有關閉，文字框的內容仍是「測試網路中斷」，送出按鈕可以再點選；步驟 11 的 `count:` 與步驟 1 的數字相同。

## ISSUE-R5.1 文字框只有空白與換行時返回

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入 2 個空白。
4. 按 1 次 Enter。
5. 點選頁首的返回按鈕。

預期：畫面直接回到設定頁 `/settings`，沒有出現確認視窗。

## ISSUE-R5.2 文字框有內容時返回

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入「畫面一直轉圈」。
4. 點選頁首的返回按鈕。

預期：畫面仍在問題回報頁，並出現確認視窗，標題是「捨棄變更？」，說明是「離開後，尚未送出的內容不會被儲存。」，下方有「繼續編輯」與「捨棄變更」兩個按鈕。

## ISSUE-R5.3 在確認視窗選擇繼續編輯

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/settings`。
2. 點選「問題回報」。
3. 在文字框輸入「畫面一直轉圈」。
4. 點選頁首的返回按鈕。
5. 點選確認視窗的「繼續編輯」。

預期：確認視窗關閉，畫面留在問題回報頁 `/settings/issue-report`，文字框的內容仍是「畫面一直轉圈」。

## ISSUE-R5.4 在確認視窗選擇捨棄變更

前端沒有自動化 test。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 在行動裝置上開啟 `https://local.taigu.tw/settings`。
3. 點選「問題回報」。
4. 在文字框輸入「畫面一直轉圈」。
5. 點選頁首的返回按鈕。
6. 點選確認視窗的「捨棄變更」。
7. 執行查看問題回報的指令。

預期：步驟 6 之後畫面回到設定頁 `/settings`；步驟 7 的 `count:` 與步驟 1 的數字相同。

## ISSUE-R6.1 文字框沒有內容時關閉視窗

前端沒有自動化 test。

1. 執行查看問題回報的指令，記下 `count:` 的數字。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/settings`。
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
