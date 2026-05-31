import json
from types import SimpleNamespace

from _pytest.monkeypatch import MonkeyPatch
from django.test import RequestFactory

from main.billing import views
from main.billing.services.ecpay import (
    EcpayClient,
    EcpayConfig,
    aes_decrypt,
    aes_encrypt,
    generate_merchant_trade_no,
)


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

    def capture_post(self, path: str, data: dict) -> dict:
        self.data = data
        return {"Token": "token"}


CapturingEcpayClient._EcpayClient__post = CapturingEcpayClient.capture_post


def test_generate_merchant_trade_no() -> None:
    trade_no = generate_merchant_trade_no("B")

    assert trade_no.startswith("B")
    assert len(trade_no) == 20
    assert trade_no.isalnum()


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


def test_ecpay_return_acks_invalid_payload() -> None:
    request = RequestFactory().post(
        "/api/billing/ecpay/return", data=b"{", content_type="application/json"
    )

    response = views.ecpay_return(request)

    assert response.status_code == 200
    assert response.content == b"1|OK"


def test_ecpay_return_acks_missing_merchant_trade_no(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(
        views,
        "get_ecpay_config",
        lambda: SimpleNamespace(hash_key="hash-key", hash_iv="hash-iv"),
    )
    monkeypatch.setattr(views, "aes_decrypt", lambda *args: {"OrderInfo": {}})
    request = RequestFactory().post(
        "/api/billing/ecpay/return",
        data=json.dumps({"Data": "encrypted"}),
        content_type="application/json",
    )

    response = views.ecpay_return(request)

    assert response.status_code == 200
    assert response.content == b"1|OK"


def test_ecpay_return_requests_retry_when_processing_fails(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        views,
        "get_ecpay_config",
        lambda: SimpleNamespace(hash_key="hash-key", hash_iv="hash-iv"),
    )
    monkeypatch.setattr(
        views,
        "aes_decrypt",
        lambda *args: {"OrderInfo": {"MerchantTradeNo": "S123"}, "RtnCode": 1},
    )
    monkeypatch.setattr(
        views.SubscriptionPayment.objects,
        "get",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("database unavailable")),
    )
    request = RequestFactory().post(
        "/api/billing/ecpay/return",
        data=json.dumps({"Data": "encrypted"}),
        content_type="application/json",
    )

    response = views.ecpay_return(request)

    assert response.status_code == 200
    assert response.content == b"0|ERROR"
