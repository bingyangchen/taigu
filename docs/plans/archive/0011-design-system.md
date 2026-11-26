---
id: "0011"
title: design-system
status: done
specs: []
depends_on: []
---

# 0011 重整前端的 Design System

## 目標

前端的樣式改用一套分成原始值與用途兩層的 design token，顏色、字級、字重、行高、間距、圓角、陰影、動畫、疊放層級、版面尺寸與斷點都從 `frontend/src/styles/` 取值，SCSS 與圖表的 TypeScript 不再寫死這些值，stylelint 會在 `make test` 與 CI 擋下新寫死的值。中性色統一成偏藍的灰，文字色都符合 `ui-guidelines.md`「文字對比」依用途與尺寸訂的下限。完成後，開發者與 agent 依用途挑選 token，之後要調整整體配色或加入其他主題時，只改 token 的定義。

## 範圍

- 要做：
  - 建立 `frontend/src/styles/`，把 `frontend/src/_design_system.scss` 與 `frontend/src/index.scss` 的內容拆到裡面，並刪除這兩個檔案。
  - 定義「做法要點」列出的每一組 token，在 `:root` 輸出成 CSS custom properties，元件用 `var()` 讀取。斷點例外，維持 Sass 變數。
  - 把每個 SCSS 檔裡的顏色、字級、字重、行高、間距、圓角、陰影、動畫時間與 easing、z-index 改成 token，寫死的值依「做法要點」的對應規則換成最接近的 token。
  - 把圖表與 icon 在 TypeScript 裡寫死的顏色與字級改成從 token 讀取，給 TypeScript 用的 token 只從一個檔案匯出。
  - 中性色改成偏藍的灰，次要文字改成 `#6a788c`。
  - 藍、紅、綠當文字色，以及上面放白字的底色，改用深一階的 `blue-600`、`red-600`、`green-600`。
  - 拿掉讓文字或圖示變淡的 `opacity`，改用顏色 token。
  - 拿掉在元件裡用 `color.mix()`、`color.scale()`、`color-mix()` 混出來的顏色，改用 token。
  - 只有後台用到的尺寸搬到 `frontend/src/pages/Admin/`。
  - `Button` 與 `RoundButton` 改用 CSS Modules，移除全域的 `.p-12` class。
  - 加入 stylelint，禁止在 `frontend/src/styles/` 以外寫死顏色、z-index、動畫時間，以及不在 scale 上的字級、間距與圓角。
  - 更新 `ui-guidelines.md`、`architecture.md`、`product-designer` skill、`sdd` skill、`design/shared/` 裡提到舊檔案的地方，並重新產生 `design/shared/components.css`。
- 刻意不做的事：
  - 深色模式與其他主題。
  - 改變導覽的切換方式，底部導覽列與側欄維持現在依 User-Agent 與 780px 切換的做法。
  - 用 Style Dictionary 或 DTCG 格式的 JSON 產生 token。
  - 調整元件的外觀。除了中性色、主色的深淺，以及換成 scale 上最接近的值造成的差異，畫面維持原樣。
  - 修改 `design/` 底下已有的設計稿。
  - Flutter app 的主題。

## 設計稿

無。中性色已經在本機的前端實際套用過，使用者確認改用偏藍的灰；換成 scale 造成的差異由使用者在實作的第 6 步逐頁調整。

## Spec 變更

無。使用者看到的行為不變。`ui-guidelines.md` 新增的「文字對比」與「可讀性與操作」裡指向它的對比規則、「字級與顏色」的字級表、表格以外的字級不隨寬度切換的規定與字重，依使用者要求在這個 plan 的 PR 一起修改；提到 `index.scss` 與 `_design_system.scss` 的兩行要等實作建立新的檔案，所以在實作時修改，新的寫法見「做法要點」。

實作時依使用者要求另外修改了 `ui-guidelines.md`：「文字對比」計算對比時，淡漸層以白色計算、半透明的背景以疊在白色上的顏色計算，文字本身不能是半透明的，但裝飾文字不受這個限制；主要文字的例子拿掉「已綁定的 Email」；「Design Token、共用元件與圖示」裡寫了好幾條規則的一項，拆成一項一條。

## 決策

### 中性色

- 選項：
  - 統一成偏藍的灰。
  - 統一成目前大部分畫面用的灰（文字 `#444`、次要文字 `#888`、框線 `#ddd`）。
  - 兩套都保留成 token。
- 取捨：統一成偏藍的灰時，大部分舊畫面的文字與框線顏色都會改變。兩套都保留時，同一個用途會有兩個 token，開發者每次都要選一次。
- 結論：統一成偏藍的灰，因為它跟主色藍比較協調，個股詳細頁、歡迎頁與圖表也已經各自用了偏藍的灰。
- 併入：無

### 文字對比的規範

- 選項：
  - 照 WCAG 2.2 AA：一般文字 4.5:1，大字 3:1，停用中的元件不受限制。
  - 照 WCAG 的分法，把下限降到 4:1，停用中的控制項與 placeholder 另訂 2:1 的例外。
  - 自訂一套規範：依文字的用途與尺寸查表決定下限。
- 取捨：照 WCAG 的分法時，只有「一般文字」與「大字」兩檔，不分字級與字重，而且例外依元件狀態決定，帳號綁定頁用停用中的輸入框顯示已綁定的 Email，Email 就落進了寬鬆的例外，實際只有大約 2.9:1，使用者卻需要讀它（ACCT-R11）。自訂規範的下限比 WCAG 2.2 AA 寬鬆，次要文字在內文以上的尺寸只要 3:1。
- 結論：自訂一套規範，寫進 `ui-guidelines.md` 的「文字對比」，並依使用者要求在這個 plan 的 PR 修改：
  - 對比用 WCAG 2 的對比比值計算，不用 APCA，因為 APCA 還不是正式標準、工具少，而 Taigu 只有淺色主題，WCAG 2 在深色背景上算不準的缺點影響不到。字級與字重的差異由規範的表處理。
  - 用途依這段資訊在畫面上的重要程度分成主要、次要、提示、裝飾四種，跟元件與狀態無關。停用樣式只表達控制項不能使用，不降低對比下限。
  - 尺寸依字級分成小字、內文、中字、大字四段，字重 600 與 700 往上算一段，因為中文字型在 macOS 與 Windows 上，600 與 700 都顯示成同一種粗細。
  - 下限只有三階：4:1、3:1、2:1，只規定下限不規定上限，因為主要與次要文字之間的層次已經由 token 決定。
- 併入：ui-guidelines.md#文字對比

### 非文字元素的對比

- 選項：
  - 在 `ui-guidelines.md` 加上 WCAG 1.4.11 的規則：辨識介面元件與它的狀態所需的視覺，以及理解圖表所需的部分，與相鄰顏色的對比至少 3:1。
  - 不加規則，各元件依情況選色。
