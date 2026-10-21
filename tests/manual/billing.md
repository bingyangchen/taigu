每一節開始之前，先完成這些準備：

1. 執行 `make start`。
2. 用一個專門用來測試的 Google 帳號，在桌面瀏覽器的 Chrome 登入 `https://local.taigu.tw`。下面的指令會刪除這個帳號的交易紀錄、現金股利紀錄、買賣計畫、自選股與付款紀錄，所以不要用平常記帳的帳號。
3. 在 repo 的根目錄執行各節的指令，並把指令裡的 `<email>` 換成這個 Google 帳號的 email。
4. 每次執行指令之後，重新整理瀏覽器的頁面，Taigu 才會載入新的資料。

各節用到下面這些說法：

- 「方案頁」指 `https://local.taigu.tw/settings/current-plan`。
- 「新增交易紀錄」指點左側選單的「新增」，再點「新增交易紀錄」；在編輯器的「搜尋證券代號或名稱」輸入那一節指定的股票代號（沒有指定時用 2330）並選擇這檔股票，「成交單價」填 100，「成交股數」填 1000，最後點「送出」。
- 「新增買賣計畫」指點左側選單的「新增」，再點「新增買賣計畫」；在編輯器選擇 2330，「目標價格」填 100，「目標股數」填 1000，最後點「送出」。
- 「升級提示視窗」指額度擋下新增時出現、有「查看 Standard 方案」按鈕的視窗；「關閉升級提示視窗」指點這個視窗右上角的關閉按鈕。
- 「從方案頁前往綠界」指在方案頁的「方案選擇」區塊點那一節指定的付款週期，在「確認訂閱 Standard」視窗點「前往綠界付款」，等瀏覽器換到綠界的付款頁之後，按瀏覽器的「上一頁」回到方案頁，不在綠界付款。

