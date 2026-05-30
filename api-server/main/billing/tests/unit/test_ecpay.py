from datetime import datetime
from zoneinfo import ZoneInfo

from _pytest.monkeypatch import MonkeyPatch

from main.billing.ecpay import (
    EcpayClient,
    EcpayConfig,
    aes_decrypt,
    aes_encrypt,
    next_period_end,
)
from main.billing.models import BillingInterval


class CapturingEcpayClient(EcpayClient):
    def __init__(self) -> None:
        self.config = EcpayConfig(
            merchant_id="3002607",
            hash_key="pwFHCqoQZGmho4w6",
            hash_iv="EkRm7iFT261dpevs",
            ecpg_base_url="https://ecpg-stage.ecpay.com.tw",
            sdk_environment="Stage",
        )
        self.data = None

    def post(self, path: str, data: dict) -> dict:
        self.data = data
        return {"Token": "token"}


def test_ecpay_aes_round_trip() -> None:
    data = {
        "MerchantID": "3002607",
        "ConsumerInfo": {
            "MerchantMemberID": "member001",
            "Email": "test@example.com",
            "Name": "王大明",
        },
    }

    encrypted = aes_encrypt(data, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")
    decrypted = aes_decrypt(encrypted, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")

    assert decrypted == data


def test_binding_token_uses_ecpay_verification_amount() -> None:
    client = CapturingEcpayClient()

    client.create_binding_token(
        user_email="test@example.com",
        user_name="Test User",
        user_id="user-id",
        merchant_trade_no="B123",
        return_url="https://local.taigu.tw/api/billing/ecpay/return",
        order_result_url="https://local.taigu.tw/api/billing/ecpay/bind-result",
    )

    assert client.data is not None
    assert client.data["OrderInfo"]["TotalAmount"] == "2"


def test_next_period_end_uses_calendar_month(monkeypatch: MonkeyPatch) -> None:
    fixed_now = datetime(2024, 1, 31, 10, 0, tzinfo=ZoneInfo("Asia/Taipei"))
    monkeypatch.setattr("main.billing.ecpay.timezone.now", lambda: fixed_now)

    period_end = next_period_end(BillingInterval.MONTH)

    assert period_end == datetime(2024, 2, 29, 10, 0, tzinfo=ZoneInfo("Asia/Taipei"))


def test_next_period_end_uses_calendar_year(monkeypatch: MonkeyPatch) -> None:
    fixed_now = datetime(2024, 2, 29, 10, 0, tzinfo=ZoneInfo("Asia/Taipei"))
    monkeypatch.setattr("main.billing.ecpay.timezone.now", lambda: fixed_now)

    period_end = next_period_end(BillingInterval.YEAR)

    assert period_end == datetime(2025, 2, 28, 10, 0, tzinfo=ZoneInfo("Asia/Taipei"))
