每一節開始之前，先完成這些準備：

1. 執行 `make start`。
2. 用一個專門用來測試的 Google 帳號，在桌面瀏覽器的 Chrome 登入 `https://local.taigu.tw`。下面的指令會刪除這個帳號的交易紀錄、現金股利紀錄、買賣計畫、自選股與付款紀錄，所以不要用平常記帳的帳號。
3. 在 repo 的根目錄執行各節的指令，並把指令裡的 `<email>` 換成這個 Google 帳號的 email。
4. 每次執行指令之後，重新整理瀏覽器的頁面，前端才會載入新的資料。
5. 如果上一節執行過「加入白名單」指令，執行「移出白名單」指令。

各節用到下面這些說法：

- 「方案頁」指 `https://local.taigu.tw/settings/current-plan`。
- 「新增交易紀錄」指點左側選單的「新增」，再點「新增交易紀錄」；在編輯器的「搜尋證券代號或名稱」輸入那一節指定的股票代號（沒有指定時用 2330）並選擇這檔股票，「成交單價」填 100，「成交股數」填 1000，最後點「送出」。
- 「新增買賣計畫」指點左側選單的「新增」，再點「新增買賣計畫」；在編輯器選擇 2330，「目標價格」填 100，「目標股數」填 1000，最後點「送出」。
- 「升級提示視窗」指額度擋下新增時出現、有「查看 Standard 方案」按鈕的視窗；「關閉升級提示視窗」指點這個視窗右上角的關閉按鈕。
- 「從方案頁前往綠界」指在方案頁的「方案選擇」區塊點那一節指定的付款週期，在「確認訂閱 Standard」視窗點「前往綠界付款」，等瀏覽器換到綠界的付款頁之後，按瀏覽器的「上一頁」回到方案頁，不在綠界付款。

「設定訂閱狀態」指令會刪除這個帳號的付款紀錄，再把訂閱設成 `STATE` 指定的狀態：`'trialing'` 是試用中，試用期還剩 31 天；`'active'` 是月繳的自動續訂中，本期還剩 20 天；`'stopped'` 是月繳的已停止自動續訂，本期還剩 20 天；`'awaiting'` 是月繳的自動續訂中，本期在 1 小時前結束，後端還沒確定這一期有沒有扣款成功；`'unsubscribed'` 是未訂閱，試用期在 9 天前結束，沒有訂閱過。這個指令建立的訂閱沒有付款紀錄，後端不知道要終止哪一份定期扣款，所以 `'active'` 與 `'awaiting'` 的訂閱要停止自動續訂時，後端會回錯誤；要停止自動續訂的各節改用「建立已付款的訂閱」指令。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
EMAIL = '<email>'
STATE = 'unsubscribed'
from datetime import timedelta
from django.utils import timezone
from main.billing.models import BillingProfile, SubscriptionPayment
now = timezone.now()
day = timedelta(days=1)
hour = timedelta(hours=1)
SubscriptionPayment.objects.filter(user__email=EMAIL).delete()
values = {
    'trialing': dict(plan='standard', subscription_status='trialing', trial_ends_at=now + 31 * day, current_period_started_at=None, current_period_ends_at=None, cancel_at_period_end=False),
    'active': dict(plan='standard', subscription_status='active', trial_ends_at=now - 9 * day, current_period_started_at=now - 10 * day, current_period_ends_at=now + 20 * day, cancel_at_period_end=False),
    'stopped': dict(plan='standard', subscription_status='active', trial_ends_at=now - 9 * day, current_period_started_at=now - 10 * day, current_period_ends_at=now + 20 * day, cancel_at_period_end=True),
    'awaiting': dict(plan='standard', subscription_status='active', trial_ends_at=now - 9 * day, current_period_started_at=now - 31 * day - hour, current_period_ends_at=now - hour, cancel_at_period_end=False),
    'unsubscribed': dict(plan='free', subscription_status='canceled', trial_ends_at=now - 9 * day, current_period_started_at=None, current_period_ends_at=None, cancel_at_period_end=False),
}[STATE]
BillingProfile.objects.filter(user__email=EMAIL).update(billing_interval='month', trial_started_at=values['trial_ends_at'] - 31 * day, ended_by_failed_renewal=False, **values)
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

