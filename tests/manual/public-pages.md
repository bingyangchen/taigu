執行 `make start`，等所有 container 都啟動。步驟寫「用未登入的桌面瀏覽器」時，開啟一個 Firefox 的隱私視窗，因為 Firefox 不提供安裝 Taigu 的選項；步驟寫「用已登入的桌面瀏覽器」時，用 Chrome 開啟 `https://local.taigu.tw/login`，再用 Google 帳號登入；步驟寫「用行動裝置」時，開啟一個 Chrome 的無痕式視窗，開啟 DevTools 的 device toolbar（Toggle device toolbar），選 iPhone 14 Pro 這類手機；前端依可用畫面的大小切換版面，不看 user agent，所以不用重新整理頁面。

步驟寫「用安裝好的 PWA」時，照下面的做法開啟 Taigu。前端依 Taigu 是不是以 PWA 開啟，決定法律頁面在新分頁還是同一個畫面開啟，所以這些步驟不能用 device toolbar 代替：

1. 如果還沒把 Taigu 安裝成 app，用 Chrome 開啟 `https://local.taigu.tw`，點網址列右側的安裝圖示，再點「安裝」。
2. 從 macOS 的 Dock 或「應用程式」資料夾開啟安裝成 app 的 Taigu。
3. 要查看 PWA 目前的網址時，在 PWA 的視窗按 Cmd+Option+I 開啟 DevTools，在 Console 執行 `location.pathname`。

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

## PUB-R3.1 在瀏覽器裡點「隱私權政策」

法律頁面在新分頁還是同一個畫面開啟，取決於 Taigu 是不是以 PWA 開啟，前端沒有自動化 test。

1. 用未登入的桌面瀏覽器開啟 `https://local.taigu.tw/welcome`。
2. 捲到頁尾。
3. 點選頁尾的「隱私權政策」。

預期：瀏覽器開啟一個新的瀏覽器分頁顯示 `/privacy-policy`，原本的瀏覽器分頁仍停在歡迎頁。

## PUB-R3.2 在 PWA 裡點「服務條款」

法律頁面在新分頁還是同一個畫面開啟，取決於 Taigu 是不是以 PWA 開啟，jsdom 沒辦法模擬 PWA，前端沒有自動化 test。

1. 用安裝好的 PWA 開啟 Taigu。
2. 如果畫面不是歡迎頁，點側邊欄或底部導覽列的頭像進入設定頁，點「登出」，再點確認視窗裡的「登出」。
3. 如果第 2 步登出了，關閉 PWA 的視窗，再重新開啟 PWA。
4. 確認 PWA 的網址是 `/welcome`。
5. 捲到頁尾。
6. 點選頁尾的「服務條款」。
7. 確認 PWA 的網址。
8. 點選服務條款左上角的返回按鈕（滑鼠移入時顯示「上一頁」）。

預期：步驟 6 之後同一個 PWA 視窗顯示服務條款，Chrome 沒有開啟新的分頁或視窗；步驟 7 的網址是 `/terms-of-service`；步驟 8 之後 PWA 回到歡迎頁。

## PUB-R3.3 在 PWA 裡從設定頁開啟隱私權政策

法律頁面在新分頁還是同一個畫面開啟，取決於 Taigu 是不是以 PWA 開啟，jsdom 沒辦法模擬 PWA，前端沒有自動化 test。

1. 用安裝好的 PWA 開啟 Taigu。
2. 如果畫面是歡迎頁，點頁首的「登入」，再用 Google 帳號登入。
3. 點側邊欄或底部導覽列的頭像進入設定頁，確認 PWA 的網址是 `/settings`。
4. 點選「關於」區塊的「隱私權政策」。
5. 確認 PWA 的網址。
6. 點選隱私權政策左上角的返回按鈕（滑鼠移入時顯示「上一頁」）。

預期：步驟 4 之後同一個 PWA 視窗顯示隱私權政策，Chrome 沒有開啟新的分頁或視窗；步驟 5 的網址是 `/privacy-policy`；步驟 6 之後 PWA 回到設定頁。

## PUB-R11.1 點頁尾的 Instagram 連結

前端沒有自動化 test。

1. 用行動裝置開啟 `https://local.taigu.tw/welcome`。
2. 捲到頁尾。
3. 點選頁尾的 Instagram 圖示。

預期：瀏覽器開啟一個新的瀏覽器分頁顯示 `https://www.instagram.com/taigu.tw/`，原本的瀏覽器分頁仍停在歡迎頁。

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

前端沒有自動化 test，而且本機的 dev server 對每個網址都回傳同一份 HTML，所以這項檢查先在本機 build，再用 `vite preview` 提供 build 出來的檔案。`vite preview` 跟 Cloudflare Pages 一樣，用 `terms-of-service.html` 回應 `/terms-of-service`。

1. 執行 `docker compose -f compose.dev.yaml run -d --rm --no-deps --name taigu-preview -p 3001:3000 frontend sh -c "npm run build && npm run preview"`。
2. 等 `docker logs taigu-preview` 印出 `http://localhost:3000/`。
3. 執行 `curl -s http://localhost:3001/terms-of-service | grep -oE '本網站可能因系統維護、升級或其他原因而暫時中斷服務|服務中斷或終止' | sort -u`。
4. 執行 `curl -s http://localhost:3001/terms-of-service | grep -oE '<title>[^<]*</title>|<link rel="canonical"[^>]*>|<meta name="robots"[^>]*>|<meta property="og:(title|url)"[^>]*>'`。
5. 執行 `docker stop taigu-preview`。

預期：步驟 3 印出「服務中斷或終止」與「本網站可能因系統維護、升級或其他原因而暫時中斷服務」兩行；步驟 4 印出 `<title>服務條款 | Taigu</title>`、`href` 是 `https://taigu.tw/terms-of-service` 的 canonical、`content` 是「服務條款 | Taigu」的 `og:title` 與 `content` 是 `https://taigu.tw/terms-of-service` 的 `og:url`，沒有 `robots` 那一行。

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
