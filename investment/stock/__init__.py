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
    endpoints = {
        "single_day": {
            "tse": "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
            "otc": "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes",
            # The "real_time" endpoint has rate limit: 3 requests per 5 seconds.
            "real_time": "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=",
        },
        "multiple_days": {
            "tse": {
                "daily": "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json",
                "monthly": "https://www.twse.com.tw/exchangeReport/FMSRFK?response=json",
            },
            "otc": {
                "daily": "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php"
            },
        },
    }
