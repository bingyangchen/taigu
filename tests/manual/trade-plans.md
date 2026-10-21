每個段落開始前，先完成這些準備：

1. 如果服務還沒啟動，執行 `make start`。「設定股價」把 scheduler 停掉之後，全部檢查完之前不要再執行 `make start`，因為它會把 scheduler 重新啟動，scheduler 在交易時段會蓋掉設定的股價。
2. 用一個測試用的 Google 帳號登入 `https://local.taigu.tw`。下面的指令會刪除與修改這個帳號的資料，所以不要用存有真實資料的帳號；指令裡的 `<email>` 一律換成這個帳號的 email。
3. 執行下面的指令，讓這個帳號在 Standard 的試用期內，新增買賣計畫才不會被 Free 方案的額度擋下，然後確認指令印出 `1`。指令同時設定 `trial_started_at` 與 `cancel_at_period_end=False`，因為試用中的方案必須有試用開始時間、而且不能標記為期末取消，只改 `plan`、`subscription_status` 與 `trial_ends_at` 時，碰到 `cancel_at_period_end=True` 或沒有 `trial_started_at` 的帳號，更新會因為資料庫的檢查而失敗：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from datetime import timedelta
   from django.utils import timezone
   from main.billing.models import BillingProfile, Plan, SubscriptionStatus
   print(BillingProfile.objects.filter(user__email='<email>').update(plan=Plan.STANDARD, subscription_status=SubscriptionStatus.TRIALING, trial_started_at=timezone.now(), trial_ends_at=timezone.now() + timedelta(days=31), cancel_at_period_end=False))
   "
   ```

4. 執行下面的指令，刪掉這個帳號所有的買賣計畫：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.trade_plan.models import TradePlan
   print(TradePlan.objects.filter(owner__email='<email>').delete())
   "
   ```

段落裡的「桌面瀏覽器」指關閉 Chrome DevTools 裝置模擬的頁面，「行動裝置」指在 DevTools 開啟裝置模擬並選一款手機（例如 iPhone 14 Pro）的頁面。Taigu 依瀏覽器的 user agent 判斷是不是行動裝置，所以每次切換裝置模擬之後都要重新整理頁面。

段落提到下面這些準備時，照這裡的做法執行：

- 建立自己的買賣計畫：執行下面的指令，把 `<股票代號>`、`<buy 或 sell>`、`<目標價格>`、`<目標股數>` 換成段落指定的值，指令會印出這筆計畫的 ID。建立之後重新整理頁面，畫面才會讀到這筆計畫。

  ```sh
  docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
  from main.account.models import User
  from main.trade_plan.models import TradePlan
  print(TradePlan.objects.create(owner=User.objects.get(email='<email>'), company_id='<股票代號>', plan_type='<buy 或 sell>', target_price=<目標價格>, target_quantity=<目標股數>).pk)
  "
  ```

- 建立別人的買賣計畫：執行下面的指令，指令會替另一位使用者 `plan-other@example.com` 建立一筆 2330 的買進計畫（目標價格 123.45 元、目標股數 7,000 股），並印出這筆計畫的 ID。

  ```sh
  docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
  from main.account.models import User
  from main.trade_plan.models import TradePlan
  other, _ = User.objects.get_or_create(email='plan-other@example.com', defaults={'oauth_org': 'google', 'oauth_id': 'plan-other', 'username': 'plan-other'})
  print(TradePlan.objects.create(owner=other, company_id='2330', plan_type='buy', target_price=123.45, target_quantity=7000).pk)
  "
  ```