- 取捨：不加規則時，沒有底色的輸入框框線（`--color-border-default`，1.28:1）、後台圖表的長條（`-soft` 1.65:1、`-faint` 1.31:1）、圓餅圖 9 個類別色裡的 5 個、成交量長條（`--color-chart-muted`，2.50:1），以及摘要卡片右側的箭頭圖示（`--color-icon-muted`，2.50:1）都低於 3:1。箭頭圖示是使用者看出摘要卡片可以點開的唯一線索。
- 結論：不加規則。這份 plan 裡提到非文字元件 3:1 的地方（focus ring 與 `blue-500`），只是說明那兩個顏色的選擇理由，不代表其他非文字元素也要達到 3:1。摘要卡片的箭頭圖示依使用者決定維持 `slate-400`。
- 併入：無

### 字重的種類

- 選項：
  - 保留六種：300、400、500、600、700、800。
  - 四種：400、500、600、700。
  - 三種：400、500、700。
- 取捨：保留 600 與 700 兩種時，中文在 macOS 的蘋方（最粗只到 Semibold）與 Windows 的微軟正黑體（只有 Light、Regular、Bold）上看起來一樣，只有數字與英文看得出差別。500 在 Windows 上會顯示成 Regular。
- 結論：四種，依使用者要求在這個 plan 的 PR 寫進 `ui-guidelines.md` 的「字級與顏色」。現在用到的 300、650、750、800、820、850 依「做法要點」換成這四種之一。
- 併入：無

### Token 的來源與輸出方式

- 選項：
  - 維持只有 Sass 變數。
  - 用 Sass map 定義 token，在 `:root` 輸出成 CSS custom properties，也從同一份 map 匯出給 TypeScript。
  - 直接手寫 CSS custom properties，透明色用 `color-mix()` 組出來，TypeScript 用 `getComputedStyle` 讀取。
  - 用 Style Dictionary 從 DTCG 格式的 JSON 產生 SCSS 與 TypeScript。
- 取捨：手寫 CSS custom properties 時，`getComputedStyle` 讀到的是沒有算出結果的 `color-mix(...)` 字串，ECharts 無法使用，而且 prerender 在 Node 裡執行，沒有 `getComputedStyle`。Style Dictionary 要多一個 build 步驟與 dependency，而 `main` 上只有網頁一個平台。
- 結論：用 Sass map 定義 token，在 `:root` 輸出成 CSS custom properties，從同一份 map 匯出給 TypeScript。透明色在 Sass 裡算成固定的值。斷點只留在 Sass，因為 media query 裡不能用 `var()`。等 Flutter app 合併進 `main`、兩個平台要共用 token 時，再評估 Style Dictionary。
- 併入：architecture.md#Design Token

### 元件讀取 Token 的寫法

- 選項：
  - 元件直接寫 `var(--color-text-secondary)`，由 stylelint 檢查 custom property 的名稱有沒有定義。
  - 元件透過 Sass function 取值，例如 `ds.color(text-secondary)`，名稱寫錯時編譯失敗。
- 取捨：用 Sass function 時，devtools 裡看到的 SCSS 寫法和輸出的 CSS 不同，設計稿也不能照抄元件的寫法。
- 結論：元件直接寫 `var()`，名稱寫錯時由 stylelint 擋下。
- 併入：architecture.md#Design Token

### 間距與圓角落在兩階正中間時

- 選項：
  - 往上取，例如 10px 換成 12px。
  - 往下取，例如 10px 換成 8px。
- 取捨：往上取時整體稍微鬆一點，手機上一個畫面放得下的資料變少；往下取時按鈕與清單列的點擊範圍跟著變小。受影響最多的是 10px（104 次）、14px（55 次）、5px（44 次）與 18px（33 次）。
- 結論：往上取，點擊範圍比較容易達到 `ui-guidelines.md` 要求的 44px。後台也用同樣的 scale 與往上取的規則，雖然 `ui-guidelines.md` 規定後台維持高資訊密度、不直接套用前台的密度，但使用者決定前後台用同一套規則，並依使用者要求在這個 plan 的 PR 修改 `ui-guidelines.md`：「規則的適用方式」寫明 scale 前後台共用、用途字級各自定義，「後台」原本寫字級與間距沿用既有後台元件的那一項，改成只寫圖表沿用 `chart.ts` 的共用樣式。換值時往上取是這次實作的一次性步驟，只寫在 plan。
- 併入：無

### 字級的 Scale 要不要有 13px

- 選項：
  - 不加，scale 跟 `ui-guidelines.md` 的字級表一樣用 11、12、14、16px。
  - 加上 13px。
- 取捨：不加 13px 時，現在寫 13px、`0.8` 到 `0.85` 倍 `$base-font-size` 的大約 70 處會變成 12px 或 14px，差距在 1px 以內。加上 13px 時，12、13、14px 三階太接近，開發者選字級時容易各用各的。
- 結論：不加 13px。
- 併入：無

### 字級要不要隨寬度切換

- 選項：
  - 依 `ui-guidelines.md` 原本的規定，用途字級在 960px 切換，窄版的主要按鈕與輔助文字比寬版小。
  - 字級 token 在 780px 切換，跟現在大部分元件的寫法一致。
  - 字級不隨寬度切換，全部寬度共用同一套。
  - 依輸入方式（`pointer: coarse`）切換，觸控裝置的字比較大。
- 取捨：在 960px 切換時，導覽在「平板寬度的導覽」完成之前，仍依 User-Agent 決定顯示底部導覽列還是側欄，側欄在 780px 以下改成抽屜，所以 780 到 959px（例如 User-Agent 不算行動裝置的 iPad）會出現寬版側欄配上窄版字級。在 780px 切換時，違反 `ui-guidelines.md` 的 960px，而且「平板寬度的導覽」把導覽改在 600px 與 960px 切換之後，780px 就跟任何切換點都對不上。不隨寬度切換時，手機上的按鈕與輔助文字會變大。依輸入方式切換時，縮窄桌面瀏覽器的視窗不會換成窄版字級，但規則要另外判斷裝置，不能沿用版面的寬度分界。
- 結論：依 `ui-guidelines.md` 原本的表，用途字級在 960px 切換，窄版比寬版小，讓手機的小螢幕放得下更多內容；表格以外的字級在每個寬度都一樣，標題與頁面最重要的數字用 `clamp()` 隨寬度縮放。窄版要變多小，集中由用途 token 與 `clamp()` 決定，元件不再各自在 media query 裡縮小字級，因為現在各元件各自縮小的結果，是同一種文字在不同頁面縮成不同的大小，切換點也各自不同。依使用者要求在這個 plan 的 PR 修改 `ui-guidelines.md` 的「字級與顏色」，把導覽文字依側邊欄與底部導覽列拆開，並寫明表格以外的字級不隨寬度切換。導覽依寬度分成底部導覽列、收合的側欄、展開的側欄三段，是改變導覽行為的工作，記在 roadmap 的「平板寬度的導覽」。
- 併入：ui-guidelines.md#字級與顏色

### Focus Ring 的樣式

- 選項：
  - 改成 `blue-600` 的 2px 實線 `outline`，與元素相隔 2px。
  - 維持 `box-shadow`，外圈改成不透明的 `blue-500`。
  - 維持現狀，記到 roadmap。
- 取捨：改成 `outline` 時，每個自己寫 focus 樣式的元件都要檢查 outline 有沒有被容器裁掉。
- 結論：改成 `blue-600` 的實線 `outline`。現在的外圈是 `blue-500` 的 10%，在白底上的對比只有大約 1.1:1，不符合 `ui-guidelines.md`「焦點位置清楚可見」的要求；`blue-600` 在白底上有 5.08:1，符合 WCAG 對非文字元件 3:1 的要求。用 `outline` 而不用 `box-shadow`，是因為 Windows 的高對比模式會拿掉 `box-shadow`，但會保留 `outline`。
- 併入：無

