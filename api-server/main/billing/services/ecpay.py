import hashlib
import hmac
import json
import urllib.parse
import uuid
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

from main.env import Env, env
from main.origins import get_public_api_origin, get_public_frontend_origin

TAIPEI = ZoneInfo("Asia/Taipei")
ECPAY_STAGE_AIO_URL = "https://payment-stage.ecpay.com.tw"
ECPAY_PROD_AIO_URL = "https://payment.ecpay.com.tw"

# CreditCardPeriodAction returns this for an order that is already disabled, which
# includes an order ECPay terminated on its own after six failed charges.
_PERIODIC_ORDER_DISABLED_RTN_CODE = "90100149"

# (connect, read) seconds. Stopping auto-renewal in the waiting period calls ECPay
# twice, and both calls must end within gunicorn's 30-second worker timeout, so that
# the view can still answer with its own error.
_PERIODIC_ORDER_REQUEST_TIMEOUT = (5, 8)


class EcpayApiError(Exception):
    def __init__(
        self,
        message: str,
        *,
        trans_code: int | None = None,
        rtn_code: int | None = None,
    ) -> None:
        self.trans_code = trans_code
        self.rtn_code = rtn_code
        super().__init__(message)


@dataclass(frozen=True)
class EcpayPeriodicCharge:
    gwsr: str
    amount: int
    exec_log_entry: dict


@dataclass(frozen=True)
class EcpayPeriodicOrder:
    # Counts the first charge too.
    total_success_times: int
    latest_successful_charge: EcpayPeriodicCharge | None


@dataclass(frozen=True)
class EcpayConfig:
    merchant_id: str
    hash_key: str
    hash_iv: str
    aio_base_url: str


def get_ecpay_config() -> EcpayConfig:
    is_prod = env.ENV == Env.PROD
    return EcpayConfig(
        merchant_id=env.ECPAY_MERCHANT_ID,
        hash_key=env.ECPAY_HASH_KEY,
        hash_iv=env.ECPAY_HASH_IV,
        aio_base_url=ECPAY_PROD_AIO_URL if is_prod else ECPAY_STAGE_AIO_URL,
    )


def generate_merchant_trade_no(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex}"[:20]


def ecpay_url_encode(value: str) -> str:
    encoded = urllib.parse.quote_plus(value, safe="").lower()
    replacements = {
        "%2d": "-",
        "%5f": "_",
        "%2e": ".",
        "%21": "!",
        "%2a": "*",
        "%28": "(",
        "%29": ")",
    }
    for source, target in replacements.items():
        encoded = encoded.replace(source, target)
    return encoded


def generate_check_mac_value(params: dict, hash_key: str, hash_iv: str) -> str:
    filtered = {
        key: "" if value is None else str(value)
        for key, value in params.items()
        if key != "CheckMacValue"
    }
    sorted_items = sorted(filtered.items(), key=lambda item: item[0].lower())
    raw = (
        f"HashKey={hash_key}&"
        + "&".join(f"{key}={value}" for key, value in sorted_items)
        + f"&HashIV={hash_iv}"
    )
    return hashlib.sha256(ecpay_url_encode(raw).encode("utf-8")).hexdigest().upper()


def verify_check_mac_value(params: dict, hash_key: str, hash_iv: str) -> bool:
    received = str(params.get("CheckMacValue", "")).upper()
    if not received:
        return False
    expected = generate_check_mac_value(params, hash_key, hash_iv)
    return hmac.compare_digest(expected, received)


def get_aio_return_url() -> str:
    return f"{get_public_api_origin()}/api/billing/ecpay/return"


def get_aio_period_return_url() -> str:
    return f"{get_public_api_origin()}/api/billing/ecpay/period-return"


def get_ecpay_checkout_result_url() -> str:
    return f"{get_public_frontend_origin()}/settings/current-plan?checkout=ecpay"


def get_aio_order_result_url() -> str:
    return f"{get_public_api_origin()}/api/billing/ecpay/order-result"


