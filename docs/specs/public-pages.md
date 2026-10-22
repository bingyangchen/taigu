---
prefix: PUB
---

# 公開頁面

公開頁面是不用登入就能看、也開放搜尋引擎收錄的三個頁面：歡迎頁 `/welcome` 向還沒使用 Taigu 的訪客介紹功能與方案，隱私權政策 `/privacy-policy` 與服務條款 `/terms-of-service`（本文件合稱法律頁面）寫出 Taigu 的法律條文。本文件也規定網址不存在時顯示的 404 頁面，以及 Taigu 的每個網址在搜尋引擎與社群平台上怎麼呈現。本文件說的「需要登入的頁面」指公開頁面、登入頁 `/login` 與 404 頁面以外的所有頁面，未登入的訪客開啟需要登入的頁面時會被導去哪裡，規則見 [account.md](account.md)。

## 需求

### PUB-R1 從歡迎頁進入登入頁

歡迎頁不需要登入就能開啟，而且在瀏覽器沒有提供安裝 Taigu 的選項時，頁首的「登入」、主標題下與頁面最後的「開始免費使用」，以及 Standard 與 Free 兩張方案卡片上的按鈕，都帶訪客到登入頁，登入與第一次登入時建立帳號的規則見 [account.md](account.md)。

- PUB-R1.1 未登入時從歡迎頁進入登入頁
  - 前提：訪客沒有登入，使用的瀏覽器沒有提供安裝 Taigu 的選項（例如 Firefox），畫面在歡迎頁，網址維持 `/welcome`。
  - 動作：點頁首的「登入」。
  - 結果：網址換成 `/login`，畫面顯示登入頁。

### PUB-R2 歡迎頁的方案介紹

歡迎頁的方案區塊寫出 Standard 的價格（每月 NT$65、每年 NT$700）、Free 的價格（NT$0）、Free 的四種額度（交易紀錄與現金股利合計 20 筆、買賣計畫 10 筆、持股 10 檔、自選股 10 檔）與兩種方案的行情更新頻率（Standard 約每 30 秒、Free 約每 10 分鐘），這些數字跟 [billing.md](billing.md) 與 [market-data.md](market-data.md) 的規則一致。

- PUB-R2.1 查看方案區塊
  - 前提：訪客開啟歡迎頁。
  - 動作：捲到方案區塊。
  - 結果：Standard 方案卡片寫著「NT$65」「/月」與「或 NT$700 / 年」，並列出「股價約每 30 秒更新」；Free 方案卡片寫著「NT$0」，並列出「交易紀錄 + 現金股利：20 筆」「買賣計畫：10 筆」「持股：10 檔」「關注：10 檔」「股價約每 10 分鐘更新」。

### PUB-R3 歡迎頁頁尾的法律頁面連結

歡迎頁的頁尾有隱私權政策與服務條款的連結，在桌面瀏覽器上，這兩個連結開啟新的瀏覽器分頁，在行動裝置上則在同一個瀏覽器分頁開啟。

- PUB-R3.1 在桌面瀏覽器上點「隱私權政策」
  - 前提：訪客在桌面瀏覽器上開啟歡迎頁。
  - 動作：點頁尾的「隱私權政策」。
  - 結果：瀏覽器開啟一個新的瀏覽器分頁顯示 `/privacy-policy`，原本的瀏覽器分頁仍停在歡迎頁。
- PUB-R3.2 在行動裝置上點「服務條款」
  - 前提：訪客在行動裝置上開啟歡迎頁。
  - 動作：點頁尾的「服務條款」。
  - 結果：同一個瀏覽器分頁的網址換成 `/terms-of-service`，畫面顯示服務條款，沒有開啟新的瀏覽器分頁。

> 設計理由：頁尾不放 GitHub repo 與 issue tracker 的連結，因為 Taigu 已經不公開程式碼，repo 改成 private，訪客點過去也無法使用。

### PUB-R4 法律頁面

隱私權政策與服務條款不需要登入就能開啟，頁面顯示標題與全部的條文。

- PUB-R4.1 未登入時開啟隱私權政策
  - 前提：訪客沒有登入。
  - 動作：開啟 `/privacy-policy`。
  - 結果：網址維持 `/privacy-policy`，畫面顯示標題「隱私權政策」，下方是第一節「適用範圍」的條文。

### PUB-R5 404 頁面

