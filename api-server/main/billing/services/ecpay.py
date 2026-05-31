import base64
import json
import logging
import urllib.parse
import uuid
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from main.env import Env, env
from main.origins import get_public_api_origin

logger = logging.getLogger(__name__)

TAIPEI = ZoneInfo("Asia/Taipei")
ECPAY_STAGE_ECPG_URL = "https://ecpg-stage.ecpay.com.tw"
ECPAY_PROD_ECPG_URL = "https://ecpg.ecpay.com.tw"
ECPAY_SDK_URL = "https://ecpg.ecpay.com.tw/Scripts/sdk-1.0.0.js?t=20210121100116"
CARD_BINDING_VERIFICATION_AMOUNT = "2"
ECPAY_COUNTRY_CODE_TAIWAN = "158"  # ISO 3166-1 numeric


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
class EcpayConfig:
    merchant_id: str
    hash_key: str
    hash_iv: str
    ecpg_base_url: str
    sdk_environment: str
    sdk_url: str = ECPAY_SDK_URL


def get_ecpay_config() -> EcpayConfig:
    is_prod = env.ENV == Env.PROD
    return EcpayConfig(
        merchant_id=env.ECPAY_MERCHANT_ID,
        hash_key=env.ECPAY_HASH_KEY,
        hash_iv=env.ECPAY_HASH_IV,
        ecpg_base_url=ECPAY_PROD_ECPG_URL if is_prod else ECPAY_STAGE_ECPG_URL,
        sdk_environment="Prod" if is_prod else "Stage",
    )


def merchant_member_id(user_id: object) -> str:
    return f"taigu{str(user_id).replace('-', '')}"[:60]


def generate_merchant_trade_no(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex}"[:20]


def aes_encrypt(data: dict, hash_key: str, hash_iv: str) -> str:
    # Ref: https://developers.ecpay.com.tw/9103/
    raw_json = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    encoded = urllib.parse.quote_plus(raw_json, safe="").replace("~", "%7E")
    plain = encoded.encode("utf-8")
    pad_length = 16 - len(plain) % 16
    padded = plain + bytes([pad_length]) * pad_length
    cipher = Cipher(
        algorithms.AES(hash_key[:16].encode("utf-8")),
        modes.CBC(hash_iv[:16].encode("utf-8")),
    )
    encryptor = cipher.encryptor()
    encrypted = encryptor.update(padded) + encryptor.finalize()
    return base64.b64encode(encrypted).decode("utf-8")


def aes_decrypt(encrypted_data: str, hash_key: str, hash_iv: str) -> dict:
    encrypted = base64.b64decode(encrypted_data)
    cipher = Cipher(
        algorithms.AES(hash_key[:16].encode("utf-8")),
        modes.CBC(hash_iv[:16].encode("utf-8")),
    )
    decryptor = cipher.decryptor()
    padded = decryptor.update(encrypted) + decryptor.finalize()
    pad_length = padded[-1]
    encoded = padded[:-pad_length].decode("utf-8")
    raw_json = urllib.parse.unquote_plus(encoded)
    return json.loads(raw_json)


class EcpayClient:
    def __init__(self) -> None:
        self.config = get_ecpay_config()

    def __post(self, path: str, data: dict) -> dict:
        request_body = {
            "MerchantID": self.config.merchant_id,
            "RqHeader": {"Timestamp": int(datetime.now(TAIPEI).timestamp())},
            "Data": aes_encrypt(data, self.config.hash_key, self.config.hash_iv),
        }
        response = requests.post(
            f"{self.config.ecpg_base_url}{path}", json=request_body, timeout=30
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("TransCode") != 1:
            raise EcpayApiError(
                payload.get("TransMsg", "ECPay transport error"),
                trans_code=payload.get("TransCode"),
            )
        decrypted = aes_decrypt(
            payload["Data"], self.config.hash_key, self.config.hash_iv
        )
        if decrypted.get("RtnCode") != 1:
            raise EcpayApiError(
                decrypted.get("RtnMsg", "ECPay business error"),
                trans_code=1,
                rtn_code=decrypted.get("RtnCode"),
            )
        return decrypted

    def create_binding_token(
        self,
        *,
        user_email: str,
        user_name: str,
        user_id: object,
        merchant_trade_no: str,
        return_url: str,
        order_result_url: str,
    ) -> dict:
        # Ref: https://developers.ecpay.com.tw/35591/
        return self.__post(
            "/Merchant/GetTokenbyBindingCard",
            {
                "MerchantID": self.config.merchant_id,
                "ConsumerInfo": {
                    "MerchantMemberID": merchant_member_id(user_id),
                    "Email": user_email,
                    "Name": user_name[:50],
                    "CountryCode": ECPAY_COUNTRY_CODE_TAIWAN,
                },
                "OrderInfo": {
                    "MerchantTradeDate": datetime.now(TAIPEI).strftime(
                        "%Y/%m/%d %H:%M:%S"
                    ),
                    "MerchantTradeNo": merchant_trade_no,
                    "TotalAmount": CARD_BINDING_VERIFICATION_AMOUNT,
                    "TradeDesc": "Taigu subscription card binding",
                    "ItemName": "Taigu Card Verification",
                    "ReturnURL": return_url,
                },
                "OrderResultURL": order_result_url,
                "CustomField": str(user_id),
            },
        )

    def create_bind_card(self, *, bind_card_pay_token: str, user_id: object) -> dict:
        return self.__post(
            "/Merchant/CreateBindCard",
            {
                "MerchantID": self.config.merchant_id,
                "BindCardPayToken": bind_card_pay_token,
                "MerchantMemberID": merchant_member_id(user_id),
            },
        )

    def create_payment_with_card_id(
        self,
        *,
        bind_card_id: str,
        user_id: object,
        user_email: str,
        user_name: str,
        merchant_trade_no: str,
        amount: int,
        return_url: str,
    ) -> dict:
        return self.__post(
            "/Merchant/CreatePaymentWithCardID",
            {
                "MerchantID": self.config.merchant_id,
                "BindCardID": bind_card_id,
                "OrderInfo": {
                    "MerchantTradeDate": datetime.now(TAIPEI).strftime(
                        "%Y/%m/%d %H:%M:%S"
                    ),
                    "MerchantTradeNo": merchant_trade_no,
                    "TotalAmount": amount,
                    "ReturnURL": return_url,
                    "TradeDesc": "Taigu Standard subscription",
                    "ItemName": "Taigu Standard",
                },
                "ConsumerInfo": {
                    "MerchantMemberID": merchant_member_id(user_id),
                    "Email": user_email,
                    "Name": user_name[:50],
                    "CountryCode": ECPAY_COUNTRY_CODE_TAIWAN,
                },
                "CustomField": str(user_id),
            },
        )


def get_ecpay_return_url() -> str:
    return f"{get_public_api_origin()}/api/billing/ecpay/return"


def get_ecpay_bind_result_url() -> str:
    return f"{get_public_api_origin()}/api/billing/ecpay/bind-result"