### 主色當文字與按鈕底色時的對比

- 選項：
  - 在這個 plan 一起修正：文字與放白字的底色改用深一階的藍、綠、紅，裝飾用途維持原本的顏色。
  - 只修正文字，藍色按鈕記到 roadmap。
  - 都記到 roadmap。
- 取捨：一起修正時，連結、主要按鈕、漲跌數字的顏色都會變深，主要按鈕是最明顯的改變。
- 結論：一起修正。藍 `#4c8bf5`、綠 `#1aa260` 當文字色時在白底上只有 3.3:1，白字放在藍色按鈕上也是 3.3:1；紅 `#d4493f` 在白底上有 4.35:1，但在 `slate-100` 與窄版漸層上不到 4:1，都不符合 4:1 的下限。這個 plan 本來就要定義文字色與底色的用途 token，所以在這裡把它們指到深一階的顏色。
- 併入：無

### 前台與後台的版面尺寸

- 選項：
  - 後台專用的尺寸都搬到 `pages/Admin/`，前台與後台的側欄寬度分開。
  - 合併前台與後台的側欄寬度。
- 取捨：前台側欄展開時是 230px，後台是 216px，合併的話其中一邊的版面會變。
- 結論：後台的側欄寬度、內容寬度、表格高度與圖表尺寸都搬到 `pages/Admin/`。收合時兩邊都是 64px，但也不合併，因為 `ui-guidelines.md` 規定前台與後台各自遵守自己的章節，之後其中一邊改寬度時，不應該連帶改到另一邊。長篇文字的行寬 `68ch` 現在只有後台的問題回報頁用到，所以也放在 `pages/Admin/`，等前台的長篇文字頁面也要用時再搬到全域。
- 併入：無

### 圓餅圖的類別色

- 選項：
  - 沿用 ECharts 預設的 9 個顏色，寫成 token。
  - 用主色與中性色重新設計一組類別色。
- 取捨：重新設計時，使用者會看到投資組合圓餅圖的配色改變。
- 結論：沿用 ECharts 預設的 9 個顏色，寫成 token。
- 併入：無

### `Button` 與 `RoundButton` 的樣式

- 選項：
  - 維持全域 CSS。
  - 改用 CSS Modules，`.p-12` 改成 prop。
- 取捨：改用 CSS Modules 之後，`design/shared/components.css` 裡這兩個元件的 class name 會加上元件名稱的前綴，`design/` 裡已有的設計稿用的是舊的 class name，重新產生 `components.css` 之後，這些設計稿的按鈕會失去樣式。
- 結論：改用 CSS Modules，避免全域 class name 互相影響，`!important` 也不再需要。已有的設計稿照 `sdd` 的規則不修改。
- 併入：無

### 確保開發者使用 Token 的方式

- 選項：
  - 在 code review 時檢查。
  - 加入 stylelint，在 `make test` 與 CI 執行。
- 結論：加入 stylelint，因為這次統計到的 62 個寫死的顏色與二十幾種字級，都是在 code review 時沒有被擋下來的。
- 併入：architecture.md#Design Token

### PR 的拆法

- 選項：
  - 一個 plan、一個 impl PR。
  - 一個 plan 加一個 impl PR 處理結構與 CSS custom properties，其他工作拆成 4 個 `change` PR。
- 取捨：只有一個 impl PR 時，diff 很大，而且合併之前，其他前端 PR 都會跟它 conflict；合併之後若某一部分有問題，只能整個 revert 或另外開 PR 修正。
- 結論：一個 plan、一個 impl PR。Scale 的值與用途 token 在 plan 裡一起決定，比分成好幾個 `change` 各自決定一致，stylelint 也能在同一個 PR 檢查有沒有漏換的值。
- 併入：無

## 做法要點

### 檔案結構

```
frontend/src/styles/
  _index.scss            @forward tokens 與 mixins；元件用 @use "styles" as ds;
  tokens/
    _palette.scss        原始色，只給 tokens/ 內部用
    _color.scss          用途色
    _typography.scss     字級、字重、行高、字距
    _spacing.scss
    _radius.scss
    _shadow.scss
    _motion.scss
    _z-index.scss
    _layout.scss
    _breakpoints.scss    斷點 map 與 up()、down() mixin
  mixins/                原本 _design_system.scss 的 page-header-title-size 這類 mixin
  base/                  在 :root 輸出 custom properties，以及原本 index.scss 的全域樣式
  tokens.module.scss     唯一給 TypeScript 用的 :export
  tokens.ts              包一層 tokens.module.scss，提供型別
```

- 在 `frontend/vite.config.*` 設定 `css.preprocessorOptions.scss.loadPaths`，讓每個 SCSS 檔都寫 `@use "styles" as ds;`，不再用 `../../design_system` 這類相對路徑，namespace 也從 `_` 改成 `ds`。
- `frontend/src/utils/breakpoints.module.scss` 與 `frontend/src/pages/Admin/tokens.module.scss` 刪除，`utils/mediaQuery.ts`、`pages/Admin/chart.ts`、`pages/Admin/Admin.tsx`、`pages/Admin/Usage/Usage.tsx`、`pages/Admin/Subscriptions/Subscriptions.tsx` 改從 `styles/tokens.ts` 讀取。後台專用的尺寸在 `pages/Admin/` 另外用一個 `:export` 匯出。
- `tokens.ts` 匯出給 ECharts 的字級是 px 的數字，因為 ECharts 的 `fontSize` 吃數字，不吃 rem 字串；匯出的顏色是 6 位數的 hex，因為 `periodTrend.ts` 會在顏色字串後面接上透明度的兩位數。
- Token 一律依類別排列，順序是 color、typography、spacing、radius、shadow、motion、z-index、layout、breakpoints；同一個 scale 裡由小到大排列。

### 顏色

原始色（`tokens/_palette.scss`）：

| 名稱 | 值 | 原本的 token |
| --- | --- | --- |
| `slate-50` | `#f6f9fc` | `$page-bg` |
| `slate-100` | `#f1f4f8` | `$noisy-white`（原本 `#f5f5f5`） |
| `slate-200` | `#dde4ee` | `$light-gray`（原本 `#ddd`） |
| `slate-300` | `#c3ccd8` | 無，取代圖表的 `#ccc` |
| `slate-400` | `#9aa5b4` | 無，取代成交量長條圖的 `#aaa` 與停用中的文字原本用的 `$light-gray` |
| `slate-500` | `#6a788c` | `$gray`（原本 `#888`） |
| `slate-800` | `#27313d` | `$deep-gray`（原本 `#444`） |
| `blue-500` | `#4c8bf5` | `$blue` |
| `blue-550` | `#3b78df` | 無 |
| `blue-600` | `#2f6bd0` | 無 |
| `red-500` | `#d4493f` | `$red` |
| `red-600` | `#c43f36` | 無 |
| `green-500` | `#1aa260` | `$green` |
| `green-600` | `#138850` | 無 |
| `yellow-500` | `#fbbc05` | `$yellow` |
| `white` | `#fff` | `$white` |
| `black` | `#000` | `$black` |