網址的路徑不符合 Taigu 任何頁面的網址格式時（例如 `/abc`、`/records/abc`），不論有沒有登入，Taigu 都在原本的網址顯示 404 頁面，頁面上只有「404」標籤、標題「找不到頁面」、說明「這個網址可能已失效或不存在。請返回首頁，重新查看投資總覽與台股紀錄。」與連到首頁 `/` 的「返回首頁」按鈕。

- PUB-R5.1 未登入時開啟不存在的網址
  - 前提：訪客沒有登入。
  - 動作：開啟 `/abc`。
  - 結果：網址維持 `/abc`，畫面顯示「404」標籤、標題「找不到頁面」、說明「這個網址可能已失效或不存在。請返回首頁，重新查看投資總覽與台股紀錄。」與「返回首頁」按鈕，沒有側邊欄，也沒有底部的導覽列。
- PUB-R5.2 在既有頁面底下不存在的網址點「返回首頁」
  - 前提：使用者已經登入，開啟 `/records/abc` 後，畫面顯示 404 頁面，網址維持 `/records/abc`。
  - 動作：點「返回首頁」。
  - 結果：網址換成 `/`，畫面顯示儀表板。

### PUB-R6 頁面標題與搜尋引擎收錄

每個頁面載入後，瀏覽器分頁上的頁面標題、是否開放搜尋引擎收錄與 canonical 網址依下表決定，開放收錄的頁面另外宣告頁面說明（meta description），不開放收錄的頁面則要求搜尋引擎不要收錄（`noindex`），也不宣告頁面說明，使用者在 Taigu 裡換到其他頁面時，這些設定跟著換成新頁面的版本。

| 頁面 | 頁面標題 | 搜尋引擎收錄 | Canonical 網址 |
| --- | --- | --- | --- |
| 歡迎頁 | 以「Taigu \| 台股記帳」開頭的歡迎頁標題 | 開放收錄 | `https://taigu.tw/welcome` |
| 隱私權政策 | 隱私權政策 \| Taigu | 開放收錄 | `https://taigu.tw/privacy-policy` |
| 服務條款 | 服務條款 \| Taigu | 開放收錄 | `https://taigu.tw/terms-of-service` |
| 登入頁 | 登入 \| Taigu | 不開放收錄 | 無 |
| 設定頁與 `/settings/` 底下的頁面 | 這些頁面共用一個以「 \| Taigu」結尾的設定頁標題 | 不開放收錄 | 無 |
| 其他需要登入的頁面，例如儀表板 `/` 與歷史紀錄頁 `/records` | Taigu \| 台股記帳 | 不開放收錄 | 無 |
| 404 頁面 | 找不到頁面 \| Taigu | 不開放收錄 | 無 |

- PUB-R6.1 開啟隱私權政策
  - 前提：無。
  - 動作：開啟 `/privacy-policy`。
  - 結果：頁面標題是「隱私權政策 | Taigu」，頁面沒有 `robots` meta tag，canonical 網址是 `https://taigu.tw/privacy-policy`，頁面有頁面說明。
- PUB-R6.2 從歡迎頁換到登入頁
  - 前提：訪客沒有登入，使用的瀏覽器沒有提供安裝 Taigu 的選項，畫面在歡迎頁，頁面標題是歡迎頁的標題，canonical 網址是 `https://taigu.tw/welcome`。
  - 動作：點頁首的「登入」。
  - 結果：頁面標題換成「登入 | Taigu」，`robots` meta tag 是 `noindex`，頁面沒有 canonical 網址，也沒有頁面說明。

> 設計理由：不開放收錄的頁面也不宣告 canonical 網址，因為 `noindex` 與 canonical 網址同時出現時，搜尋引擎收到的是互相矛盾的訊號。

### PUB-R7 執行 JavaScript 之前的內容

公開頁面的網址直接回傳已經包含整頁內容的 HTML，HTML 裡的頁面標題、頁面說明、canonical 網址與分享預覽的標題、說明、網址都是該頁的版本，其他網址則回傳同一份 HTML，這些值都是歡迎頁的版本，頁面上的文字只有「Taigu 需要啟用 JavaScript 才能運作，請在瀏覽器設定中開啟。」。

- PUB-R7.1 不執行 JavaScript 抓取服務條款
  - 前提：無。
  - 動作：用不執行 JavaScript 的 client 抓取 `https://taigu.tw/terms-of-service`。
  - 結果：回傳的 HTML 含有「服務中斷或終止」一節的標題與條文「本網站可能因系統維護、升級或其他原因而暫時中斷服務」，頁面標題與分享預覽的標題都是「服務條款 | Taigu」，canonical 網址與分享預覽的網址都是 `https://taigu.tw/terms-of-service`，沒有 `robots` meta tag。
