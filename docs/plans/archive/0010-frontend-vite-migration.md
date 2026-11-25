---
id: "0010"
title: frontend-vite-migration
status: done
specs: []
depends_on: []
---

# 0010 前端改用 Vite 與 React 19

## 目標

前端不再依賴已停止積極維護的 Create React App，改用 Vite 啟動 dev server 與 build，用 Vitest 執行測試，並一起升級到 React 19 與相關套件的新版。公開頁面的 prerender 改由 Vite 的 SSR 在 build 時產生 HTML，不再需要 headless Chrome，各頁面的標題、頁面說明與 canonical 網址改用 React 19 原生的 metadata 寫法。完成後，本機 Docker 開發、Cloudflare Pages 部署、CI 的前端測試都能正常運作，使用者看到的行為與現在相同，已安裝的 PWA 也能更新到新版並離線開啟。

## 範圍

- 要做：
  - 用 Vite 取代 `react-scripts` 啟動 dev server 與 build，build 出來的檔案仍放在 `frontend/build/`，Cloudflare Pages 的 build 指令仍是 `npm run build`。
  - 用 Vitest 取代 Jest，改寫測試裡的 `jest.*` 與 `setupTests.ts`，並更新 `make test`、`make check-scenarios`、CI，以及 scenario checker 裡提到 Jest 的訊息。
  - Service worker 改由 Vite 的 build 注入 precache 清單，`service-worker.ts` 的 routing 與 `serviceWorkerRegistration.ts` 的更新流程照舊。
  - 公開頁面的 prerender 改用 Vite 的 SSR build 與 `renderToString`，移除 puppeteer。
  - 升級到 React 19，`PageMeta` 改用 React 19 原生的 `<title>`、`<meta>`、`<link>`。前端啟動時先移除 `index.html` 裡的預設 head tag。
  - 公開頁面的網址清單合併成 `frontend/src/` 裡的一個模組，prerender 與 `service-worker.ts` 都從這個模組讀取。
  - 一起升級以下套件：`react`、`react-dom`、`@types/react`、`@types/react-dom` 升到 19，`react-redux` 升到 9，`@reduxjs/toolkit` 升到 2，`@testing-library/react` 升到 16 並加上 `@testing-library/dom`，`@testing-library/user-event` 升到 14，TypeScript 升到 5，`@typescript-eslint` 升到 8，ESLint 升到 9 並改用 flat config，workbox 升到 7。
  - 移除 `reportWebVitals.ts` 與 `web-vitals`，因為 `index.tsx` 呼叫 `reportWebVitals()` 時沒有傳入 callback，量到的數字沒有送到任何地方。
  - 在 `frontend/.node-version` 固定 Node 的版本為 22.14.0，與 `frontend/Dockerfile` 相同。
  - 更新 `compose.dev.yaml` 掛進 container 的檔案、`README.md` 與 sdd skill 裡提到 Jest 的地方。
- 刻意不做的事：
  - 前端接手 prerender 的 HTML 時改用 `hydrateRoot`。
  - 另外支援 Vite 預設 build target 以外的舊瀏覽器，或在舊瀏覽器顯示提示。
  - 把 PWA 更新到新版的流程寫成 spec。

## 設計稿

無

## Spec 變更

無。使用者看到的行為不變，架構的改動寫在「做法要點」。

## 決策

### 測試框架

- 選項：
  - 改用 Vitest。
  - 保留 Jest，自己設定 `ts-jest` 或 `babel-jest`。
- 取捨：保留 Jest 時，build 與測試各有一套 transpile 設定，SCSS module 與 web worker 用的 `import.meta.url` 要分別處理。
- 結論：改用 Vitest，沿用 Vite 的設定。
- 併入：無

### PR 的拆法

- 選項：
  - 一個 plan、一個 impl PR。
  - 先在 Create React App 底下改用 Vitest，再另外換 build，拆成兩個 plan。
- 結論：一個 plan、一個 impl PR，因為前端測試只有 9 個檔案，拆開只是多一份暫時的 Vitest 設定。
- 併入：無

### Build 輸出目錄

- 選項：
  - 維持 `build/`。
  - 改成 Vite 預設的 `dist/`。
- 取捨：改成 `dist/` 時，merge 的同時要改 Cloudflare Pages dashboard 上的輸出目錄。
- 結論：維持 `build/`。
- 併入：無

### 支援的瀏覽器

- 選項：
  - 用 Vite 預設的 build target。
  - 把 `build.target` 調到涵蓋 Safari 15。
  - 加上 `@vitejs/plugin-legacy`，另外產生附 polyfill 的 bundle。
- 取捨：Vite 預設的 target 不涵蓋 Safari 15，所以最多只能升到 iOS 15 的 iPhone（例如 iPhone 6s、iPhone 7）可能無法使用 Taigu。`@vitejs/plugin-legacy` 會讓 service worker 多 precache 一份 legacy bundle。
- 結論：用 Vite 預設的 build target。
- 併入：architecture.md#前端的 Build

