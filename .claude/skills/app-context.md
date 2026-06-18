# Taigu Product & Technical Blueprint

This file serves as the definitive reference for AI agents to instantly align with Taigu's product vision, system architecture, database design, and codebase topography.

## 1. Product Identity & Domain

* **Core Purpose**: A Traditional Chinese, Taiwan-focused stock investment journaling, dividend tracking, and portfolio analysis platform. An elegant, mobile-first alternative to clunky Excel spreadsheets.
* **Tagline**: "專為台股設計，你的專業記帳幫手"
* **Target Audience**: Taiwan stock retail investors (from beginners/students to active traders) who value visual clarity, privacy, and speed.
* **Freemium Model**: Free tier has rigid monthly record and watch quotas + throttled market data (10 min). Standard tier unlocks unlimited tracking, 30s real-time data, and is sold via ECPay subscription. New users get a 31-day trial of Standard.

## 2. Codebase Topography (Feature-to-File Map)

Any feature change should map directly to these routes, frontend pages, and backend applications:

| Feature/Page | URL Route | Frontend Page Component | Backend App |
| :--- | :--- | :--- | :--- |
| **Dashboard (儀表板)** | `/` | `frontend/src/pages/Main/Dashboard/Dashboard.tsx` | N/A (Aggregated statistics) |
| **Market List (市場)** | `/market` | `frontend/src/pages/Main/Market/Market.tsx` | `api-server/main/market/` |
| **Stock Detail (詳情)** | `/market/:sid` | `frontend/src/pages/Main/Details/Details.tsx` | `api-server/main/stock_memo/` |
| **History (歷史紀錄)** | `/records` | `frontend/src/pages/Main/Records/Records.tsx` | `api-server/main/trade_record/`, `api-server/main/cash_dividend/` |
| **Trade Plans (買賣計畫)** | `/plans` | `frontend/src/pages/Main/Plans/Plans.tsx` | `api-server/main/trade_plan/` |
| **Earning Analysis (收益分析)** | `/earning-analysis` | `frontend/src/pages/Main/EarningAnalysis/EarningAnalysis.tsx` | N/A (Frontend calculations) |
| **Handling Fee (手續費)** | `/handling-fee` | `frontend/src/pages/Main/HandlingFee/HandlingFee.tsx` | `api-server/main/handling_fee/` |
| **Billing (付款與方案)** | `/settings/current-plan` | `frontend/src/pages/Settings/CurrentPlan/CurrentPlan.tsx` | `api-server/main/billing/` |
| **Support (問題回報)** | `/settings/issue-report` | `frontend/src/pages/Settings/IssueReport/IssueReport.tsx` | `api-server/main/issue_report/` |

## 3. Core Business & Domain Logic

Keep these system-level constraints invariant across all implementations:

* **Holding Calculation**: A user "holds" a stock if the sum of all their `TradeRecord.deal_quantity` for that stock (`company_id`) is strictly greater than `0`.
* **Buy vs. Sell Semantics**: Buy records are represented by positive quantities (`deal_quantity > 0`). Sell records are negative (`deal_quantity < 0`).
* **The Central Identifier (`sid`)**: Stock identifiers are strings representing Taiwan stock codes (e.g. `"2330"`, `"0050"`). In database tables, this maps to `company_id`.
* **Quota Enforcement**: Free tier users cannot exceed limits. Verify limits in backend entitlements (`api-server/main/billing/services/entitlements.py`) before executing mutations.

## 4. Technical Architecture & Data Flow

* **Authentication**: Google OAuth. Frontend and API use HTTP-only JWT cookies and CSRF tokens for stateless session tracking.
* **State & Fetching**: Global states live in Redux Toolkit (Slices). Critical user portfolios and market index states are initialized concurrently inside `Main.tsx` (`componentDidMount`).
* **Offline / PWA**: App shell, static assets, and safe GET requests are cached using Workbox (Stale-While-Revalidate). Crucially: **No offline CRUD or conflict resolution is supported**; mutations must proceed online via the backend.
* **Payment System**: ECPay integration handles standard card transactions and background automatic recurring billing.

## 5. Relational Data Blueprint

* **Identity & Authentication**:
  * `User`: Main user identity (UUID, Google OAuth details).
  * `RefreshToken`: Hashed OAuth/JWT refresh tokens for secure session rotation.
* **Reference Data**:
  * `Company`: Stock profile metadata.
  * `StockInfo`: Real-time stock price and trading volume.
  * `History`: Historical stock prices (Daily, Weekly, Monthly).
  * `StockPricePerMinute`: Individual stock intraday per-minute price logs (used for intraday details).
  * `MarketIndexPerMinute`: TSE/OTC index per-minute real-time price logs.
  * `MarketIndexHistory`: Historical daily close prices for TSE/OTC indexes.
  * `MaterialFact`: Critical corporate actions/disclosures from companies.
* **Transactional & Operational Data**:
  * `TradeRecord`: User buy/sell stock transactions.
  * `CashDividendRecord`: Cash dividend income logs.
  * `StockMemo`: User-configured notes and memo details per stock.
  * `TradePlan`: User target trade pricing plans.
  * `Favorite`: Watchlist stock associations.
  * `HandlingFeeDiscountRecord`: User brokerage discount percentage tiers.
  * `BillingProfile`: Active subscription plan, expiration, and status.
  * `SubscriptionPayment`: Logs for payments and subscription invoices.
  * `IssueReport`: User-submitted support and feedback (max 5000 characters).
  * `DataChangeLog`: Tracks revision logs (UPSERT/DELETE) of user mutations (e.g., TradeRecord) to enable differential API syncing.

## 6. UX & Copy Constraints (The Brand DNA)

* **Language**: Standard Traditional Chinese (zh-TW).
* **Tone**: Practical, clean, friendly, precise, and devoid of marketing hype. Avoid terms suggesting investment advice.
* **Palette**: Blue (`#4c8bf5`), Red (`#d4493f` for positive/up), Green (`#1aa260` for negative/down), Yellow (`#fbbc05`), Deep Gray (`#444`).
* **Feedback**: Any long process must show a loading state/skeleton. Destructive actions must prompt a confirmation.
