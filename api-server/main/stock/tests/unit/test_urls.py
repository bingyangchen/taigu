import pytest
from django.urls import Resolver404, resolve

from main.stock.views import cash_dividend_record, stock_info, trade_record


class TestStockUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        """Test that all URL patterns resolve to the correct view functions."""
        url_patterns = [
            ("/api/stock/market-index/", stock_info.market_index),
            ("/api/stock/market-index", stock_info.market_index),
            ("/api/stock/current-stock-info/", stock_info.current_stock_info),
            ("/api/stock/current-stock-info", stock_info.current_stock_info),
            ("/api/stock/historical-prices/1234/", stock_info.historical_prices),
            ("/api/stock/historical-prices/1234", stock_info.historical_prices),
            ("/api/stock/search/", stock_info.search),
            ("/api/stock/search", stock_info.search),
            ("/api/stock/trade-records/", trade_record.list),
            ("/api/stock/trade-records", trade_record.list),
            ("/api/stock/trade-record/", trade_record.create),
            ("/api/stock/trade-record", trade_record.create),
            ("/api/stock/trade-records/123/", trade_record.update_or_delete),
            ("/api/stock/trade-records/123", trade_record.update_or_delete),
            ("/api/stock/cash-dividends/", cash_dividend_record.list),
            ("/api/stock/cash-dividends", cash_dividend_record.list),
            ("/api/stock/cash-dividend/", cash_dividend_record.create),
            ("/api/stock/cash-dividend", cash_dividend_record.create),
            ("/api/stock/cash-dividend/456/", cash_dividend_record.update_or_delete),
            ("/api/stock/cash-dividend/456", cash_dividend_record.update_or_delete),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_url_patterns_configuration(self) -> None:
        """Test that URL patterns are configured correctly with expected count and no duplicates."""
        from main.stock.urls import urlpatterns

        # Should have exactly 10 active patterns
        assert len(urlpatterns) == 10

        # Check for duplicate patterns
        patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                patterns.append(pattern.pattern._regex)

        assert len(patterns) == len(set(patterns))

    def test_url_patterns_regex_format(self) -> None:
        """Test that URL patterns use the expected regex format."""
        from main.stock.urls import urlpatterns

        expected_patterns = [
            r"^market-index[/]?$",
            r"^current-stock-info[/]?$",
            r"^historical-prices/(?P<sid>\w+)[/]?$",
            r"^search[/]?$",
            r"^trade-records[/]?$",
            r"^trade-record[/]?$",
            r"^trade-records/(?P<id>\w+)[/]?$",
            r"^cash-dividends[/]?$",
            r"^cash-dividend[/]?$",
            r"^cash-dividend/(?P<id>\w+)[/]?$",
        ]

        actual_patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                actual_patterns.append(pattern.pattern._regex)

        # Sort both lists for comparison
        expected_patterns.sort()
        actual_patterns.sort()

        assert actual_patterns == expected_patterns

    def test_url_patterns_case_sensitivity(self) -> None:
        """Test that URLs are case sensitive as expected."""
        url = "/api/stock/market-index/"

        # Should not match with different case
        with pytest.raises(Resolver404):
            resolve(url.upper())

    def test_invalid_urls_raise_resolver404(self) -> None:
        """Test that invalid URLs properly raise Resolver404."""
        # Test non-existent URL
        with pytest.raises(Resolver404):
            resolve("/api/stock/non-existent-url/")

        # Test invalid historical prices URL (missing sid)
        with pytest.raises(Resolver404):
            resolve("/api/stock/historical-prices/")

        # Test invalid trade record URL (missing id)
        with pytest.raises(Resolver404):
            resolve("/api/stock/trade-records//")

        # Test invalid cash dividend URL (missing id)
        with pytest.raises(Resolver404):
            resolve("/api/stock/cash-dividend//")

    def test_regex_patterns_specificity(self) -> None:
        """Test that similar URLs don't conflict."""
        # These should resolve to different views
        trade_records_list = resolve("/api/stock/trade-records/")
        trade_record_create = resolve("/api/stock/trade-record/")
        trade_record_update = resolve("/api/stock/trade-records/123/")

        assert trade_records_list.func == trade_record.list
        assert trade_record_create.func == trade_record.create
        assert trade_record_update.func == trade_record.update_or_delete
