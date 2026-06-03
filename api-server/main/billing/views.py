import json
import logging

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

from main.billing.models import (
    BillingInterval,
    Plan,
    SubscriptionPayment,
    SubscriptionStatus,
)
from main.billing.services.ecpay import (
    EcpayApiError,
    EcpayClient,
    get_ecpay_checkout_result_url,
    get_ecpay_config,
    verify_check_mac_value,
)
from main.billing.services.entitlements import (
    ensure_billing_profile,
    serialize_entitlements,
)
from main.billing.services.subscription import (
    STANDARD_PRICES,
    SubscriptionPaymentNotChargeableError,
    create_subscription_checkout,
    get_active_provider_subscription_id,
    mark_payment_failed,
    mark_payment_paid,
    process_period_payment_callback,
)
from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit

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
    return JsonResponse(
        {"subscription": serialize_entitlements(user), "prices": STANDARD_PRICES}
    )


@rate_limit(rate=0.5)
def _start_subscription(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body or "{}")
    plan = payload.get("plan")
    if plan != Plan.STANDARD:
        return JsonResponse({"message": "Unsupported subscription plan"}, status=400)
    interval = payload.get("billing_interval", BillingInterval.MONTH)
    try:
        checkout = create_subscription_checkout(user=request.user, interval=interval)
    except (SubscriptionPaymentNotChargeableError, ValueError) as error:
        return JsonResponse({"message": str(error)}, status=400)
    except EcpayApiError as error:
        logger.warning("Failed to create ECPay subscription checkout: %s", error)
        return JsonResponse({"message": str(error)}, status=502)
    return JsonResponse(checkout)


@rate_limit(rate=0.5)
@require_POST
@require_login
def cancel_subscription(request: HttpRequest) -> JsonResponse:
    profile = ensure_billing_profile(request.user)
    if profile.plan != Plan.STANDARD or profile.subscription_status not in [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
    ]:
        return JsonResponse({"message": "No active subscription to cancel"}, status=400)

    if profile.cancel_at_period_end:
        return JsonResponse({"subscription": serialize_entitlements(request.user)})

    if provider_subscription_id := get_active_provider_subscription_id(request.user):
        try:
            EcpayClient().cancel_aio_periodic_order(
                merchant_trade_no=provider_subscription_id
            )
        except EcpayApiError as error:
            logger.warning("Failed to cancel ECPay periodic subscription: %s", error)
            return JsonResponse({"message": str(error)}, status=502)
    profile.cancel_at_period_end = True
    profile.save()
    return JsonResponse({"subscription": serialize_entitlements(request.user)})


@csrf_exempt
@require_POST
def ecpay_return(request: HttpRequest) -> HttpResponse:
    # Ref: https://developers.ecpay.com.tw/2878/
    # 使用者手動完成付款後，綠界會呼叫此 API。
    try:
        data = request.POST.dict()
        config = get_ecpay_config()
        if not verify_check_mac_value(data, config.hash_key, config.hash_iv):
            raise ValueError("Invalid CheckMacValue")
    except Exception:
        logger.exception("Invalid ECPay ReturnURL payload")
        return HttpResponse("1|OK", content_type="text/plain")

    provider_request_id = data.get("MerchantTradeNo")
    if not provider_request_id:
        logger.error("ECPay ReturnURL missing MerchantTradeNo: %s", data)
        return HttpResponse("1|OK", content_type="text/plain")

    try:
        payment = SubscriptionPayment.objects.get(
            provider_request_id=provider_request_id
        )
    except SubscriptionPayment.DoesNotExist:
        logger.error("Unknown ECPay MerchantTradeNo: %s", provider_request_id)
        return HttpResponse("1|OK", content_type="text/plain")
    except Exception:
        logger.exception("Failed to fetch ECPay payment")
        return HttpResponse("0|ERROR", content_type="text/plain")

    try:
        if str(data.get("RtnCode")) == "1":
            mark_payment_paid(
                payment,
                {
                    **data,
                    "OrderInfo": {
                        "MerchantTradeNo": data.get("MerchantTradeNo"),
                        "TradeNo": data.get("TradeNo"),
                        "TotalAmount": data.get("TradeAmt"),
                    },
                },
                expected_merchant_id=config.merchant_id,
            )
        else:
            mark_payment_failed(provider_request_id, data)
    except Exception:
        logger.exception("Failed to process ECPay ReturnURL")
        return HttpResponse("0|ERROR", content_type="text/plain")
    return HttpResponse("1|OK", content_type="text/plain")


@csrf_exempt
@require_POST
def ecpay_order_result(request: HttpRequest) -> HttpResponse:
    response = HttpResponse(status=303)
    response["Location"] = get_ecpay_checkout_result_url()
    return response


@csrf_exempt
@require_POST
def ecpay_period_return(request: HttpRequest) -> HttpResponse:
    # Ref: https://developers.ecpay.com.tw/5631/
    # 系統自動定期扣款後，綠界會呼叫此 API。
    try:
        data = request.POST.dict()
        config = get_ecpay_config()
        if not verify_check_mac_value(data, config.hash_key, config.hash_iv):
            raise ValueError("Invalid CheckMacValue")
        process_period_payment_callback(data, expected_merchant_id=config.merchant_id)
    except Exception:
        logger.exception("Failed to process ECPay PeriodReturnURL")
        return HttpResponse("0|ERROR", content_type="text/plain")
    return HttpResponse("1|OK", content_type="text/plain")
