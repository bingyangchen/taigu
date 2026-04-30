# Taigu App Context

Use this file as the shared source of truth before making product, design, architecture, API, or database decisions.

## What This App Does

Taigu is a Traditional Chinese, Taiwan-focused stock investment journaling and portfolio tracking app. It helps users record Taiwan stock trades and cash dividends, monitor holdings and favorites, view real-time market information, and understand investment performance through charts.

The product positions itself as "專為台股設計，你的專業記帳幫手" and as an alternative to tracking investment performance in Excel.

## Core Experience

- **Dashboard**: Shows TSE and OTC index movement, invested cash, portfolio market value, annualized return, realized gains, and accumulated handling fees.
- **Market**: Tracks current holdings and favorite stocks, with stock detail pages for price history, inventory distribution, company information, material facts, notes, and related records.
- **Records**: Lets users create, edit, delete, search, and export trade records and cash dividend records.
- **Trade plans**: Lets users save target buy or sell plans and sorts them by distance from current price when market data is available.
- **Earning analysis**: Breaks down capital gains and cash dividends by stock.
- **Handling fee analysis**: Tracks accumulated handling fees and discount records.
- **Settings**: Covers profile information, Google account binding, data controls, legal pages, and account-related surfaces.

## Product Characteristics

- The primary audience is Taiwan stock investors, including students and office workers who want a cleaner alternative to spreadsheets.
- The app is mobile-first and installable as a PWA, but also supports desktop layouts with sidebars.
- The language and market context are zh-TW by default; use Taiwan stock terms such as 台股, 證券代號, 交易紀錄, 現金股利, 持股, 最愛, 買賣計畫, and 手續費.
- The app supports cross-device continuity through server-side accounts, not through a local-first sync architecture.
- Real-time information matters, but the app is primarily a journaling and analysis tool, not a trading execution platform.

## Technical Context

- Frontend: React 18, TypeScript, React Router, Redux Toolkit, Sass, ECharts, and Workbox service worker.
- Backend: Django 5 API server with PostgreSQL for persistent data and Redis for cache.
- Auth: Google OAuth creates or binds users; the API uses an HTTP-only JWT auth cookie plus CSRF protection.
- Data ownership: User-created records are scoped by authenticated user. Stock market reference data is shared.
- Runtime architecture: production uses Cloudflare Pages for the frontend and an AWS EC2 stack for API server, PostgreSQL, Redis, Nginx reverse proxy, and scheduler.
- Scheduler: background jobs refresh real-time stock information during Taiwan market hours, store daily history, update company lists, and fetch material facts.
- PWA caching: the service worker precaches the app shell, caches static assets, and stale-while-revalidates selected GET API responses. Mutations still go through the backend; do not assume offline CRUD, conflict resolution, or local-first sync.

## Data Model

- Account data centers on `User`, identified by UUID and tied to Google OAuth identity.
- Market reference data includes `Company`, `StockInfo`, `History`, `MarketIndexPerMinute`, and `MaterialFact`.
- User investment data includes `TradeRecord`, `CashDividendRecord`, `StockMemo`, `TradePlan`, `Favorite`, and `HandlingFeeDiscountRecord`.
- Trade quantities use sign to distinguish buy and sell records: positive means buy, negative means sell.
- Stock IDs (`sid`) are central across API payloads, routing, search, records, holdings, favorites, and charts.

## Design Style Direction

- The visual tone is clean, modern, data-focused, and friendly rather than brokerage-like or overly financial.
- The design uses clear cards, floating pill tabs, sidebars or bottom navigation, modal-based creation/editing, and chart-heavy summaries.
- Brand colors include blue `#4c8bf5`, red `#d4493f`, green `#1aa260`, yellow `#fbbc05`, deep gray `#444`, and light PWA theme blue `#d1eeff`.
- Red and green are used for market movement and buy/sell semantics; preserve the app's existing convention when extending UI.
- Favor clarity and smoothness: "介面簡潔乾淨", "圖表一目了然", and "操作流暢直覺" are explicit product promises.

## UX Principles

- Make adding trade records, cash dividends, and trade plans fast because these are the core recurring actions.
- Keep investment performance legible at a glance; charts should answer practical portfolio questions, not just look decorative.
- Preserve user trust around financial records: destructive actions need confirmation, exports should be predictable, and errors should be clear.
- Design empty states that help users take the next action, especially before they have trade records, holdings, favorites, plans, gains, or dividends.
- Treat mobile PWA interactions as first-class: bottom navigation, speed dial actions, full-screen modals, touch gestures, and install prompts matter.

## Copy Tone

- Default to Traditional Chinese unless the user asks otherwise.
- Be concise, practical, and encouraging; avoid exaggerated investment promises or language that sounds like financial advice.
- Use action-oriented labels that match existing product copy, such as 新增交易紀錄, 新增現金股利, 新增買賣計畫, 匯出所有交易紀錄, and 顯示更多.
- Security and privacy copy should be reassuring but specific; the product stores sensitive investment records and authenticates through Google.