「設定訂閱狀態」指令會刪除這個帳號的付款紀錄，再把訂閱設成 `STATE` 指定的狀態：`'trialing'` 是試用中，試用期還剩 31 天；`'active'` 是月繳的自動續訂中，本期還剩 20 天；`'stopped'` 是月繳的已停止自動續訂，本期還剩 20 天；`'past_due'` 是扣款失敗，本期在 2 天前結束；`'free'` 是 Free，試用期在 9 天前結束，沒有訂閱過。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
EMAIL = '<email>'
STATE = 'free'
from datetime import timedelta
from django.utils import timezone
from main.billing.models import BillingProfile, SubscriptionPayment
now = timezone.now()
day = timedelta(days=1)
SubscriptionPayment.objects.filter(user__email=EMAIL).delete()
values = {
    'trialing': dict(plan='standard', subscription_status='trialing', trial_ends_at=now + 31 * day, current_period_started_at=None, current_period_ends_at=None, cancel_at_period_end=False),
    'active': dict(plan='standard', subscription_status='active', trial_ends_at=now - 9 * day, current_period_started_at=now - 10 * day, current_period_ends_at=now + 20 * day, cancel_at_period_end=False),
    'stopped': dict(plan='standard', subscription_status='active', trial_ends_at=now - 9 * day, current_period_started_at=now - 10 * day, current_period_ends_at=now + 20 * day, cancel_at_period_end=True),
    'past_due': dict(plan='standard', subscription_status='past_due', trial_ends_at=now - 9 * day, current_period_started_at=now - 32 * day, current_period_ends_at=now - 2 * day, cancel_at_period_end=False),
    'free': dict(plan='free', subscription_status='canceled', trial_ends_at=now - 9 * day, current_period_started_at=None, current_period_ends_at=None, cancel_at_period_end=False),
}[STATE]
BillingProfile.objects.filter(user__email=EMAIL).update(billing_interval='month', trial_started_at=values['trial_ends_at'] - 31 * day, **values)
"
```

「準備資料」指令會先刪除這個帳號的交易紀錄、現金股利紀錄、買賣計畫與自選股，再依開頭的數字建立資料。`HOLDINGS` 是上個月買進的持股檔數，依序是 2330、2317、2454、2412、2882、2881、1301、1303、2002、2308；`TRADE_RECORDS` 是本月新增、買進 1 張 2330 的交易紀錄筆數；`CASH_DIVIDENDS` 與 `TRADE_PLANS` 是本月新增的 2330 現金股利紀錄與買賣計畫筆數；`FAVORITES` 是自選股檔數，依序是 2330、2317、2454、2412、2882、2881、1301、1303、2002、2308、2603、0050。各節沒有提到的數字設成 0。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
EMAIL = '<email>'
HOLDINGS = 0
TRADE_RECORDS = 0
CASH_DIVIDENDS = 0
TRADE_PLANS = 0
FAVORITES = 0
from datetime import date, timedelta
from django.db import transaction
from django.utils import timezone
from main.account.models import User
from main.cash_dividend.models import CashDividendRecord
from main.core.models import DataChangeLog
from main.favorite.models import Favorite
from main.trade_plan.models import TradePlan
from main.trade_record.models import TradeRecord
SIDS = ['2330', '2317', '2454', '2412', '2882', '2881', '1301', '1303', '2002', '2308', '2603', '0050']
user = User.objects.get(email=EMAIL)
last_month = timezone.localtime().replace(day=1, hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)
with transaction.atomic():
    for model in [TradeRecord, CashDividendRecord, TradePlan, Favorite]:
        model.objects.filter(owner=user).delete()
    DataChangeLog.objects.filter(user=user).delete()
    for sid in SIDS[:HOLDINGS]:
        TradeRecord.objects.create(owner=user, company_id=sid, deal_time=last_month.date(), deal_price=100, deal_quantity=1000, handling_fee=20)
    TradeRecord.objects.filter(owner=user).update(created_at=last_month)
    for _ in range(TRADE_RECORDS):
        TradeRecord.objects.create(owner=user, company_id='2330', deal_time=date.today(), deal_price=100, deal_quantity=1000, handling_fee=20)
    for _ in range(CASH_DIVIDENDS):
        CashDividendRecord.objects.create(owner=user, company_id='2330', deal_time=date.today(), cash_dividend=100)
    for _ in range(TRADE_PLANS):
        TradePlan.objects.create(owner=user, company_id='2330', plan_type='buy', target_price=100, target_quantity=1000)
    for sid in SIDS[:FAVORITES]:
        Favorite.objects.create(owner=user, company_id=sid)
"
```

「建立已付款的訂閱」指令會刪除這個帳號的付款紀錄，建立一筆已付款的月繳訂閱，再把訂閱設成 `STATE`（`'active'` 是自動續訂中，`'past_due'` 是扣款失敗），並讓本期在 `PERIOD_ENDS_IN_HOURS` 小時之後結束，負數表示本期已經結束。這筆訂閱沒有真的在綠界建立，所以停止自動續訂時綠界會回傳錯誤。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
EMAIL = '<email>'
STATE = 'active'
PERIOD_ENDS_IN_HOURS = 480
import uuid
from datetime import timedelta
from django.utils import timezone
from main.account.models import User
from main.billing.models import BillingProfile, SubscriptionPayment
from main.billing.services.subscription import mark_payment_paid
user = User.objects.get(email=EMAIL)
SubscriptionPayment.objects.filter(user=user).delete()
payment = SubscriptionPayment.objects.create(user=user, provider_request_id='M' + uuid.uuid4().hex[:19], billing_interval='month', amount=65)
mark_payment_paid(payment, {'RtnCode': 1, 'OrderInfo': {'MerchantTradeNo': payment.provider_request_id, 'TradeNo': 'T' + payment.provider_request_id, 'TotalAmount': 65}})
BillingProfile.objects.filter(user=user).update(subscription_status=STATE, current_period_ends_at=timezone.now() + timedelta(hours=PERIOD_ENDS_IN_HOURS))
"
```

「模擬付款結果」指令假裝綠界通知 Taigu 這個帳號最近一筆付款的結果，`SUCCESS = True` 是付款成功，`SUCCESS = False` 是付款失敗：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
EMAIL = '<email>'
SUCCESS = True
from main.billing.models import SubscriptionPayment
from main.billing.services.subscription import mark_payment_failed, mark_payment_paid
payment = SubscriptionPayment.objects.filter(user__email=EMAIL).latest('created_at')
if SUCCESS:
    mark_payment_paid(payment, {'RtnCode': 1, 'OrderInfo': {'MerchantTradeNo': payment.provider_request_id, 'TradeNo': 'T' + payment.provider_request_id, 'TotalAmount': payment.amount}})
else:
    mark_payment_failed(payment.provider_request_id, {'RtnCode': 0, 'RtnMsg': 'manual test'})
"
```

