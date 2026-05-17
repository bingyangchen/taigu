import pytest
from django.urls import Resolver404, resolve

from main.stock_memo import views


class TestStockMemoUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        url_patterns = [
            ("/api/stock-memo/2330/", views.update_or_create_stock_memo),
            ("/api/stock-memo/2330", views.update_or_create_stock_memo),
            ("/api/stock-memo/company-info/", views.list_company_info),
            ("/api/stock-memo/company-info", views.list_company_info),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_old_memo_urls_do_not_resolve(self) -> None:
        with pytest.raises(Resolver404):
            resolve("/api/memo/stock-memo/2330/")

        with pytest.raises(Resolver404):
            resolve("/api/memo/company-info/")
