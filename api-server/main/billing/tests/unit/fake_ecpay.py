import json
import urllib.parse
from collections.abc import Callable

import requests

from main.billing.services.ecpay import EcpayConfig

STAGE_ECPAY_CONFIG = EcpayConfig(
    merchant_id="3002607",
    hash_key="pwFHCqoQZGmho4w6",
    hash_iv="EkRm7iFT261dpevs",
    aio_base_url="https://payment-stage.ecpay.com.tw",
)
ORDER_DISABLED_RTN_CODE = "90100149"
TERMINATION_FAILED_RTN_CODE = "10100050"
_UNKNOWN_ORDER_QUERY_RTN_CODE = 10200047


class FakeEcpay:
    """
    Answers the requests EcpayClient posts to ECPay's periodic order APIs, so that
    tests go through the client's own handling of ECPay's responses and errors.
    """

    def __init__(self) -> None:
        self.trade_no_to_exec_log: dict[str, list[dict]] = {}
        self.trade_no_to_query_error: dict[str, Exception] = {}
        self.termination_error: Exception | None = None
        self.termination_rtn_code = "1"
        self.before_termination: Callable[[], None] | None = None
        self.queried_trade_nos: list[str] = []
        self.terminated_trade_nos: list[str] = []

    def add_charge(
        self,
        merchant_trade_no: str,
        *,
        gwsr: str,
        process_date: str,
        amount: int = 65,
        rtn_code: int = 1,
    ) -> None:
        self.trade_no_to_exec_log.setdefault(merchant_trade_no, []).append(
            {
                "RtnCode": rtn_code,
                "amount": amount,
                "gwsr": int(gwsr),
                "process_date": process_date,
                "auth_code": "777777",
                "TradeNo": f"T{gwsr}",
            }
        )

    def post(self, url: str, *, data: dict, timeout: int) -> requests.Response:
        merchant_trade_no = data["MerchantTradeNo"]
        match url.rsplit("/", 1)[1]:
            case "QueryCreditCardPeriodInfo":
                self.queried_trade_nos.append(merchant_trade_no)
                if error := self.trade_no_to_query_error.get(merchant_trade_no):
                    raise error
                exec_log = self.trade_no_to_exec_log.get(merchant_trade_no)
                if exec_log is None:
                    return _make_response(
                        json.dumps({"RtnCode": _UNKNOWN_ORDER_QUERY_RTN_CODE})
                    )
                return _make_response(
                    json.dumps(
                        {
                            "MerchantID": data["MerchantID"],
                            "MerchantTradeNo": merchant_trade_no,
                            "RtnCode": 1,
                            "TotalSuccessTimes": sum(
                                entry["RtnCode"] == 1 for entry in exec_log
                            ),
                            "ExecStatus": "1",
                            "ExecLog": exec_log,
                        }
                    )
                )
            case "CreditCardPeriodAction":
                self.terminated_trade_nos.append(merchant_trade_no)
                if self.before_termination:
                    self.before_termination()
                if self.termination_error:
                    raise self.termination_error
                return _make_response(
                    urllib.parse.urlencode(
                        {
                            "MerchantID": data["MerchantID"],
                            "MerchantTradeNo": merchant_trade_no,
                            "RtnCode": self.termination_rtn_code,
                            "RtnMsg": "fake",
                        }
                    )
                )
            case path:
                raise AssertionError(f"Unexpected ECPay API: {path}")


def _make_response(text: str) -> requests.Response:
    response = requests.Response()
    response.status_code = 200
    response._content = text.encode()
    return response