「模擬定期扣款結果」指令假裝綠界通知 Taigu 定期扣款的結果，執行之前要先用「建立已付款的訂閱」指令建立訂閱。`SUCCESS = True` 是扣款成功，`SUCCESS = False` 是扣款失敗：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
EMAIL = '<email>'
SUCCESS = True
from main.billing.models import SubscriptionPayment
from main.billing.services.subscription import process_period_payment_callback
first = SubscriptionPayment.objects.filter(user__email=EMAIL, status='paid').earliest('created_at')
times = SubscriptionPayment.objects.filter(user__email=EMAIL).count() + 1
process_period_payment_callback({'MerchantTradeNo': first.provider_subscription_id, 'RtnCode': 1 if SUCCESS else 0, 'RtnMsg': 'manual test', 'Gwsr': first.provider_request_id + str(times), 'Amount': first.amount, 'TotalSuccessTimes': times})
"
```

「執行到期處理」指令立刻執行每天的到期處理：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py reconcile_due_billing_profiles
```

## BILL-R1.1 已停止自動續訂但本期還沒結束

前端沒有自動化 test，後端也沒有 test 驗證已停止自動續訂的方案。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'stopped'`。
2. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」，方案頁沒有「額度使用」區塊。

## BILL-R1.2 扣款失敗

前端沒有自動化 test，後端也沒有 test 驗證扣款失敗的方案。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'past_due'`。
2. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」與「付款未完成，重新完成付款後可恢復 Standard 權益。」，方案頁有「額度使用」區塊。

## BILL-R2.1 第一次登入

`test_new_user_gets_standard_trial` 只驗證新使用者的訂閱與方案，沒有驗證試用期的長度與方案頁顯示的日期。

1. 執行下面的指令，刪除這個帳號的方案資料，讓 Taigu 把下一次登入當成第一次登入：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.billing.models import BillingProfile
   BillingProfile.objects.filter(user__email='<email>').delete()
   "
   ```

2. 登出 Taigu。
3. 用同一個 Google 帳號登入 `https://local.taigu.tw`。
4. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」與標籤「試用中」，「試用至」的日期是今天的 31 天後。

## BILL-R2.3 試用期結束後再登入

前端沒有自動化 test，後端也沒有 test 驗證試用期結束後再登入的結果。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 登出 Taigu。
3. 用同一個 Google 帳號登入 `https://local.taigu.tw`。
4. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」，沒有「試用中」標籤。

## BILL-R3.2 試用期間新增的紀錄在試用期結束後仍算進本月

前端沒有自動化 test，後端也沒有 test 驗證試用期間新增的紀錄在試用期結束後的計算。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 25。
3. 執行下面的指令，讓試用期在這一刻結束、訂閱變成 Free，這樣第 2 步的 25 筆紀錄都是在試用期間新增的，然後確認指令印出 `1`：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from django.utils import timezone
   from main.billing.models import BillingProfile
   print(BillingProfile.objects.filter(user__email='<email>').update(plan='free', subscription_status='canceled', trial_ends_at=timezone.now()))
   "
   ```

4. 新增交易紀錄。
5. 關閉升級提示視窗。
6. 開啟方案頁。

預期：第 4 步之後畫面出現升級提示視窗；方案頁的「交易與股利」一列仍顯示「本月 25 / 20」。

## BILL-R4.1 上個月最後一刻新增的紀錄不算進本月

前端沒有自動化 test，後端也沒有 test 驗證每月額度以台灣時間的 1 日 0 點起算。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 20。
3. 執行下面的指令，把這 20 筆紀錄的新增時間改到上個月最後一天的 23:59（台灣時間）：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.trade_record.models import TradeRecord
   month_start = timezone.localtime().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
   TradeRecord.objects.filter(owner__email='<email>').update(created_at=month_start - timedelta(minutes=1))
   "
   ```