### 舊瀏覽器的提示

- 選項：
  - 不顯示提示。
  - 在 `index.html` 用 inline script 檢查瀏覽器功能，不支援時顯示「請更新瀏覽器」。
- 取捨：用功能檢查只能大概判斷，因為 build 出來的程式在舊瀏覽器會不會出錯，取決於語法轉換的結果與程式用到的 API。
- 結論：不顯示提示。
- 併入：無

### Prerender 的做法

- 選項：
  - 保留 puppeteer，擷取 build 出來的頁面。
  - 改用 Vite 的 SSR build，用 `renderToString` 產生 HTML。
- 取捨：改用 SSR 時，三個公開頁面的元件在 Node 裡 render，不能在 render 時讀取 `window`、IndexedDB 這類只有瀏覽器才有的東西。
- 結論：改用 Vite 的 SSR build。原本選 puppeteer 的理由是 Create React App 的 CSS module class name 與檔名帶有 hash，不 eject 就無法用另一個 bundler 產生一樣的結果；改用 Vite 之後，SSR build 與 client build 用同一份設定，這個限制不存在。
- 併入：architecture.md#公開頁面的 Prerender

### 前端接手 Prerender 的 HTML 的方式

- 選項：
  - 維持 `createRoot`，JavaScript 載入後重新 render 整頁。
  - 改用 `hydrateRoot`，沿用 prerender 的 DOM。
- 取捨：維持 `createRoot` 時，歡迎頁的 demo 影片會從頭播放，已經播過的進場動畫會再播一次，與現在相同。改用 `hydrateRoot` 時，SSR 與瀏覽器第一次 render 的結果要完全相同，所以會隨時間改變的內容要另外處理，例如頁尾用 `new Date().getFullYear()` 寫的年份，跨年之後，SSR 在 build 時算出的年份就與瀏覽器算出的不同。
- 結論：維持 `createRoot`。
- 併入：architecture.md#公開頁面的 Prerender

### 頁面 Head 的寫法

- 選項：
  - 每頁的 metadata 抽成常數，頁面與 prerender 共用。
  - 用 context 在 SSR 時收集 `PageMeta` 的 props。
  - 改用 `react-helmet-async`。
  - 升級到 React 19，改用原生的 `<title>`、`<meta>`、`<link>`。
- 取捨：升級到 React 19 時，`react-redux` 要升到 9、`@reduxjs/toolkit` 要升到 2、`@testing-library/react` 要升到 16，全部頁面都要重新確認。抽成常數時，以後新增公開頁面要記得同時登記到 prerender。改用 `react-helmet-async` 時，要改寫全部 9 處用到 `PageMeta` 的地方，升級 React 時也要等這個套件支援新版。
- 結論：升級到 React 19，改用原生的 `<title>`、`<meta>`、`<link>`，metadata 只寫在頁面裡，SSR 與瀏覽器用同一份。
- 併入：architecture.md#頁面的 Head

### `index.html` 的預設 Head Tag

- 選項：
  - 前端在第一次 render 之前，移除 `index.html` 裡的預設 title、頁面說明、canonical 與分享預覽的 tag。
  - 預設 tag 加上標記，前端等 React 插入同名的 tag 之後再移除。
- 取捨：移除預設 tag 之後，沒有寫 `<title>` 的頁面就沒有頁面標題，所以每個頁面都要寫。
- 結論：第一次 render 之前移除。`index.html` 必須保留這些預設 tag，因為不執行 JavaScript 的 client 抓取非公開頁面的網址時，要讀到歡迎頁的版本（PUB-R7）。不過 React 插入的 tag 如果沒有取代既有的同名 tag，head 裡會同時有兩個 `<title>` 與兩個 canonical，瀏覽器分頁會顯示排在前面的那個 `<title>`，所以前端要先移除預設 tag。
- 併入：architecture.md#頁面的 Head

### 連帶升級的範圍

- 選項：
  - 只升級改用 Vite 與 React 19 非升不可的套件。
  - 一起升級 ESLint 9、`@testing-library/user-event` 14 與 workbox 7。
- 結論：一起升級。
- 併入：無

### Cloudflare Pages 的 Node 版本

- 選項：
  - 在 `frontend/.node-version` 固定版本。
  - 只在 Cloudflare Pages dashboard 設定 `NODE_VERSION`。
- 結論：用 `frontend/.node-version`，讓本機、CI 與 Cloudflare Pages 用同一個版本。`package.json` 不加 `engines`，因為 npm 遇到 `engines` 不符時預設只會警告。
- 併入：無

### 已安裝的 PWA 能更新到新版的驗證