「建立綠界測試訂單」指的是在綠界的 stage 環境建立一份真的定期扣款，步驟如下。同一份測試訂單可以在各節重複使用：綠界已經終止的定期扣款再收到終止的要求時，回傳這份定期扣款已經終止，後端算成終止成功（見 BILL-R22）。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 開啟方案頁，點「方案選擇」區塊的「月繳」，再點「前往綠界付款」。
3. 記下綠界付款頁「訂單編號」的值，這就是之後各節所說的「綠界測試訂單編號」。
4. 點綠界付款頁右側「綠界支付掃碼」下方的「測試付款請點此」，在新開的「模擬付款」頁，「信用卡有效年(YY)」填 `30`，「信用卡有效月(MM)」填 `12`，「信用卡安全碼」填 `222`，其他空白的欄位任意填寫，點「交易成功」。
5. 在「交易驗證碼確認」頁點「取得OTP服務密碼」，在輸入框填 `1234`，點「送出(Submit)」。
6. 等原本的分頁回到方案頁。綠界送出的付款成功通知到不了本機的後端，所以方案頁仍顯示 Free，各節再用「建立已付款的訂閱」指令把這份訂單記成付款成功。

「建立已付款的訂閱」指令會刪除這個帳號的付款紀錄，建立一筆已付款的月繳訂閱，訂閱是自動續訂中，並讓本期在 `PERIOD_ENDS_IN_HOURS` 小時之後結束，負數表示本期已經結束。`ORDER` 是空字串時，這筆訂閱沒有真的在綠界建立，所以後端向綠界查詢或請綠界終止定期扣款時，綠界會回傳錯誤；`ORDER` 填「綠界測試訂單編號」時，這筆訂閱自己的定期扣款就是那份測試訂單。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
EMAIL = '<email>'
ORDER = ''
PERIOD_ENDS_IN_HOURS = 480
import uuid
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from django.utils import timezone
from main.account.models import User
from main.billing.models import BillingProfile, SubscriptionPayment
from main.billing.services.subscription import mark_payment_paid
user = User.objects.get(email=EMAIL)
SubscriptionPayment.objects.filter(user=user).delete()
BillingProfile.objects.filter(user=user).update(plan='free', subscription_status='canceled', current_period_started_at=None, current_period_ends_at=None, cancel_at_period_end=False)
payment = SubscriptionPayment.objects.create(user=user, provider_request_id=ORDER or 'M' + uuid.uuid4().hex[:19], billing_interval='month', amount=65)
mark_payment_paid(payment, {'RtnCode': 1, 'OrderInfo': {'MerchantTradeNo': payment.provider_request_id, 'TradeNo': 'T' + payment.provider_request_id, 'TotalAmount': 65}})
ends_at = timezone.localtime() + timedelta(hours=PERIOD_ENDS_IN_HOURS)
SubscriptionPayment.objects.filter(pk=payment.pk).update(paid_at=ends_at)
BillingProfile.objects.filter(user=user).update(current_period_started_at=ends_at - relativedelta(months=1), current_period_ends_at=ends_at)
"
```

「模擬付款結果」指令假裝綠界通知後端這個帳號最近一筆付款的結果，`SUCCESS = True` 是付款成功，`SUCCESS = False` 是付款失敗：

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

「執行到期處理」指令立刻執行每天的到期處理。這個指令會處理本機資料庫裡每一個帳號的到期訂閱，不只是測試帳號：

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py reconcile_due_billing_profiles
```

「加入白名單」與「移出白名單」指令把這個帳號加進或移出白名單。沒有寫到白名單的各節都假設這個帳號不在白名單上。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py standard_whitelist add <email>
```

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py standard_whitelist remove <email>
```

「讓方案資料取得失敗」與「恢復方案資料」指令把買賣計畫的資料表改名再改回來。改名之後，後端計算方案頁的額度用量時讀不到這個資料表，前端取得方案資料時，後端回應 500；登入與其他帳號資料不受影響。

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
from django.db import connection
connection.cursor().execute('ALTER TABLE trade_plan RENAME TO trade_plan_paused')
"
```

```bash
docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
from django.db import connection
connection.cursor().execute('ALTER TABLE trade_plan_paused RENAME TO trade_plan')
"
```

## BILL-R1.1 已停止自動續訂但本期還沒結束

前端沒有自動化 test，後端也沒有 test 驗證已停止自動續訂的方案。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'stopped'`。
2. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」，方案頁沒有「額度使用」區塊。

## BILL-R1.6 等待期內

前端沒有自動化 test，`test_waiting_period_keeps_standard` 只驗證後端判定的方案。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'awaiting'`。
2. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」，方案頁沒有「額度使用」區塊。

## BILL-R2.1 第一次登入

`test_new_user_gets_standard_trial` 只驗證新使用者的訂閱與方案，沒有驗證試用期的長度與方案頁顯示的日期。

1. 執行下面的指令，刪除這個帳號的方案資料，讓後端把下一次登入當成第一次登入：

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

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 登出 Taigu。
3. 用同一個 Google 帳號登入 `https://local.taigu.tw`。
4. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」，沒有「試用中」標籤。

