import pytest
from django.urls import Resolver404, resolve

from main.trade_plan import views


class TestTradePlanUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        url_patterns = [
            ("/api/trade-plans/", views.create_or_list_trade_plans),
            ("/api/trade-plans", views.create_or_list_trade_plans),
            ("/api/trade-plans/123/", views.update_or_delete_trade_plan),
            ("/api/trade-plans/123", views.update_or_delete_trade_plan),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_old_memo_urls_do_not_resolve(self) -> None:
        with pytest.raises(Resolver404):
            resolve("/api/memo/trade-plans/")

        with pytest.raises(Resolver404):
            resolve("/api/memo/trade-plan/123/")

        with pytest.raises(Resolver404):
            resolve("/api/trade-plan/")

        with pytest.raises(Resolver404):
            resolve("/api/trade-plan/123/")

    def test_url_patterns_regex_format(self) -> None:
        from main.trade_plan.urls import urlpatterns

        expected_patterns = [
            r"^$",
            r"^(?P<id>\w+)[/]?$",
        ]

        actual_patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                actual_patterns.append(pattern.pattern._regex)

        assert sorted(actual_patterns) == sorted(expected_patterns)
