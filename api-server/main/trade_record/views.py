import json
from datetime import datetime

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_http_methods

from main.core.data_change import append_data_change_log
from main.core.data_change import get_last_revision as get_data_change_last_revision
from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.core.models import DataChangeLog
from main.market.models import Company
from main.trade_record.models import TradeRecord

TRADE_RECORD_SUBJECT = DataChangeLog.Subject.TRADE_RECORD


@rate_limit(rate=2)
@require_login
@require_http_methods(["GET", "POST"])
def create_or_list(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return _list(request)
    elif request.method == "POST":
        return _create(request)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def _list(request: HttpRequest) -> JsonResponse:
    since_revision = request.GET.get("since_revision")
    deal_times = [
        datetime.strptime(d, "%Y-%m-%d").date()
        for d in json.loads(request.GET.get("deal_times", "[]"))  # type: ignore
    ]
    sids = json.loads(request.GET.get("sids", "[]"))  # type: ignore

    if since_revision is not None and not deal_times and not sids:
        return _list_incremental(request, int(since_revision))

    if deal_times or sids:
        if deal_times and sids:
            query_set = request.user.trade_records.filter(
                deal_time__in=deal_times
            ).filter(company__pk__in=sids)
        elif not deal_times:
            query_set = request.user.trade_records.filter(company__pk__in=sids)
        else:
            query_set = request.user.trade_records.filter(deal_time__in=deal_times)
    else:
        query_set = request.user.trade_records.all()

    query_set = query_set.select_related("company").order_by(
        "-deal_time", "-created_at"
    )
    last_revision = _get_last_revision(request.user)
    return JsonResponse(
        {
            "last_revision": last_revision,
            "updates": [_serialize_trade_record(record) for record in query_set],
            "deletes": [],
            "is_full_snapshot": True,
        }
    )


def _list_incremental(request: HttpRequest, since_revision: int) -> JsonResponse:
    change_logs = list(
        DataChangeLog.objects.filter(
            user=request.user,
            subject=TRADE_RECORD_SUBJECT,
            revision__gte=since_revision,
        ).order_by("revision")
    )

    if not change_logs:
        return _full_snapshot_response(request, since_revision)

    first_revision = change_logs[0].revision
    last_revision = change_logs[-1].revision
    # The requested cursor is older than the retained change log window, so
    # deltas would be incomplete. Send a full snapshot to rebuild the client cache.
    if since_revision > 0 and first_revision != since_revision:
        return _full_snapshot_response(request, last_revision)

    if since_revision != 0:
        change_logs = change_logs[1:]
    if not change_logs:
        return JsonResponse(
            {
                "last_revision": since_revision,
                "updates": [],
                "deletes": [],
                "is_full_snapshot": False,
            }
        )

    updated_record_ids = {
        int(log.subject_id)
        for log in change_logs
        if log.operation == DataChangeLog.Operation.UPSERT
    }
    deleted_record_ids = [
        int(log.subject_id)
        for log in change_logs
        if log.operation == DataChangeLog.Operation.DELETE
    ]
    updated_records = (
        request.user.trade_records.filter(pk__in=updated_record_ids)
        .select_related("company")
        .order_by("-deal_time", "-created_at")
    )
    return JsonResponse(
        {
            "last_revision": last_revision,
            "updates": [_serialize_trade_record(record) for record in updated_records],
            "deletes": deleted_record_ids,
            "is_full_snapshot": False,
        }
    )


def _create(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body)

    if (
        (not (deal_time := payload.get("deal_time")))
        or (not (sid := payload.get("sid")))
        or ((deal_price := payload.get("deal_price")) is None)
        or ((deal_quantity := payload.get("deal_quantity")) is None)
        or ((handling_fee := payload.get("handling_fee")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    if deal_price < 0:
        return JsonResponse({"message": "Deal price must be positive"}, status=400)
    if handling_fee < 0:
        return JsonResponse({"message": "Handling fee must be positive"}, status=400)

    try:
        company = Company.objects.get(pk=str(sid))
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

    with transaction.atomic():
        record = TradeRecord.objects.create(
            owner=request.user,
            company=company,
            deal_time=datetime.strptime(str(deal_time), "%Y-%m-%d").date(),
            deal_price=float(deal_price),
            deal_quantity=int(deal_quantity),
            handling_fee=int(handling_fee),
        )
        append_data_change_log(
            user=request.user,
            subject=TRADE_RECORD_SUBJECT,
            subject_id=record.pk,
            operation=DataChangeLog.Operation.UPSERT,
        )
    return JsonResponse(_serialize_trade_record(record))


@rate_limit(rate=1)
@require_login
@require_http_methods(["POST", "DELETE"])
def update_or_delete(request: HttpRequest, id: str | int) -> JsonResponse:
    if request.method == "POST":
        return _update(request, id)
    elif request.method == "DELETE":
        return _delete(request, id)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def _update(request: HttpRequest, id: str | int) -> JsonResponse:
    payload = json.loads(request.body)

    if (
        (not (deal_time := payload.get("deal_time")))
        or (not (sid := payload.get("sid")))
        or ((deal_price := payload.get("deal_price")) is None)
        or ((deal_quantity := payload.get("deal_quantity")) is None)
        or ((handling_fee := payload.get("handling_fee")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    if deal_price < 0:
        return JsonResponse({"message": "Deal price must be positive"}, status=400)
    if handling_fee < 0:
        return JsonResponse({"message": "Handling fee must be positive"}, status=400)

    try:
        company = Company.objects.get(pk=str(sid))
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

    with transaction.atomic():
        record = TradeRecord.objects.select_for_update().get(
            pk=int(id), owner=request.user
        )
        record.company = company
        record.deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
        record.deal_price = float(deal_price)
        record.deal_quantity = int(deal_quantity)
        record.handling_fee = int(handling_fee)
        record.save()
        append_data_change_log(
            user=request.user,
            subject=TRADE_RECORD_SUBJECT,
            subject_id=record.pk,
            operation=DataChangeLog.Operation.UPSERT,
        )
    return JsonResponse(_serialize_trade_record(record))


def _delete(request: HttpRequest, id: str | int) -> JsonResponse:
    with transaction.atomic():
        record = TradeRecord.objects.select_for_update().get(
            pk=int(id), owner=request.user
        )
        record_id = record.pk
        record.delete()
        append_data_change_log(
            user=request.user,
            subject=TRADE_RECORD_SUBJECT,
            subject_id=record_id,
            operation=DataChangeLog.Operation.DELETE,
        )
    return JsonResponse({})


def _get_last_revision(user) -> int:  # noqa: ANN001
    return get_data_change_last_revision(user=user, subject=TRADE_RECORD_SUBJECT)


def _full_snapshot_response(request: HttpRequest, last_revision: int) -> JsonResponse:
    query_set = request.user.trade_records.select_related("company").order_by(
        "-deal_time", "-created_at"
    )
    return JsonResponse(
        {
            "last_revision": last_revision,
            "updates": [_serialize_trade_record(record) for record in query_set],
            "deletes": [],
            "is_full_snapshot": True,
        }
    )


def _serialize_trade_record(record: TradeRecord) -> dict:
    return {
        "id": record.pk,
        "deal_time": record.deal_time,
        "sid": record.company.pk,
        "company_name": record.company.name,
        "deal_price": record.deal_price,
        "deal_quantity": record.deal_quantity,
        "handling_fee": record.handling_fee,
    }