## BILL-R3.2 試用期間新增的紀錄在試用期結束後仍算進本月

前端沒有自動化 test，後端也沒有 test 驗證試用期間新增的紀錄在試用期結束後的計算。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 25。
3. 執行下面的指令，讓試用期在這一刻結束、使用者變成未訂閱，這樣第 2 步的 25 筆紀錄都是在試用期間新增的，然後確認指令印出 `1`：

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

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
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

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 19。
3. 新增交易紀錄，「交易日期」改填上個月的任何一天。
4. 開啟方案頁。

預期：第 3 步之後畫面沒有出現升級提示視窗；方案頁的「交易與股利」一列顯示「本月 20 / 20」。

## BILL-R4.3 刪除本月新增的紀錄之後再新增

前端沒有自動化 test，後端也沒有 test 驗證刪除紀錄之後的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 20。
3. 開啟 `https://local.taigu.tw/records`。
4. 點其中一筆交易紀錄的「刪除」按鈕。
5. 在「刪除交易紀錄？」視窗點「刪除交易紀錄」。
6. 新增交易紀錄。

預期：第 6 步之後畫面沒有出現升級提示視窗，歷史紀錄頁列出 20 筆交易紀錄。

## BILL-R5.1 本月已有 10 筆買賣計畫

前端沒有自動化 test，後端也沒有 test 驗證買賣計畫的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`TRADE_PLANS` 設成 10。
3. 新增買賣計畫。
4. 關閉升級提示視窗。
5. 開啟方案頁。

預期：第 3 步之後畫面出現升級提示視窗；方案頁的「買賣計畫」一列仍顯示「本月 10 / 10」。

## BILL-R6.1 持有 10 檔時買進第 11 檔

前端沒有自動化 test，後端也沒有 test 驗證持股檔數的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`HOLDINGS` 設成 10。
3. 新增交易紀錄，股票代號用 2603。
4. 關閉升級提示視窗。
5. 開啟方案頁。

預期：第 3 步之後畫面出現升級提示視窗；方案頁「持股」一列的用量仍是 10，「交易與股利」一列顯示「本月 0 / 20」。

## BILL-R6.2 持有 10 檔時加碼其中一檔

前端沒有自動化 test，後端也沒有 test 驗證持股檔數的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`HOLDINGS` 設成 10。
3. 新增交易紀錄，股票代號用 2330。
4. 開啟方案頁。

預期：第 3 步之後畫面沒有出現升級提示視窗；方案頁「持股」一列的用量是 10，「交易與股利」一列顯示「本月 1 / 20」。

## BILL-R7.1 已有 10 檔時加入第 11 檔

前端沒有自動化 test，後端也沒有 test 驗證自選股檔數的額度。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`FAVORITES` 設成 10。
3. 開啟 `https://local.taigu.tw/market/2603`。
4. 點股票名稱上方工具列裡的空心愛心按鈕。
5. 關閉升級提示視窗。
6. 開啟方案頁。

預期：第 4 步之後畫面出現升級提示視窗，關閉視窗後愛心仍是空心；方案頁「關注」一列的用量仍是 10。

## BILL-R8.1 持股額度用完後把紀錄改成另一檔股票

前端沒有自動化 test，後端也沒有 test 驗證編輯不受額度限制。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
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
3. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
4. 開啟 `https://local.taigu.tw/market`。
5. 點「關注」分頁。

預期：「關注」分頁列出 12 檔股票。

## BILL-R9.1 本月額度已用完時新增交易紀錄

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 20。
3. 新增交易紀錄。

預期：畫面顯示升級提示視窗，標題是「這個月的新增額度已用完」，「目前限制」寫「Free 方案每月最多只能新增 20 筆交易紀錄與現金股利。」，視窗裡有關閉視窗的按鈕與「查看 Standard 方案」按鈕；開啟方案頁後，「交易與股利」一列仍顯示「本月 20 / 20」。

## BILL-R9.2 點「查看 Standard 方案」

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`TRADE_RECORDS` 設成 20。
3. 新增交易紀錄。
4. 點升級提示視窗的「查看 Standard 方案」。

預期：升級提示視窗關閉，網址變成 `https://local.taigu.tw/settings/current-plan`，畫面顯示方案頁。