4. 新增交易紀錄。
5. 開啟方案頁。

預期：第 4 步之後畫面沒有出現升級提示視窗；方案頁的「交易與股利」一列顯示「本月 1 / 20」。

## BILL-R4.2 交易日期在上個月的紀錄算進本月

前端沒有自動化 test，後端也沒有 test 驗證每月額度跟交易日期無關。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 19。
3. 新增交易紀錄，「交易日期」改填上個月的任何一天。
4. 開啟方案頁。

預期：第 3 步之後畫面沒有出現升級提示視窗；方案頁的「交易與股利」一列顯示「本月 20 / 20」。

## BILL-R4.3 刪除本月新增的紀錄之後再新增

前端沒有自動化 test，後端也沒有 test 驗證刪除紀錄之後的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 20。
3. 開啟 `https://local.taigu.tw/records`。
4. 點其中一筆交易紀錄的「刪除」按鈕。
5. 在「刪除交易紀錄？」視窗點「刪除交易紀錄」。
6. 新增交易紀錄。

預期：第 6 步之後畫面沒有出現升級提示視窗，歷史紀錄頁列出 20 筆交易紀錄。

## BILL-R5.1 本月已有 10 筆買賣計畫

前端沒有自動化 test，後端也沒有 test 驗證買賣計畫的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`TRADE_PLANS` 設成 10。
3. 新增買賣計畫。
4. 關閉升級提示視窗。
5. 開啟方案頁。

預期：第 3 步之後畫面出現升級提示視窗；方案頁的「買賣計畫」一列仍顯示「本月 10 / 10」。

## BILL-R6.1 持有 10 檔時買進第 11 檔

前端沒有自動化 test，後端也沒有 test 驗證持股檔數的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`HOLDINGS` 設成 10。
3. 新增交易紀錄，股票代號用 2603。
4. 關閉升級提示視窗。
5. 開啟方案頁。

預期：第 3 步之後畫面出現升級提示視窗；方案頁「持股」一列的用量仍是 10，「交易與股利」一列顯示「本月 0 / 20」。

## BILL-R6.2 持有 10 檔時加碼其中一檔

前端沒有自動化 test，後端也沒有 test 驗證持股檔數的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`HOLDINGS` 設成 10。
3. 新增交易紀錄，股票代號用 2330。
4. 開啟方案頁。

預期：第 3 步之後畫面沒有出現升級提示視窗；方案頁「持股」一列的用量是 10，「交易與股利」一列顯示「本月 1 / 20」。

## BILL-R7.1 已有 10 檔時加入第 11 檔

前端沒有自動化 test，後端也沒有 test 驗證自選股檔數的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`FAVORITES` 設成 10。
3. 開啟 `https://local.taigu.tw/market/2603`。
4. 點股票名稱上方工具列裡的空心愛心按鈕。
5. 關閉升級提示視窗。
6. 開啟方案頁。

預期：第 4 步之後畫面出現升級提示視窗，關閉視窗後愛心仍是空心；方案頁「關注」一列的用量仍是 10。

## BILL-R8.1 持股額度用完後把紀錄改成另一檔股票

前端沒有自動化 test，後端也沒有 test 驗證編輯不受額度限制。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`HOLDINGS` 設成 10，`TRADE_RECORDS` 設成 1。
3. 開啟 `https://local.taigu.tw/records`。
4. 點其中一筆 2330 交易紀錄的「編輯」按鈕。
5. 點編輯器裡股票欄位的「更換」。
6. 在「搜尋證券代號或名稱」輸入 2603 並選擇這檔股票。
7. 點「送出」。
8. 開啟方案頁。

