import json
import logging

from django.http import HttpRequest, HttpResponse, HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

from main.billing.models import (
    BillingInterval,
    PaymentStatus,
    Plan,
    SubscriptionPayment,
    SubscriptionStatus,
)
from main.billing.services.card import (
    activate_card_binding,
    create_card_binding_token,
    get_default_active_card,
    serialize_card,
)
from main.billing.services.ecpay import (
    EcpayApiError,
    EcpayClient,
    aes_decrypt,
    get_ecpay_config,
)
from main.billing.services.entitlements import (
    ensure_billing_profile,
    serialize_entitlements,
)
from main.billing.services.subscription import (
    STANDARD_PRICES,
    SubscriptionPaymentNotChargeableError,
    create_subscription_payment,
    mark_payment_failed,
    mark_payment_paid,
)
from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.origins import get_public_frontend_origin

logger = logging.getLogger(__name__)


@require_http_methods(["GET", "POST"])
@require_login
def handle_subscription(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return _get_subscription(request)
    if request.method == "POST":
        return _start_subscription(request)
    return JsonResponse({"message": "Method Not Allowed"}, status=405)


@rate_limit(rate=3)
def _get_subscription(request: HttpRequest) -> JsonResponse:
    user = request.user
    card = get_default_active_card(user)
    return JsonResponse(
        {
            "subscription": serialize_entitlements(user),
            "card": serialize_card(card),
            "prices": STANDARD_PRICES,
        }
    )


@rate_limit(rate=0.5)
def _start_subscription(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body or "{}")
    plan = payload.get("plan")
    if plan != Plan.STANDARD:
        return JsonResponse({"message": "Unsupported subscription plan"}, status=400)
    interval = payload.get("billing_interval", BillingInterval.MONTH)
    try:
        payment = create_subscription_payment(user=request.user, interval=interval)
    except (SubscriptionPaymentNotChargeableError, ValueError) as error:
        return JsonResponse({"message": str(error)}, status=400)
    except EcpayApiError as error:
        logger.warning("Failed to charge ECPay subscription: %s", error)
        return JsonResponse({"message": str(error)}, status=502)
    return JsonResponse(
        {"subscription_activated": payment.status == PaymentStatus.PAID}
    )


@rate_limit(rate=0.5)
@require_POST
@require_login
def init_card_binding(request: HttpRequest) -> JsonResponse:
    try:
        config = get_ecpay_config()
        token_result = create_card_binding_token(user=request.user)
        return JsonResponse(
            {
                **token_result,
                "sdk_environment": config.sdk_environment,
                "sdk_url": config.sdk_url,
            }
        )
    except EcpayApiError as error:
        logger.error("Failed to create ECPay binding token: %s", error)
        return JsonResponse({"message": str(error)}, status=502)


@rate_limit(rate=0.5)
@require_POST
@require_login
def confirm_card_binding(request: HttpRequest) -> JsonResponse:
    try:
        payload = json.loads(request.body)
        token = payload.get("bind_card_pay_token")
        if not token:
            return JsonResponse(
                {"message": "bind_card_pay_token is required"}, status=400
            )
        result = EcpayClient().create_bind_card(
            bind_card_pay_token=token, user_id=request.user.pk
        )
        if three_d_url := result.get("ThreeDInfo", {}).get("ThreeDURL"):
            return JsonResponse({"three_d_url": three_d_url})
        activate_card_binding(result)
        return JsonResponse({})
    except EcpayApiError as error:
        logger.warning("Failed to create ECPay card binding: %s", error)
        return JsonResponse({"message": str(error)}, status=502)


@rate_limit(rate=0.5)
@require_POST
@require_login
def cancel_subscription(request: HttpRequest) -> JsonResponse:
    profile = ensure_billing_profile(request.user)
    if profile.subscription_status == SubscriptionStatus.TRIALING:
        profile.plan = Plan.FREE
        profile.subscription_status = SubscriptionStatus.CANCELED
    else:
        profile.cancel_at_period_end = True
    profile.save()
    return JsonResponse({"subscription": serialize_entitlements(request.user)})


@csrf_exempt
@require_POST
def ecpay_return(request: HttpRequest) -> HttpResponse:
    # Ref: https://developers.ecpay.com.tw/35601/
    try:
        payload = json.loads(request.body)
        config = get_ecpay_config()
        data = aes_decrypt(payload["Data"], config.hash_key, config.hash_iv)
    except Exception:
        logger.exception("Invalid ECPay ReturnURL payload")
        return HttpResponse("1|OK", content_type="text/plain")

    provider_request_id = data.get("OrderInfo", {}).get("MerchantTradeNo")
    if not provider_request_id:
        logger.error("ECPay ReturnURL missing MerchantTradeNo: %s", data)
        return HttpResponse("1|OK", content_type="text/plain")

    try:
        if provider_request_id.startswith("B"):
            activate_card_binding(data)
        elif provider_request_id.startswith("S"):
            payment = SubscriptionPayment.objects.get(
                provider_request_id=provider_request_id
            )
            if data.get("RtnCode") == 1:
                mark_payment_paid(payment, data)
            else:
                mark_payment_failed(provider_request_id, data)
        else:
            logger.error(
                "Unknown ECPay MerchantTradeNo prefix: %s", provider_request_id
            )
    except Exception:
        logger.exception("Failed to process ECPay ReturnURL")
        return HttpResponse("0|ERROR", content_type="text/plain")
    return HttpResponse("1|OK", content_type="text/plain")


@csrf_exempt
@require_POST
def ecpay_bind_result(request: HttpRequest) -> HttpResponse:
    # Ref: https://developers.ecpay.com.tw/35606/
    try:
        result_data = request.POST.get("ResultData")
        if not result_data:
            raise ValueError("ResultData is required")
        outer = json.loads(result_data)
        config = get_ecpay_config()
        data = aes_decrypt(outer["Data"], config.hash_key, config.hash_iv)
        activate_card_binding(data)
        redirect_url = (
            f"{get_public_frontend_origin()}/settings/current-plan?bind=success"
        )
    except Exception:
        logger.exception("Failed to process ECPay OrderResultURL")
        redirect_url = (
            f"{get_public_frontend_origin()}/settings/current-plan?bind=failed"
        )

    return HttpResponseRedirect(redirect_url)
