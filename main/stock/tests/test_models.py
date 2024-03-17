import time

import pytest

from .. import UnknownStockIdError
from ..models import Company, CompanyManager


def test_fetch_company_info():
    assert CompanyManager.fetch_company_info("2330") == {
        "name": "台積電",
        "trade_type": "tse",
    }
    time.sleep(0.5)  # to avoid reaching the rate limit

    with pytest.raises(UnknownStockIdError):
        CompanyManager.fetch_company_info("no_such_sid")
    time.sleep(0.5)  # to avoid reaching the rate limit


@pytest.mark.django_db
def test_company_class():
    c, is_new = Company.objects.get_or_create(pk="2330")
    assert c.stock_id == "2330"
    time.sleep(0.5)  # to avoid reaching the rate limit

    with pytest.raises(UnknownStockIdError):
        c, is_new = Company.objects.get_or_create(pk="no_such_sid")
    time.sleep(0.5)  # to avoid reaching the rate limit

    c = Company.objects.get(pk="2330")
    assert c.stock_id == "2330"
    time.sleep(0.5)  # to avoid reaching the rate limit
