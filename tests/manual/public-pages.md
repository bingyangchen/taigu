執行 `make start`，等所有 container 都啟動。步驟寫「用未登入的桌面瀏覽器」時，開啟一個 Firefox 的隱私視窗，因為 Firefox 不提供安裝 Taigu 的選項；步驟寫「用已登入的桌面瀏覽器」時，用 Chrome 開啟 `https://local.taigu.tw/login`，再用 Google 帳號登入；步驟寫「用行動裝置」時，開啟一個 Chrome 的無痕式視窗，開啟 DevTools 的裝置模擬（Toggle device toolbar），選一款手機機型（例如 iPhone 14 Pro），再重新整理頁面。

要查看頁面的標題、`robots` meta tag、canonical 網址與頁面說明時，在 DevTools 的 Console 執行下面的指令，指令會依序印出這四個值，頁面沒有某個值時印出 `undefined`：

```js
[document.title, document.querySelector('meta[name="robots"]')?.content, document.querySelector('link[rel="canonical"]')?.href, document.querySelector('meta[name="description"]')?.content]
```

## PUB-R1.1 未登入時從歡迎頁進入登入頁

前端沒有自動化 test。

1. 用未登入的桌面瀏覽器開啟 `https://local.taigu.tw/welcome`。
2. 確認網址維持 `/welcome`。
3. 點選頁首的「登入」。

預期：網址換成 `/login`，畫面顯示登入頁。

## PUB-R2.1 查看方案區塊

前端沒有自動化 test。

1. 用未登入的桌面瀏覽器開啟 `https://local.taigu.tw/welcome`。
2. 捲到方案區塊。

預期：Standard 方案卡片寫著「NT$65」「/月」與「或 NT$700 / 年」，並列出「股價約每 30 秒更新」；Free 方案卡片寫著「NT$0」，並列出「交易紀錄 + 現金股利：20 筆」「買賣計畫：10 筆」「持股：10 檔」「關注：10 檔」「股價約每 10 分鐘更新」。

## PUB-R3.1 在桌面瀏覽器上點「隱私權政策」

前端沒有自動化 test。

1. 用未登入的桌面瀏覽器開啟 `https://local.taigu.tw/welcome`。
2. 捲到頁尾。
3. 點選頁尾的「隱私權政策」。

預期：瀏覽器開啟一個新的瀏覽器分頁顯示 `/privacy-policy`，原本的瀏覽器分頁仍停在歡迎頁。

## PUB-R3.2 在行動裝置上點「服務條款」

前端沒有自動化 test。

1. 用行動裝置開啟 `https://local.taigu.tw/welcome`。
2. 捲到頁尾。
3. 點選頁尾的「服務條款」。

預期：同一個瀏覽器分頁的網址換成 `/terms-of-service`，畫面顯示服務條款，沒有開啟新的瀏覽器分頁。

## PUB-R4.1 未登入時開啟隱私權政策

前端沒有自動化 test。

1. 用未登入的桌面瀏覽器開啟 `https://local.taigu.tw/privacy-policy`。

預期：網址維持 `/privacy-policy`，畫面顯示標題「隱私權政策」，下方是第一節「適用範圍」的條文。

## PUB-R5.1 未登入時開啟不存在的網址

前端沒有自動化 test。

1. 用未登入的桌面瀏覽器開啟 `https://local.taigu.tw/abc`。

預期：網址維持 `/abc`，畫面顯示「404」標籤、標題「找不到頁面」、說明「這個網址可能已失效或不存在。請返回首頁，重新查看投資總覽與台股紀錄。」與「返回首頁」按鈕，沒有側邊欄，也沒有底部的導覽列。

## PUB-R5.2 在既有頁面底下不存在的網址點「返回首頁」

前端沒有自動化 test。

1. 用已登入的桌面瀏覽器開啟 `https://local.taigu.tw/records/abc`。
2. 確認網址維持 `/records/abc`，畫面顯示 404 頁面。
3. 點選「返回首頁」。

預期：網址換成 `/`，畫面顯示儀表板。

## PUB-R6.1 開啟隱私權政策

前端沒有自動化 test。

1. 用未登入的桌面瀏覽器開啟 `https://local.taigu.tw/privacy-policy`。
2. 在 DevTools 的 Console 執行檔案開頭的指令。

預期：印出的四個值依序是「隱私權政策 | Taigu」、`undefined`、`https://taigu.tw/privacy-policy`，以及一段不是 `undefined` 的頁面說明。

## PUB-R6.2 從歡迎頁換到登入頁

前端沒有自動化 test。

