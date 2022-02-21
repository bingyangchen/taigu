from django.contrib import admin
from .models import (
    trade_record,
    stock_info,
    cash_dividend_record,
    stock_memo,
    trade_plan,
)

admin.site.register(trade_record)
admin.site.register(stock_info)
admin.site.register(cash_dividend_record)
admin.site.register(stock_memo)
admin.site.register(trade_plan)