用途色（`tokens/_color.scss`）。元件只用這一層，透明色在 Sass 裡用 `rgba()` 算成固定的值：

| 類別 | Token | 值 |
| --- | --- | --- |
| 文字 | `--color-text-primary` | `slate-800` |
| | `--color-text-secondary` | `slate-500` |
| | `--color-text-tertiary` | `slate-400` |
| | `--color-icon-muted` | `slate-400` |
| | `--color-text-inverse` | `white` |
| | `--color-text-accent` | `blue-600` |
| | `--color-text-danger` | `red-600` |
| | `--color-text-success` | `green-600` |
| | `--color-text-warning` | `#765b1d` |
| 背景 | `--color-bg-page` | `slate-50` |
| | `--color-bg-surface` | `white` |
| | `--color-bg-subtle` | `slate-100` |
| | `--color-bg-frosted` | `white` 的 60% |
| | `--color-bg-frosted-text` | `white` 的 90% |
| | `--color-bg-hover` | `slate-800` 的 5% |
| | `--color-bg-backdrop` | `black` 的 45% |
| | `--color-bg-inverse` | `slate-800` |
| | `--color-bg-accent` | `blue-600` |
| | `--color-bg-accent-subtle` | `blue-500` 的 10% |
| | `--color-bg-danger` | `red-600` |
| | `--color-bg-danger-subtle` | `red-500` 的 10% |
| | `--color-bg-success` | `green-600` |
| | `--color-bg-success-subtle` | `green-500` 的 10% |
| | `--color-bg-warning` | `yellow-500` |
| | `--color-bg-warning-subtle` | `#fff7e5` |
| | `--color-bg-shell-top` | `#d1eeff` |
| | `--color-bg-shell-bottom` | `#feedff` |
| 框線 | `--color-border-default` | `slate-200` |
| | `--color-border-subtle` | `slate-100` |
| | `--color-border-accent` | `blue-500` |
| | `--color-border-danger` | `red-500` |
| | `--color-border-danger-subtle` | `red-500` 的 25% |
| | `--color-border-success-subtle` | `green-500` 的 25% |
| | `--color-border-warning` | `#f0d9a8` |
| 漲跌 | `--color-price-up` | `red-600` |
| | `--color-price-down` | `green-600` |
| | `--color-price-flat` | `slate-500` |
| 圖表 | `--color-chart-up` | `red-500` |
| | `--color-chart-down` | `green-500` |
| | `--color-chart-accent` | `blue-500` |
| | `--color-chart-accent-soft` | `blue-500` 的 45% |
| | `--color-chart-accent-faint` | `blue-500` 的 25% |
| | `--color-chart-accent-wash` | `blue-500` 的 10% |
| | `--color-chart-category-1` 到 `--color-chart-category-9` | `#5470c6`、`#91cc75`、`#fac858`、`#ee6666`、`#73c0de`、`#3ba272`、`#fc8452`、`#9a60b4`、`#ea7ccc` |
| | `--color-chart-muted` | `slate-400` |
| | `--color-chart-inactive` | `slate-300` |

紅色與綠色同時用在兩種用途：錯誤與成功，以及台股的漲與跌。換成 token 時依每一處的用途選 `danger`、`success` 或 `price-up`、`price-down`，例如 `StockSearchContent.module.scss` 與 `admin.md` 的人數增減是漲跌，`ToastList.module.scss` 與 `Button.scss` 是錯誤與成功。`MarketIndexSummary.module.scss` 與 `MarketIndexDetails.module.scss` 用 `color.scale()` 把紅綠調深的文字色，改成 `--color-price-up` 與 `--color-price-down`。

`-600` 的顏色用在文字，以及上面放白字的底色；`-500` 的顏色只用在不放文字的地方，例如圖表的線條與長條、框線與淺色底。`blue-500` 在白底上有 3.32:1，符合 WCAG 對非文字元件 3:1 的要求。`-600` 的三個顏色在各種底色上的對比如下：

| 顏色 | `#ffffff` | `slate-50` | `slate-100` | `#d1eeff` | `#feedff` | 白字放在這個顏色上 |
| --- | --- | --- | --- | --- | --- | --- |
| `blue-600` | 5.08 | 4.81 | 4.60 | 4.20 | 4.54 | 5.08 |
| `red-600` | 5.11 | 4.83 | 4.63 | 4.23 | 4.57 | 5.11 |
| `green-600` | 4.50 | 4.26 | 4.08 | 3.72 | 4.02 | 4.50 |

寫死的顏色與既有的透明色依以下規則換成用途色：

