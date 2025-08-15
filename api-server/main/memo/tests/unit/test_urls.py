import pytest
from django.urls import Resolver404, resolve

from main.memo import views


class TestMemoUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        """Test that all URL patterns resolve to the correct view functions."""
        url_patterns = [
            ("/api/memo/stock-memo/2330/", views.update_or_create_stock_memo),
            ("/api/memo/stock-memo/2330", views.update_or_create_stock_memo),
            ("/api/memo/company-info/", views.list_company_info),
            ("/api/memo/company-info", views.list_company_info),
            ("/api/memo/trade-plans/", views.list_trade_plans),
            ("/api/memo/trade-plans", views.list_trade_plans),
            ("/api/memo/trade-plan/", views.create_trade_plan),
            ("/api/memo/trade-plan", views.create_trade_plan),
            ("/api/memo/trade-plan/123/", views.update_or_delete_trade_plan),
            ("/api/memo/trade-plan/123", views.update_or_delete_trade_plan),
            ("/api/memo/favorites/", views.list_favorites),
            ("/api/memo/favorites", views.list_favorites),
            ("/api/memo/favorite/2330/", views.create_or_delete_favorite),
            ("/api/memo/favorite/2330", views.create_or_delete_favorite),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_url_patterns_configuration(self) -> None:
        """Test that URL patterns are configured correctly with expected count and no duplicates."""
        from main.memo.urls import urlpatterns

        # Should have exactly 7 active patterns
        assert len(urlpatterns) == 7

        # Check for duplicate patterns
        patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                patterns.append(pattern.pattern._regex)

        assert len(patterns) == len(set(patterns))

    def test_url_patterns_regex_format(self) -> None:
        """Test that URL patterns use the expected regex format."""
        from main.memo.urls import urlpatterns

        expected_patterns = [
            r"^stock-memo/(?P<sid>\w+)[/]?$",
            r"^company-info[/]?$",
            r"^trade-plans[/]?$",
            r"^trade-plan[/]?$",
            r"^trade-plan/(?P<id>\w+)[/]?$",
            r"^favorites[/]?$",
            r"^favorite/(?P<sid>\w+)[/]?$",
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
        url = "/api/memo/stock-memo/2330/"

        # Should not match with different case
        with pytest.raises(Resolver404):
            resolve(url.upper())

    def test_url_parameter_extraction(self) -> None:
        """Test that URL parameters are correctly extracted."""
        # Test stock-memo with stock ID parameter
        url = "/api/memo/stock-memo/2330/"
        resolver = resolve(url)
        assert resolver.kwargs["sid"] == "2330"

        # Test trade-plan with ID parameter
        url2 = "/api/memo/trade-plan/123/"
        resolver2 = resolve(url2)
        assert resolver2.kwargs["id"] == "123"

        # Test favorite with stock ID parameter
        url3 = "/api/memo/favorite/2317/"
        resolver3 = resolve(url3)
        assert resolver3.kwargs["sid"] == "2317"