預期：第 7 步之後畫面沒有出現升級提示視窗；方案頁「持股」一列的用量是 11。

## BILL-R8.2 試用期結束時自選股超過 10 檔

前端沒有自動化 test，後端也沒有 test 驗證試用期結束後資料仍保留。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行「準備資料」指令，`FAVORITES` 設成 12。
3. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
4. 開啟 `https://local.taigu.tw/market`。
5. 點「關注」分頁。

預期：「關注」分頁列出 12 檔股票。

## BILL-R9.1 本月額度已用完時新增交易紀錄

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 20。
3. 新增交易紀錄。

預期：畫面顯示升級提示視窗，標題是「這個月的新增額度已用完」，「目前限制」寫「Free 方案每月最多只能新增 20 筆交易紀錄與現金股利。」，視窗裡有關閉視窗的按鈕與「查看 Standard 方案」按鈕；開啟方案頁後，「交易與股利」一列仍顯示「本月 20 / 20」。

## BILL-R9.2 點「查看 Standard 方案」

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 20。
3. 新增交易紀錄。
4. 點升級提示視窗的「查看 Standard 方案」。

預期：升級提示視窗關閉，網址變成 `https://local.taigu.tw/settings/current-plan`，畫面顯示方案頁。

## BILL-R10.1 自動續訂中

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'active'`。
2. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」、標籤「月繳」、「NT$65/月」，「下次續費」的日期是今天的 20 天後。

## BILL-R10.2 已停止自動續訂

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'stopped'`。
2. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」、「有效至 <日期>」，以及「目前方案可使用至 <日期>。到期後會切換為 Free，不會再自動扣款。」，兩個日期都是今天的 20 天後。

## BILL-R11.1 Free 方案的額度用量

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 執行「準備資料」指令，`HOLDINGS` 設成 2，`TRADE_RECORDS` 設成 5，`CASH_DIVIDENDS` 設成 2，`TRADE_PLANS` 設成 3，`FAVORITES` 設成 4。
3. 開啟方案頁。

預期：「額度使用」區塊的「交易與股利」一列顯示「本月 7 / 20」，「買賣計畫」一列顯示「本月 3 / 10」，「持股」一列的用量是 2、上限是 10，「關注」一列的用量是 4、上限是 10。

## BILL-R12.1 試用中

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 開啟方案頁。

預期：「方案選擇」區塊有「月繳 NT$65」與「年繳 NT$700」兩個選項。

## BILL-R12.2 Free 狀態

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 開啟方案頁。

預期：「方案選擇」區塊有「月繳 NT$65」與「年繳 NT$700」兩個選項。

## BILL-R12.3 自動續訂中

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'active'`。
2. 開啟方案頁。

預期：方案頁沒有「方案選擇」區塊。

## BILL-R12.4 已停止自動續訂

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'stopped'`。
2. 開啟方案頁。

預期：方案頁沒有「方案選擇」區塊。

## BILL-R13.1 點選月繳

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 開啟方案頁。
3. 點「方案選擇」區塊的「月繳」。

預期：畫面顯示「確認訂閱 Standard」視窗，寫出「付款週期 月繳」與「每期金額 NT$65」，視窗裡有關閉視窗的按鈕與「前往綠界付款」按鈕。

## BILL-R13.2 前往綠界付款

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 開啟方案頁。
3. 點「方案選擇」區塊的「月繳」。
4. 點「前往綠界付款」。

預期：瀏覽器換到網址以 `https://payment-stage.ecpay.com.tw` 開頭的綠界付款頁。

## BILL-R14.1 試用中付款