- 選項：
  - 不加 spec，實測從目前 prod 的 service worker 更新到新版，結果記在 `architecture.md`。
  - 先 backfill 一份 PWA 更新的 spec，再寫進這個 plan。
- 結論：不加 spec，因為更新的流程不變，要確認的只是新的 build 沒有影響這個流程。
- 併入：無

### 公開頁面的網址清單

- 選項：
  - 合併成 `frontend/src/` 裡的一個模組。
  - 維持 `prerender.mjs` 與 `service-worker.ts` 各一份。
- 結論：合併成一個模組，因為 prerender 改由 Vite 處理之後，就能與 `service-worker.ts` import 同一個模組。
- 併入：無

## 做法要點

- 已安裝的 PWA 要能更新到新版，所以 service worker 的網址維持 `/service-worker.js`，scope 維持 `/`。網址改變的話，瀏覽器會繼續用舊的 service worker。
- 實作要實測從目前 prod 的 service worker 更新到新版：使用者的瀏覽器裝了用 Create React App build 的 service worker，新版上線之後，使用者再開啟 Taigu 時，瀏覽器換成新版的 service worker，畫面換到首頁並重新載入，之後使用者離線開啟 Taigu 也能使用。實測的瀏覽器與結果記在 `architecture.md`。
- 實作要實測 React 19 在 `createRoot` 底下把 `<title>`、`<meta>`、`<link>` 插到 head 的哪個位置，以及 head 裡已經有同名 tag 時的處理，結果記在 `architecture.md` 的「頁面的 Head」。要達到的結果是：JavaScript 執行之後，head 裡只有一組目前頁面的頁面標題、頁面說明、`robots` meta tag 與 canonical（PUB-R6）。
- Prerender 改由 Vite 的 SSR build 產生三個公開頁面的 HTML：把 SSR 輸出的頁面內容與 head tag 寫進 `index.html` 的副本，取代裡面的預設 head tag。
- Vite 需要 Node 20.19 以上或 22.12 以上，所以 merge 之前，請到 Cloudflare Pages 的 dashboard 確認環境變數 `NODE_VERSION`：有設定的話，刪除或改成 22.14.0。Node 版本不符而 build 失敗時，Cloudflare Pages 會繼續提供上一個成功的版本。`.node-version` 與 `NODE_VERSION` 同時存在時哪一個優先還沒有實測，實作時要實測，結果記在 `architecture.md`。
- 上線之後如果 prod 有問題，可以在 Cloudflare Pages 的 dashboard 把部署退回上一版。已經更新到新版 service worker 的瀏覽器，在使用者下次開啟 Taigu 時，會照上面實測的更新流程換成退回後的版本。
- Vite 預設的 build target 不涵蓋 Safari 15（見「支援的瀏覽器」），所以實作不實測 iOS 15。
- 這個 plan 只改前端，所以與後端的部署順序無關。
- `architecture.md` 要更新的地方：
  - 新增「前端的 Build」一節，寫 Vite、Vitest 與支援的瀏覽器。
  - 改寫「公開頁面的 Prerender」：設計理由改成說明為什麼用 Vite 的 SSR build，並把「兩份清單要一致」改成指向共用的模組。
  - 新增「頁面的 Head」一節，寫原生 metadata 與前端啟動時移除預設 tag 的做法。
  - 功能與程式碼對照表的「公開頁面」一列，更新 `index.html` 與 prerender 程式的路徑。
- sdd skill 與 `README.md` 裡的「Jest」改成 Vitest。這不會改變一份 plan 要寫哪些內容，所以 impl PR 的 description 不必列出 `draft` 與 `approved` 的 plan。

## 驗證方式

這個 plan 沒有新增或修改情境。下列既有情境會受到 build、head 或 service worker 改動的影響，實作時要重跑。改用 Vite 之後，在本機就能 build 並提供 prerender 的 HTML，所以 PUB-R7.1 的手動檢查步驟可以改成在本機執行。

| 情境 | 驗證方式 |
| --- | --- |
| PUB-R6.1 開啟隱私權政策 | 手動 |
| PUB-R6.2 從歡迎頁換到登入頁 | 手動 |
| PUB-R7.1 不執行 JavaScript 抓取服務條款 | 手動 |
| PUB-R7.2 不執行 JavaScript 抓取首頁 | 手動 |
| PUB-R8.1 查看首頁的分享資訊與結構化資料 | 手動 |
| MKT-R13.7 離線開啟時使用 Cache | 手動 |
| FAV-R2.2 離線時加入 | 手動 |
| FAV-R2.3 離線時移除 | 手動 |
| USAGE-R1.2 以 PWA 開啟 Taigu | 手動 |
| USAGE-R1.11 離線時切回分頁 | 手動 |
| USAGE-R1.12 隔天從其他 app 切回 PWA | 手動 |
| ISSUE-R3.3 在 PWA 送出問題回報 | 手動 |

## 還沒定案的問題

無