- 讓一檔股票成為持股：在桌面瀏覽器上點選側邊欄的「新增」，在新增交易紀錄的視窗選這檔股票，成交單價輸入 100、成交股數輸入 1000，再點選「送出」。
- 把一檔股票加入關注：開啟這檔股票的個股詳情頁 `https://local.taigu.tw/market/<股票代號>`，愛心按鈕是空心時點選它；已經是實心時不要點，因為點了會移除這檔自選股。
- 設定股價：在第一個用到設定股價的段落開始前，先執行 `docker compose -f compose.dev.yaml stop scheduler`，讓 scheduler 不會蓋掉設定的股價，再執行下面的指令，把 2330 與 2317 原本的行情備份到 api-server container 的 `/tmp/trade_plans_backup.json`（全部檢查完之前不要重建 api-server container，也不要再執行一次備份）：

  ```sh
  docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
  import json
  from main.market.models import StockInfo
  rows = list(StockInfo.objects.filter(company_id__in=['2330', '2317']).values('company_id', 'date', 'close_price', 'fluct_price', 'quantity'))
  json.dump(rows, open('/tmp/trade_plans_backup.json', 'w'), default=str)
  print(rows)
  "
  ```

  每次設定股價時，執行下面的指令，把 `<股票代號>` 與 `<價格>` 換成段落指定的值，設定之後重新整理頁面：

  ```sh
  docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
  from datetime import date
  from main.market.models import StockInfo
  print(StockInfo.objects.update_or_create(company_id='<股票代號>', defaults={'date': date.today(), 'close_price': <價格>, 'fluct_price': 0, 'quantity': 1000000}))
  "
  ```

  全部檢查完後，執行下面的指令，從備份還原 2330 與 2317 的行情（備份時沒有行情的股票，會刪掉段落建立的那筆行情），再執行 `docker compose -f compose.dev.yaml start scheduler`：

  ```sh
  docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
  import json
  from main.market.models import StockInfo
  rows = json.load(open('/tmp/trade_plans_backup.json'))
  StockInfo.objects.filter(company_id__in=['2330', '2317']).exclude(company_id__in=[row['company_id'] for row in rows]).delete()
  for row in rows:
      StockInfo.objects.filter(company_id=row['company_id']).update(date=row['date'], close_price=row['close_price'], fluct_price=row['fluct_price'], quantity=row['quantity'])
  print(list(StockInfo.objects.filter(company_id__in=['2330', '2317']).values('company_id', 'close_price')))
  "
  ```

## PLAN-R1.1 買賣計畫頁不列出別人的計畫

前端沒有自動化 test，後端的 test 也沒有驗證別人的計畫不會出現。

1. 建立別人的買賣計畫。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。

預期：列表裡沒有目標價「$123.45」、「7,000 股」的計畫。

## PLAN-R1.2 修改別人的買賣計畫

沒有自動化 test 驗證這個情境。

1. 建立別人的買賣計畫，記下印出的 ID。
2. 執行下面的指令，把兩處 `<ID>` 換成上一步記下的 ID：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   import json
   from django.test import RequestFactory
   from main.account.models import User
   from main.trade_plan.models import TradePlan
   from main.trade_plan.views import update_or_delete_trade_plan
   request = RequestFactory().post('/', data=json.dumps({'sid': '2330', 'plan_type': 'sell', 'target_price': 1, 'target_quantity': 1}), content_type='application/json')
   request.user = User.objects.get(email='<email>')
   try:
       print('response', update_or_delete_trade_plan(request, <ID>).status_code)
   except TradePlan.DoesNotExist:
       print('DoesNotExist raised')
   plan = TradePlan.objects.get(pk=<ID>)
   print(plan.plan_type, plan.target_price, plan.target_quantity)
   "
   ```

預期：指令先印出 `DoesNotExist raised`，再印出 `buy 123.45 7000`，這筆計畫仍是買進、目標價格 123.45 元、目標股數 7,000 股。如果第一行是 `response 429` 之類的其他結果，代表要求沒有走到修改的步驟，等幾秒後重新執行指令。

## PLAN-R2.1 沒有任何買賣計畫

前端沒有自動化 test。

1. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。

預期：頁面顯示「目前沒有買賣計畫」。

## PLAN-R2.2 搜尋沒有符合的計畫

前端沒有自動化 test。

1. 建立自己的買賣計畫：2330、buy、500、1000。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
3. 在搜尋框輸入「2603」。

預期：頁面顯示「目前沒有買賣計畫」。

## PLAN-R3.1 差距小的計畫排在前面

前端沒有自動化 test。

1. 讓 2330 成為持股。
2. 讓 2317 成為持股。
3. 設定股價：把 2330 設成 600。
4. 設定股價：把 2317 設成 100。
5. 建立自己的買賣計畫：2330、buy、570、1000。
6. 建立自己的買賣計畫：2317、buy、98、1000。
7. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。

預期：2317 的計畫排在 2330 的計畫前面。

## PLAN-R4.1 只看買進計畫

前端沒有自動化 test。

1. 建立自己的買賣計畫：2330、buy、500、1000。
2. 建立自己的買賣計畫：2330、sell、650、1000。
3. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
4. 在搜尋框輸入「買」。

預期：列表只剩標示「買入」的計畫。

## PLAN-R4.2 帶股票代號開啟買賣計畫頁

前端沒有自動化 test。

1. 建立自己的買賣計畫：2330、buy、500、1000。
2. 建立自己的買賣計畫：2317、buy、100、1000。
3. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans?sid=2330`。