- 依屬性選類別：`color` 用文字色，`background` 用背景色，`border` 與 `outline` 用框線色，`box-shadow` 用陰影 token。
- 同類別裡，選放在實際底色上結果最接近的 token。例如框線用的 `$black-transparent-2`（黑色 10%）在白底上接近 `#e6e6e6`，所以換成 `--color-border-default`；`$black-transparent-3`（黑色 5%）換成 `--color-border-subtle` 或 `--color-bg-subtle`。不過元素會疊在不同底色上、需要半透明時，背景用 `--color-bg-hover`。
- 個股詳細頁（`Details.module.scss`）與歡迎頁（`Welcome.module.scss`）自己定義的深色文字（`#202833`、`#1f2933`、`#213044`、`#27313d`）換成 `--color-text-primary`，次要文字（`#6f7c8d`、`#647287`、`#556274`、`#435064`）依用途換成 `--color-text-primary` 或 `--color-text-secondary`，淺色框線（`#e1e9f3` 到 `#e7edf5`）換成 `--color-border-default`，`#f8fbff` 這類淺色背景換成 `--color-bg-page`。
- 圖表：座標軸文字（`#aaa`、`#9aa7b5`、`#566375`）換成 `--color-text-secondary`，格線與座標軸線（`#ddd`、`#dce5ef`、`#e6ebf0`、`#e2e8f0`）換成 `--color-border-default` 或 `--color-border-subtle`，tooltip 的背景與文字（`rgba(255, 255, 255, 0.96)`、`#334155`）換成 `--color-bg-surface` 與 `--color-text-primary`，tooltip 的框線 `#dbe4ef` 換成 `--color-border-default`，輔助線 `#788596` 換成 `--color-text-secondary`。圖表裡 `#4c8bf5`、`#d4493f`、`#1aa260` 與 `rgba(76, 139, 245, …)` 這類線條、長條與填色換成 `--color-chart-accent`、`--color-chart-up`、`--color-chart-down`，藍色的透明色換成透明度最接近的 `--color-chart-accent-soft`、`-faint` 或 `-wash`。後台圖表用 `blueTransparent1` 與 `blueTransparent2` 區分「今天」或「這個月」的長條與其他長條（ADMIN-R7、ADMIN-R11），分別換成 `-soft` 與 `-faint`，維持現在的深淺關係。收益分析頁的資本利得橫條圖現在獲利用藍色、虧損用 `#f44336`，跟 `ui-guidelines.md`「漲跌」紅色代表獲利、綠色代表虧損的規定相反，改成獲利用 `--color-chart-up`、虧損用 `--color-chart-down`，獲利的橫條會從藍色變成紅色。圖表的 tooltip 與標籤裡的漲跌文字用 `--color-price-up` 與 `--color-price-down`，不用 `--color-chart-up` 與 `--color-chart-down`，例如 `StockIntradayLineChart.tsx` 的 tooltip 現在跟線條共用 `RED`、`GREEN` 這兩個常數，要拆開。這個 tooltip 現在用 `fluctPrice > 0 ? RED : GREEN` 決定顏色，所以漲跌是 0 時顯示綠色，違反 `ui-guidelines.md`「漲跌」對 0 用中性色的規定，一起改成 0 時用 `--color-price-flat`。
- `marketIndexChartData.ts` 第 4 行說明座標軸文字為什麼較深的註解，改成依 4:1 的下限說明。
- 實作時依使用者決定修改 `ui-guidelines.md`：計算對比時，淡漸層以白色計算，半透明的背景只以它疊在白色上的顏色計算，不把底下的漸層與捲動的內容算進去；文字本身的顏色不能是半透明的。所以 `--color-bg-hover` 與各個 `-subtle` 這類半透明背景也可以放在漸層上，segmented control 的軌道用 `slate-800` 的 5%（`--color-bg-muted`）。藍色也因此調淺：新增 `blue-550` #3b78df，`--color-text-accent` 與 `--color-bg-accent` 改用它；放在淡藍底這類有色或灰色底上的藍字改用 `--color-text-accent-strong`（`blue-600`）；24px 以上的藍字用 `--color-text-accent-large`（`blue-500`）。次要文字的 `slate-500` 也依使用者要求從 #647287 調淺成 #6a788c，這是在白底、`slate-50`、`slate-100`、5% 的灰底與淡藍底上都還有 4:1 的最淺的灰。
- 浮在捲動內容上的毛玻璃底色維持 `--color-bg-frosted`（白色的 60%）。`--color-bg-frosted-text`（白色的 90%）只用在歡迎頁的 sticky 頁首，取代原本 `color-mix(...)` 的 88%。搜尋框裡使用者輸入的關鍵字是表單欄位的值，算主要文字，從 `$gray` 改成 `--color-text-primary`。
- 深色底放白字的元件（`Tooltip` 的 `.content` 與 `.arrow`、`SpeedDial` 的 `.hint_text`）現在用 `$deep-gray` 當底色，換成 `--color-bg-inverse`，白字在上面大約 13:1；不換成最接近的 `--color-bg-backdrop`，因為那是半透明的遮罩色，白字在上面只有大約 3.3:1。
- `--color-text-warning` 只用在 `--color-bg-warning-subtle` 上（對比大約 6:1）；放在黃色的 `--color-bg-warning` 上的文字用 `--color-text-primary`（對比大約 7.7:1），因為 `--color-text-warning` 在黃色上只有 3.74:1。
- 文字與圖示的深淺只用顏色 token 決定，不在含有文字或圖示的元素上用 `opacity` 讓它們變淡，因為 `opacity` 的實際效果取決於底下的顏色，上面算出來的對比就不成立了。現在用 `opacity` 讓文字或圖示變淡的地方有以下幾處，拿掉 `opacity`，改用對應的顏色 token：
  - 歷史紀錄頁、買賣計畫頁與手續費頁（2 處）沒有資料時的提示（`Records.module.scss`、`Plans.module.scss`、`HandlingFee.module.scss`），現在是 `$gray` 加 `opacity: 0.7`，在白底上實際大約 2.3:1，改成 `--color-text-secondary`。
  - 側欄的提示文字（`MainSideBar.module.scss` 的 `.hint`），現在是 `$blue` 加 `opacity: 0.9`，改成 `--color-text-accent`。
  - 摘要卡片右側的圖示（`SummaryCard.module.scss`），現在是 `$gray` 加 `opacity: 0.6`，改成 `--color-icon-muted`（`slate-400`）。
  - 儀表板裡藍色連結的 hover（`Dashboard.module.scss` 的 `.button`），現在是 `opacity: 0.8`，改成滑鼠移入時把底線加粗，文字維持 `--color-text-accent`。
- 只用來淡化裝飾、skeleton 動畫，或在停用中的元素上蓋一層遮罩的 `opacity` 維持原樣。
- 只有 `styles/tokens/` 可以用 `color.mix()`、`color.scale()`、`color-mix()` 這類函式算出顏色，其他地方一律用 token。現在有幾處為了讓文字讀得清楚，各自把顏色混深，同一個用途因此有好幾種顏色，這些地方改用以下 token：
  - 把 `$deep-gray` 與 `$gray` 依 50%、65%、68%、75% 混成的四種灰（`Dashboard.module.scss` 的 `--dashboard-label-color`、`SegmentedControl.module.scss`、`MarketIndexDetails.module.scss` 的 `$muted`、`MarketIndexSummary.module.scss`），改成 `--color-text-secondary`。這四處現在在白底上是 5.7 到 7.5:1，改了之後是 4.89:1，看起來會變淡。
  - `color.scale($blue, $lightness: -42%)` 調深的藍（`MarketIndexSummary.module.scss` 與 `MarketIndexDetails.module.scss` 的 `$action`），改成 `--color-text-accent`。
  - 歡迎頁用 `color-mix()` 混出的半透明藍與背景，陰影改成 `--shadow-accent`，`outline` 改成 focus ring 的 token，背景改成最接近的背景色 token。

`--color-text-primary`、`--color-text-secondary`、`--color-text-tertiary` 對應 `ui-guidelines.md`「文字對比」的主要、次要、提示三種用途，元件依這段資訊在畫面上的重要程度選用。次要文字 `#6a788c` 在各種底色上的對比如下，最低 4.06:1，所以在每一種尺寸都符合次要文字的下限。窄版的淡漸層依 `ui-guidelines.md` 以白色計算。用到 `--color-text-secondary` 的元素如果放在其他底色上，實作時要另外檢查：

| 底色 | 對比 |
| --- | --- |
| `#ffffff` | 4.48 |
| `#f6f9fc`（`slate-50`） | 4.24 |
| `#f1f4f8`（`slate-100`） | 4.06 |

提示文字的下限是 2:1。`--color-text-tertiary`（`#9aa5b4`）在白底上是 2.50，在停用中按鈕的底色 `slate-100` 上是 2.26，在窄版漸層的頂端是 2.07。停用中按鈕的文字與輸入框的 placeholder 現在分別是 `#ddd` 放在 `#f5f5f5` 上（大約 1.2:1）與 `#ddd` 放在白底上（大約 1.4:1），照 `ui-guidelines.md`「文字對比」的例子算提示，改成 `--color-text-tertiary`。實作時逐一確認每個 placeholder 都有標籤、圖示、視窗標題或段落標題說明用途，例如記帳編輯器的股票欄位有「股票」或「買賣與股票」這類段落標題；沒有的話，那個 placeholder 算次要文字，用 `--color-text-secondary`。停用中的元素上蓋的遮罩，要跟遮罩下的文字一起算對比。帳號綁定頁用停用中的 `LabeledInputV2` 顯示已綁定的 Email，上面再蓋 50% 的白色遮罩，實際只有大約 2.9:1；實作時改成不用停用中的輸入框顯示 Email，拿掉遮罩，改成文字。使用者決定這一頁的主要目的是改綁，Email 在設定頁已經清楚顯示，所以這一頁的 Email 算提示文字，用 `--color-text-tertiary`，並從 `ui-guidelines.md` 主要文字的例子拿掉「已綁定的 Email」。