1. 用未登入的桌面瀏覽器開啟 `https://local.taigu.tw/welcome`。
2. 在 DevTools 的 Console 執行檔案開頭的指令。
3. 點選頁首的「登入」。
4. 在 DevTools 的 Console 再執行一次檔案開頭的指令。

預期：步驟 2 印出的頁面標題是「Taigu | 台股記帳 | 專業投資組合管理，精準損益計算與績效追蹤」，canonical 網址是 `https://taigu.tw/welcome`；步驟 4 印出的四個值依序是「登入 | Taigu」、`noindex`、`undefined`、`undefined`。

## PUB-R7.1 不執行 JavaScript 抓取服務條款

前端沒有自動化 test，而且本機的 dev server 對每個網址都回傳同一份 HTML，只有部署後的網站會讓公開頁面直接回傳整頁內容，所以這項檢查對 prod 執行，要等 `main` 部署之後再執行。

1. 執行 `curl -s https://taigu.tw/terms-of-service | grep -oE '本網站可能因系統維護、升級或其他原因而暫時中斷服務|服務中斷或終止' | sort -u`。
2. 執行 `curl -s https://taigu.tw/terms-of-service | grep -oE '<title>[^<]*</title>|<link rel="canonical"[^>]*>|<meta name="robots"[^>]*>|<meta property="og:(title|url)"[^>]*>'`。

預期：步驟 1 印出「服務中斷或終止」與「本網站可能因系統維護、升級或其他原因而暫時中斷服務」兩行；步驟 2 印出 `<title>服務條款 | Taigu</title>`、`href` 是 `https://taigu.tw/terms-of-service` 的 canonical、`content` 是「服務條款 | Taigu」的 `og:title` 與 `content` 是 `https://taigu.tw/terms-of-service` 的 `og:url`，沒有 `robots` 那一行。

## PUB-R7.2 不執行 JavaScript 抓取首頁

前端沒有自動化 test。dev server 回傳的 HTML 沒有壓縮，有些 meta tag 跨了好幾行，所以下面的指令先用 `tr` 把整份 HTML 接成一行再比對。

1. 執行 `curl -sk https://local.taigu.tw/ | tr '\n' ' ' | grep -oE '<title>[^<]*</title>|<link rel="canonical"[^>]*>|<meta[^>]*property="og:(title|url)"[^>]*>|<noscript>[^<]*</noscript>|<div id="root">[^<]*</div>'`。

預期：印出 `<title>Taigu | 台股記帳 | 專業投資組合管理，精準損益計算與績效追蹤</title>`、`content` 是同一個標題的 `og:title`、`href` 是 `https://taigu.tw/welcome` 的 canonical、`content` 是 `https://taigu.tw/welcome` 的 `og:url`、`<noscript>Taigu 需要啟用 JavaScript 才能運作，請在瀏覽器設定中開啟。</noscript>`，以及裡面沒有任何文字的 `<div id="root"></div>`。

## PUB-R8.1 查看首頁的分享資訊與結構化資料

前端沒有自動化 test。

1. 執行 `curl -sk https://local.taigu.tw/ | tr '\n' ' ' | grep -oE '<meta[^>]*property="og:(image|image:width|image:height|site_name)"[^>]*>'`。
2. 執行 `curl -sk https://local.taigu.tw/ | sed -n '/application\/ld+json/,/<\/script>/p'`。

預期：步驟 1 印出 `content` 是 `https://taigu.tw/cover.jpg` 的 `og:image`、`content` 是 1200 的 `og:image:width`、`content` 是 900 的 `og:image:height` 與 `content` 是 Taigu 的 `og:site_name`；步驟 2 印出兩段結構化資料，`@type` 是 `WebApplication` 的那一段在 `offers` 列出 `name` 是 Free、`price` 是 0 與 `name` 是 Standard、`price` 是 65 的兩個方案，`priceCurrency` 都是 TWD，`@type` 是 `Organization` 的那一段的 `name` 是 Taigu，`logo` 是 `https://taigu.tw/logo-l.png`，`email` 是 `taigu.tw@gmail.com`。

## PUB-R9.1 查看 robots.txt

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/robots.txt`。

預期：檔案寫著 `User-agent: *`、`Allow: /`，接著是 `/login`、`/settings`、`/records`、`/plans`、`/market`、`/market-index`、`/search`、`/earning-analysis`、`/handling-fee` 各一行 `Disallow`，最後一行是 `Sitemap: https://taigu.tw/sitemap.xml`。

## PUB-R10.1 查看 sitemap

前端沒有自動化 test。

1. 開啟 `https://local.taigu.tw/sitemap.xml`。

預期：檔案有三個 `<loc>`，依序是 `https://taigu.tw/welcome`、`https://taigu.tw/privacy-policy` 與 `https://taigu.tw/terms-of-service`。
