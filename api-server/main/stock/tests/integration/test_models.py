import time

import pytest

from main.stock import UnknownStockIdError
from main.stock.models import Company, CompanyManager


class TestCompanyManager:
    def test_fetch_company_info_success(self) -> None:
        info = CompanyManager.fetch_company_info("2330")
        assert info["name"] == "台積電"
        assert info["business"] != ""
        time.sleep(0.5)  # to avoid reaching the rate limit

    def test_fetch_company_info_unknown_stock_id(self) -> None:
        with pytest.raises(UnknownStockIdError):
            CompanyManager.fetch_company_info("no_such_sid")
        time.sleep(0.5)  # to avoid reaching the rate limit


@pytest.mark.django_db
class TestCompanyModel:
    def test_company_class_success(self) -> None:
        c, is_new = Company.objects.get_or_create(pk="2330")
        assert c.stock_id == "2330"
        time.sleep(0.5)  # to avoid reaching the rate limit

    def test_company_class_unknown_stock_id(self) -> None:
        with pytest.raises(UnknownStockIdError):
            c, is_new = Company.objects.get_or_create(pk="no_such_sid")
        time.sleep(0.5)  # to avoid reaching the rate limit