### 字級、字重、行高與字距

- 字級用 rem，讓使用者在瀏覽器調大字級時跟著放大。原始的 scale 是 11、12、14、16、18、20、24、28、32、40、48px（換成 rem），沒有 13px，標題與重要數字另外用 `clamp()` 定義隨視窗寬度變化的字級，見下面「表格以外的字級」那一點。
- 依 `ui-guidelines.md` 的「字級與顏色」表格定義用途字級，在 `:root` 依 `lg`（960px）改寫窄版的值，不改 `html` 的字級，以免蓋掉使用者在瀏覽器設定的字級：`--font-size-body`（16px）、`--font-size-button`（寬版 16px、窄版 14px）、`--font-size-data`（14px）、`--font-size-caption`（寬版 12px、窄版 11px）、`--font-size-nav-sidebar`（14px）、`--font-size-nav-bar`（11px）、`--font-size-chart-tick`（11px）。`--font-size-nav-sidebar` 與 `--font-size-nav-bar` 不依寬度改寫，所以在「平板寬度的導覽」完成之前，窄版畫面上出現的側欄與寬版畫面上出現的底部導覽列，仍分別用 14px 與 11px；`ui-guidelines.md` 依使用者決定在這兩格寫「無」，等導覽改成依寬度切換之後才不會出現這兩種情況。窄版的表單輸入維持 16px，因為 iOS 的 Safari 在輸入框的字小於 16px 時，會在使用者點進去時自動放大頁面。搜尋框也算表單輸入，例如市場頁的搜尋框（`Market.module.scss` 的 `.search_box input`）現在寫死 14px，改成 `--font-size-body`。表格沒有列到的用途直接用原始的 scale。元素屬於表格的某一列時，用這一列的用途字級，不用下面「換成最接近的值」的規則。例如視窗、編輯頁與表單底部那一排操作按鈕都是 `Button` 的 `.l` 尺寸，包括頭像與名字頁、刪除帳號頁放在 `Form` footer 的按鈕，包括 `primary_fill l` 的送出與 `transparent l` 的取消，`.l` 現在是 14.4px，這一排的按鈕照用途字級改成寬版 16px、窄版 14px，同一排的按鈕一樣大。`.l` 也用在不屬於這一排的按鈕，例如登入頁的 Google 登入、找不到頁面的回首頁、帳號綁定頁、付款頁的方案選項與重新載入、`DestructiveActionSection`，這些按鈕的字級不隨寬度切換，照「換成最接近的值」改成 14px。所以不是直接改 `.l` 這個 class，而是讓這一排按鈕的容器（例如 `FormPageShell`、`Modal`、`BottomSheet` 與 `Form` 底部的按鈕列）或 `Button` 的一個 variant 讀 `--font-size-button`；`.xs` 用在日期與輔助文字時改成 `--font-size-caption`。
- 表格以外的字級在每個寬度都一樣，所以元件在 media query 裡縮小或放大字級的寫法都拿掉，改用寬版的字級。標題與頁面最重要的數字例外，用 `clamp()` 定義的字級隨寬度縮放：歡迎頁的大標題用 `--font-size-display-title`，頁面標題用 `--font-size-page-title`，儀表板的投入金額（現在是 `2.9lvw`、512px 以下 `8lvw`）與大盤指數頁的指數（現在是 `clamp(1.625rem, 1.15rem + 1.4vw, 2.25rem)`）用 `--font-size-display-number`。這些 token 的 `clamp()` 上下限用 rem，讓使用者放大文字時，標題與重要數字跟其他文字一樣變大；值讓預設字級下 320px、390px 與 1280px 寬時的大小跟現在接近，320px 寬時大金額也不會撐出橫向捲動。現在在 780px 以下縮小的其他字，改成寬版的字級之後會變大，實作時要特別檢查 320px 寬的畫面有沒有橫向捲動。
- 圖表在 TypeScript 裡的字級也從 `styles/tokens.ts` 讀取。前台圖表的座標軸刻度用 `--font-size-chart-tick`，包括現在沒有設定 `fontSize`、用 ECharts 預設值的 `HistoricalPriceLineChart.tsx`、`SimpleCashInvestedLineChart.tsx`、`TradeVolumeBarChart.tsx`；tooltip 的字級固定用 scale 上的 12px，不用 `--font-size-caption`，因為 tooltip 的內容是時間、價格與漲跌這些資料，不屬於隨寬度切換的那幾列。後台圖表的刻度字級在 `pages/Admin/` 另外定義，值同樣是 11px，因為 `ui-guidelines.md` 規定前台的字級不能直接套到後台。後台用到的共用元件（例如 `Button`、`Tooltip`、`SegmentedControl`）會讀前台的用途字級 token，而這些 token 在 960px 切換；後台沒有窄版的字級，所以在後台最外層的元素上把這些 token 固定成寬版的值，不隨寬度切換，避免後台在 780 到 959px 時出現寬版版面配上窄版字級。`ToastList` 用 `createPortal` render 在後台的元素樹之外，所以後台顯示的 toast 也要套用同樣的固定，例如在後台頁面開啟時替 `body` 加上一個 class。
- `$base-font-size` 的倍數、px 與 rem 寫的其他字級，都換成 scale 上最接近的值，例如 `0.9 * $base-font-size`（14.4px）換成 14px，`1.3 * $base-font-size`（20.8px）換成 20px。後台現在的字級（10、12、14、16、20、28px）也換成同一組 scale。
- 字重：`--font-weight-regular` 400、`--font-weight-medium` 500、`--font-weight-semibold` 600、`--font-weight-bold` 700。`bold` 換成 700，`normal` 換成 400，650 照落在兩階正中間時往上取的規則換成 700，750 以上換成 700。`DollarSign` 與 `PercentSign` 的 300 換成 400，配上 `--color-text-secondary`。瀏覽器的預設樣式把 `<strong>` 與 `<b>` 設成 `font-weight: bolder`，放在 600 或 700 的元素裡會算成 900，所以全域樣式把這兩個元素明確設成 700。
- 行高：`--line-height-tight` 1.2、`--line-height-snug` 1.4、`--line-height-normal` 1.5、`--line-height-relaxed` 1.7。用 px 寫的行高依字級換算成比例，再換成最接近的 token。
- 字距：`--letter-spacing-base` 1px，從 `*` 改成設在 `body`，讓子元素繼承。`button`、`input`、`select`、`textarea` 的瀏覽器預設樣式會把字距設成 `normal`，所以全域樣式把這四種元素的 `font` 與 `letter-spacing` 設成 `inherit`。`Button` 沒有加尺寸 class 時，現在用的是瀏覽器預設的 13.33px，改成 `inherit` 之後會變成父元素的字級，所以 `Button` 的預設樣式另外設成 14px，維持現在的大小。歡迎頁在 `*` 上把字距設回 0 的寫法改成只設在頁面最外層。

### 間距與圓角