## BILL-R9.3 兩種額度都用完時新增交易紀錄

前端沒有自動化 test，後端也沒有 test 驗證兩種額度都用完時先擋下哪一種。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`HOLDINGS` 設成 10，`TRADE_RECORDS` 設成 20。
3. 新增交易紀錄，股票代號用 2603。

預期：後端沒有新增這筆交易紀錄，升級提示視窗的標題是「這個月的新增額度已用完」，不是「持股檔數已達 Free 上限」。

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

## BILL-R10.3 白名單上的使用者未訂閱

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行下面的指令，讓這個帳號像是以前訂閱過月繳的 Standard 方案，上一期在 33 天前結束：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.billing.models import BillingProfile
   now = timezone.now()
   BillingProfile.objects.filter(user__email='<email>').update(current_period_started_at=now - timedelta(days=64), current_period_ends_at=now - timedelta(days=33))
   "
   ```

3. 執行「加入白名單」指令。
4. 開啟方案頁。

預期：「目前方案」區塊裡只有「Standard」、標籤「使用中」、「行情更新 約每 30 秒」與「額度 交易與股利、買賣計畫、持股、關注皆不限量」。

## BILL-R10.4 白名單上的使用者在試用中

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。

預期：「目前方案」區塊裡只有「Standard」、標籤「使用中」、「行情更新 約每 30 秒」與「額度 交易與股利、買賣計畫、持股、關注皆不限量」，沒有標籤「試用中」，也沒有「試用至」。

## BILL-R10.6 白名單上的使用者已停止自動續訂

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'stopped'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。

預期：「目前方案」區塊裡只有「Standard」、標籤「使用中」、「行情更新 約每 30 秒」與「額度 交易與股利、買賣計畫、持股、關注皆不限量」，沒有「有效至」，也沒有「到期後會切換為 Free」。

## BILL-R10.7 白名單上的使用者在自動續訂中

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'active'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」、標籤「月繳」、「NT$65/月」，「下次續費」的日期是今天的 20 天後。

## BILL-R10.8 等待期內

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'awaiting'`。
2. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」、標籤「月繳」、「NT$65/月」、「扣款日 <日期>」與「正在確認本期的扣款結果，確認前仍可使用 Standard 方案。」，日期是 1 小時前的日期。

## BILL-R10.9 以前訂閱過的使用者未訂閱

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行下面的指令，讓這個帳號像是以前訂閱過月繳的 Standard 方案，上一期在 33 天前結束：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.billing.models import BillingProfile
   now = timezone.now()
   BillingProfile.objects.filter(user__email='<email>').update(current_period_started_at=now - timedelta(days=64), current_period_ends_at=now - timedelta(days=33))
   "
   ```

3. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」，沒有「有效至」，也沒有任何日期。

## BILL-R10.10 白名單上的使用者在等待期內

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'awaiting'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。

預期：「目前方案」區塊裡只有「Standard」、標籤「使用中」、「行情更新 約每 30 秒」與「額度 交易與股利、買賣計畫、持股、關注皆不限量」，沒有「扣款日」，也沒有「正在確認本期的扣款結果，確認前仍可使用 Standard 方案。」。

## BILL-R10.11 本期沒有扣款成功而結束訂閱之後

前端沒有自動化 test，`test_unpaid_period_ends_subscription` 只驗證後端記下的訂閱。

1. 執行「建立綠界測試訂單」的步驟，取得「綠界測試訂單編號」；已經有的話沿用。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `-48`。
3. 執行「執行到期處理」指令。
4. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」與「上一期的扣款沒有成功，自動續訂已經結束。重新訂閱即可恢復 Standard 方案。」，方案頁有「方案選擇」區塊。

## BILL-R10.12 等待期內停止自動續訂而變成未訂閱之後

前端沒有自動化 test，`test_stop_in_waiting_period_without_charge` 只驗證後端記下的訂閱。

1. 執行「建立綠界測試訂單」的步驟，取得「綠界測試訂單編號」；已經有的話沿用。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `-1`。
3. 開啟方案頁，點「訂閱管理」區塊的「停止自動續訂」，再點確認視窗裡的「停止自動續訂」。
4. 確認視窗關閉之後，重新整理方案頁。

預期：「目前方案」區塊顯示「Free」，沒有「上一期的扣款沒有成功，自動續訂已經結束。重新訂閱即可恢復 Standard 方案。」。

## BILL-R10.13 本期沒有扣款成功而結束之後重新訂閱，停止自動續訂後到期

前端沒有自動化 test，`test_resubscribing_clears_failed_renewal` 只驗證後端記下的訂閱。

1. 完成「BILL-R10.11 本期沒有扣款成功而結束訂閱之後」的第 1 到 3 步。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `480`。
3. 開啟方案頁，點「訂閱管理」區塊的「停止自動續訂」，再點確認視窗裡的「停止自動續訂」。
4. 執行下面的指令，讓本期在 1 分鐘前結束：

   ```bash
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.billing.models import BillingProfile
   BillingProfile.objects.filter(user__email='<email>').update(current_period_ends_at=timezone.now() - timedelta(minutes=1))
   "
   ```

5. 執行「執行到期處理」指令。
6. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」，沒有「上一期的扣款沒有成功，自動續訂已經結束。重新訂閱即可恢復 Standard 方案。」。

## BILL-R11.1 Free 方案的額度用量

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「準備資料」指令，`HOLDINGS` 設成 2，`TRADE_RECORDS` 設成 5，`CASH_DIVIDENDS` 設成 2，`TRADE_PLANS` 設成 3，`FAVORITES` 設成 4。
3. 開啟方案頁。

預期：「額度使用」區塊的「交易與股利」一列顯示「本月 7 / 20」，「買賣計畫」一列顯示「本月 3 / 10」，「持股」一列的用量是 2、上限是 10，「關注」一列的用量是 4、上限是 10。

## BILL-R12.1 試用中

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 開啟方案頁。

預期：「方案選擇」區塊有「月繳 NT$65」與「年繳 NT$700」兩個選項。

## BILL-R12.2 未訂閱

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
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

## BILL-R12.5 白名單上的使用者未訂閱

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。

預期：方案頁沒有「方案選擇」區塊。

## BILL-R12.6 白名單上的使用者在試用中

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。

預期：方案頁沒有「方案選擇」區塊。

## BILL-R12.8 已停止自動續訂後本期結束

前端沒有自動化 test。

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

預期：「方案選擇」區塊有「月繳 NT$65」與「年繳 NT$700」兩個選項。

## BILL-R12.9 等待期內

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'awaiting'`。
2. 開啟方案頁。

