import pytest
from django.urls import Resolver404, resolve

from main.market import views


class TestMarketUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        url_patterns = [
            ("/api/market/market-index/", views.market_index),
            ("/api/market/current-stock-info/", views.current_stock_info),
            ("/api/market/historical-prices/2330/", views.historical_prices),
            ("/api/market/search/", views.search),
            ("/api/market/company-names/", views.company_names),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_old_stock_url_does_not_resolve(self) -> None:
        with pytest.raises(Resolver404):
            resolve("/api/stock/market-index/")
