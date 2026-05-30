import pytest

from main.account import OAuthOrganization
from main.account.models import User
from main.billing.models import CardBinding, CardStatus, PaymentProvider
from main.billing.services.card import (
    activate_card_binding,
    create_card_binding_token,
    get_default_active_card,
)
from main.billing.services.ecpay import (
    get_ecpay_bind_result_url,
    get_ecpay_return_url,
    merchant_member_id,
)


class FakeEcpayClient:
    def __init__(self) -> None:
        self.request: dict | None = None

    def create_binding_token(self, **kwargs) -> dict:  # noqa: ANN003
        self.request = kwargs
        return {"Token": "binding-token", "TokenExpireDate": "2026/01/01 12:00:00"}


@pytest.mark.django_db
class TestCardBinding:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="oauth-id",
            email="test@example.com",
            username="Test User",
        )

    def test_create_card_binding_token_creates_pending_binding(
        self, user: User
    ) -> None:
        client = FakeEcpayClient()

        result = create_card_binding_token(user=user, client=client)

        binding = CardBinding.objects.get(user=user, status=CardStatus.PENDING)
        assert result == {
            "token": "binding-token",
            "token_expires_at": "2026/01/01 12:00:00",
        }
        assert client.request is not None
        assert client.request["return_url"] == get_ecpay_return_url()
        assert client.request["order_result_url"] == get_ecpay_bind_result_url()
        assert client.request["merchant_trade_no"] == binding.provider_request_id
        assert binding.user == user
        assert binding.provider == PaymentProvider.ECPAY
        assert binding.provider_member_id == merchant_member_id(user.id)
        assert binding.status == CardStatus.PENDING
        assert binding.raw_response == {
            "Token": "binding-token",
            "TokenExpireDate": "2026/01/01 12:00:00",
        }

    def test_activate_card_binding_from_success_response(self, user: User) -> None:
        binding = CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B123",
        )

        result = activate_card_binding(
            {
                "RtnCode": 1,
                "OrderInfo": {"MerchantTradeNo": "B123"},
                "BindCardID": "bind-card-id",
                "CardInfo": {"Card6No": "431195", "Card4No": "2222"},
            }
        )

        binding.refresh_from_db()
        assert result == binding
        assert binding.status == CardStatus.ACTIVE
        assert binding.provider_binding_id == "bind-card-id"
        assert binding.card_6_no == "431195"
        assert binding.card_4_no == "2222"

    def test_activate_card_binding_from_failure_response(self, user: User) -> None:
        binding = CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B123",
        )
        response = {
            "RtnCode": 0,
            "RtnMsg": "Binding failed",
            "OrderInfo": {"MerchantTradeNo": "B123"},
        }

        activate_card_binding(response)

        binding.refresh_from_db()
        assert binding.status == CardStatus.FAILED
        assert binding.provider_binding_id is None
        assert binding.raw_response == response

    def test_get_default_active_card_returns_latest_bound_card(
        self, user: User
    ) -> None:
        CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B123",
            status=CardStatus.FAILED,
        )
        first_active = CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B124",
            provider_binding_id="first-bind-card-id",
            status=CardStatus.ACTIVE,
        )
        latest_active = CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B125",
            provider_binding_id="latest-bind-card-id",
            status=CardStatus.ACTIVE,
        )

        assert first_active.provider_binding_id
        assert get_default_active_card(user) == latest_active