預期：方案頁沒有「方案選擇」區塊。

## BILL-R13.1 點選月繳

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 開啟方案頁。
3. 點「方案選擇」區塊的「月繳」。

預期：畫面顯示「確認訂閱 Standard」視窗，寫出「付款週期 月繳」、「每期金額 NT$65」與「下次續費 <日期>」，日期是今天（台灣時間）的 1 個月後，視窗裡有關閉視窗的按鈕與「前往綠界付款」按鈕。

## BILL-R13.2 前往綠界付款

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 開啟方案頁。
3. 點「方案選擇」區塊的「月繳」。
4. 點「前往綠界付款」。

預期：瀏覽器換到網址以 `https://payment-stage.ecpay.com.tw` 開頭的綠界付款頁。

## BILL-R13.3 在月底點選月繳

前端沒有自動化 test。前提的日期要在瀏覽器裡改，所以用 Chrome 開發者工具的 Console 把頁面的時間固定在 2027/01/31。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 開啟方案頁。
3. 開啟 Chrome 開發者工具的 Console，執行下面的程式，讓頁面取得的現在時間固定是台灣時間 2027/01/31 12:00：

   ```js
   const fixedTime = new Date("2027-01-31T12:00:00+08:00").getTime();
   const RealDate = Date;
   window.Date = class extends RealDate {
     constructor(...args) {
       super(...(args.length ? args : [fixedTime]));
     }
     static now() {
       return fixedTime;
     }
   };
   ```

4. 點「方案選擇」區塊的「月繳」。

預期：「確認訂閱 Standard」視窗寫出「下次續費 2027/02/28」。

## BILL-R13.4 點選年繳

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 開啟方案頁。
3. 點「方案選擇」區塊的「年繳」。

預期：「確認訂閱 Standard」視窗寫出「付款週期 年繳」、「每期金額 NT$700」與「下次續費 <日期>」，日期是今天（台灣時間）的 1 年後。

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

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
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

4. 執行「執行到期處理」指令。
5. 執行「模擬付款結果」指令，`SUCCESS` 設成 `True`。
6. 開啟方案頁。

預期：「目前方案」區塊顯示「Standard」與標籤「月繳」，「下次續費」的日期是今天的 1 個月後。

## BILL-R15.1 未訂閱時付款失敗

前端沒有自動化 test，後端也沒有 test 驗證付款失敗之後的訂閱狀態。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 從方案頁前往綠界，付款週期選「月繳」。
3. 執行「模擬付款結果」指令，`SUCCESS` 設成 `False`。
4. 開啟方案頁。

