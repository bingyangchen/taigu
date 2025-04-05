class Frequency:
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    ALL = [DAILY, WEEKLY, MONTHLY]
    CHOICES = [(DAILY, DAILY), (WEEKLY, WEEKLY), (MONTHLY, MONTHLY)]


class TradeType:
    TSE = "tse"
    OTC = "otc"
    ALL = [TSE, OTC]
    CHOICES = [(TSE, TSE), (OTC, OTC)]
    TRADE_TYPE_ZH_ENG_MAP = {"上市": TSE, "上櫃": OTC}


class ThirdPartyApi:
    company_info = "https://isin.twse.com.tw/isin/single_main.jsp?owncode="
    company_business = "https://mopsov.twse.com.tw/mops/web/ajax_t05st03"
    realtime = {
        # Realtime Stock Info (Rate limit: 3 requests per 5 seconds)
        "stock": "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=",
        # Realtime Market Index Info
        TradeType.TSE: "https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK",
        TradeType.OTC: "https://www.tpex.org.tw/openapi/v1/tpex_mainborad_highlight",
    }
    single_day = {  # Daily Close Info
        TradeType.TSE: "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
        TradeType.OTC: "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes",
    }
    multiple_days = "https://query1.finance.yahoo.com/v7/finance/download/"
    material_fact = {
        TradeType.TSE: "https://openapi.twse.com.tw/v1/opendata/t187ap04_L",
        TradeType.OTC: "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap04_O",
    }


class UnknownStockIdError(Exception): ...