- 間距以 4px 為基準：`--space-025` 2px、`--space-050` 4px、`--space-075` 6px、`--space-100` 8px、`--space-150` 12px、`--space-200` 16px、`--space-250` 20px、`--space-300` 24px、`--space-400` 32px、`--space-500` 40px、`--space-600` 48px、`--space-800` 64px、`--space-1000` 80px。名稱的數字是 8px 的百分比，之後要在兩個值中間加一階時不用改名。
- 圓角：`--radius-xs` 4px、`--radius-sm` 6px、`--radius-md` 8px、`--radius-lg` 12px、`--radius-xl` 16px、`--radius-2xl` 20px、`--radius-pill` 999px、`--radius-circle` 50%。`100px` 與大於等於元素高度一半的圓角換成 `--radius-pill`。
- 不在 scale 上的值換成最接近的一階，例如 15px 換成 16px，26px 換成 24px。落在兩階正中間的值往上取，例如 10px 換成 12px，14px 換成 16px，5px 換成 6px，3px 換成 4px，28px 換成 32px。字級也用同樣的規則，例如 13px 換成 14px。
- 1px 的位移與 0 維持原樣。大於 80px 的值是版面尺寸，不算間距，改成用 layout token 與 `calc()` 算出來，例如底部導覽列的高度加上間距。

### 陰影、動畫與疊放層級

- 陰影的顏色改用偏藍的深色 `#26394d`（個股詳細頁已經在用），分成 `--shadow-sm`（`0 2px 8px`，8%）、`--shadow-md`（`0 8px 20px`，9%）、`--shadow-lg`（`0 12px 30px`，12%）、`--shadow-xl`（`0 24px 70px`，11%），歡迎頁主要按鈕的藍色陰影寫成 `--shadow-accent`（`0 14px 34px`，`blue-500` 的 32%）。現有的 35 種陰影依大小換成最接近的一階。
- Focus ring 改成 `outline`：`--focus-ring-width` 2px、`--focus-ring-offset` 2px、`--color-focus-ring` `blue-600`（白底上 5.08:1）、`--color-focus-ring-inverse` `white`，用 `outline: var(--focus-ring-width) solid var(--color-focus-ring)` 與 `outline-offset: var(--focus-ring-offset)` 顯示，取代原本用 `box-shadow` 疊出來、外圈只有 `blue-500` 10% 的 `--focus-ring`。`Button.scss`、`SegmentedControl`、`BottomSheet`、`MarketIndexSummary`、`LabeledInput`、`RecordEditor`、`MainSideBar` 這些各自寫 focus 樣式的地方都改用這三個 token；元素本身放在藍、紅、綠這類有色底上時（例如 toast 裡的關閉按鈕，toast 的底色是 `--color-bg-danger` 或 `--color-bg-success`），`blue-600` 的 outline 在 `red-600`、`green-600` 上只有大約 1.01:1，所以改用白色的 `--color-focus-ring-inverse`（白色在這三種底色上都超過 5:1）。實作時逐一檢查放在有色底上的可聚焦元素。元素在會裁切內容的容器裡、外移的 outline 會被裁掉時，處理方式依元素的底色決定：淺色底的元素把 `outline-offset` 改成負值，畫在元素內側；藍、紅、綠這類有色底的元素不畫在內側，因為內側的 `blue-600` outline 在 `blue-600` 的按鈕上對比是 1:1，改成讓容器加上足夠的內距，outline 畫在外側也不會被裁掉。現在會遇到的容器是 `FormPageShell`（`overflow: hidden`）與 `Modal` 的內容區（`overflow: auto`），裡面有手續費折讓編輯器、升級方案視窗的主要按鈕，以及刪除確認視窗的紅色按鈕。
- 動畫時間：`--duration-fast` 150ms（取代 100 到 160ms）、`--duration-base` 200ms（取代 180 到 250ms）、`--duration-slow` 300ms（取代 260 到 420ms）。480ms 以上的動畫（載入畫面、skeleton、歡迎頁的進場動畫）留在各自的元件裡，寫成元件裡的 Sass 變數。Easing：`--ease-standard` 是 `ease`，`--ease-out` 是 `cubic-bezier(0.22, 1, 0.36, 1)`（取代 `ease-out` 與 `cubic-bezier(0.2, 0.8, 0.2, 1)`），`--ease-in-out` 是 `ease-in-out`。`linear` 照用。
- 疊放層級：會蓋在其他頁面內容上的元素（頁首、頁尾、側欄、加號選單、bottom sheet、modal、toast、載入畫面、tooltip），依用途定義 `--z-*` token。實作時先列出這些元素現在的 z-index，token 的值要讓會互相重疊的元素維持現在的上下順序；現在數值相同、靠 DOM 順序決定上下的元素（例如 toast 與 modal 都是 6），換成 token 之後也要維持現在的結果。只在元件內部排列子元素的 z-index（0 到 3）維持數字。

### 版面尺寸與斷點

- 全域的 layout token：`--layout-header-height` 65px、`--layout-footer-height` 65px、`--layout-sidebar-width` 230px、`--layout-sidebar-collapsed-width` 64px。頁首與頁尾的高度，以及用這兩個高度算出來的位移，換成 rem（65px 是 4.0625rem），讓使用者調大瀏覽器的預設字級時，頁首與頁尾跟著字變高，文字不會被裁掉。瀏覽器預設字級是 16px 時，這兩個高度仍是 65px。使用者放大文字時，頁首與頁尾各自的高度不超過可用高度的四分之一，例如寫成 `min(4.0625rem, 25dvh)`，讓兩者合計不超過一半，手機橫放（844 × 360）時內容仍有一半的高度。側欄寬度維持 px，`desktop-sidebar.md` 的 230px 與 64px 不受影響。
- 搬到 `pages/Admin/` 的尺寸：後台側欄 216px 與收合時的 64px、內容寬度 1440px 與 480px、表格最大高度 440px、圖表高度 280px 與 180px、圖表標籤的最小寬度 480px、長篇文字的行寬 68ch。
- 斷點：`sm` 512px、`md` 780px、`lg` 960px、`xl` 1024px、`2xl` 1280px，名稱的值就是切換點，所以原本 `$width-512: 511px` 這種名稱與值差 1px 的寫法不再需要。`ds.down(md)` 輸出 `@media (width < 780px)`，`ds.up(md)` 輸出 `@media (width >= 780px)`。直接寫 `960px` 的 media query、`_.$width-780 + 1px` 的寫法與元件自己定義的 `$narrow` 都改用這兩個 mixin。
- TypeScript 裡的 media query 也從 `styles/tokens.ts` 讀斷點，透過同一個 helper 產生 `(width < Npx)` 與 `(width >= Npx)`，讓 TypeScript 與 SCSS 在同一個像素切換。例如 `utils/mediaQuery.ts` 的 `NARROW_LAYOUT_QUERY` 現在是 `(max-width: 959px)`，斷點的值改成 960px 之後如果還用 `max-width`，在剛好 960px 時就會跟 SCSS 不一致。`Main.tsx`、`MainSideBar.tsx`、`Settings.tsx` 裡直接寫的 `(min-width: 960px)`、`(max-width: 779px)`、`(min-width: 780px)` 也改用這個 helper，切換點維持現在的值。
- 不在斷點 scale 上的 media query 與 container query，例如 `Market.module.scss` 的 `(min-width: 779px)` 與 `359px`、`Welcome.module.scss` 的 `1025px`、`MarketIndexDetails.module.scss` 的 `960px <= width <= 1160px`、`Dashboard.module.scss` 的 `@container (max-width: 1200px)`、`SpeedDial.module.scss` 的 `max-height: 450px`，逐一判斷：意思跟某個斷點相同、只差 1px 的，改用 mixin；其他的寫成元件裡的 Sass 變數，照 Stylelint 一節的規則用註解寫明理由。
- `page-header-title-size` 這個 mixin 現在在 512px 以下把頁面標題從 20px 縮成 17.6px，改成 `--font-size-page-title`，用 `clamp()` 讓 1280px 寬時是 20px、390px 寬時接近 17.6px，拿掉 mixin 裡的 media query。