前端沒有自動化 test，後端也沒有 test 驗證付款成功之後的訂閱狀態。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行下面的指令，讓試用期在 10 天後結束：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.billing.models import BillingProfile
   BillingProfile.objects.filter(user__email='<email>').update(trial_ends_at=timezone.now() + timedelta(days=10))
   "
   ```

3. 從方案頁前往綠界，付款週期選「月繳」。
4. 執行「模擬付款結果」指令，`SUCCESS` 設成 `True`。
5. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」與標籤「月繳」，「下次續費」的日期是今天的 1 個月後，不是 10 天後。

## BILL-R14.3 開啟付款頁超過 30 分鐘才付款成功

`test_late_success_callback_can_mark_expired_payment_paid` 只驗證這筆付款算付款成功，沒有驗證訂閱狀態。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 從方案頁前往綠界，付款週期選「月繳」。
3. 執行下面的指令，把這筆付款的建立時間改到 31 分鐘前：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.billing.models import SubscriptionPayment
   SubscriptionPayment.objects.filter(user__email='<email>', status='pending').update(created_at=timezone.now() - timedelta(minutes=31))
   "
   ```

4. 執行「執行到期處理」指令。這個指令會處理本機資料庫裡每一個帳號的到期訂閱，不只是測試帳號。
5. 執行「模擬付款結果」指令，`SUCCESS` 設成 `True`。
6. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」與標籤「月繳」，「下次續費」的日期是今天的 1 個月後。

## BILL-R15.1 Free 狀態付款失敗

前端沒有自動化 test，後端也沒有 test 驗證付款失敗之後的訂閱狀態。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 從方案頁前往綠界，付款週期選「月繳」。
3. 執行「模擬付款結果」指令，`SUCCESS` 設成 `False`。
4. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」。

## BILL-R16.1 檢查碼不對

後端沒有 test 驗證檢查碼不對的通知不會讓付款算成功。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'free'`。
2. 從方案頁前往綠界，付款週期選「月繳」。
3. 執行下面的指令，印出這筆付款的編號：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.billing.models import SubscriptionPayment
   print('PAYMENT', SubscriptionPayment.objects.filter(user__email='<email>').latest('created_at').provider_request_id)
   "
   ```

4. 執行下面的指令，送出一則檢查碼不對的付款成功通知，`<編號>` 換成上一步印在 `PAYMENT` 後面的編號：

   ```bash
   curl -k -X POST https://local.taigu.tw/api/billing/ecpay/return -d 'MerchantTradeNo=<編號>&RtnCode=1&TradeNo=manual-test&TradeAmt=65&CheckMacValue=WRONG'
   ```

5. 開啟方案頁。

預期：「目前方案」區塊仍顯示「Free」。

## BILL-R18.2 已停止自動續訂後再訂閱

後端沒有 test 驗證已停止自動續訂的使用者不能再訂閱，方案頁也沒有讓這類使用者訂閱的按鈕，所以用指令直接要求訂閱。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'stopped'`。
2. 執行下面的指令，替這個帳號要求訂閱月繳的 Standard：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.account.models import User
   from main.billing.models import SubscriptionPayment
   from main.billing.services.subscription import SubscriptionPaymentNotChargeableError, create_subscription_checkout
   user = User.objects.get(email='<email>')
   try:
       create_subscription_checkout(user=user, interval='month')
       print('RESULT created')
   except SubscriptionPaymentNotChargeableError as error:
       print('RESULT refused:', error)
   print('PAYMENTS', SubscriptionPayment.objects.filter(user=user).count())
   "
   ```

預期：指令印出 `RESULT refused: Subscription is already active` 與 `PAYMENTS 0`。

## BILL-R19.1 從綠界回到方案頁

`test_ecpay_order_result_redirects_to_checkout_result` 與 `test_checkout_result_url_flags_ecpay_checkout` 只驗證 Taigu 把瀏覽器導到帶 `?checkout=ecpay` 的方案頁，畫面上的提示只能人工確認。

1. 開啟 `https://local.taigu.tw/settings/current-plan?checkout=ecpay`。

預期：頁面頂端顯示「若已完成付款，系統會在收到綠界通知後更新方案狀態。」這段提示。

