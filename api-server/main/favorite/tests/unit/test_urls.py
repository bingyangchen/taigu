import pytest
from django.urls import Resolver404, resolve

from main.favorite import views


class TestFavoriteUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        url_patterns = [
            ("/api/favorites/", views.list_favorites),
            ("/api/favorites", views.list_favorites),
            ("/api/favorites/2330/", views.create_or_delete_favorite),
            ("/api/favorites/2330", views.create_or_delete_favorite),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_old_memo_urls_do_not_resolve(self) -> None:
        with pytest.raises(Resolver404):
            resolve("/api/memo/favorites/")

        with pytest.raises(Resolver404):
            resolve("/api/memo/favorite/2330/")

        with pytest.raises(Resolver404):
            resolve("/api/favorite/2330/")

    def test_url_patterns_regex_format(self) -> None:
        from main.favorite.urls import urlpatterns

        expected_patterns = [
            r"^$",
            r"^(?P<sid>\w+)[/]?$",
        ]

        actual_patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                actual_patterns.append(pattern.pattern._regex)

        assert sorted(actual_patterns) == sorted(expected_patterns)