預期：搜尋框顯示「2330」，列表只有 2330 的計畫。

## PLAN-R5.1 在桌面瀏覽器上新增

後端的 test 只驗證 Taigu 儲存了計畫，同一檔股票可以有兩筆計畫與畫面上的結果都要手動確認。

1. 建立自己的買賣計畫：2330、sell、650、1000。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
3. 點選側邊欄「新增」右邊的三角形，再點選選單裡的「新增買賣計畫」。
4. 在股票欄位輸入「2330」，點選搜尋結果的「台積電」。
5. 確認買賣開關停在「買」。
6. 在目標價格輸入 500。
7. 在目標股數輸入 1000。
8. 點選「送出」。

預期：視窗關閉，列表有兩列 2330 的計畫，新的一列顯示「買入」「1,000 股」「$500」，標示「賣出」、目標價「$650」的計畫仍在。

## PLAN-R5.2 在行動裝置上從個股詳情頁新增

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/market/2330`。
2. 點選畫面右下角的加號按鈕，再點選「新增買賣計畫」。
3. 確認網址是 `/plans/new?sid=2330`，股票欄位顯示「台積電」與「2330」。
4. 在目標價格輸入 500。
5. 在目標股數輸入 1000。
6. 點選頁首的「送出」。
7. 確認畫面回到 `/market/2330`。
8. 開啟 `https://local.taigu.tw/plans`。

預期：第 7 步畫面回到 2330 的個股詳情頁；第 8 步的列表有一筆 2330 的買進計畫，目標價「$500」。

## PLAN-R5.3 在行動裝置上新增超過額度的計畫

前端沒有自動化 test，額度擋下時的畫面只能人工確認。

1. 執行下面的指令，把帳號改成 Free 方案，並建立 10 筆這個月新增的 2330 買進計畫，用完每月的額度，然後確認指令印出 `1`：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.account.models import User
   from main.billing.models import BillingProfile
   from main.trade_plan.models import TradePlan
   u = User.objects.get(email='<email>')
   [TradePlan.objects.create(owner=u, company_id='2330', plan_type='buy', target_price=100, target_quantity=1000) for _ in range(10)]
   print(BillingProfile.objects.filter(user=u).update(plan='free', subscription_status='canceled'))
   "
   ```

2. 在行動裝置上開啟 `https://local.taigu.tw/plans/new`。
3. 在股票欄位選台積電 2330，在目標價格輸入 500，在目標股數輸入 1000。
4. 點選頁首的「送出」。
5. 關掉 `PlanUpsellModal`。
6. 執行下面的指令，印出這個帳號目標價格是 500 的買賣計畫筆數：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   from main.trade_plan.models import TradePlan
   print(TradePlan.objects.filter(owner__email='<email>', target_price=500).count())
   "
   ```

7. 執行準備步驟 3 的指令，讓帳號回到 Standard 的試用期，再執行準備步驟 4 的指令，刪掉這個帳號所有的買賣計畫。

預期：第 4 步之後畫面出現 `PlanUpsellModal`；第 5 步之後畫面仍是新增買賣計畫的編輯頁，2330、500 與 1000 都還在；第 6 步印出 `0`。

## PLAN-R6.1 還沒選股票

前端沒有自動化 test。

1. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
2. 點選側邊欄「新增」右邊的三角形，再點選「新增買賣計畫」。
3. 在目標價格輸入 500。
4. 在目標股數輸入 1000。

預期：「送出」按鈕是灰色、不能點。

## PLAN-R7.1 買進的預估手續費

前端沒有自動化 test。

1. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
2. 點選側邊欄「新增」右邊的三角形，再點選「新增買賣計畫」。
3. 確認買賣開關停在「買」。
4. 在目標價格輸入 100。
5. 在目標股數輸入 1000。

預期：視窗顯示「成交金額 100,000 元」與「預估手續費 142 元」。

## PLAN-R7.2 賣出的預估手續費

前端沒有自動化 test。

1. 照 PLAN-R7.1 的步驟填好目標價格 100 與目標股數 1000。
2. 點選買賣開關，切到「賣」。

預期：視窗顯示「成交金額 100,000 元」與「預估手續費 442 元」。

## PLAN-R7.3 預估手續費最少 1 元

前端沒有自動化 test。

1. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
2. 點選側邊欄「新增」右邊的三角形，再點選「新增買賣計畫」。
3. 確認買賣開關停在「買」。
4. 在目標價格輸入 10。
5. 在目標股數輸入 10。

預期：視窗顯示「成交金額 100 元」與「預估手續費 1 元」。

## PLAN-R8.3 股票代號不在股票清單裡

沒有自動化 test 驗證這個情境。

1. 執行下面的指令：

   ```sh
   docker compose -f compose.dev.yaml exec api-server python manage.py shell -c "
   import json
   from django.test import RequestFactory
   from main.account.models import User
   from main.market.models import Company
   from main.trade_plan.models import TradePlan
   from main.trade_plan.views import create_trade_plan
   me = User.objects.get(email='<email>')
   before = TradePlan.objects.filter(owner=me).count()
   request = RequestFactory().post('/', data=json.dumps({'sid': '0000', 'plan_type': 'buy', 'target_price': 100, 'target_quantity': 1000}), content_type='application/json')
   request.user = me
   print(Company.objects.filter(pk='0000').exists(), create_trade_plan(request).status_code, TradePlan.objects.filter(owner=me).count() - before)
   "
   ```

預期：指令印出 `False 400 0`，也就是股票清單裡沒有 0000，Taigu 拒絕這個要求，這個帳號的買賣計畫沒有增加。

## PLAN-R9.1 在桌面瀏覽器上修改

後端的 test 只驗證 Taigu 儲存了修改，畫面上的結果要手動確認。

1. 建立自己的買賣計畫：2330、buy、500、1000。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
3. 把滑鼠移到 2330 這一列，點選右邊出現的鉛筆按鈕。
4. 把目標價格改成 520。
5. 點選「送出」。

預期：視窗關閉，列表裡這筆計畫的目標價顯示「$520」。

## PLAN-R9.2 在行動裝置上修改

後端的 test 只驗證 Taigu 儲存了修改，畫面上的結果要手動確認。

1. 建立自己的買賣計畫：2330、buy、500、1000，記下印出的 ID。
2. 在行動裝置上開啟 `https://local.taigu.tw/plans`。
3. 點選 2330 這一列。
4. 確認網址是 `/plans/<第 1 步記下的 ID>/edit`。
5. 把目標價格改成 520。
6. 點選頁首的「送出」。

