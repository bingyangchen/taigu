from main.billing.ecpay import EcpayClient, EcpayConfig, aes_decrypt, aes_encrypt


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
    assert client.data["OrderInfo"]["TotalAmount"] == "10"
