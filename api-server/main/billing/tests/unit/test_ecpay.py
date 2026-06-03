from types import SimpleNamespace

from _pytest.monkeypatch import MonkeyPatch
from django.test import RequestFactory

from main.billing import views
from main.billing.services.ecpay import (
    EcpayClient,
    EcpayConfig,
    generate_check_mac_value,
    generate_merchant_trade_no,
    get_ecpay_checkout_result_url,
    verify_check_mac_value,
)


class ConfiguredEcpayClient(EcpayClient):
    def __init__(self) -> None:
        self.config = EcpayConfig(
            merchant_id="3002607",
            hash_key="pwFHCqoQZGmho4w6",
            hash_iv="EkRm7iFT261dpevs",
            aio_base_url="https://payment-stage.ecpay.com.tw",
        )


def test_generate_merchant_trade_no() -> None:
    trade_no = generate_merchant_trade_no("B")

    assert trade_no.startswith("B")
    assert len(trade_no) == 20
    assert trade_no.isalnum()


def test_ecpay_check_mac_value_round_trip() -> None:
    data = {
        "MerchantID": "3002607",
        "MerchantTradeNo": "S123",
        "MerchantTradeDate": "2026/06/02 10:00:00",
        "PaymentType": "aio",
        "TotalAmount": 65,
        "TradeDesc": "Taigu Standard subscription",
        "ItemName": "Taigu Standard",
        "ReturnURL": "https://local.taigu.tw/api/billing/ecpay/return",
        "ChoosePayment": "Credit",
        "EncryptType": 1,
    }

    data["CheckMacValue"] = generate_check_mac_value(
        data, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs"
    )

    assert verify_check_mac_value(data, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs")


def test_checkout_result_url_flags_ecpay_checkout(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(
        "main.billing.services.ecpay.get_public_frontend_origin",
        lambda: "https://local.taigu.tw",
    )

    assert (
        get_ecpay_checkout_result_url()
        == "https://local.taigu.tw/settings/current-plan?checkout=ecpay"
    )


def test_periodic_checkout_uses_aio_periodic_fields() -> None:
    client = ConfiguredEcpayClient()

    checkout = client.build_aio_periodic_checkout_form(
        user_id="user-id",
        merchant_trade_no="S123",
        amount=65,
        billing_interval="month",
        return_url="https://local.taigu.tw/api/billing/ecpay/return",
        period_return_url="https://local.taigu.tw/api/billing/ecpay/period-return",
        client_back_url="https://local.taigu.tw/settings/current-plan",
    )

    params = checkout["params"]
    assert checkout["action_url"] == (
        "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"
    )
    assert params["MerchantTradeNo"] == "S123"
    assert params["ChoosePayment"] == "Credit"
    assert params["PeriodType"] == "M"
    assert params["Frequency"] == 1
    assert params["ExecTimes"] == 999
    assert verify_check_mac_value(params, client.config.hash_key, client.config.hash_iv)


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
    monkeypatch.setattr(views, "verify_check_mac_value", lambda *args: True)
    request = RequestFactory().post("/api/billing/ecpay/return", data={})

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
    monkeypatch.setattr(views, "verify_check_mac_value", lambda *args: True)
    monkeypatch.setattr(
        views.SubscriptionPayment.objects,
        "get",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("database unavailable")),
    )
    request = RequestFactory().post(
        "/api/billing/ecpay/return", data={"MerchantTradeNo": "S123", "RtnCode": "1"}
    )

    response = views.ecpay_return(request)

    assert response.status_code == 200
    assert response.content == b"0|ERROR"