預期：「目前方案」區塊顯示「Free」。

## BILL-R16.1 檢查碼不對

後端沒有 test 驗證檢查碼不對的通知不會讓付款算成功。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
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

## BILL-R17.2 從綠界付款頁按上一頁

前端沒有自動化 test，按瀏覽器的上一頁之後的畫面只能在瀏覽器上確認。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'unsubscribed'`。
2. 開啟方案頁。
3. 點「方案選擇」區塊的「月繳」，再點「前往綠界付款」。
4. 等瀏覽器換到綠界的付款頁之後，按瀏覽器的上一頁。
5. 點「方案選擇」區塊的「年繳」。

預期：第 4 步之後畫面顯示方案頁，沒有開著的「確認訂閱 Standard」視窗，「月繳」與「年繳」可以點選；第 5 步之後畫面顯示「確認訂閱 Standard」視窗，寫出「付款週期 年繳」，而且視窗沒有自己關閉。

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

`test_ecpay_order_result_redirects_to_checkout_result` 與 `test_checkout_result_url_flags_ecpay_checkout` 只驗證後端把瀏覽器導到帶 `?checkout=ecpay` 的方案頁，畫面上的提示只能人工確認。

1. 開啟 `https://local.taigu.tw/settings/current-plan?checkout=ecpay`。

預期：頁面頂端顯示「若已完成付款，系統會在收到綠界通知後更新方案狀態。」這段提示。

## BILL-R22.6 白名單上的使用者這一期沒有扣款成功

前端沒有自動化 test，`test_whitelisted_user_unpaid_period_ends_subscription` 只驗證後端記下的訂閱。

1. 執行「建立綠界測試訂單」的步驟，取得「綠界測試訂單編號」；已經有的話沿用。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `-48`。
3. 執行「加入白名單」指令。
4. 執行「執行到期處理」指令。
5. 開啟方案頁。

預期：「目前方案」區塊裡只有「Standard」、標籤「使用中」、「行情更新 約每 30 秒」與「額度 交易與股利、買賣計畫、持股、關注皆不限量」，沒有「上一期的扣款沒有成功，自動續訂已經結束。重新訂閱即可恢復 Standard 方案。」，方案頁沒有「訂閱管理」區塊。

