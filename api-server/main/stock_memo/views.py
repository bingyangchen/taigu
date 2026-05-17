import json

from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST

from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.market.models import Company
from main.stock_memo.models import StockMemo


@rate_limit(rate=1)
@require_POST
@require_login
def update_or_create_stock_memo(request: HttpRequest, sid: str) -> JsonResponse:
    note = json.loads(request.body)["note"] or ""

    try:
        company = Company.objects.get(pk=sid)
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

    memo, _created = StockMemo.objects.update_or_create(
        owner=request.user, company=company, defaults={"note": note}
    )
    return JsonResponse(
        {
            "sid": memo.company.pk,
            "company_name": memo.company.name,
            "business": company.business,
            "note": memo.note,
        }
    )


@rate_limit(rate=3)
@require_GET
@require_login
def list_company_info(request: HttpRequest) -> JsonResponse:
    sids = [sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid]
    if not sids:
        return JsonResponse({"message": "sids is required."}, status=400)

    company_query_set = Company.objects.prefetch_related("material_facts").filter(
        pk__in=sids
    )
    memo_query_set = request.user.stock_memos.filter(company__pk__in=sids)  # type: ignore
    stock_id_memo_map = {
        memo.company.pk: memo.note for memo in memo_query_set.select_related("company")
    }
    result = {}
    for company in company_query_set:
        result[company.pk] = {
            "sid": company.pk,
            "company_name": company.name,
            "business": company.business,
            "note": stock_id_memo_map.get(company.pk, ""),
            "material_facts": sorted(
                [
                    {
                        "date_time": m.date_time,
                        "title": m.title,
                        "description": m.description,
                    }
                    for m in company.material_facts.all()  # type: ignore
                ],
                key=lambda x: x["date_time"],
                reverse=True,
            ),
        }
    return JsonResponse(result)
