from django.contrib import admin
from .models import TradeRecord, StockInfo, CashDividendRecord, StockMemo, TradePlan


class TradeRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "dealTime", "sid", "companyName",
                    "dealPrice", "dealQuantity", "handlingFee")


class CashDividendRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "dealTime", "sid", "companyName", "cashDividend")


class StockInfoAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "sid", "companyName",
                    "tradeType", "quantity", "openPrice",
                    "closePrice", "highestPrice", "lowestPrice",
                    "fluctPrice", "fluctRate")


class StockMemoAdmin(admin.ModelAdmin):
    list_display = ("id", "sid", "mainGoodsOrServices",
                    "strategyUsed", "myNote")


class TradePlanAdmin(admin.ModelAdmin):
    list_display = ("id", "sid", "planType", "targetPrice", "targetQuantity")


admin.site.register(TradeRecord, TradeRecordAdmin)
admin.site.register(CashDividendRecord, CashDividendRecordAdmin)
admin.site.register(StockInfo, StockInfoAdmin)
admin.site.register(StockMemo, StockMemoAdmin)
admin.site.register(TradePlan, TradePlanAdmin)