預期：畫面回到 `/plans`，這筆計畫的目標價顯示「$520」。

## PLAN-R10.1 開啟不存在的買賣計畫

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/plans/999999/edit`。

預期：頁面寫著「找不到這筆資料，可能已經被刪除或尚未載入完成。」，沒有股票、目標價格、目標股數等欄位，頁首也沒有「送出」。

## PLAN-R11.1 有變更時返回

前端沒有自動化 test。

1. 在行動裝置上開啟 `https://local.taigu.tw/plans`。
2. 點選畫面右下角的加號按鈕，再點選「新增買賣計畫」。
3. 在目標價格輸入 500。
4. 點選頁首左邊的返回按鈕。

預期：畫面出現標題「捨棄變更？」的視窗，說明是「離開後，尚未送出的內容不會被儲存。」，按鈕是「繼續編輯」與「捨棄變更」。

## PLAN-R11.2 沒有變更時返回

前端沒有自動化 test。

1. 建立自己的買賣計畫：2330、buy、500、1000。
2. 在行動裝置上開啟 `https://local.taigu.tw/plans`。
3. 點選 2330 這一列。
4. 不更動任何欄位，點選頁首左邊的返回按鈕。

預期：畫面沒有出現確認視窗，直接回到 `/plans`。

## PLAN-R12.1 從列表開啟確認視窗

前端沒有自動化 test。

1. 建立自己的買賣計畫：2330、buy、500、1000。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
3. 把滑鼠移到 2330 這一列，點選右邊出現的垃圾桶按鈕。

預期：畫面出現標題「刪除買賣計畫？」的視窗，說明是「刪除後，這個目標價提醒不會再出現在買賣計畫中。」，內容列出「2330 台積電」與這筆計畫的目標價、類型、股數，並有「刪除買賣計畫」按鈕；列表後面仍看得到這筆計畫。

## PLAN-R12.2 從編輯器刪除

後端的 test 只驗證 Taigu 刪除了計畫，畫面上的結果要手動確認。

1. 建立自己的買賣計畫：2330、buy、500、1000。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
3. 把滑鼠移到 2330 這一列，點選右邊出現的鉛筆按鈕。
4. 點選「其他操作」裡的「刪除買賣計畫」。
5. 確認「刪除買賣計畫？」視窗出現在編輯器上方。
6. 點選確認視窗的「刪除買賣計畫」。

預期：確認視窗與編輯器都關閉，列表不再有這筆計畫。