## BILL-R23.1 開啟停止自動續訂的確認視窗

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'active'`。
2. 開啟方案頁。
3. 點「訂閱管理」區塊的「停止自動續訂」。

預期：畫面顯示確認視窗，標題是「停止 Standard 自動續訂？」，寫出「Standard 權益會保留至 <日期>。到期後會切換為 Free。」，日期是今天的 20 天後；「到期後會發生什麼？」裡沒有「你可以在到期前重新啟用自動續訂。」，視窗裡沒有「可以告訴我們原因嗎？」，按鈕是「保留自動續訂」與「停止自動續訂」。

## BILL-R23.2 確認停止自動續訂

前端沒有自動化 test，後端也沒有 test 驗證停止自動續訂成功的結果。

1. 執行「建立綠界測試訂單」的步驟，取得「綠界測試訂單編號」；已經有的話沿用。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `480`。
3. 開啟方案頁。
4. 點「訂閱管理」區塊的「停止自動續訂」。
5. 點確認視窗裡的「停止自動續訂」。

預期：確認視窗關閉，頁面頂端顯示「已停止自動續訂，Standard 權益會保留到 <日期>。」，日期是今天的 20 天後；「目前方案」區塊顯示「有效至」，「訂閱管理」區塊沒有「停止自動續訂」按鈕。

## BILL-R23.3 綠界沒有終止定期扣款

前端沒有自動化 test，`test_ecpay_failure_keeps_auto_renewal` 只驗證後端的回應。「建立已付款的訂閱」指令在 `ORDER` 是空字串時建立的訂閱沒有真的在綠界建立，所以後端請綠界終止定期扣款時，綠界回傳這份訂單不存在。

1. 執行「建立已付款的訂閱」指令，`ORDER` 設成空字串，`PERIOD_ENDS_IN_HOURS` 設成 `480`。
2. 開啟方案頁。
3. 點「訂閱管理」區塊的「停止自動續訂」。
4. 點確認視窗裡的「停止自動續訂」。
5. 點「保留自動續訂」。
6. 重新整理方案頁。

預期：第 4 步之後確認視窗沒有關閉，並顯示「綠界暫時無法處理，請稍後再試。」；重新整理之後，「目前方案」區塊仍顯示「下次續費」，「訂閱管理」區塊仍有「停止自動續訂」按鈕。


## BILL-R23.6 白名單上的使用者在自動續訂中

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'active'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。

預期：「訂閱管理」區塊有「停止自動續訂」按鈕。

## BILL-R23.7 白名單上的使用者開啟停止自動續訂的確認視窗

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'active'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。
4. 點「訂閱管理」區塊的「停止自動續訂」。

預期：畫面顯示確認視窗，標題是「停止 Standard 自動續訂？」，說明是「停止後不會再自動扣款。」，沒有「Standard 權益會保留至 <日期>。到期後會切換為 Free。」，也沒有「到期後會發生什麼？」，按鈕是「保留自動續訂」與「停止自動續訂」。

## BILL-R23.8 白名單上的使用者確認停止自動續訂

`test_whitelisted_user_stops_auto_renewal` 只驗證訂閱變成已停止自動續訂，前端沒有自動化 test。

1. 執行「建立綠界測試訂單」的步驟，取得「綠界測試訂單編號」；已經有的話沿用。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `480`。
3. 執行「加入白名單」指令。
4. 開啟方案頁。
5. 點「訂閱管理」區塊的「停止自動續訂」。
6. 點確認視窗裡的「停止自動續訂」。

預期：確認視窗關閉，頁面頂端顯示「已停止自動續訂，之後不會再扣款。」，方案頁沒有「訂閱管理」區塊。

## BILL-R23.9 等待期內開啟停止自動續訂的確認視窗

前端沒有自動化 test。

1. 執行「建立已付款的訂閱」指令，`ORDER` 設成空字串，`PERIOD_ENDS_IN_HOURS` 設成 `-1`。
2. 開啟方案頁。
3. 點「訂閱管理」區塊的「停止自動續訂」。

預期：確認視窗的說明是「停止後不會再自動扣款。如果本期已經扣款成功，Standard 權益會保留到 <日期>；如果沒有，會立刻切換為 Free 方案。」，日期是 1 小時前的日期的 1 個月後；視窗裡沒有「Standard 權益會保留至」，有「到期後會發生什麼？」。

## BILL-R23.10 等待期內停止自動續訂，這一期已經扣款成功

前端沒有自動化 test，`test_stop_in_waiting_period_after_unnotified_charge` 只驗證後端記下的訂閱。這一節需要一份綠界在第一次扣款之後又扣款成功過的測試訂單，綠界的 stage 環境要在建立訂單的 1 個月後才會扣第二期。

1. 準備一份在 1 個月以前照「建立綠界測試訂單」的步驟建立、之後沒有終止過的測試訂單，用它的訂單編號當「綠界測試訂單編號」。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填這份測試訂單的編號，`PERIOD_ENDS_IN_HOURS` 設成 `-1`。
3. 開啟方案頁，點「訂閱管理」區塊的「停止自動續訂」。
4. 點確認視窗裡的「停止自動續訂」。

預期：確認視窗關閉，頁面頂端顯示「已停止自動續訂，Standard 權益會保留到 <日期>。」，日期是 1 小時前的日期的 1 個月後；「目前方案」區塊顯示「有效至 <同一個日期>」。

## BILL-R23.11 等待期內停止自動續訂，這一期沒有扣款成功

前端沒有自動化 test，`test_stop_in_waiting_period_without_charge` 只驗證後端記下的訂閱。

1. 執行「建立綠界測試訂單」的步驟，取得「綠界測試訂單編號」；已經有的話沿用。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `-1`。
3. 開啟方案頁，點「訂閱管理」區塊的「停止自動續訂」。
4. 點確認視窗裡的「停止自動續訂」。

預期：確認視窗關閉，頁面頂端顯示「已停止自動續訂，目前方案是 Free。」，「目前方案」區塊顯示「Free」，方案頁有「方案選擇」區塊。

## BILL-R23.12 白名單上的使用者在等待期內

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'awaiting'`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。

預期：「訂閱管理」區塊寫「本期的扣款結果還在確認中。停止後不會再自動扣款。」，並有「停止自動續訂」按鈕。

## BILL-R23.13 請綠界終止定期扣款時連線逾時

前端沒有自動化 test，`test_ecpay_timeout_keeps_auto_renewal` 只驗證後端的回應。這一節讓 `api-server` 的 container 把綠界的網域解析到不會回應的位址，後端連線綠界時就會逾時。