- PUB-R7.2 不執行 JavaScript 抓取首頁
  - 前提：無。
  - 動作：用不執行 JavaScript 的 client 抓取首頁 `/`。
  - 結果：回傳的 HTML 的頁面標題與分享預覽的標題都是歡迎頁的標題（以「Taigu | 台股記帳」開頭），canonical 網址與分享預覽的網址都是 `https://taigu.tw/welcome`，頁面上的文字只有「Taigu 需要啟用 JavaScript 才能運作，請在瀏覽器設定中開啟。」。

> 設計理由：公開頁面的網址直接回傳整頁內容，因為 LINE、Facebook 抓取分享預覽的爬蟲與部分搜尋引擎不執行 JavaScript，所以網址如果只回傳空白的 HTML、再由 JavaScript 產生內容，這些爬蟲讀到的每個網址都是空白的頁面。

### PUB-R8 分享預覽的圖片與結構化資料

每個網址回傳的 HTML 都讓分享預覽使用同一張封面圖 `https://taigu.tw/cover.jpg`（1200×900 像素），網站名稱是 Taigu，並帶有兩段 schema.org 的結構化資料：`WebApplication` 列出 Free（價格 0）與 Standard（價格 65）兩個方案，幣別都是 TWD，`Organization` 列出名稱 Taigu、標誌 `https://taigu.tw/logo-l.png` 與聯絡信箱 `taigu.tw@gmail.com`。

- PUB-R8.1 查看首頁的分享資訊與結構化資料
  - 前提：無。
  - 動作：用不執行 JavaScript 的 client 抓取首頁 `/`。
  - 結果：回傳的 HTML 的 `og:image` 是 `https://taigu.tw/cover.jpg`，`og:image:width` 是 1200，`og:image:height` 是 900，`og:site_name` 是 Taigu；`@type` 是 `WebApplication` 的結構化資料在 `offers` 列出 `name` 是 Free、`price` 是 0 與 `name` 是 Standard、`price` 是 65 的兩個方案，`priceCurrency` 都是 TWD；`@type` 是 `Organization` 的結構化資料的 `name` 是 Taigu，`logo` 是 `https://taigu.tw/logo-l.png`，`email` 是 `taigu.tw@gmail.com`。

> 設計理由：每個方案都寫出幣別 TWD，因為 Google 要求價格與幣別一起出現，少了幣別，整段結構化資料對 Google 的複合式搜尋結果（rich results）都無效。

### PUB-R9 robots.txt 擋下的路徑

`robots.txt` 允許搜尋引擎抓取 Taigu 的網址，但擋下 `/login`、`/settings`、`/records`、`/plans`、`/market`、`/market-index`、`/search`、`/earning-analysis`、`/handling-fee` 這幾個路徑與路徑底下的網址，並寫出 sitemap 的位址 `https://taigu.tw/sitemap.xml`。

- PUB-R9.1 查看 robots.txt
  - 前提：無。
  - 動作：開啟 `/robots.txt`。
  - 結果：檔案寫著 `User-agent: *`、`Allow: /`，接著是 `/login`、`/settings`、`/records`、`/plans`、`/market`、`/market-index`、`/search`、`/earning-analysis`、`/handling-fee` 各一行 `Disallow`，最後一行是 `Sitemap: https://taigu.tw/sitemap.xml`。

> 設計理由：`robots.txt` 擋下登入頁與上面這幾個需要登入的頁面所在的路徑，因為爬蟲抓這些網址只會拿到沒有內容的畫面，或是被導去歡迎頁，搜尋引擎會把這些網址判斷成 soft 404，也會用掉搜尋引擎分配給 Taigu 的抓取次數。

### PUB-R10 Sitemap 列出的網址

Sitemap 只列出三個公開頁面的網址：`https://taigu.tw/welcome`、`https://taigu.tw/privacy-policy` 與 `https://taigu.tw/terms-of-service`。

- PUB-R10.1 查看 sitemap
  - 前提：無。
  - 動作：開啟 `/sitemap.xml`。
  - 結果：檔案有三個 `<loc>`，依序是 `https://taigu.tw/welcome`、`https://taigu.tw/privacy-policy` 與 `https://taigu.tw/terms-of-service`。

> 設計理由：首頁 `/` 不列在 sitemap，因為首頁在執行 JavaScript 之前宣告的 canonical 網址是歡迎頁，把首頁列進 sitemap 會跟這個 canonical 網址互相矛盾。