## BILL-R20.1 自動續訂中的定期扣款成功

後端沒有 test 驗證定期扣款成功之後的訂閱狀態。

1. 執行「建立已付款的訂閱」指令，`STATE` 設成 `'active'`，`PERIOD_ENDS_IN_HOURS` 設成 `-1`。
2. 執行「模擬定期扣款結果」指令，`SUCCESS` 設成 `True`。
3. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」與標籤「月繳」，「下次續費」的日期是今天的 1 個月後。

## BILL-R20.2 扣款失敗後定期扣款成功

後端沒有 test 驗證定期扣款成功之後的訂閱狀態。

1. 執行「建立已付款的訂閱」指令，`STATE` 設成 `'past_due'`，`PERIOD_ENDS_IN_HOURS` 設成 `-48`。
2. 執行「模擬定期扣款結果」指令，`SUCCESS` 設成 `True`。
3. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」與標籤「月繳」，「下次續費」的日期是今天的 1 個月後。

## BILL-R21.1 定期扣款失敗

後端沒有 test 驗證定期扣款失敗之後的訂閱狀態。

1. 執行「建立已付款的訂閱」指令，`STATE` 設成 `'active'`，`PERIOD_ENDS_IN_HOURS` 設成 `480`。
2. 執行「模擬定期扣款結果」指令，`SUCCESS` 設成 `False`。
3. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」與「付款未完成，重新完成付款後可恢復 Standard 權益。」。

## BILL-R23.1 開啟停止自動續訂的確認視窗

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'active'`。
2. 開啟方案頁。
3. 點「訂閱管理」區塊的「停止自動續訂」。

預期：畫面顯示確認視窗，標題是「停止 Standard 自動續訂？」，寫出「Standard 權益會保留至 <日期>。到期後會切換為 Free。」，日期是今天的 20 天後，按鈕是「保留自動續訂」與「停止自動續訂」。

## BILL-R23.2 確認停止自動續訂

前端沒有自動化 test，後端也沒有 test 驗證停止自動續訂成功的結果。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'active'`。
2. 開啟方案頁。
3. 點「訂閱管理」區塊的「停止自動續訂」。
4. 點確認視窗裡的「停止自動續訂」。

預期：確認視窗關閉，頁面頂端顯示「已停止自動續訂，Standard 權益會保留到 <日期>。」，日期是今天的 20 天後；「目前方案」區塊顯示「有效至」，「訂閱管理」區塊沒有「停止自動續訂」按鈕。

## BILL-R23.3 綠界沒有取消定期扣款

前端沒有自動化 test，後端也沒有 test 驗證綠界回傳錯誤時的結果。這項檢查假設綠界的測試環境收到取消一筆不存在的定期定額訂單時會回傳錯誤；「建立已付款的訂閱」指令建立的訂閱沒有真的在綠界建立，所以 Taigu 請綠界取消時會收到錯誤。

1. 執行「建立已付款的訂閱」指令，`STATE` 設成 `'active'`，`PERIOD_ENDS_IN_HOURS` 設成 `480`。
2. 開啟方案頁。
3. 點「訂閱管理」區塊的「停止自動續訂」。
4. 點確認視窗裡的「停止自動續訂」。
5. 點「保留自動續訂」。
6. 重新整理方案頁。

預期：第 4 步之後確認視窗沒有關閉；重新整理之後，「目前方案」區塊仍顯示「下次續費」，「訂閱管理」區塊仍有「停止自動續訂」按鈕。

## BILL-R24.1 本期剛結束

前端沒有自動化 test，後端也沒有 test 驗證本期剛結束、每天的到期處理還沒執行時的方案。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'stopped'`。
2. 執行下面的指令，讓本期在 1 分鐘前結束：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.billing.models import BillingProfile
   BillingProfile.objects.filter(user__email='<email>').update(current_period_ends_at=timezone.now() - timedelta(minutes=1))
   "
   ```

3. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」，方案頁有「額度使用」區塊。
