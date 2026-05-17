import pytest
from django.urls import Resolver404, resolve

from main.trade_record import views


class TestTradeRecordUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        url_patterns = [
            ("/api/trade-records/", views.create_or_list),
            ("/api/trade-records", views.create_or_list),
            ("/api/trade-records/123/", views.update_or_delete),
            ("/api/trade-records/123", views.update_or_delete),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_old_stock_url_does_not_resolve(self) -> None:
        with pytest.raises(Resolver404):
            resolve("/api/stock/trade-records/")
