import pytest
from django.urls import Resolver404, resolve

from main.stock.views import cash_dividend_record, stock_info, trade_record


class TestStockUrls:
    def test_market_index_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/market-index/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == stock_info.market_index

        # Test without trailing slash
        url_without_slash = "/api/stock/market-index"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == stock_info.market_index

    def test_current_stock_info_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/current-stock-info/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == stock_info.current_stock_info

        # Test without trailing slash
        url_without_slash = "/api/stock/current-stock-info"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == stock_info.current_stock_info

    def test_historical_prices_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/historical-prices/1234/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == stock_info.historical_prices
        assert resolver_with_slash.kwargs == {"sid": "1234"}

        # Test without trailing slash
        url_without_slash = "/api/stock/historical-prices/1234"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == stock_info.historical_prices
        assert resolver_without_slash.kwargs == {"sid": "1234"}

    def test_historical_prices_url_pattern_with_alphanumeric_sid(self) -> None:
        # Test with alphanumeric stock ID
        url = "/api/stock/historical-prices/ABC123/"
        resolver = resolve(url)
        assert resolver.func == stock_info.historical_prices
        assert resolver.kwargs == {"sid": "ABC123"}

    def test_historical_prices_url_pattern_with_numeric_sid(self) -> None:
        # Test with numeric stock ID
        url = "/api/stock/historical-prices/5678/"
        resolver = resolve(url)
        assert resolver.func == stock_info.historical_prices
        assert resolver.kwargs == {"sid": "5678"}

    def test_search_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/search/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == stock_info.search

        # Test without trailing slash
        url_without_slash = "/api/stock/search"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == stock_info.search

    def test_trade_records_list_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/trade-records/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == trade_record.list

        # Test without trailing slash
        url_without_slash = "/api/stock/trade-records"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == trade_record.list

    def test_trade_record_create_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/trade-record/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == trade_record.create

        # Test without trailing slash
        url_without_slash = "/api/stock/trade-record"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == trade_record.create

    def test_trade_record_update_or_delete_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/trade-records/123/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == trade_record.update_or_delete
        assert resolver_with_slash.kwargs == {"id": "123"}

        # Test without trailing slash
        url_without_slash = "/api/stock/trade-records/123"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == trade_record.update_or_delete
        assert resolver_without_slash.kwargs == {"id": "123"}

    def test_trade_record_update_or_delete_url_pattern_with_alphanumeric_id(
        self,
    ) -> None:
        # Test with alphanumeric ID
        url = "/api/stock/trade-records/ABC123/"
        resolver = resolve(url)
        assert resolver.func == trade_record.update_or_delete
        assert resolver.kwargs == {"id": "ABC123"}

    def test_cash_dividends_list_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/cash-dividends/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == cash_dividend_record.list

        # Test without trailing slash
        url_without_slash = "/api/stock/cash-dividends"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == cash_dividend_record.list

    def test_cash_dividend_create_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/cash-dividend/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == cash_dividend_record.create

        # Test without trailing slash
        url_without_slash = "/api/stock/cash-dividend"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == cash_dividend_record.create

    def test_cash_dividend_update_or_delete_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/stock/cash-dividend/456/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == cash_dividend_record.update_or_delete
        assert resolver_with_slash.kwargs == {"id": "456"}

        # Test without trailing slash
        url_without_slash = "/api/stock/cash-dividend/456"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == cash_dividend_record.update_or_delete
        assert resolver_without_slash.kwargs == {"id": "456"}

    def test_cash_dividend_update_or_delete_url_pattern_with_alphanumeric_id(
        self,
    ) -> None:
        # Test with alphanumeric ID
        url = "/api/stock/cash-dividend/XYZ789/"
        resolver = resolve(url)
        assert resolver.func == cash_dividend_record.update_or_delete
        assert resolver.kwargs == {"id": "XYZ789"}

    def test_invalid_urls_raise_resolver404(self) -> None:
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
        # Test that similar URLs don't conflict

        # These should resolve to different views
        trade_records_list = resolve("/api/stock/trade-records/")
        trade_record_create = resolve("/api/stock/trade-record/")
        trade_record_update = resolve("/api/stock/trade-records/123/")

        assert trade_records_list.func == trade_record.list
        assert trade_record_create.func == trade_record.create
        assert trade_record_update.func == trade_record.update_or_delete

    def test_url_pattern_case_sensitivity(self) -> None:
        # URLs should be case sensitive for stock IDs
        url_lowercase = "/api/stock/historical-prices/abcd/"
        url_uppercase = "/api/stock/historical-prices/ABCD/"

        resolver_lowercase = resolve(url_lowercase)
        resolver_uppercase = resolve(url_uppercase)

        assert resolver_lowercase.kwargs == {"sid": "abcd"}
        assert resolver_uppercase.kwargs == {"sid": "ABCD"}

    def test_special_characters_in_stock_id(self) -> None:
        # Test stock ID with underscore (should work with \w+)
        url = "/api/stock/historical-prices/TEST_123/"
        resolver = resolve(url)
        assert resolver.kwargs == {"sid": "TEST_123"}

    def test_url_patterns_with_numbers_only(self) -> None:
        # Test pure numeric IDs
        historical_url = "/api/stock/historical-prices/1234567890/"
        trade_record_url = "/api/stock/trade-records/9876543210/"
        cash_dividend_url = "/api/stock/cash-dividend/1111111111/"

        historical_resolver = resolve(historical_url)
        trade_record_resolver = resolve(trade_record_url)
        cash_dividend_resolver = resolve(cash_dividend_url)

        assert historical_resolver.kwargs == {"sid": "1234567890"}
        assert trade_record_resolver.kwargs == {"id": "9876543210"}
        assert cash_dividend_resolver.kwargs == {"id": "1111111111"}

    def test_empty_path_components_fail(self) -> None:
        # Test that empty path components don't match
        with pytest.raises(Resolver404):
            resolve("/api/stock/historical-prices//")

        with pytest.raises(Resolver404):
            resolve("/api/stock/trade-records//")

        with pytest.raises(Resolver404):
            resolve("/api/stock/cash-dividend//")

    def test_url_resolution_consistency(self) -> None:
        # Test that the same URL always resolves to the same view
        url = "/api/stock/market-index/"

        resolver1 = resolve(url)
        resolver2 = resolve(url)

        assert resolver1.func == resolver2.func
        assert resolver1.func == stock_info.market_index