## PLAN-R13.1 沒有網路時送出

前端沒有自動化 test。

1. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
2. 點選側邊欄「新增」右邊的三角形，再點選「新增買賣計畫」。
3. 在股票欄位輸入「2330」，點選搜尋結果的「台積電」。
4. 在目標價格輸入 500。
5. 在目標股數輸入 1000。
6. 在 DevTools 的 Network 分頁把網路設成「Offline」。
7. 點選「送出」。
8. 確認畫面出現紅色的錯誤提示，視窗仍開著，欄位仍是 2330、500 與 1000。
9. 在 DevTools 的 Network 分頁把網路設回「No throttling」。
10. 重新整理頁面。

預期：第 8 步的畫面如上所述；第 10 步之後，列表顯示「目前沒有買賣計畫」。

## PLAN-R13.2 沒有網路時刪除

前端沒有自動化 test。

1. 建立自己的買賣計畫：2330、buy、500、1000。
2. 在桌面瀏覽器上開啟 `https://local.taigu.tw/plans`。
3. 把滑鼠移到 2330 這一列，點選右邊出現的垃圾桶按鈕。
4. 在 DevTools 的 Network 分頁把網路設成「Offline」。
5. 點選確認視窗的「刪除買賣計畫」。
6. 如果畫面出現開發環境才有的「Uncaught runtime errors」全螢幕畫面，點右上角的 ✕ 關掉它。這個畫面來自 dev server，不是要檢查的結果；錯誤提示 5 秒後會消失，所以這一步要在第 5 步之後馬上做。
7. 確認畫面與列表之後，把 Network 分頁的網路改回「No throttling」。

預期：第 5 步之後畫面出現紅色的錯誤提示，確認視窗仍開著，列表後面仍看得到這筆計畫。

## PLAN-R14.1 差距剛好 5%

前端沒有自動化 test。

1. 讓 2330 成為持股。
2. 設定股價：把 2330 設成 100。
3. 建立自己的買賣計畫：2330、buy、95、1000。
4. 在桌面瀏覽器上開啟 `https://local.taigu.tw/market`。
5. 點選「持股」分頁。

預期：2330 的卡片顯示「距買進價 5.0%」。

## PLAN-R14.2 差距超過 5%

前端沒有自動化 test。

1. 讓 2330 成為持股。
2. 設定股價：把 2330 設成 100。
3. 建立自己的買賣計畫：2330、buy、94、1000。
4. 在桌面瀏覽器上開啟 `https://local.taigu.tw/market`。
5. 點選「持股」分頁。

預期：2330 的卡片沒有「距買進價」或「距賣出價」的文字。

## PLAN-R14.3 有多筆計畫時顯示差距最小的一筆

前端沒有自動化 test。

1. 讓 2330 成為持股。
2. 設定股價：把 2330 設成 100。
3. 建立自己的買賣計畫：2330、buy、97、1000。
4. 建立自己的買賣計畫：2330、sell、102、1000。
5. 在桌面瀏覽器上開啟 `https://local.taigu.tw/market`。
6. 點選「持股」分頁。

預期：2330 的卡片顯示「距賣出價 2.0%」。

## PLAN-R14.4 股票沒有目前價格

前端沒有自動化 test。

1. 讓 2330 成為持股。
2. 設定股價：把 2330 設成 0。
3. 建立自己的買賣計畫：2330、buy、100、1000。
4. 在桌面瀏覽器上開啟 `https://local.taigu.tw/market`。
5. 點選「持股」分頁。
6. 確認 2330 卡片的價格顯示「--」。

預期：2330 的卡片沒有「距買進價」或「距賣出價」的文字。

## PLAN-R14.5 在行動裝置上的「關注」分頁

前端沒有自動化 test。

1. 把 2330 加入關注。
2. 設定股價：把 2330 設成 100。
3. 建立自己的買賣計畫：2330、buy、97、1000。
4. 在行動裝置上開啟 `https://local.taigu.tw/market`。
5. 點選「關注」分頁。

預期：2330 那一列在原本顯示成交量的位置顯示「計畫：距買進價 3.0%」，沒有顯示成交量。

## PLAN-R14.6 在行動裝置上的「持股」分頁

前端沒有自動化 test。

1. 讓 2330 成為持股。
2. 設定股價：把 2330 設成 100。
3. 建立自己的買賣計畫：2330、buy、97、1000。
4. 在行動裝置上開啟 `https://local.taigu.tw/market`。
5. 點選「持股」分頁。

預期：2330 那一列沒有「距買進價」或「距賣出價」的文字。