class EcpayClient:
    def __init__(self) -> None:
        self.config = get_ecpay_config()

    def build_aio_periodic_checkout_form(
        self,
        *,
        user_id: object,
        merchant_trade_no: str,
        amount: int,
        billing_interval: str,
        return_url: str,
        period_return_url: str,
        order_result_url: str,
    ) -> dict:
        # Ref: https://developers.ecpay.com.tw/2868/
        period_type = "Y" if billing_interval == "year" else "M"
        exec_times = 99 if period_type == "Y" else 999
        params = {
            "MerchantID": self.config.merchant_id,
            "MerchantTradeNo": merchant_trade_no,
            "MerchantTradeDate": datetime.now(TAIPEI).strftime("%Y/%m/%d %H:%M:%S"),
            "PaymentType": "aio",
            "TotalAmount": amount,
            "TradeDesc": "Taigu Standard subscription",
            "ItemName": "Taigu Standard",
            "ReturnURL": return_url,
            "ChoosePayment": "Credit",
            "EncryptType": 1,
            "PeriodAmount": amount,
            "PeriodType": period_type,
            "Frequency": 1,
            "ExecTimes": exec_times,
            "PeriodReturnURL": period_return_url,
            "OrderResultURL": order_result_url,
            "CustomField1": str(user_id),
        }
        params["CheckMacValue"] = generate_check_mac_value(
            params, self.config.hash_key, self.config.hash_iv
        )
        return {
            "action_url": f"{self.config.aio_base_url}/Cashier/AioCheckOut/V5",
            "params": params,
        }

    def cancel_aio_periodic_order(self, *, merchant_trade_no: str) -> None:
        # Ref: https://developers.ecpay.com.tw/2900/
        response_text = self._post_periodic_order_request(
            "CreditCardPeriodAction",
            {"MerchantTradeNo": merchant_trade_no, "Action": "Cancel"},
        )
        payload = dict(urllib.parse.parse_qsl(response_text, keep_blank_values=True))
        if str(payload.get("RtnCode")) not in {"1", _PERIODIC_ORDER_DISABLED_RTN_CODE}:
            raise EcpayApiError(payload.get("RtnMsg") or "ECPay period action error")

    def query_aio_periodic_order(self, *, merchant_trade_no: str) -> EcpayPeriodicOrder:
        # Ref: https://developers.ecpay.com.tw/2892/
        response_text = self._post_periodic_order_request(
            "QueryCreditCardPeriodInfo", {"MerchantTradeNo": merchant_trade_no}
        )
        try:
            payload = json.loads(response_text)
            if str(payload.get("RtnCode")) != "1":
                raise EcpayApiError(payload.get("RtnMsg") or "ECPay period query error")
            successful_charges = [
                entry for entry in payload["ExecLog"] if str(entry["RtnCode"]) == "1"
            ]
            latest_charge = max(
                successful_charges,
                key=lambda entry: entry["process_date"],
                default=None,
            )
            return EcpayPeriodicOrder(
                total_success_times=int(payload["TotalSuccessTimes"]),
                latest_successful_charge=(
                    EcpayPeriodicCharge(
                        gwsr=str(latest_charge["gwsr"]),
                        amount=int(latest_charge["amount"]),
                        exec_log_entry=latest_charge,
                    )
                    if latest_charge
                    else None
                ),
            )
        except (AttributeError, KeyError, TypeError, ValueError) as error:
            raise EcpayApiError("Malformed ECPay periodic order info") from error

    def _post_periodic_order_request(self, path: str, params: dict) -> str:
        params = {
            "MerchantID": self.config.merchant_id,
            **params,
            "TimeStamp": int(datetime.now(TAIPEI).timestamp()),
        }
        params["CheckMacValue"] = generate_check_mac_value(
            params, self.config.hash_key, self.config.hash_iv
        )
        try:
            response = requests.post(
                f"{self.config.aio_base_url}/Cashier/{path}",
                data=params,
                timeout=_PERIODIC_ORDER_REQUEST_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as error:
            raise EcpayApiError(f"ECPay request failed: {error}") from error
        return response.text