### Stylelint

- 依 `README.md` 的「Dependency Management」加入 stylelint、`stylelint-config-standard-scss` 與 `stylelint-declaration-strict-value`，設定檔放在 `frontend/`。
- 在 `frontend/src/styles/` 以外，禁止 `color`、`background`、`border`、`outline`、`fill`、`stroke`、`box-shadow` 使用寫死的顏色，禁止 `z-index` 使用大於 3 的數字，禁止 `transition` 與 `animation` 使用 480ms 以下寫死的時間，禁止 `font-size`、`font-weight`、`line-height`、`border-radius` 不用 token，禁止 `margin`、`padding`、`gap` 使用 0 與 1px 以外的寫死值。字級、字重、行高、圓角與間距這些屬性接受元件自己定義的 Sass 變數，讓元件在有理由時使用不在 scale 上的值；顏色相關的屬性不接受 Sass 變數，只接受 `var(--color-…)` 這類 token，需要新的顏色時新增一個用途 token。每個這樣的變數上一行要寫註解，說明為什麼不用 scale 上的值，例如要跟某個固定尺寸的圖片對齊。Code review 時檢查這個理由，沒有理由的變數改用 token。
- 檢查每個 `var(--…)` 都有在 `styles/` 定義，例如用 `stylelint-value-no-unknown-custom-properties`。
- 在 `frontend/src/styles/tokens/` 以外，用 `function-disallowed-list` 禁止 `color.mix`、`color.scale`、`color.adjust`、`color-mix`、`rgba` 與 `hsla`，因為 `stylelint-declaration-strict-value` 預設會略過函式，混出來的顏色不會被前一條規則擋下。
- `scripts/dev/test.sh` 與 CI 的前端 job 在跑測試之前執行 stylelint，有違規時失敗。

### 要一起更新的文件與工具

- `ui-guidelines.md` 的「Design Token、共用元件與圖示」有兩項要改：
  - 以「沿用系統字型」開頭的那一項，`font-family` 的來源從 `frontend/src/index.scss` 改成 `frontend/src/styles/tokens/_typography.scss`。
  - 以「色票、斷點與共用版面尺寸以」開頭的那一項，token 的來源改成 `frontend/src/styles/`，並寫明只有一個畫面用到的值留在那個畫面。新的寫法是「**預設**：顏色一律以 `frontend/src/styles/` 的用途 token 為來源，不直接使用原始色，也不在元件裡另外定義顏色。多個畫面共用的字級、間距、圓角、陰影、動畫、疊放層級、版面尺寸與斷點也以 `frontend/src/styles/` 的 token 為來源。只有一個畫面或元件用到的尺寸與動畫，寫在那個畫面或元件自己的檔案；只有後台用到的值，寫在 `frontend/src/pages/Admin/`。字級、間距與圓角使用 scale 上的值，有理由使用其他值時，寫成元件裡的 Sass 變數並以註解說明理由。」
- `architecture.md` 的「前端」新增「Design Token」一節，寫入上面「併入」指向這一節的決策與理由，以及 `styles/` 的結構、`ds` namespace 與 stylelint 擋下的寫法。
- `ui-guidelines.md` 的「文字對比」：在表格後面寫入「文字對比的規範」這個決策的設計理由；「字級與顏色」：在字級表後面寫入「字級要不要隨寬度切換」的設計理由。
- `.agents/skills/product-designer/SKILL.md`、`.agents/skills/product-designer/scripts/build-draft-css.mjs`、`design/shared/README.md`：改成從 `frontend/src/styles/` 讀 token，設計稿裡的顏色寫成用途 token（例如 `var(--color-text-secondary)`），字級寫成字級 token，不再用 `var(--base-font-size)` 的倍數。改完重新產生 `design/shared/components.css`。
- `.agents/skills/sdd/SKILL.md` 的 code review 檢查項目裡提到 `frontend/src/_design_system.scss` 的地方，改成 `frontend/src/styles/`。

### 驗證

- 搬檔案、改名、改用 `loadPaths` 與 `ds`、拆用途 token、改用斷點 mixin（輸出成跟原本相同的 `max-width`）、搬後台的尺寸、合併給 TypeScript 的 token 這些修改不改變任何值，做完時 `vite build` 輸出的 CSS 要跟 `main` 完全相同，CSS Modules 的 class name 也不能變。
- 會改變輸出的修改做完之後，截圖比對主要頁面的寬版與窄版。
- 另外檢查以下幾點，不符合的地方在這個分支修正：
  - 每個頁面在 320px 寬時，頁面本身沒有橫向捲動。
  - 主要按鈕與觸控環境的圖示操作，可點擊範圍至少 44×44px。
  - 把文字放大到 200% 時，手機橫放（844 × 360）的頁首與頁尾合計不超過可用高度的一半，頁面標題與底部導覽列的文字沒有被裁掉，操作仍可使用。
  - 視窗寬度是 959px 與 960px 時，操作按鈕的字級與記帳編輯器的窄版或寬版版面一起切換。
  - 把瀏覽器的預設字級調成 20px 時，頁面標題、歡迎頁的大標題與儀表板的投入金額跟其他文字一樣變大。
  - 把瀏覽器的預設字級調成 20px 時，頁首、頁尾、側欄與按鈕的文字沒有被裁掉，操作仍可使用。
- 依 `tests/manual/` 重跑跟畫面尺寸有關的手動檢查，至少包括 MKT-R14.3（390 × 700 時不用捲動就看得到兩組數值與圖表）、MKT-R14.4（320 × 568 或文字放大到 200% 時沒有橫向捲動）與 MKT-R14.11（844 × 360 時操作加號選單），因為間距往上取、字級變大與頁首頁尾改用 rem 都會讓頁面變高。沒通過的情境在這個分支修正，不改 spec。這個檢查要在實作初期先做一次，因為窄版只能透過用途 token 與 `clamp()` 縮小文字；如果只調整間距與排列仍然通不過 MKT-R14.3，停下來問使用者，不要在元件裡另外縮小文字。
- 這個分支會改到幾乎所有 SCSS 檔，所以實作期間其他前端工作，包括 roadmap 上的「前端全面改用 Function Component」，要等這個 PR 合併之後再開始。

## 驗證方式

無。這個 plan 沒有新增或修改情境，使用者看到的行為不變，畫面上的差異在實作的第 6 步由使用者逐頁確認。

## 還沒定案的問題

無
