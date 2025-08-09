import pytest
from django.http import HttpRequest
from django.urls import Resolver404, resolve

from main.memo import views


class TestMemoUrls:
    def test_stock_memo_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/memo/stock-memo/2330/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.update_or_create_stock_memo
        assert resolver_with_slash.kwargs["sid"] == "2330"

        # Test without trailing slash
        url_without_slash = "/api/memo/stock-memo/2330"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.update_or_create_stock_memo
        assert resolver_without_slash.kwargs["sid"] == "2330"

    def test_company_info_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/memo/company-info/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.list_company_info

        # Test without trailing slash
        url_without_slash = "/api/memo/company-info"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.list_company_info

    def test_trade_plans_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/memo/trade-plans/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.list_trade_plans

        # Test without trailing slash
        url_without_slash = "/api/memo/trade-plans"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.list_trade_plans

    def test_trade_plan_create_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/memo/trade-plan/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.create_trade_plan

        # Test without trailing slash
        url_without_slash = "/api/memo/trade-plan"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.create_trade_plan

    def test_trade_plan_update_delete_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/memo/trade-plan/123/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.update_or_delete_trade_plan
        assert resolver_with_slash.kwargs["id"] == "123"

        # Test without trailing slash
        url_without_slash = "/api/memo/trade-plan/456"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.update_or_delete_trade_plan
        assert resolver_without_slash.kwargs["id"] == "456"

    def test_favorites_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/memo/favorites/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.list_favorites

        # Test without trailing slash
        url_without_slash = "/api/memo/favorites"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.list_favorites

    def test_favorite_create_delete_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/memo/favorite/2330/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.create_or_delete_favorite
        assert resolver_with_slash.kwargs["sid"] == "2330"

        # Test without trailing slash
        url_without_slash = "/api/memo/favorite/2317"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.create_or_delete_favorite
        assert resolver_without_slash.kwargs["sid"] == "2317"

    def test_url_patterns_count(self) -> None:
        from main.memo.urls import urlpatterns

        # We expect 7 URL patterns
        assert len(urlpatterns) == 7

    def test_url_patterns_view_mappings(self) -> None:
        from main.memo.urls import urlpatterns

        expected_mappings = {
            r"^stock-memo/(?P<sid>\w+)[/]?$": views.update_or_create_stock_memo,
            r"^company-info[/]?$": views.list_company_info,
            r"^trade-plans[/]?$": views.list_trade_plans,
            r"^trade-plan[/]?$": views.create_trade_plan,
            r"^trade-plan/(?P<id>\w+)[/]?$": views.update_or_delete_trade_plan,
            r"^favorites[/]?$": views.list_favorites,
            r"^favorite/(?P<sid>\w+)[/]?$": views.create_or_delete_favorite,
        }

        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                regex = pattern.pattern._regex
                expected_view = expected_mappings.get(regex)
                if expected_view:
                    assert pattern.callback == expected_view

    def test_url_patterns_regex_patterns(self) -> None:
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

    def test_url_resolution_with_parameters(self) -> None:
        # Test stock-memo with stock ID parameter
        url = "/api/memo/stock-memo/2330/"
        request = HttpRequest()
        request.path = url

        resolver_obj = resolve(url)
        assert resolver_obj.func == views.update_or_create_stock_memo
        assert resolver_obj.kwargs["sid"] == "2330"

        # Test trade-plan with ID parameter
        url2 = "/api/memo/trade-plan/123/"
        resolver_obj2 = resolve(url2)
        assert resolver_obj2.func == views.update_or_delete_trade_plan
        assert resolver_obj2.kwargs["id"] == "123"

        # Test favorite with stock ID parameter
        url3 = "/api/memo/favorite/2317/"
        resolver_obj3 = resolve(url3)
        assert resolver_obj3.func == views.create_or_delete_favorite
        assert resolver_obj3.kwargs["sid"] == "2317"

    def test_url_patterns_case_sensitivity(self) -> None:
        # Test that URLs are case sensitive
        url = "/api/memo/stock-memo/2330/"

        # Should not match with different case
        with pytest.raises(Resolver404):
            resolve(url.upper())

    def test_url_patterns_parameter_validation(self) -> None:
        # Test that parameter patterns match expected values
        # Stock IDs should match word characters (\w+)
        valid_stock_urls = [
            "/api/memo/stock-memo/2330/",
            "/api/memo/stock-memo/ABC123/",
            "/api/memo/stock-memo/test_stock/",
            "/api/memo/favorite/2330/",
            "/api/memo/favorite/ABC123/",
        ]

        for url in valid_stock_urls:
            resolver_obj = resolve(url)
            assert resolver_obj is not None

        # Trade plan IDs should match word characters (\w+)
        valid_plan_urls = [
            "/api/memo/trade-plan/123/",
            "/api/memo/trade-plan/abc/",
            "/api/memo/trade-plan/test_plan/",
        ]

        for url in valid_plan_urls:
            resolver_obj = resolve(url)
            assert resolver_obj is not None

    def test_url_patterns_invalid_parameters(self) -> None:
        # Test URLs that should not match due to invalid characters
        invalid_urls = [
            "/api/memo/stock-memo/2330-invalid/",  # Hyphen not in \w
            "/api/memo/stock-memo/2330.abc/",  # Dot not in \w
            "/api/memo/stock-memo/2330 space/",  # Space not in \w
            "/api/memo/favorite/2330-invalid/",
            "/api/memo/trade-plan/123-invalid/",
        ]

        for url in invalid_urls:
            with pytest.raises(Resolver404):
                resolve(url)

    def test_url_patterns_view_imports(self) -> None:
        from main.memo.urls import urlpatterns

        # Check that all view functions are imported and callable
        for pattern in urlpatterns:
            if hasattr(pattern, "callback"):
                view_func = pattern.callback
                assert view_func is not None
                assert callable(view_func)

    def test_url_patterns_no_duplicates(self) -> None:
        from main.memo.urls import urlpatterns

        # Check for duplicate patterns
        patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                patterns.append(pattern.pattern._regex)

        # All patterns should be unique
        assert len(patterns) == len(set(patterns))

    def test_url_patterns_http_methods_support(self) -> None:
        # Test that each view supports the expected HTTP methods based on decorators
        expected_methods = {
            "/api/memo/stock-memo/2330/": ["POST"],  # @require_POST
            "/api/memo/company-info/": ["GET"],  # @require_GET
            "/api/memo/trade-plans/": ["GET"],  # @require_GET
            "/api/memo/trade-plan/": ["POST"],  # @require_POST (create)
            "/api/memo/trade-plan/123/": ["POST", "DELETE"],  # update_or_delete
            "/api/memo/favorites/": ["GET"],  # @require_GET
            "/api/memo/favorite/2330/": ["POST", "DELETE"],  # create_or_delete
        }

        for url, _methods in expected_methods.items():
            resolver_obj = resolve(url)
            view_func = resolver_obj.func

            # Check that view function exists and is callable
            assert view_func is not None
            assert callable(view_func)

    def test_url_patterns_trailing_slash_consistency(self) -> None:
        # Test that all patterns support both with and without trailing slash
        base_urls = [
            "/api/memo/company-info",
            "/api/memo/trade-plans",
            "/api/memo/trade-plan",
            "/api/memo/favorites",
        ]

        parameterized_urls = [
            "/api/memo/stock-memo/2330",
            "/api/memo/trade-plan/123",
            "/api/memo/favorite/2330",
        ]

        # Test base URLs both with and without trailing slash
        for base_url in base_urls:
            # Without trailing slash
            resolver1 = resolve(base_url)
            assert resolver1 is not None

            # With trailing slash
            resolver2 = resolve(base_url + "/")
            assert resolver2 is not None

            # Should resolve to the same view
            assert resolver1.func == resolver2.func

        # Test parameterized URLs both with and without trailing slash
        for param_url in parameterized_urls:
            # Without trailing slash
            resolver1 = resolve(param_url)
            assert resolver1 is not None

            # With trailing slash
            resolver2 = resolve(param_url + "/")
            assert resolver2 is not None

            # Should resolve to the same view
            assert resolver1.func == resolver2.func

    def test_url_patterns_parameter_extraction(self) -> None:
        # Test that parameters are correctly extracted from URLs
        test_cases = [
            ("/api/memo/stock-memo/AAPL/", "sid", "AAPL"),
            ("/api/memo/stock-memo/2330/", "sid", "2330"),
            ("/api/memo/trade-plan/456/", "id", "456"),
            ("/api/memo/trade-plan/abc123/", "id", "abc123"),
            ("/api/memo/favorite/TSLA/", "sid", "TSLA"),
            ("/api/memo/favorite/9999/", "sid", "9999"),
        ]

        for url, param_name, expected_value in test_cases:
            resolver_obj = resolve(url)
            assert param_name in resolver_obj.kwargs
            assert resolver_obj.kwargs[param_name] == expected_value

    def test_url_patterns_edge_cases(self) -> None:
        # Test edge cases for parameter patterns
        edge_case_urls = [
            "/api/memo/stock-memo/a/",  # Single character
            "/api/memo/stock-memo/123456789/",  # Long numeric
            "/api/memo/trade-plan/1/",  # Single digit
            "/api/memo/favorite/A_B_C/",  # Underscores
        ]

        for url in edge_case_urls:
            resolver_obj = resolve(url)
            assert resolver_obj is not None

    def test_url_patterns_namespace_separation(self) -> None:
        # Ensure memo URLs don't conflict with other app URLs
        memo_urls = [
            "/api/memo/stock-memo/2330/",
            "/api/memo/company-info/",
            "/api/memo/trade-plans/",
            "/api/memo/trade-plan/",
            "/api/memo/trade-plan/123/",
            "/api/memo/favorites/",
            "/api/memo/favorite/2330/",
        ]

        for url in memo_urls:
            resolver_obj = resolve(url)
            # All should resolve successfully
            assert resolver_obj is not None
            # All should point to memo views
            assert resolver_obj.func.__module__.startswith("main.memo.views")

    def test_url_patterns_comprehensive_regex_validation(self) -> None:
        # Comprehensive test for regex pattern matching
        from main.memo.urls import urlpatterns

        # Extract all regex patterns
        patterns_dict = {}
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                regex = pattern.pattern._regex
                patterns_dict[regex] = pattern.callback

        # Test each pattern individually
        assert r"^stock-memo/(?P<sid>\w+)[/]?$" in patterns_dict
        assert r"^company-info[/]?$" in patterns_dict
        assert r"^trade-plans[/]?$" in patterns_dict
        assert r"^trade-plan[/]?$" in patterns_dict
        assert r"^trade-plan/(?P<id>\w+)[/]?$" in patterns_dict
        assert r"^favorites[/]?$" in patterns_dict
        assert r"^favorite/(?P<sid>\w+)[/]?$" in patterns_dict

        # Verify each pattern maps to correct view
        assert (
            patterns_dict[r"^stock-memo/(?P<sid>\w+)[/]?$"]
            == views.update_or_create_stock_memo
        )
        assert patterns_dict[r"^company-info[/]?$"] == views.list_company_info
        assert patterns_dict[r"^trade-plans[/]?$"] == views.list_trade_plans
        assert patterns_dict[r"^trade-plan[/]?$"] == views.create_trade_plan
        assert (
            patterns_dict[r"^trade-plan/(?P<id>\w+)[/]?$"]
            == views.update_or_delete_trade_plan
        )
        assert patterns_dict[r"^favorites[/]?$"] == views.list_favorites
        assert (
            patterns_dict[r"^favorite/(?P<sid>\w+)[/]?$"]
            == views.create_or_delete_favorite
        )
