from django.db import transaction

from main.account.models import User
from main.billing.models import CardBinding, CardStatus, PaymentProvider
from main.billing.services.ecpay import (
    EcpayClient,
    generate_merchant_trade_no,
    get_ecpay_bind_result_url,
    get_ecpay_return_url,
    merchant_member_id,
)


def create_card_binding_token(*, user: User, client: EcpayClient | None = None) -> dict:
    ecpay_client = client or EcpayClient()
    merchant_trade_no = generate_merchant_trade_no("B")
    binding = CardBinding.objects.create(
        user=user,
        provider=PaymentProvider.ECPAY,
        provider_member_id=merchant_member_id(user.id),
        provider_request_id=merchant_trade_no,
    )
    response = ecpay_client.create_binding_token(
        user_email=user.email,
        user_name=user.username,
        user_id=user.id,
        merchant_trade_no=merchant_trade_no,
        return_url=get_ecpay_return_url(),
        order_result_url=get_ecpay_bind_result_url(),
    )
    binding.raw_response = response
    binding.save()
    return {
        "token": response["Token"],
        "token_expires_at": response.get("TokenExpireDate"),
    }


@transaction.atomic
def activate_card_binding(data: dict) -> CardBinding:
    order_info = data.get("OrderInfo", {})
    merchant_trade_no = order_info.get("MerchantTradeNo")
    binding = CardBinding.objects.select_for_update().get(
        provider=PaymentProvider.ECPAY, provider_request_id=merchant_trade_no
    )
    if data.get("RtnCode") != 1:
        binding.status = CardStatus.FAILED
        binding.raw_response = data
        binding.save()
        return binding

    card_info = data.get("CardInfo", {})
    binding.provider_binding_id = data.get("BindCardID")
    binding.card_6_no = card_info.get("Card6No")
    binding.card_4_no = card_info.get("Card4No")
    binding.status = CardStatus.ACTIVE
    binding.raw_response = data
    CardBinding.objects.filter(
        user=binding.user,
        provider=binding.provider,
        status=CardStatus.ACTIVE,
    ).exclude(pk=binding.pk).update(status=CardStatus.DELETED)
    binding.save()
    return binding


def get_default_active_card(user: User) -> CardBinding | None:
    return (
        CardBinding.objects.filter(
            user=user, provider=PaymentProvider.ECPAY, status=CardStatus.ACTIVE
        )
        .exclude(provider_binding_id__isnull=True)
        .order_by("-updated_at")
        .first()
    )


def serialize_card(card: CardBinding | None) -> dict | None:
    if card is None:
        return None
    return {
        "id": str(card.id),
        "card_6_no": card.card_6_no,
        "card_4_no": card.card_4_no,
        "status": card.status,
    }
