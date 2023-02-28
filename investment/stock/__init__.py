class Frequency:
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    ALL = [DAILY, WEEKLY, MONTHLY]
    CHOICES = [
        (DAILY, DAILY),
        (WEEKLY, WEEKLY),
        (MONTHLY, MONTHLY),
    ]


class TradeType:
    TSE = "tse"
    OTC = "otc"
    ALL = [TSE, OTC]
    CHOICES = [
        (TSE, TSE),
        (OTC, OTC),
    ]


class InfoEndpoint:
    # self.endpoint = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch="
    endpoints = {
        "single_day": {
            "tse": "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
            "otc": "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes",
        },
        "multiple_days": {
            "tse": {
                "daily": "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20220115&stockNo=2330",
                "monthly": "https://www.twse.com.tw/exchangeReport/FMSRFK?response=json&date=20220115&stockNo=2330",
            },
            "otc": "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?d=111/03/01&stkno=3105",
        },
    }