1. 執行「建立綠界測試訂單」的步驟，取得「綠界測試訂單編號」；已經有的話沿用。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `480`。
3. 執行下面的指令，讓後端連不上綠界：

   ```bash
   docker compose -f compose.dev.yaml exec api-server sh -c "echo '10.255.255.1 payment-stage.ecpay.com.tw' >> /etc/hosts"
   ```

4. 開啟方案頁，點「訂閱管理」區塊的「停止自動續訂」。
5. 點確認視窗裡的「停止自動續訂」，等到確認視窗裡出現錯誤訊息。
6. 執行下面的指令，讓後端恢復連線：

   ```bash
   docker compose -f compose.dev.yaml exec api-server sh -c "sed '/10.255.255.1 payment-stage.ecpay.com.tw/d' /etc/hosts > /tmp/hosts && cat /tmp/hosts > /etc/hosts"
   ```

7. 點「保留自動續訂」，再重新整理方案頁。

預期：第 5 步之後確認視窗沒有關閉，並顯示「綠界暫時無法處理，請稍後再試。」；重新整理之後，「目前方案」區塊仍顯示「下次續費」，「訂閱管理」區塊仍有「停止自動續訂」按鈕。

## BILL-R23.15 白名單上的使用者在等待期內停止自動續訂，這一期沒有扣款成功

前端沒有自動化 test，`test_whitelisted_user_stop_in_waiting_period_without_charge` 只驗證後端記下的訂閱。

1. 執行「建立綠界測試訂單」的步驟，取得「綠界測試訂單編號」；已經有的話沿用。
2. 執行「建立已付款的訂閱」指令，`ORDER` 填「綠界測試訂單編號」，`PERIOD_ENDS_IN_HOURS` 設成 `-1`。
3. 執行「加入白名單」指令。
4. 開啟方案頁，點「訂閱管理」區塊的「停止自動續訂」。
5. 點確認視窗裡的「停止自動續訂」。

預期：確認視窗關閉，頁面頂端顯示「已停止自動續訂，之後不會再扣款。」，方案頁沒有「訂閱管理」區塊，也沒有「方案選擇」區塊。

## BILL-R23.16 等待期內的「訂閱管理」區塊

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'awaiting'`。
2. 開啟方案頁。

預期：「訂閱管理」區塊寫「本期的扣款結果還在確認中。停止後不會再自動扣款。」，並有「停止自動續訂」按鈕。

## BILL-R23.17 白名單上的使用者在等待期內開啟停止自動續訂的確認視窗

前端沒有自動化 test。

1. 執行「建立已付款的訂閱」指令，`ORDER` 設成空字串，`PERIOD_ENDS_IN_HOURS` 設成 `-1`。
2. 執行「加入白名單」指令。
3. 開啟方案頁。
4. 點「訂閱管理」區塊的「停止自動續訂」。

預期：確認視窗的說明只有「停止後不會再自動扣款。」，沒有「如果本期已經扣款成功」，也沒有「到期後會發生什麼？」。

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

預期：「目前方案」區塊顯示「Free」，沒有「有效至」，方案頁有「額度使用」區塊。

## BILL-R28.1 取得方案資料失敗

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行「讓方案資料取得失敗」指令。
3. 開啟方案頁。
4. 執行「恢復方案資料」指令。

預期：第 3 步之後方案頁只顯示「暫時無法取得方案資料，請稍後再試。」與「重新載入」按鈕，沒有「目前方案」區塊。

## BILL-R28.2 重新載入成功

前端沒有自動化 test。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行「讓方案資料取得失敗」指令。
3. 開啟方案頁，確認畫面顯示「暫時無法取得方案資料，請稍後再試。」。
4. 執行「恢復方案資料」指令。
5. 點「重新載入」。

預期：方案頁顯示「目前方案」區塊，標籤是「試用中」。

## BILL-R28.3 從綠界回到方案頁時取得方案資料失敗

前端沒有自動化 test。從綠界回到方案頁時，綠界把瀏覽器導到 `https://local.taigu.tw/settings/current-plan?checkout=ecpay`（見 BILL-R19.1 的手動檢查），所以這一節直接開啟這個網址。

1. 執行「設定訂閱狀態」指令，`STATE` 設成 `'trialing'`。
2. 執行「讓方案資料取得失敗」指令。
3. 開啟 `https://local.taigu.tw/settings/current-plan?checkout=ecpay`。
4. 執行「恢復方案資料」指令。

預期：第 3 步之後方案頁頂端顯示「若已完成付款，系統會在收到綠界通知後更新方案狀態。」，下方只有「暫時無法取得方案資料，請稍後再試。」與「重新載入」按鈕。
